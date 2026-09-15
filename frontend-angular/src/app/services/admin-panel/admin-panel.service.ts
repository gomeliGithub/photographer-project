import { ElementRef, EventEmitter, Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { FormArray, FormControl, FormGroup, Validators } from '@angular/forms';

import { Observable, Subscription, map } from 'rxjs';

import { NgbModalRef } from '@ng-bootstrap/ng-bootstrap';

import { AdminPanelComponent } from '../../components/admin-panel/admin-panel.component';
import { AdminPanelOrdersControlComponent } from '../../components/admin-panel-orders-control/admin-panel-orders-control.component';
import { AdminPanelDiscountsControlComponent } from '../../components/admin-panel-discounts-control/admin-panel-discounts-control.component';
import { ClientOrdersComponent } from '../../components/admin-panel-orders-control/client-orders/client-orders.component';
import { OffcanvasSearchComponent } from '../../components/admin-panel/offcanvas-search/offcanvas-search.component';

import { AppService } from '../../app.service';
import { WebSocketService } from '../web-socket/web-socket.service';

import { Client_order_statuses, Client_order_types, IClientOrdersData, Image_display_types, Image_photography_types, IOrdersClientsData, IFullCompressedImageData } from '@photographer-project/types';
import { IGetClientOrdersOptions, IGetFullCompressedImagesDataOptions, SortBy_Types } from '@photographer-project/types';
import { IClientOrderWithoutRelationFields, ICompressedImageWithoutRelationFields, IDiscount, IImagePhotographyType } from '@photographer-project/types';
import { IImageMeta, ICurrentAdminImageData } from '@photographer-project/types';

import { environment } from '../../../environments/environment';

@Injectable({
    providedIn: 'root'
})
export class AdminPanelService {
    @Inject(PLATFORM_ID) private readonly platformId: string;
    public isPlatformBrowser: boolean;
    
    private readonly _socketServerHost: string = environment.webSocketServerURL;

    constructor (
        private readonly _http: HttpClient,

        private readonly _appService: AppService,
        private readonly _webSocketService: WebSocketService
    ) { 
        this.isPlatformBrowser = isPlatformBrowser(this.platformId);
    }

    public spinnerHiddenStatusChange: EventEmitter<boolean> = new EventEmitter();

    public setSpinnerHiddenStatus (value: boolean): void {
        this.spinnerHiddenStatusChange.emit(value);
    }

    public getFullCompressedImagesData (componentThis: AdminPanelComponent, isSearch: boolean, getParams: IGetFullCompressedImagesDataOptions, additionalImagesClick: boolean = false, reversePush: boolean = false, getFirst: boolean = false): Subscription { // : void {
        if ( additionalImagesClick ) {
            this.checkChangesInPreviousPhotographyTypes(componentThis);
            this.checkChangesInPreviousDisplayTypes(componentThis);
        }

        let params: HttpParams = new HttpParams();

        if ( getParams ) {
            getParams.imagesLimit ? params = params.append('imagesLimit', getParams.imagesLimit) : undefined;
            getParams.imagesExistsCount ? params = params.append('imagesExistsCount', !getFirst ? getParams.imagesExistsCount : 0) : undefined;
            getParams.dateFrom ? params = params.append('dateFrom', getParams.dateFrom.toUTCString()) : undefined;
            getParams.dateUntil ? params = params.append('dateUntil', getParams.dateUntil.toUTCString()) : undefined;
            getParams.photographyTypes ? params = params.append('photographyTypes', JSON.stringify(getParams.photographyTypes)) : undefined;
            getParams.displayTypes ? params = params.append('displayTypes', JSON.stringify(getParams.displayTypes)) : undefined;
            params = params.append('sortBy', getParams.sortBy);
        }

        return this._http.get<IFullCompressedImageData>(`${ environment.apiServerURL }/admin-panel/getFullCompressedImagesList`, { params }).subscribe({
            next: imageData => {
                if ( ( isSearch && ( !componentThis.searchImagesFormStates.previousPhotographyTypesNotChange || !componentThis.searchImagesFormStates.previousDisplayTypesNotChange ) ) || !componentThis.fullCompressedImagesStates.additionalIsExists ) {
                    componentThis.fullCompressedImagesStates.list = imageData.imagesList;

                    if ( componentThis.fullCompressedImagesStates.list.length > 0 ) {
                        componentThis.compressedImagesStates.thumbnailUrls = [];
                        componentThis.compressedImagesStates.containersAnimationCurrent = [];
                        componentThis.compressedImagesStates.containersDeleteStatus = [];

                        componentThis.loadAndShowImageThumbnailRecursive(componentThis.fullCompressedImagesStates.list, 0);
                    } else componentThis.changeDocumentBodyUserInteractions();

                    componentThis.fullCompressedImagesStates.list.forEach(() => {
                        componentThis.compressedImagesStates.containersAnimationCurrent.push('leave');
                        componentThis.compressedImagesStates.containersDeleteStatus.push(false);
                    });

                    componentThis.compressedImagesStates.containerAnimationIsDone = false;

                    componentThis.changeImageDataForm = new FormGroup({
                        'newImagePhotographyType': new FormArray(componentThis.fullCompressedImagesStates.list.map(data => {
                            componentThis.changeImageDataFormPreviousValues['newImagePhotographyType'].push(data.photographyType);

                            return new FormControl(data.photographyType);
                        })),
                        'newImageDisplayType': new FormArray(componentThis.fullCompressedImagesStates.list.map(data => {
                            componentThis.changeImageDataFormPreviousValues['newImageDisplayType'].push(data.displayType);

                            return new FormControl(data.displayType);
                        })),
                        'newImageDescription': new FormArray(componentThis.fullCompressedImagesStates.list.map(data => {
                            componentThis.changeImageDataFormPreviousValues['newImageDescription'].push(data.description);

                            return new FormControl(data.description);
                        }))
                    });

                    componentThis.fullCompressedImagesStates.list.forEach(() => {
                        componentThis.changeImageDataFormSubmitButtonsHiddenStatus.push(true);
                        componentThis.compressedImagesStates.dataContainersAnimationCurrent.push('static');
                    });
                } else {
                    componentThis.compressedImagesStates.buttonsIsHidden = true;

                    if ( !reversePush ) componentThis.fullCompressedImagesStates.list.push(...imageData.imagesList);
                    else componentThis.fullCompressedImagesStates.list.unshift(...imageData.imagesList);

                    const newFullCompressedImagesList: ICompressedImageWithoutRelationFields[] = componentThis.fullCompressedImagesStates.list.slice(getParams?.imagesExistsCount);

                    if ( !reversePush ) newFullCompressedImagesList.forEach(() => {
                        componentThis.compressedImagesStates.containersAnimationCurrent.push('leave');
                        componentThis.compressedImagesStates.containersDeleteStatus.push(false);
                    });
                    else newFullCompressedImagesList.forEach(() => {
                        componentThis.compressedImagesStates.containersAnimationCurrent.unshift('leave');
                        componentThis.compressedImagesStates.containersDeleteStatus.unshift(false);
                    });

                    componentThis.compressedImagesStates.containerAnimationIsDone = false;

                    if ( !getFirst ) componentThis.loadAndShowImageThumbnailRecursive(newFullCompressedImagesList, 0)

                    if ( !reversePush ) imageData.imagesList.forEach(data => {
                        componentThis.changeImageDataFormPreviousValues['newImagePhotographyType'].push(data.photographyType);
                        componentThis.changeImageDataForm.controls.newImagePhotographyType.push(new FormControl(data.photographyType));

                        componentThis.changeImageDataFormPreviousValues['newImageDisplayType'].push(data.displayType);
                        componentThis.changeImageDataForm.controls.newImageDisplayType.push(new FormControl(data.displayType));

                        componentThis.changeImageDataFormPreviousValues['newImageDescription'].push(data.description);
                        componentThis.changeImageDataForm.controls.newImageDescription.push(new FormControl(data.description));
                    });
                    else imageData.imagesList.forEach(data => {
                        componentThis.changeImageDataFormPreviousValues['newImagePhotographyType'].unshift(data.photographyType);
                        componentThis.changeImageDataForm.controls.newImagePhotographyType.insert(0, new FormControl(data.photographyType));

                        componentThis.changeImageDataFormPreviousValues['newImageDisplayType'].unshift(data.displayType);
                        componentThis.changeImageDataForm.controls.newImageDisplayType.insert(0, new FormControl(data.displayType));

                        componentThis.changeImageDataFormPreviousValues['newImageDescription'].unshift(data.description);
                        componentThis.changeImageDataForm.controls.newImageDescription.insert(0, new FormControl(data.description));
                    });

                    if ( !reversePush ) imageData.imagesList.forEach(() => {
                        componentThis.changeImageDataFormSubmitButtonsHiddenStatus.push(true);
                        componentThis.compressedImagesStates.dataContainersAnimationCurrent.push('static');
                    });
                    else imageData.imagesList.forEach(() => {
                        componentThis.changeImageDataFormSubmitButtonsHiddenStatus.unshift(true);
                        componentThis.compressedImagesStates.dataContainersAnimationCurrent.unshift('static');
                    });

                    if ( getFirst ) {
                        componentThis.compressedImagesStates.containersDeleteStatus[componentThis.compressedImagesStates.containersDeleteStatus.length - 1] = true;
                        componentThis.changeDetectorRef.detectChanges();

                        componentThis.fullCompressedImagesStates.list.splice(componentThis.fullCompressedImagesStates.list.length - 1, 1);

                        this.loadAndShowImageThumbnail(componentThis, null, true, imageData.imagesList[0].originalName, componentThis.fullCompressedImagesStates.list, 0, true);
                                    
                        Object.keys(componentThis.changeImageDataFormPreviousValues).forEach(controlName => componentThis.changeImageDataFormPreviousValues[controlName].splice(componentThis.compressedImagesStates.containersDeleteStatus.length - 1, 1));

                        componentThis.compressedImagesStates.thumbnailUrls.splice(componentThis.compressedImagesStates.thumbnailUrls.length - 1, 1);
                        componentThis.compressedImagesStates.containersAnimationCurrent.splice(componentThis.compressedImagesStates.containersAnimationCurrent.length - 1, 1);
                        componentThis.changeImageDataFormSubmitButtonsHiddenStatus.splice(componentThis.changeImageDataFormSubmitButtonsHiddenStatus.length - 1, 1);
                        componentThis.compressedImagesStates.dataContainersAnimationCurrent.splice(componentThis.compressedImagesStates.dataContainersAnimationCurrent.length - 1, 1);
                        componentThis.compressedImagesStates.containersDeleteStatus.splice(componentThis.compressedImagesStates.containersDeleteStatus.length - 1, 1);
                    }
                }

                componentThis.fullCompressedImagesStates.listCount = imageData.count;

                componentThis.fullCompressedImagesStates.additionalIsExists = imageData.additionalImagesIsExists;

                componentThis.compressedImagesStates.dataIsLoaded = true;
            },
            error: () => this._appService.createErrorModal()
        });
    }

    public checkChangesInPreviousPhotographyTypes (componentThis: AdminPanelComponent): void {
        let result: boolean = false;

        if ( componentThis.searchImagesFormStates.previousPhotographyTypes.length !== 0 && componentThis.searchImagesFormStates.previousPhotographyTypes.length === componentThis.searchImagesFormStates.currentPhotographyTypes?.length ) {
            result = componentThis.searchImagesFormStates.previousPhotographyTypes.every(( data, index ) => data === ( componentThis.searchImagesFormStates.currentPhotographyTypes as Image_photography_types[] )[index]);
        } else result = false;

        componentThis.searchImagesFormStates.previousPhotographyTypesNotChange = result;
    }

    public checkChangesInPreviousDisplayTypes (componentThis: AdminPanelComponent): void {
        let result: boolean = false;

        if ( componentThis.searchImagesFormStates.previousDisplayTypes.length !== 0 && componentThis.searchImagesFormStates.previousDisplayTypes.length === componentThis.searchImagesFormStates.currentDisplayTypes?.length ) {
            result = componentThis.searchImagesFormStates.previousDisplayTypes.every(( data, index ) => data === ( componentThis.searchImagesFormStates.currentDisplayTypes as Image_display_types[] )[index]);
        } else result = false;

        componentThis.searchImagesFormStates.previousDisplayTypesNotChange = result;
    }

    public changeImageFormControlChange (componentThis: AdminPanelComponent, formArrayName: 'newImagePhotographyType' | 'newImageDisplayType' | 'newImageDescription', formControlIndex: number): void {
        const formArray: FormArray<FormControl<string>> = <FormArray<FormControl<Image_photography_types | Image_display_types | string>>>componentThis.changeImageDataForm.get(formArrayName);
        const control: FormControl<string> = formArray.at(formControlIndex);

        if ( componentThis.changeImageDataFormPreviousValues[formArrayName][formControlIndex] === control.value ) {
            componentThis.changeImageDataFormSubmitButtonsHiddenStatus[formControlIndex] = true;

            switch ( formArrayName ) {
                case 'newImagePhotographyType': { control.removeValidators([ Validators.required, componentThis.imagePhotographyTypeValidator ]); break; }
                case 'newImageDisplayType': { control.removeValidators([ Validators.required, componentThis.imageDisplayTypeValidator ]); break; }
                case 'newImageDescription': { control.removeValidators([ Validators.maxLength(20) ]); break; }
            }
        } else {
            componentThis.changeImageDataFormSubmitButtonsHiddenStatus[formControlIndex] = false;

            switch ( formArrayName ) {
                case 'newImagePhotographyType': { control.setValidators([ Validators.required, componentThis.imagePhotographyTypeValidator ]); break; }
                case 'newImageDisplayType': { control.setValidators([ Validators.required, componentThis.imageDisplayTypeValidator ]); break; }
                case 'newImageDescription': { control.setValidators([ Validators.maxLength(20) ]); break; }
            }
        }

        control.updateValueAndValidity();
    }

    public loadAndShowImageThumbnail (componentThis: AdminPanelComponent, imageButton: HTMLButtonElement | null, recursive: boolean, originalName?: string, compressedImagesList?: ICompressedImageWithoutRelationFields[], currentIndex?: number, oneRecursiveCall: boolean = false): Subscription | undefined { // : void {
        const originalImageName: string | null = !originalName ? ( imageButton as HTMLButtonElement ).getAttribute('originalImageName') : originalName;

        if ( originalImageName !== null ) {
            componentThis.currentLoadedImageThumbnailOriginalName = originalImageName;
            componentThis.spinnerHidden = false;
    
            return this._http.get(`${ environment.apiServerURL }/admin-panel/getImageThumbnail`, {
                params: {
                    originalName: originalImageName
                }, responseType: 'blob',
            }).subscribe({
                next: imageThumbnailBlob => {
                    const reader = new FileReader();
    
                    reader.readAsDataURL(imageThumbnailBlob);
    
                    reader.onload = event => {
                        componentThis.spinnerHidden = true;

                        if ( !recursive ) {
                            componentThis.imageThumbnailStates.url = ( event.target as FileReader ).result as string;
        
                            componentThis.imageThumbnailStates.containerIsVisible = true;
                                
                            componentThis.switchImageThumbnailContainerVisible();
                        } else {
                            if ( !oneRecursiveCall ) {
                                componentThis.compressedImagesStates.thumbnailUrls.push(( event.target as FileReader ).result as string);
        
                                ( currentIndex as number ) += 1;

                                console.log(componentThis.compressedImagesStates.thumbnailUrls);
            
                                if ( ( currentIndex as number ) === compressedImagesList?.length ) {
                                    componentThis.changeDocumentBodyUserInteractions();

                                    return;
                                } else componentThis.loadAndShowImageThumbnailRecursive(compressedImagesList as ICompressedImageWithoutRelationFields[], currentIndex as number);
                            } else {
                                componentThis.compressedImagesStates.thumbnailUrls.unshift(( event.target as FileReader ).result as string);

                                componentThis.changeDocumentBodyUserInteractions();
                            }
                        }
                    };   
                },
                error: ( err: any ) => {
                    componentThis.spinnerHidden = true;
    
                    if ( err instanceof HttpErrorResponse && err.status === 409) this._appService.createWarningModal(this._appService.getTranslations('ADMINPANEL.PREVIOUSACTIVEIMAGEOPERATIONSMESSAGES.GETTHUMBNAIL'));
                    else this._appService.createErrorModal();
                }
            });
        } else return;
    }

    public getClientOrdersData (options: IGetClientOrdersOptions) {
        const params: HttpParams = this._createGetClientOrdersParams(options);

        return this._http.get<IClientOrdersData>(`${ environment.apiServerURL }/admin-panel/getClientOrders`, { params }).pipe(map(data => {
            data.orders = data.orders.map(clientOrder => {
                Object.keys(clientOrder).forEach(field => {
                    if ( field === 'createdDate' ) clientOrder[field] = new Date(clientOrder[field]);
                    if ( field === 'photographyType' ) switch ( clientOrder[field] ) {
                        case 'individual': { clientOrder[field] = this._appService.getTranslations('IMAGEPHOTOGRAPHYTYPES.INDIVIDUAL'); break; }
                        case 'children': { clientOrder[field] = this._appService.getTranslations('IMAGEPHOTOGRAPHYTYPES.CHILDREN'); break; }
                        case 'wedding': { clientOrder[field] = this._appService.getTranslations('IMAGEPHOTOGRAPHYTYPES.WEDDING'); break; }
                        case 'family': { clientOrder[field] = this._appService.getTranslations('IMAGEPHOTOGRAPHYTYPES.FAMILY'); break; }
                    }
                    if ( field === 'type') {
                        switch ( clientOrder[field] ) {
                            case 'consultation': { clientOrder[field] = this._appService.getTranslations('CLIENTORDERTYPES.CONSULTATION') as Client_order_types; break; }
                            case 'full': { clientOrder[field] = this._appService.getTranslations('CLIENTORDERTYPES.FULL') as Client_order_types; break; }
                        }
                    }
                    if ( field === 'status' ) switch ( clientOrder[field] ) {
                        case 'new': { clientOrder[field] = this._appService.getTranslations('CLIENTORDERSTATUSES.NEW') as Client_order_statuses; break; }
                        case 'processed': { clientOrder[field] = this._appService.getTranslations('CLIENTORDERSTATUSES.PROCESSED') as Client_order_statuses; break; }
                    }
                });

                return clientOrder;
            });
                
            return data;
        }));
    }

    public getOrdersClientsData (options: IGetClientOrdersOptions) {
        const params: HttpParams = this._createGetClientOrdersParams(options);

        return this._http.get<IOrdersClientsData>(`${ environment.apiServerURL }/admin-panel/getOrdersClientsData`, { params });
    }

    private _createGetClientOrdersParams (options: IGetClientOrdersOptions): HttpParams {
        let params: HttpParams = new HttpParams();

        if ( options ) {
            options.memberLogin ? params = params.append('memberLogin', options.memberLogin) : undefined;
            options.fromDate ? params = params.append('fromDate', options.fromDate.toDateString()) : undefined;
            options.untilDate ? params = params.append('untilDate', options.untilDate.toDateString()) : undefined;
            options.status ? params = params.append('status', options.status) : undefined;
            options.existsCount ? params = params.append('existsCount', options.existsCount) : undefined;
            options.ordersLimit ? params = params.append('ordersLimit', options.ordersLimit) : undefined;
        }

        return params;
    }
    
    public changeClientOrderStatus (clientOrderId: number, clientLogin: string): Observable<void> { 
        return this._http.put<void>(`${ environment.apiServerURL }/admin-panel/changeClientOrderStatus`, { adminPanel: {
            clientOrderId,
            clientLogin
        }});
    }

    public uploadImage (componentThis: AdminPanelComponent, imagePhotographyType: string | null | undefined, imageDisplayType: string | null | undefined, imageDescription: string | null | undefined, imageMetaJson: IImageMeta): void {
        const newClientId: number = Math.random();

        componentThis.uploadImageButtonIsDisabled = true;
        
        this._http.post(`${ environment.apiServerURL }/admin-panel/uploadImage`, {
            client: {
                _id: newClientId, 
                uploadImageMeta: JSON.stringify(imageMetaJson),
                imagePhotographyType,
                imageDisplayType,
                imageDescription
            }
        }, { responseType: 'text' }).pipe<string | { currentAdminId: number, currentAdminLogin: string }>(map((res: string) => {
            try {
                return JSON.parse(res);
            } catch {
                return res; 
            }
        })).subscribe({
            next: responseResult => {
                if ( typeof responseResult !== 'string' ) {
                    const reader = new FileReader();

                    reader.onload = event => {
                        const fileData: ArrayBuffer = ( event.target as FileReader ).result as ArrayBuffer;
                        
                        const slicedImageData: ArrayBuffer[] = [];
                        
                        for ( let i = 0; i <= fileData.byteLength; i += 100000 ) {
                            slicedImageData.push(fileData.slice(i, i + 100000));
                        }

                        const JSONCurrentAdminImageData: ICurrentAdminImageData = {
                            currentAdminData: {
                                id: responseResult.currentAdminId,
                                login: responseResult.currentAdminLogin
                            },
                            imageMeta: imageMetaJson,
                            imageAdditionalData: {
                                photographyType: imagePhotographyType as Image_photography_types,
                                displayType: imageDisplayType as string as Image_display_types,
                                description: imageDescription as string
                            }
                        }
                        
                        this._webSocketService.on(componentThis, this, this._socketServerHost, componentThis.uploadImageForm, slicedImageData, newClientId, JSONCurrentAdminImageData);
                    }
                        
                    reader.readAsArrayBuffer(componentThis.imageFile as File);
                } else {

                    componentThis.uploadImageForm.reset();

                    switch ( responseResult ) {
                        case 'PREVIOUSUPLOADIMAGEPROCESSISACTIVE': { this._appService.createWarningModal(this._appService.getTranslations(`UPLOADIMAGERESPONSES.${ responseResult }`)); break; }
                        case 'NOTSUPPORTEDFORMAT': { this._appService.createWarningModal(this._appService.getTranslations(`UPLOADIMAGERESPONSES.${ responseResult }`)); break; }
                        case 'PENDING': { this._appService.createWarningModal(this._appService.getTranslations(`UPLOADIMAGERESPONSES.${ responseResult }`)); break; }
                        case 'FILEEXISTS': { this._appService.createWarningModal(this._appService.getTranslations(`UPLOADIMAGERESPONSES.${ responseResult }`)); break; }
                        case 'MAXCOUNT': { this._appService.createWarningModal(this._appService.getTranslations(`UPLOADIMAGERESPONSES.${ responseResult }`)); break; }
                        case 'MAXSIZE': { this._appService.createWarningModal(this._appService.getTranslations(`UPLOADIMAGERESPONSES.${ responseResult }`)); break; }
                        case 'MAXNAMELENGTH': { this._appService.createWarningModal(this._appService.getTranslations(`UPLOADIMAGERESPONSES.${ responseResult }`)); break; }
                    }
                }
            },
            error: () => this._appService.createErrorModal()
        });
    }

    public cancelUploadImage (): void {
        this._webSocketService.send('CANCEL_UPLOAD');
    }

    public deleteImage (componentThis: AdminPanelComponent, deleteImageButton: HTMLButtonElement, compressedImageIndex: number): Subscription | undefined { // : void {
        const originalImageName: string | null = deleteImageButton.getAttribute('originalImageName');
        const imageIndexNumber: number = parseInt(deleteImageButton.getAttribute('image-index-number') as string, 10);

        if ( originalImageName !== null && !isNaN(imageIndexNumber) ) {
            componentThis.spinnerHidden = false;

            return this._http.post(`${ environment.apiServerURL }/admin-panel/deleteImage`, {
                adminPanel: { originalImageName }
            }, { responseType: 'text' }).subscribe({
                next: responseText => {
                    this.switchImageControlResponses(responseText, 'delete');
                    componentThis.deleteImageIsCompleted = true;

                    componentThis.compressedImagesStates.containersDeleteStatus[imageIndexNumber] = true;
                    componentThis.changeDetectorRef.detectChanges();

                    componentThis.fullCompressedImagesStates.list.splice(imageIndexNumber, 1);
                    
                    Object.keys(componentThis.changeImageDataFormPreviousValues).forEach(controlName => componentThis.changeImageDataFormPreviousValues[controlName].splice(imageIndexNumber, 1));

                    componentThis.compressedImagesStates.thumbnailUrls.splice(compressedImageIndex, 1);
                    componentThis.compressedImagesStates.containersAnimationCurrent.splice(compressedImageIndex, 1);
                    componentThis.changeImageDataFormSubmitButtonsHiddenStatus.splice(compressedImageIndex, 1);
                    componentThis.compressedImagesStates.dataContainersAnimationCurrent.splice(compressedImageIndex, 1);
                    componentThis.compressedImagesStates.containersDeleteStatus.splice(compressedImageIndex, 1);

                    componentThis.changeDocumentBodyUserInteractions();

                    this.getFullCompressedImagesData(componentThis, false, {
                        imagesLimit: 1,
                        imagesExistsCount: componentThis.fullCompressedImagesStates.list ? componentThis.fullCompressedImagesStates.list.length : 0,
                        dateFrom: componentThis.searchImagesFormStates.currentDateFrom,
                        dateUntil: componentThis.searchImagesFormStates.currentDateUntil,
                        photographyTypes: componentThis.searchImagesFormStates.currentPhotographyTypes,
                        displayTypes: componentThis.searchImagesFormStates.currentDisplayTypes,
                        sortBy: componentThis.searchImagesForm.controls['sortBy'].value
                    });
                },
                error: () => {
                    componentThis.spinnerHidden = true;

                    this._appService.createErrorModal();
                }
            });
        } else return;
    }

    public changeImageDisplayTarget (componentThis: AdminPanelComponent, imageButton: HTMLButtonElement): Subscription | undefined { // : void {
        const originalImageName: string | null = imageButton.getAttribute('originalImageName');
        const displayTargetPage: string | null = imageButton.getAttribute('targetPage');
        const imageIndexNumber: number = parseInt(imageButton.getAttribute('image-index-number') as string, 10);

        if ( originalImageName !== null && displayTargetPage !== null && !isNaN(imageIndexNumber) ) {
            componentThis.spinnerHidden = false;

            return this._http.post(`${ environment.apiServerURL }/admin-panel/changeImageDisplayTarget`, {
                adminPanel: { originalImageName, displayTargetPage }
            }, { responseType: 'text' }).subscribe({
                next: responseText => {
                    this.switchImageControlResponses(responseText, 'changeDisplayTarget');

                    if ( responseText === 'SUCCESS' ) {
                        componentThis.fullCompressedImagesStates.list[imageIndexNumber].displayedOnHomePage = false;
                        componentThis.fullCompressedImagesStates.list[imageIndexNumber].displayedOnGalleryPage = false;
                        
                        switch ( displayTargetPage ) {
                            case 'home': { componentThis.fullCompressedImagesStates.list[imageIndexNumber].displayedOnHomePage = true; break; }
                            case 'gallery': { componentThis.fullCompressedImagesStates.list[imageIndexNumber].displayedOnGalleryPage = true; break; }
                            case 'original': { break; }
                        }
                    }
                },
                error: () => {
                    componentThis.spinnerHidden = true;
                    
                    this._appService.createErrorModal();
                }
            });
        } else return;
    }

    public changeImageData (componentThis: AdminPanelComponent, originalImageName: string): Subscription { // : void {
        componentThis.spinnerHidden = false;

        const changeImageDataFormValue = componentThis.changeImageDataForm.value;
        const changedImageIndexNumber: number = componentThis.fullCompressedImagesStates.list.findIndex(imageData => imageData.originalName == originalImageName);
        
        const previousImagePhotographyType: Image_photography_types = componentThis.changeImageDataFormPreviousValues['newImagePhotographyType'][changedImageIndexNumber] as Image_photography_types;
        const previousImageDisplayType: Image_display_types = componentThis.changeImageDataFormPreviousValues['newImageDisplayType'][changedImageIndexNumber] as Image_display_types;
        const previousImageDescription: string = componentThis.changeImageDataFormPreviousValues['newImageDescription'][changedImageIndexNumber] as string;

        let newImagePhotographyType: Image_photography_types | undefined = ( changeImageDataFormValue.newImagePhotographyType as ( Image_photography_types | null )[] ).at(changedImageIndexNumber) as Image_photography_types;
        let newImageDisplayType: Image_display_types | undefined = ( changeImageDataFormValue.newImageDisplayType as ( Image_display_types | null )[] ).at(changedImageIndexNumber) as Image_display_types;
        let newImageDescription: string | undefined = ( changeImageDataFormValue.newImageDescription as string[] ).at(changedImageIndexNumber) as string;

        newImagePhotographyType = previousImagePhotographyType !== newImagePhotographyType ? newImagePhotographyType : undefined;
        newImageDisplayType = previousImageDisplayType !== newImageDisplayType ? newImageDisplayType : undefined;
        newImageDescription = previousImageDescription !== newImageDescription ? newImageDescription : undefined;

        return this._http.put(`${ environment.apiServerURL }/admin-panel/changeImageData`, {
            adminPanel: { originalImageName, newImagePhotographyType, newImageDescription, newImageDisplayType }
        }, { responseType: 'text' }).subscribe({
            next: responseText => {
                componentThis.spinnerHidden = true;

                this.switchImageControlResponses(responseText, 'changeData');

                let control: FormControl<Image_photography_types | Image_display_types | string | null> | null = null; componentThis.changeImageDataFormSubmitButtonsHiddenStatus

                if ( newImagePhotographyType && componentThis.fullCompressedImagesStates.list[changedImageIndexNumber].photographyType !== newImagePhotographyType ) {
                    control = componentThis.changeImageDataForm.controls.newImagePhotographyType.at(changedImageIndexNumber) as FormControl<Image_photography_types>;

                    if ( control !== null ) {
                        control.removeValidators([ Validators.required, componentThis.imagePhotographyTypeValidator ]);
                        componentThis.fullCompressedImagesStates.list[changedImageIndexNumber].photographyType = newImagePhotographyType as Image_photography_types;

                        ( componentThis.changeImageDataFormPreviousValues['newImagePhotographyType'][changedImageIndexNumber] as Image_photography_types ) = newImagePhotographyType;
                    }
                }

                if ( newImageDisplayType && componentThis.fullCompressedImagesStates.list[changedImageIndexNumber].displayType !== newImageDisplayType ) {
                    control = componentThis.changeImageDataForm.controls.newImageDisplayType.at(changedImageIndexNumber) as FormControl<Image_display_types>;

                    if ( control !== null ) {
                        control.removeValidators([ Validators.required, componentThis.imageDisplayTypeValidator ]);
                        componentThis.fullCompressedImagesStates.list[changedImageIndexNumber].displayType = newImageDisplayType as Image_display_types;

                        ( componentThis.changeImageDataFormPreviousValues['newImageDisplayType'][changedImageIndexNumber] as Image_display_types ) = newImageDisplayType as Image_display_types;
                    }
                }

                if ( newImageDescription && componentThis.fullCompressedImagesStates.list[changedImageIndexNumber].description !== newImageDescription ) {
                    control = componentThis.changeImageDataForm.controls.newImageDescription.at(changedImageIndexNumber) as FormControl<string>;

                    if ( control !== null ) {
                        control.removeValidators([ Validators.maxLength(20) ]);
                        componentThis.fullCompressedImagesStates.list[changedImageIndexNumber].description = newImageDescription;

                        ( componentThis.changeImageDataFormPreviousValues['newImageDescription'][changedImageIndexNumber] as string ) = newImageDescription;
                    }
                }

                componentThis.changeImageDataFormSubmitButtonsHiddenStatus[changedImageIndexNumber] = true;
            },
            error: () => {
                componentThis.spinnerHidden = true;

                this._appService.createErrorModal();
            }
        });
    }

    public setPhotographyTypeImage (componentThis: AdminPanelComponent, imageButton: HTMLButtonElement): Subscription | undefined { // : void {
        const originalImageName: string | null = imageButton.getAttribute('originalImageName');
        const imagePhotographyType: string | null = imageButton.getAttribute('imagePhotographyType');

        if ( originalImageName !== null && imagePhotographyType !== null ) {
            componentThis.spinnerHidden = false;

            return this._http.post(`${ environment.apiServerURL }/admin-panel/setPhotographyTypeImage`, {
                adminPanel: { originalImageName, imagePhotographyType }
            }, { responseType: 'text' }).subscribe({
                next: responseText => {
                    componentThis.spinnerHidden = true;

                    this.switchImageControlResponses(responseText, 'setPhotographyType');

                    const editedPhotographyTypeIndex: number = ( componentThis.imagePhotographyTypesData as IImagePhotographyType[]).findIndex(photographyTypeData => photographyTypeData.name === imagePhotographyType);
                    ( componentThis.imagePhotographyTypesData as IImagePhotographyType[])[editedPhotographyTypeIndex].compressedImageOriginalName = ( componentThis.fullCompressedImagesStates.list.find(imageData => imageData.originalName === originalImageName) as ICompressedImageWithoutRelationFields).name;

                    componentThis.changeDetectorRef.detectChanges();
                },
                error: () => {
                    componentThis.spinnerHidden = true;
                    
                    this._appService.createErrorModal();
                }
            });
        } else return;
    }

    public changePhotographyTypeDescription (componentThis: AdminPanelComponent, target: HTMLButtonElement, index: number): Subscription | NgbModalRef | undefined { // : void {
        const photographyTypeName: string = target.getAttribute('photography-type-name') as string;

        if ( photographyTypeName ) {
            const photographyTypeNewDescription: string = ( componentThis.imagePhotographyTypeDescriptionViewRefs.find(imagePhotographyTypeDescription => {
                return imagePhotographyTypeDescription.nativeElement.getAttribute('photography-type-name') === photographyTypeName;
            }) as ElementRef<HTMLInputElement> ).nativeElement.value;

            if ( photographyTypeNewDescription.length <= 800 ) {
                componentThis.spinnerHidden = false;

                return this._http.post<void>(`${ environment.apiServerURL }/admin-panel/changePhotographyTypeDescription`, {
                    adminPanel: { photographyTypeName, photographyTypeNewDescription }
                }).subscribe({
                    next: () => {
                        componentThis.spinnerHidden = true;

                        const editedPhotographyTypeIndex: number = ( componentThis.imagePhotographyTypesData as IImagePhotographyType[] ).findIndex(photographyTypeData => photographyTypeData.name === photographyTypeName);
                        ( componentThis.imagePhotographyTypesData as IImagePhotographyType[] )[editedPhotographyTypeIndex].description = photographyTypeNewDescription;

                        componentThis.changeDetectorRef.detectChanges();

                        componentThis.imagePhotographyTypeDescriptionPreviousValues[index].value = photographyTypeNewDescription; /////////////////////// NEW ////////////////////////
 
                        this._appService.createSuccessModal();
                    },
                    error: () => {
                        componentThis.spinnerHidden = true;
                        
                        this._appService.createErrorModal();
                    }
                });
            } else {
                return this._appService.createWarningModal(this._appService.getTranslations('ADMINPANEL.CHANGEPHOTOGRAPHYTYPEDESCRIPTIONBUTTONINVALIDMESSSAGE'));
            }
        } else return;
    }

    public searchImages (componentThis: AdminPanelComponent, offcanvasComponentThis: OffcanvasSearchComponent): void {
        componentThis.searchImagesForm.updateValueAndValidity();

        offcanvasComponentThis.searchImagesButtonIsDisabled = true;

        const { dateFrom, dateUntil, photographyTypes, displayTypes, sortBy } = componentThis.searchImagesForm.value;

        componentThis.searchImagesFormStates.currentDateFrom = new Date(dateFrom as string);
        componentThis.searchImagesFormStates.currentDateUntil = new Date(dateUntil as string);

        componentThis.searchImagesFormStates.currentPhotographyTypes = [];
        componentThis.searchImagesFormStates.currentDisplayTypes = [];

        ( photographyTypes as boolean[] ).forEach(( selected, index ) => selected === true ? ( componentThis.searchImagesFormStates.currentPhotographyTypes as Image_photography_types[] ).push(componentThis.imagePhotographyTypes[index]) : null);
        ( displayTypes as boolean[] ).forEach(( selected, index ) => selected === true ? ( componentThis.searchImagesFormStates.currentDisplayTypes as Image_display_types[] ).push(componentThis.imageDisplayTypes[index]) : null);

        this.checkChangesInPreviousPhotographyTypes(componentThis);
        this.checkChangesInPreviousDisplayTypes(componentThis);

        if ( !componentThis.searchImagesFormStates.previousPhotographyTypesNotChange ) componentThis.searchImagesFormStates.previousPhotographyTypes = componentThis.searchImagesFormStates.currentPhotographyTypes;
        if ( !componentThis.searchImagesFormStates.previousDisplayTypesNotChange ) componentThis.searchImagesFormStates.previousDisplayTypes = componentThis.searchImagesFormStates.currentDisplayTypes;
        
        if ( componentThis.searchImagesFormStates.currentPhotographyTypes.length === 0 ) componentThis.searchImagesFormStates.currentPhotographyTypes = undefined;
        if ( componentThis.searchImagesFormStates.currentDisplayTypes.length === 0 ) componentThis.searchImagesFormStates.currentDisplayTypes = undefined;

        componentThis.getFullCompressedImagesData(true, {
            dateFrom: componentThis.searchImagesFormStates.currentDateFrom, 
            dateUntil: componentThis.searchImagesFormStates.currentDateUntil,
            photographyTypes: componentThis.searchImagesFormStates.currentPhotographyTypes,
            displayTypes: componentThis.searchImagesFormStates.currentDisplayTypes,
            sortBy: sortBy as SortBy_Types
        }, false, offcanvasComponentThis);
    }

    public switchImageControlResponses (responseText: string, operationName: string): void {
        switch ( responseText ) {
            case 'SUCCESS': {
                this.setSpinnerHiddenStatus(true);

                if ( operationName !== 'delete' ) this._appService.createSuccessModal();
                
                break; 
            }

            case 'MAXCOUNT': {
                this.setSpinnerHiddenStatus(true);

                this._appService.createWarningModal(this._appService.getTranslations('ADMINPANEL.MAXCOUNTONHOMEPAGEMESSAGE')); 

                break;
            }

            case 'PENDING': {
                this.setSpinnerHiddenStatus(true);

                this._appService.createWarningModal(this._appService.getTranslations('UPLOADIMAGERESPONSES.PENDING')); 
                    
                break; 
            }

            case 'WRONGDISPLAYTYPE': {
                this.setSpinnerHiddenStatus(true);
                
                this._appService.createWarningModal(this._appService.getTranslations('UPLOADIMAGERESPONSES.WRONGDISPLAYTYPE')); 

                break;
            }
        }
    }
    
    public getNextClientOrdersData (componentThis: AdminPanelOrdersControlComponent | ClientOrdersComponent, event?: MouseEvent, selectMemberClick = false): void {
        const target: HTMLDivElement | null = event ? event.target as HTMLDivElement : null;

        let clientLogin: string | null = null;
        let existsCount: number | null = null;

        if ( !componentThis.additionalOrdersExists ) existsCount = 0;
        else existsCount = componentThis.clientOrderViewRefs.length;

        if ( target !== null ) {
            clientLogin = target.getAttribute('client-login');

            componentThis.currentSelectedClientLogin = clientLogin !== 'guest' ? clientLogin as string : this._appService.getTranslations('ADMINPANEL.GUESTLOGINTEXT');
        }

        if ( !componentThis.currentSelectedClientLogin ) componentThis.currentSelectedClientLogin = this._appService.getTranslations('ADMINPANEL.GUESTLOGINTEXT');

        let memberLogin: string | null = null;

        if ( componentThis.currentSelectedClientLogin && componentThis.currentSelectedClientLogin !== 'Гость' ) {
            memberLogin = existsCount === 0 ? clientLogin : componentThis.currentSelectedClientLogin === 'Гость' ? 'guest' : componentThis.currentSelectedClientLogin;
        } else memberLogin = 'guest';

        if ( componentThis.prevCurrentSelectedOrdersStatusType !== componentThis.currentSelectedOrdersStatusType ) existsCount = 0;
        if ( existsCount === 0 || selectMemberClick ) componentThis.additionalOrdersExists = false;

        this.getClientOrdersData({
            status: componentThis.currentSelectedOrdersStatusType,
            memberLogin: clientLogin !== null ? clientLogin : 'guest',
            ordersLimit: 2,
            existsCount: existsCount
        }).subscribe({
            next: clientOrdersData => {
                if ( !componentThis.additionalOrdersExists
                    && ( existsCount === 0 || componentThis.prevCurrentSelectedOrdersStatusType !== componentThis.currentSelectedOrdersStatusType )
                ) {
                    componentThis.clientOrders.orders = clientOrdersData.orders && clientOrdersData.orders.length !== 0 ? clientOrdersData.orders : [];
                } else {
                    componentThis.clientOrders.orders.push(...clientOrdersData.orders as IClientOrderWithoutRelationFields[]);
                }

                componentThis.additionalOrdersExists = clientOrdersData.additionalOrdersExists;
            },
            error: () => this._appService.createErrorModal()
        });
    }

    public getNextOrdersClientsData (componentThis: AdminPanelOrdersControlComponent | ClientOrdersComponent) {
        let existsCount: number | null = null;

        if ( !componentThis.additionalOrdersClientsExists ) existsCount = 0;
        else existsCount = componentThis.getClientOrdersButtonViewRefs.length;

        if ( existsCount === 0 ) componentThis.additionalOrdersClientsExists = false;
        const params: HttpParams = this._createGetClientOrdersParams({
            ordersLimit: 2,
            existsCount: existsCount === 0 ? existsCount : existsCount - 1
        });

        this._http.get<IOrdersClientsData>(`${ environment.apiServerURL }/admin-panel/getOrdersClientsData`, { params }).subscribe({
            next: ordersClientsData => { 
                if ( !componentThis.additionalOrdersClientsExists
                    && ( existsCount === 0 || componentThis.prevCurrentSelectedOrdersStatusType !== componentThis.currentSelectedOrdersStatusType )
                ) {
                    componentThis.ordersClientsData.clients = ordersClientsData.clients && ordersClientsData.clients.length !== 0 ? ordersClientsData.clients : [];
                } else {
                    componentThis.ordersClientsData.clients.push(...ordersClientsData.clients);
                }

                componentThis.additionalOrdersClientsExists = ordersClientsData.additionalOrdersClientsExists;
            },
            error: () => this._appService.createErrorModal()
        });
    }

    public getDiscountsData (): Observable<IDiscount[]> {
        return this._http.get<IDiscount[]>(`${ environment.apiServerURL }/admin-panel/getDiscountsData`);
    }

    public createDiscount (componentThis: AdminPanelDiscountsControlComponent, discountContent: string, fromDate: Date, toDate: Date): void {
        componentThis.spinnerHidden = false;

        this._http.post(`${ environment.apiServerURL }/admin-panel/createDiscount`, { 
            adminPanel: {
                discountContent,
                fromDate,
                toDate
            }
        }, { responseType: 'text' }).subscribe({
            next: responseText => {
                if ( responseText === 'MAXCOUNT' ) {
                    componentThis.spinnerHidden = true;

                    this._appService.createWarningModal(this._appService.getTranslations('ADMINPANEL.CHANGEDISCOUNTMAXCOUNTMESSAGE'));
                } else if ( responseText === 'SUCCESS' ) window.location.reload();
            },
            error: () => {
                componentThis.spinnerHidden = true;

                this._appService.createErrorModal()
            }
        });
    }

    public changeDiscountData (componentThis: AdminPanelDiscountsControlComponent, newDiscountContent: string, newFromDate: Date, newToDate: Date, discountId: number): void {
        componentThis.spinnerHidden = false;

        this._http.put<void>(`${ environment.apiServerURL }/admin-panel/changeDiscountData`, {
            adminPanel: {
                newDiscountContent,
                newFromDate,
                newToDate,
                discountId
            }
        }).subscribe({
            next: () => window.location.reload(),
            error: () => {
                componentThis.spinnerHidden = true;

                this._appService.createErrorModal()
            }
        });
    }

    public deleteDiscount (componentThis: AdminPanelDiscountsControlComponent, discountId: number): void {
        componentThis.spinnerHidden = false;

        this._http.delete<void>(`${ environment.apiServerURL }/admin-panel/deleteDiscount`, {
            params: { discountId }
        }).subscribe({
            next: () => window.location.reload(),
            error: () => {
                componentThis.spinnerHidden = true;

                this._appService.createErrorModal()
            }
        });
    }
}