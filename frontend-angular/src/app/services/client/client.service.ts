import { ElementRef, EventEmitter, Injectable, QueryList } from '@angular/core';
import { HttpClient, HttpResponse } from '@angular/common/http';

import { Observable, forkJoin } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';

import { AppService } from '../../app.service';

import { Image_display_types, Image_photography_types, IClientBrowser, IGalleryCompressedImagesData } from '@photographer-project/types';
import { IClientSignData } from '@photographer-project/types';
import { ICompressedImageWithoutRelationFields, IDiscount, IImagePhotographyType } from '@photographer-project/types';

import { environment } from '../../../environments/environment';

@Injectable({
    providedIn: 'root'
})
export class ClientService {
    constructor (
        private readonly _http: HttpClient,
        private readonly _translateService: TranslateService,

        private readonly _appService: AppService
    ) { }

    public scrollPageBottomStatusChange: EventEmitter<boolean> = new EventEmitter();
    public navbarAnimationStateChange: EventEmitter<string> = new EventEmitter();
    public prevNavbarAnimationStateChange: EventEmitter<string> = new EventEmitter();
    public footerAnimationStateChange: EventEmitter<string> = new EventEmitter();

    public galleryImageContainerViewRefsChange: EventEmitter<QueryList<ElementRef<HTMLDivElement>>> = new EventEmitter();

    public setScrollPageBottomStatus (value: boolean): void {
        this.scrollPageBottomStatusChange.emit(value);
    }

    public setNavbarAnimationState (value: string): void {
        this.navbarAnimationStateChange.emit(value);
    }

    public setPrevNavbarAnimationStateChange (value: string | undefined): void { 
        this.prevNavbarAnimationStateChange.emit(value);
    }

    public setFooterAnimationState (value: string): void {
        this.footerAnimationStateChange.emit(value);
    }

    public setGalleryImageContainerViewRefs (value: QueryList<ElementRef<HTMLDivElement>>): void {
        this.galleryImageContainerViewRefsChange.emit(value);
    }

    public getActiveClient (): Observable<IClientBrowser> {
        return this._http.get<IClientBrowser>(`${ environment.apiServerURL }/sign/getActiveClient`);
    }

    public sign (signFormValue: Partial<{
        clientLogin: string | null;
        clientPassword: string | null;
        clientFullName: string | null;
        clientEmail?: string | null;
    }>, signOperation: 'up' | 'in'): void {
        const { clientLogin, clientPassword, clientFullName, clientEmail } = signFormValue;

        const clientData: IClientSignData = {
            login: clientLogin as string,
            password: clientPassword as string
        }

        if ( signOperation === 'up') {
            clientData.fullName = clientFullName as string;
            clientData.email = clientEmail as string;

            this._http.post(`${ environment.apiServerURL }/sign/up`, {
                sign: { clientData }
            }).subscribe({
                next: () => this._appService.reloadComponent(false, '/sign/in'),
                error: () => this._appService.createErrorModal(this._appService.getTranslations('CLIENTPAGE.SIGNERRORTEXT'))
            });
        } else this._http.put(`${ environment.apiServerURL }/sign/in`, {
            sign: { clientData }
        }, { responseType: 'text' }).subscribe({
            next: access_token => {
                localStorage.setItem('access_token', access_token);

                this._appService.reloadComponent(false, '');
            },
            error: () => this._appService.createErrorModal(this._appService.getTranslations('CLIENTPAGE.SIGNERRORTEXT'))
        });
    }

    public getCompressedImagesData (imagesType: 'home', imageDisplayType: Image_display_types): Observable<ICompressedImageWithoutRelationFields[]> ////////////////// EDIT (Transfer State) /////////////////////
    public getCompressedImagesData (imagesType: Image_photography_types, imageDisplayType: Image_display_types, imagesExistsCount?: number): Observable<IGalleryCompressedImagesData>
    public getCompressedImagesData (imagesType: 'home' | Image_photography_types, imageDisplayType: Image_display_types, imagesExistsCount?: number): Observable<IGalleryCompressedImagesData | ICompressedImageWithoutRelationFields[]> {
        return this._http.get<IGalleryCompressedImagesData | ICompressedImageWithoutRelationFields[]>(`${ environment.apiServerURL }/client/getCompressedImagesData/:${ imagesType }`, { params: {
            imageDisplayType,
            imagesExistsCount: imagesExistsCount as number
        }});
    }

    public getImagePhotographyTypesData (targetPage: 'home'): Observable<IImagePhotographyType[][]>
    public getImagePhotographyTypesData (targetPage: 'admin'): Observable<IImagePhotographyType[]>
    public getImagePhotographyTypesData (targetPage: 'home' | 'admin'): Observable<IImagePhotographyType[][] | IImagePhotographyType[]> {
        return this._http.get<IImagePhotographyType[][] | IImagePhotographyType[]>(`${ environment.apiServerURL }/client/getImagePhotographyTypesData/:${ targetPage }`);
    }

    public getDiscountsData (): Observable<IDiscount[]> {
        return this._http.get<IDiscount[]>(`${ environment.apiServerURL }/client/getDiscountsData`);
    }

    public downloadOriginalImage (compressedImageName: string): Observable<HttpResponse<Blob>> {
        return this._http.get(`${ environment.apiServerURL }/client/downloadOriginalImage/:${ compressedImageName }`, { responseType: 'blob', observe: 'response' });
    }

    public sendOrder (photographyType: string, sendOrderFormValue: Partial<{
        orderType: string | null;
        clientPhoneNumber: string | null;
        comment: string | null;
    }>): void {
        const { orderType, clientPhoneNumber, comment } = sendOrderFormValue;

        this._http.post(`${ environment.apiServerURL }/client/createOrder`, {
            client: {
                imagePhotographyType: photographyType,
                orderType,
                clientPhoneNumber,
                comment
            }
        }).subscribe({
            next: () => this._appService.createSuccessModal(this._appService.getTranslations('GALLERYPAGE.CLIENTORDERSUCCESSMESSAGE')),
            error: () => this._appService.createErrorModal()
        });
    }

    public signOut (): Observable<void> {
        return this._http.put<void>(`${ environment.apiServerURL }/sign/out`, { });
    }

    public changeClientLocale (newLocale: string) {
        return forkJoin([ 
            this._http.post(`${ environment.apiServerURL }/client/changeLocale`, { sign: { newLocale } }, { responseType: 'text' }),
            this._translateService.use(newLocale)
        ]);
    }
}