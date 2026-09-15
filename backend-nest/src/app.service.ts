import { LazyModuleLoader } from '@nestjs/core';
import { DynamicModule, Injectable, Type } from '@nestjs/common';

import * as fs from 'fs';
import path, { join } from 'path';
import { EOL } from 'os';

import ms, { StringValue } from 'ms';

import { AdminPanelModule } from './modules/admin-panel.module';
import { ClientModule } from './modules/client.module';
import { ImageControlModule } from './modules/image-control.module';
import { SignModule } from './modules/sign.module';

import { AdminPanelService } from './services/admin-panel/admin-panel.service';
import { ClientService } from './services/client/client.service';
import { ImageControlService } from './services/image-control/image-control.service';
import { SignService } from './services/sign/sign.service';
import { JwtControlService } from './services/sign/jwt-control.service';
import { WebSocketService } from './services/web-socket/web-socket.service';

import { ICookieSerializeOptions } from '@photographer-project/types';

const NODE_ENV: string = process.env['NODE_ENV'] as string; //

@Injectable()
export class AppService {
    public promisesCache: { [ x: string ]: { pendingPromises: Promise<any>[], count: number } } = { };
    public adminPanelImageOperationKeys: string[] = [ 'deleteImage', 'resizeImageThumbnail', 'changeImageDisplayTargetRename', 'changeImageData', 'setPhotographyTypeImageUnlink', 'setPhotographyTypeImageCopy' ];
    
    constructor (
        private readonly _lazyModuleLoader: LazyModuleLoader
    ) { }

    public staticFilesDirPath: string = join(process.cwd(), '../frontend-angular', 'dist', 'frontend-angular', 'browser', 'assets');

    public serverLogFilePath: string = join(process.cwd(),'logs', '_server.log');
    public serverErrorFilePath: string = join(process.cwd(), 'logs', '_serverError.log');
    public httpLogFilePath: string = join(process.cwd(), 'logs', '_httpServer.log');
    public httpErrorLogFilePath: string = join(process.cwd(), 'logs', '_httpErrorServer.log');
    public webSocketLogFilePath: string = join(process.cwd(), 'logs', '_webSocketServer.log');
    public webSocketErrorLogFilePath: string = join(process.cwd(), 'logs', '_webSocketErrorServer.log');

    public cookieSerializeOptions: ICookieSerializeOptions = {
        httpOnly: true,
        maxAge: ms(process.env['COOKIE_MAXAGE_TIME'] as StringValue),
        sameSite: 'strict', // 'strict', // NODE_ENV === 'production' ? 'strict' : 'none',
        secure: NODE_ENV === 'production' ? true : false, // true,
        priority: 'high',
        signed: true //
    }

    public clientOriginalImagesDir: string = path.join(process.cwd(), 'files', 'originalImages');
    public clientCompressedImagesDir: string = path.join(process.cwd(), 'files', 'compressedImages');

    public supportedImageFileTypes: string[] = [ 'image/jpg', 'image/jpeg', 'image/png' ]; // [ 'jpg', 'png', 'webp', 'avif', 'gif', 'svg', 'tiff' 
    
    /**
        * Add and delete promises in cache.
        * 
        * @param   key Key of group pending promises.
        * @param   promise New pending promise.
        * 
        * @returns Done pending promise.
    */
    public async managePromisesCache (key: string, promise: Promise<any>): Promise<any> {
        if ( this.adminPanelImageOperationKeys.includes(key) ) {
            if ( !this.promisesCache[key] ) {
                this.promisesCache[key] = { 
                    pendingPromises: [],
                    count: 0
                }
            }

            if ( this.promisesCache[key].count <= 3 ) {
                const pendingPromise: Promise<any> = promise;

                this.promisesCache[key].pendingPromises.push(pendingPromise);
                this.promisesCache[key].count = this.promisesCache[key].count += 1;

                await pendingPromise;

                this.promisesCache[key].pendingPromises = this.promisesCache[key].pendingPromises.filter((_, index) => {
                    return index !== this.promisesCache[key].count - 1;
                });

                this.promisesCache[key].count = this.promisesCache[key].count -= 1;

                return pendingPromise;
            } else {
                const firstPendingPromise: Promise<any> = this.promisesCache[key].pendingPromises[this.promisesCache[key].count - 1];

                await firstPendingPromise;

                await this.managePromisesCache(key, promise);
            }
        }
    }

    /**
        * Write log line in file.
        * 
        * @param logLine Log line for write.
        * @param error Write to error log.
        * @param logType Log type.
    */
    public logLineAsync (logLine: string, error: boolean, logType: 'server' | 'http' | 'webSocket'): Promise<void> {
        return new Promise<void>( ( resolve, reject ) => {
            const logDT = new Date();

            const time: string = logDT.toLocaleDateString() + " " + logDT.toLocaleTimeString();
            const fullLogLine: string = time + " " + logLine;

            let logFilePath: string | null = null;

            switch ( logType ) {
                case 'server': { logFilePath = !error ? this.serverLogFilePath : this.serverErrorFilePath; break; }
                case 'http': { logFilePath = !error ? this.httpLogFilePath : this.httpErrorLogFilePath; break; }
                case 'webSocket': { logFilePath = !error ? this.webSocketLogFilePath : this.webSocketErrorLogFilePath; break; }
            }
        
            if ( !error ) console.info(fullLogLine);
            else console.error(fullLogLine);
        
            fs.open(logFilePath as string, 'a+', ( err, logFd ) => {
                if ( err ) reject(err);
                else fs.write(logFd, fullLogLine + EOL, err => {
                    if ( err ) reject(err); 
                    else fs.close(logFd, err =>{
                        if ( err ) reject(err);
                        else resolve();
                    });
                });
            });
        });
    }

    /**
        * Lazy load service.
        *
        * @param   module   Module contains service.
        * @param   service  Service for load.
        * 
        * @returns Service reference.
    */
    public async getServiceRef ( module: typeof AdminPanelModule, service: typeof AdminPanelService ): Promise<AdminPanelService>
    public async getServiceRef ( module: typeof ClientModule, service: typeof ClientService ): Promise<ClientService>
    public async getServiceRef ( module: typeof ImageControlModule, service: typeof ImageControlService ): Promise<ImageControlService>
    public async getServiceRef ( module: typeof SignModule, service: typeof SignService ): Promise<SignService>
    public async getServiceRef ( module: typeof SignModule, service: typeof JwtControlService ): Promise<JwtControlService>
    public async getServiceRef ( module: DynamicModule | Type<unknown> | typeof WebSocketService, service: string | symbol | Type<any> ): Promise<AdminPanelService | ClientService | ImageControlService | SignService | JwtControlService | WebSocketService> {
        const moduleRef = await this._lazyModuleLoader.load(() => module);
        const serviceRef: AdminPanelService | ClientService | ImageControlService | SignService | JwtControlService = moduleRef.get(service);

        return serviceRef;
    }
}