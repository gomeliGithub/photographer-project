import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FormControl, FormGroup } from '@angular/forms';

import { AdminPanelComponent } from '../../components/admin-panel/admin-panel.component';
import { AdminPanelService } from '../admin-panel/admin-panel.service';

import { AppService } from '../../app.service';

import { ICurrentAdminImageData, IWSMessage } from '@photographer-project/types';

@Injectable({
    providedIn: 'root'
})
export class WebSocketService {
    @Inject(PLATFORM_ID) private readonly platformId: string;
    public isPlatformBrowser: boolean;

    private _connection: WebSocket | null;

    private _keepAliveTimer: any;

    private _currentChunkNumber: number;
    private _slicedImageData: ArrayBuffer[];

    public progressBarVisible: boolean = false;
    public progressBarValue: number = 0;
    public componentClass: string;

    constructor (
        private readonly _appService: AppService
    ) {
        this.isPlatformBrowser = isPlatformBrowser(this.platformId);
    }

    public on (componentThis: AdminPanelComponent, adminPanelServiceThis: AdminPanelService, host: string, uploadImageForm: FormGroup<{
        imagePhotographyType: FormControl<string | null>;
        imageDisplayType: FormControl<string | null>;
        image: FormControl<FileList | null>;
        imageDescription: FormControl<string | null>;
    }>, slicedImageData: ArrayBuffer[], newClientId: number, currentAdminImageDataJSON: ICurrentAdminImageData): void {
        this._connection = new WebSocket(`${ host }/:${ newClientId }?${ encodeURIComponent(JSON.stringify(currentAdminImageDataJSON)) }`);

        this._connection.onopen = () => {
            this._keepAliveTimer = setInterval(() => {
                this.send('KEEP_ME_ALIVE');
            }, 5000);

            this.progressBarVisible = true;
            this.componentClass = 'pointerEventsNone2';
        };

        this._connection.onmessage = (event: MessageEvent<IWSMessage>) => {
            const message: IWSMessage | null = JSON.parse(event.data as unknown as string);
            if ( message !== null ) {
                if ( message.event === 'uploadImage' ) {
                    switch ( message.text ) {
                        case 'PENDING': {
                            this.closeConnection(componentThis);

                            this._appService.createWarningModal(this._appService.getTranslations('UPLOADIMAGE_PENDINGMESSAGE')); 
                                
                            break;
                        }
                        case 'ERROR': { 
                            this._clearUploadImageData(uploadImageForm);

                            this.closeConnection(componentThis);

                            this._appService.createErrorModal(); 
                                
                            break; 
                        }
                        case 'CANCEL_UPLOAD_DONE': {
                            this.closeConnection(componentThis);

                            this._appService.createWarningModal(this._appService.getTranslations('UPLOADIMAGE_CANSELMESSAGE')); 
                                
                            break;
                        }
                        case 'FINISH': {
                            this.closeConnection(componentThis);

                            this.progressBarValue = message.percentUploaded as number;

                            this._clearUploadImageData(uploadImageForm);

                            this.progressBarValue = 0;

                            this.progressBarVisible = false;
                            this.componentClass = '';

                            this._appService.createSuccessModal(this._appService.getTranslations('UPLOADIMAGERESPONSES.FINISH'));

                            componentThis.changeDocumentBodyUserInteractions(); 

                            adminPanelServiceThis.getFullCompressedImagesData(componentThis, false, {
                                imagesLimit: 1,
                                imagesExistsCount: componentThis.fullCompressedImagesStates.list ? componentThis.fullCompressedImagesStates.list.length : 0,
                                dateFrom: componentThis.searchImagesFormStates.currentDateFrom,
                                dateUntil: componentThis.searchImagesFormStates.currentDateUntil,
                                photographyTypes: componentThis.searchImagesFormStates.currentPhotographyTypes,
                                displayTypes: componentThis.searchImagesFormStates.currentDisplayTypes,
                                sortBy: componentThis.searchImagesForm.controls['sortBy'].value
                            }, false, true, true);

                            break;
                        }
                        case 'SUCCESS': { 
                            this.progressBarValue = message.percentUploaded as number;

                            this.sendImage(this._slicedImageData, this._currentChunkNumber += 1);
                                
                            break; 
                        }
                    }
                } else if ( message.event === 'info' ) {
                    if ( message.text === 'Ready' ) {
                        this.sendImage(slicedImageData, 0);
                    }
                }
            } else {
                this.closeConnection(componentThis);

                this._appService.createErrorModal();
            }
        }

        this._connection.onerror = error => {
            console.log('WebSocket error: ', error);
        };

        this._connection.onclose = () => {
            this._connection = null;

            clearInterval(this._keepAliveTimer);
        };
    }

    public send (data: string | Blob | ArrayBuffer): void {
        if ( this._connection !== null ) this._connection.send(data);
    }

    public sendImage (slicedImageData: ArrayBuffer[], chunkNumber: number): void {
        if ( !this._slicedImageData || this._slicedImageData.length === 0 ) this._slicedImageData = slicedImageData;
        
        this._currentChunkNumber = chunkNumber;

        this.send(slicedImageData[chunkNumber]);
    }

    public closeConnection (componentThis: AdminPanelComponent, onlyClose?: false): void {
        if ( !onlyClose ) {
            this.progressBarValue = 0;
            this.progressBarVisible = false;
            this.componentClass = '';
        }

        componentThis.previousActiveImageOperations.upload = false;
        componentThis.uploadImageButtonIsDisabled = false;

        if ( this._connection !== null ) this._connection.close();
    }

    private _clearUploadImageData (uploadImageForm: FormGroup<{
        imagePhotographyType: FormControl<string | null>;
        imageDisplayType: FormControl<string | null>;
        image: FormControl<FileList | null>;
        imageDescription: FormControl<string | null>;
    }>) {
        uploadImageForm.reset();

        this._slicedImageData = [];
        this._currentChunkNumber = 0;
    }
}