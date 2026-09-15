import { Injectable } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { WebSocketServer } from 'ws';

import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import path from 'path';

import { ImageControlModule } from '../../modules/image-control.module';

import { PrismaService } from '../../../prisma/prisma.service';
import { AppService } from '../../app.service';
import { AdminPanelService } from '../admin-panel/admin-panel.service';
import { ImageControlService } from '../image-control/image-control.service';

import { IImageAdditionalData } from '@photographer-project/types';
import { ICurrentAdminImageData, IPercentUploadedOptions, IWSMessage, IWebSocketClient } from '@photographer-project/types';

@Injectable()
export class WebSocketService {
    public webSocketServerPort: number = parseInt(process.env['WEBSOCKETSERVER_PORT'] as string, 10);

    private _webSocketClients: IWebSocketClient[] = [];

    @OnEvent('compressNewImageStatus.changed')
    async handleCompressNewImageStatusChange(payload: { oldCompressStatus: string; newCompressStatus: string, currentWebSocketClient: IWebSocketClient }): Promise<void> {
        const newCompressImageName: string = `${ path.basename(payload.currentWebSocketClient.imagePath, path.extname(payload.currentWebSocketClient.imagePath)) }_thumb.webp`;
        const outputImagePath: string = path.join(this._appService.clientCompressedImagesDir, newCompressImageName);
        await fsPromises.unlink(outputImagePath);
        await this._prisma.admin.update({
            data: { compressedImages: { delete: { name: newCompressImageName }, } },
            where: { id: payload.currentWebSocketClient.activeAdminId }
        });

        payload.currentWebSocketClient.compressImageIsDone = false;
        payload.currentWebSocketClient.cancelUploadImageMessageIsReceived = false;
    }

    constructor (
        private readonly _eventEmitter: EventEmitter2,

        private readonly _prisma: PrismaService,
        
        private readonly _appService: AppService,
        private readonly _adminPanelService: AdminPanelService
    ) {
        const socketServer = new WebSocketServer({ port: this.webSocketServerPort });

        socketServer.on('connection', async ( connection, request ) => {
            const urlParts = ( request.url as string ).split('?');
            const firstURLPart: string[] = urlParts[0].split('/');
            const secondURLPart: string = decodeURIComponent(urlParts[1]);
            const webSocketClientId: number = parseFloat(firstURLPart[firstURLPart.length - 1].substring(2));
            const JSONCurrentAdminImageData: string = secondURLPart;

            if ( isNaN(webSocketClientId) ) {
                connection.terminate();

                return;
            }

            let parsedJSONCurrentAdminImageData: ICurrentAdminImageData | null = null;

            try {
                parsedJSONCurrentAdminImageData = JSON.parse(JSONCurrentAdminImageData);
            } catch {
                await this._closeConnection(webSocketClientId, true, "WebSocket");
            }

            const currentWebSocketClient: IWebSocketClient | undefined = this._webSocketClients.find(client => client._id === webSocketClientId);
            if ( currentWebSocketClient ) {
                connection.send(JSON.stringify(this._createMessage('uploadImage', 'ERROR')));
                connection.terminate();

                await this._appService.logLineAsync(
                    `${ process.env['SERVER_DOMAIN'] } [${ process.env['WEBSOCKETSERVER_PORT'] }] WebSocketClientId --- ${ webSocketClientId }, login --- -. Websocket error`,
                    true, 'webSocket'
                );

                return;
            }
                
            const newOriginalImagePath: string = path.join(this._appService.clientOriginalImagesDir, parsedJSONCurrentAdminImageData?.imageMeta.name as string);
            
            this._webSocketClients.push({
                _id: webSocketClientId,
                activeAdminId: parsedJSONCurrentAdminImageData?.currentAdminData.id as number,
                activeAdminLogin: parsedJSONCurrentAdminImageData?.currentAdminData.login as string,
                activeWriteStream: null,
                currentChunkNumber: 0,
                uploadedSize: 0,
                imageMetaName: parsedJSONCurrentAdminImageData?.imageMeta.name as string,
                imageMetaSize: parsedJSONCurrentAdminImageData?.imageMeta.size as number,
                imagePath: newOriginalImagePath,
                lastkeepalive: Date.now(),
                connection: null,
                imageAdditionalData: parsedJSONCurrentAdminImageData?.imageAdditionalData as IImageAdditionalData,
                compressImageIsDone: false,
                cancelUploadImageMessageIsReceived: false
            });

            const newWebSocketClient: IWebSocketClient = this._webSocketClients.find(client => client._id === webSocketClientId) as IWebSocketClient;

            const checkActiveWebSocketClientsCountResult: string | null = this._checkActiveWebSocketClientsCount();
            if ( checkActiveWebSocketClientsCountResult !== null ) newWebSocketClient.cancelUploadImageMessageIsReceived = true;

            const writeStream: fs.WriteStream = fs.createWriteStream(newWebSocketClient.imagePath);
            writeStream.on('error', async () => await this._closeConnection(webSocketClientId, true, 'Stream'));
            writeStream.on('finish', async () => {
                const currentWebSockeClient: IWebSocketClient = this._webSocketClients.find(client => client._id === webSocketClientId) as IWebSocketClient;
                if ( currentWebSockeClient ) {
                    await this._appService.logLineAsync(
                        `${ process.env['SERVER_DOMAIN'] } [${ process.env['WEBSOCKETSERVER_PORT'] }] 
                        WebSocketClientId --- ${ webSocketClientId }, login --- ${ currentWebSockeClient.activeAdminLogin }. All chunks writed, overall size --> ${ currentWebSockeClient.uploadedSize }. Image ${ newWebSocketClient.imageMetaName } uploaded`, 
                        false, 'webSocket'
                    );

                    const imageControlServiceRef: ImageControlService = await this._appService.getServiceRef(ImageControlModule, ImageControlService);
                    const compressImageResult: boolean = await imageControlServiceRef.compressImage(currentWebSockeClient.activeAdminId, {
                        inputImagePath: newWebSocketClient.imagePath, 
                        outputDirPath: this._appService.clientCompressedImagesDir,
                        originalImageSize: newWebSocketClient.imageMetaSize, 
                        imageAdditionalData: currentWebSockeClient.imageAdditionalData
                    });
        
                    if ( !compressImageResult ) await this._closeConnection(webSocketClientId, true, 'CompressImage');
                    else {
                        if ( newWebSocketClient.cancelUploadImageMessageIsReceived ) this._setCompressNewImageIsDoneStatus(true, currentWebSockeClient, currentWebSockeClient.activeAdminId, currentWebSockeClient.imagePath, this._appService.clientCompressedImagesDir);

                        const successMessage: IWSMessage = this._createMessage('uploadImage', 'FINISH', { 
                            uploadedSize: currentWebSockeClient.uploadedSize, 
                            imageMetaSize: newWebSocketClient.imageMetaSize
                        });

                        currentWebSockeClient.connection?.send(JSON.stringify(successMessage));

                        await this._closeConnection(newWebSocketClient._id);
                    }
                }
            });

            newWebSocketClient.activeWriteStream = writeStream;
            newWebSocketClient.connection = connection;

            let timer: number = 0;

            const timeoutInterval = setInterval(async () => {
                timer++;
            
                try {
                    if ( ( Date.now() - newWebSocketClient.lastkeepalive ) > 10000 ) {
                        await this._closeConnection(newWebSocketClient._id, true, 'WebSocket');

                        clearInterval(timeoutInterval);
                    } else if ( newWebSocketClient.connection ) {
                        const message: IWSMessage = this._createMessage('timer', 'timer= ' + timer);
                
                        newWebSocketClient.connection.send(JSON.stringify(message));
                    }
                } catch {
                    this._appService.logLineAsync(`${ process.env['SERVER_DOMAIN'] } [${ this.webSocketServerPort }] WebSocket error`, true, 'webSocket');
                }
            }, 3000);

            await this._appService.logLineAsync(`${ process.env['SERVER_DOMAIN'] } [${ this.webSocketServerPort }] New connection established. WebSocketClientId --- ${ webSocketClientId }, login --- ${ newWebSocketClient.activeAdminLogin }`, false, 'webSocket');
                
            connection.on('message', async ( data, isBinary ) => {
                const currentWebSocketClient: IWebSocketClient | undefined = this._webSocketClients.find(client => client._id === webSocketClientId);
                if ( currentWebSocketClient ) await this._connectionOnMessageHandler(currentWebSocketClient, webSocketClientId, data, isBinary);
            });

            connection.on('close', async () => {
                const currentWebSocketClient: IWebSocketClient | undefined = this._webSocketClients.find(client => client._id === webSocketClientId);
                if ( currentWebSocketClient ) {
                    if ( currentWebSocketClient.cancelUploadImageMessageIsReceived || currentWebSocketClient.uploadedSize < currentWebSocketClient.imageMetaSize ) {
                        await this._closeConnection(currentWebSocketClient._id);
                    } // else if ( currentWebSocketClient.uploadedSize < currentWebSocketClient.imageMetaSize ) await this._closeConnection(currentWebSocketClient._id);
                }

                clearInterval(timeoutInterval);
            });

            connection.on('error', async () => {
                const currentWebSocketClient: IWebSocketClient | undefined = this._webSocketClients.find(client => client._id === webSocketClientId);

                if ( currentWebSocketClient ) await this._closeConnection(currentWebSocketClient._id, true, 'WebSocket');
            });

            const readyMessage: IWSMessage = this._createMessage('info', 'Ready');
            newWebSocketClient.connection.send(JSON.stringify(readyMessage));
        });

        this._appService.logLineAsync(`${ process.env['SERVER_DOMAIN'] } Socket server running on port ${ this.webSocketServerPort }`, false, 'server');
    }
    /**
        * Set compressing new image status is done .
        * 
        * @param newCompressStatus New compress status.
        * @param currentWebSocketClient Current webSocket client data.
        * @param activeAdminId Current admin id.
        * @param newImageOriginalPath New image original path in file system.
        * @param newImageCompressPath New image compress path in file system.
    */
    private _setCompressNewImageIsDoneStatus (newCompressStatus: boolean, currentWebSocketClient: IWebSocketClient, activeAdminId: number, newImageOriginalPath: string, newImageCompressPath: string): void {
        const oldValue = currentWebSocketClient.compressImageIsDone;
        currentWebSocketClient.compressImageIsDone = newCompressStatus;

        this._eventEmitter.emit('compressNewImageStatus.changed', {
            oldValue,
            newCompressStatus,
            currentWebSocketClient,
            activeAdminId,
            newImageOriginalPath,
            newImageCompressPath
        });
    }

    /**
        * Message from webSocket client handler function.
        * 
        * @param currentWebSocketClient Current webSocket client data.
        * @param webSocketClientId WebSocket client id from connection URL.
        * @param data Data from webSocket client.
        * @param isBinary Data is binary.
    */
    private async _connectionOnMessageHandler (currentWebSocketClient: IWebSocketClient, webSocketClientId: number, data: any, isBinary: boolean): Promise<void> {
        if ( currentWebSocketClient.cancelUploadImageMessageIsReceived === true ) {
            const warningMessage: IWSMessage = this._createMessage('uploadImage', 'PENDING');
            currentWebSocketClient.connection?.send(JSON.stringify(warningMessage));
        } else if ( isBinary ) {
            if ( currentWebSocketClient.connection !== null ) {
                const fileData: string | Buffer = data;

                if ( currentWebSocketClient.uploadedSize === 0 ) await this._appService.logLineAsync(`${ process.env['SERVER_DOMAIN'] } [${ this.webSocketServerPort }] WebSocketClientId --- ${ webSocketClientId }, 
                login --- ${ currentWebSocketClient.activeAdminLogin }. Upload file ${ currentWebSocketClient.imageMetaName }, size --- ${ currentWebSocketClient.imageMetaSize } is started`, false, 'webSocket');

                currentWebSocketClient.uploadedSize += fileData.length;

                currentWebSocketClient.activeWriteStream?.write(fileData, async () => {
                    const message: IWSMessage = this._createMessage('uploadImage', 'SUCCESS', { uploadedSize: currentWebSocketClient.uploadedSize, imageMetaSize: currentWebSocketClient.imageMetaSize });

                    await this._appService.logLineAsync(`${ process.env['SERVER_DOMAIN'] } [${ this.webSocketServerPort }] WebSocketClientId --- ${ webSocketClientId }, 
                    login --- ${ currentWebSocketClient.activeAdminLogin }. Chunk ${ currentWebSocketClient.currentChunkNumber } writed, size --> ${ fileData.length }`, false, 'webSocket');

                    currentWebSocketClient.currentChunkNumber += 1;
                    if ( currentWebSocketClient.uploadedSize === currentWebSocketClient.imageMetaSize ) currentWebSocketClient.activeWriteStream?.end();
                    else currentWebSocketClient.connection?.send(JSON.stringify(message));
                });
            }
        } else if ( data.toString() === "KEEP_ME_ALIVE" ) this._webSocketClients.forEach(client => client._id === webSocketClientId ? client.lastkeepalive = Date.now() : null);
        else if ( data.toString() === "CANCEL_UPLOAD" ) {
            if ( !currentWebSocketClient.cancelUploadImageMessageIsReceived ) {
                currentWebSocketClient.cancelUploadImageMessageIsReceived = true;

                await this._closeConnection(currentWebSocketClient._id, true, 'Cancel');
            } else await this._closeConnection(currentWebSocketClient._id, true, 'WebSocket');
        }
    }

    /**
        * Close webSocket connection.
        * 
        * @param webSocketClientId WebSocket client id from connection URL.
        * @param error Close connection with error.
        * @param errorType Connection error type.
    */
    private async _closeConnection (webSocketClientId: number, error = false, errorType?: 'WebSocket' | 'Stream' | 'Cancel' | 'CompressImage'): Promise<void> {
        const currentClient: IWebSocketClient | undefined = this._webSocketClients.find(client => client._id === webSocketClientId);
        if ( currentClient ) {
            if ( currentClient.connection !== null ) {
                if ( error ) {
                    let message: IWSMessage | null = null;

                    if ( errorType ) {
                        if ( errorType in [ 'WebSocket', 'Stream', 'CompressImage' ] ) message = this._createMessage('uploadImage', 'ERROR');
                        else if ( errorType === 'Cancel' ) {
                            message = this._createMessage('uploadImage', 'CANCEL_UPLOAD_DONE');
                        }

                        currentClient.connection.send(JSON.stringify(message));
                    }
                } else {
                    const newImageInfo: fs.Stats = await fsPromises.lstat(currentClient.imagePath);
                    if ( newImageInfo.size !== currentClient.imageMetaSize ) {
                        currentClient.activeWriteStream?.destroy();
                        await fsPromises.unlink(currentClient.imagePath);
                    }
                }

                currentClient.connection.terminate();
                currentClient.connection = null;

                await this._appService.logLineAsync(`${ process.env['SERVER_DOMAIN'] } [${ this.webSocketServerPort }] Connection close. WebSocketClientId --- ${ webSocketClientId }, login --- ${ currentClient.activeAdminLogin }`, false, 'webSocket');

                if ( error ) {
                    let errorMessage: string = '';

                    switch ( errorType ) {
                        case 'WebSocket': { errorMessage = 'Websocket error'; break; }
                        case 'Stream': { errorMessage = 'Stream error'; break; }
                        case 'Cancel': { errorMessage = 'Cancel error'; break; }
                        case 'CompressImage': { errorMessage = 'Compress Image error'; break; }
                    }

                    currentClient.activeWriteStream?.destroy();
                    await fsPromises.unlink(currentClient.imagePath);

                    this._webSocketClients = this._webSocketClients.filter(( client => client.connection !== null ));

                    await this._appService.logLineAsync(
                        `${ process.env['SERVER_DOMAIN'] } [${ process.env['WEBSOCKETSERVER_PORT'] }] WebSocketClientId --- ${ webSocketClientId }, login --- ${ currentClient.activeAdminLogin }. ${ errorMessage }`,
                        true, 'webSocket'
                    );
                } else this._webSocketClients = this._webSocketClients.filter(client => client._id !== currentClient._id);

                this._adminPanelService.previousActiveImageOperations.upload = false; // this._adminPanelService.previousUploadImageProcessIsActive = false;

                return;
            }
        }
    }

    /**
        * Create message for webSocket client.
        * 
        * @param   eventType Type of message.
        * @param   eventText Message text.
        * @param   percentUploadedOptions Data of currently uploaded image.
        * 
        * @returns WebSocket message.
    */
    private _createMessage (eventType: 'timer' | 'uploadImage' | 'info', eventText: string, percentUploadedOptions?: IPercentUploadedOptions): IWSMessage {
        const message: IWSMessage = {
            event: eventType,
            text: eventText
        }
    
        if ( percentUploadedOptions ) message.percentUploaded = Math.round((percentUploadedOptions.uploadedSize / percentUploadedOptions.imageMetaSize) * 100);
    
        return message;
    }
    /**
        * Check active web socket client count.
        * 
        * @returns 'PENDING' or null.
    */
    private _checkActiveWebSocketClientsCount (): 'PENDING' | null {
        let activeUploadsClientNumber: number = 0;
        this._webSocketClients.forEach(client => client.activeWriteStream !== null ? activeUploadsClientNumber += 1 : null);
        if ( activeUploadsClientNumber > 3 ) return 'PENDING';

        return null;
    }
}