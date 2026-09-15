import { Inject, Injectable, PLATFORM_ID, StateKey, TransferState } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

import { HomeComponent } from '../../components/home/home.component';

import { AppService } from '../../app.service';
import { ClientService } from '../client/client.service';

import { IIntersectionObserverInit } from '@photographer-project/types'
import { ICompressedImageWithoutRelationFields, IDiscount, IImagePhotographyType } from '@photographer-project/types';

@Injectable({
    providedIn: 'root'
})
export class HomeService {
    public isPlatformBrowser: boolean;

    public intersectionObservers: IntersectionObserver[] | null = null;
    
    constructor (
        @Inject(PLATFORM_ID) private readonly platformId: string,
        
        private readonly _transferState: TransferState,

        private readonly _appService: AppService,
        private readonly _clientService: ClientService
    ) { 
        this.isPlatformBrowser = isPlatformBrowser(this.platformId);
    }

    public snapSectionScrollObserve (componentThis: HomeComponent): void {
        const callback = ( entries: IntersectionObserverEntry[], observer: IntersectionObserver ) => {
            entries.forEach(({ target, isIntersecting, intersectionRatio }) => {
                const imagePhotographyContainerIndexNumber: number = parseInt(target.getAttribute('image-photography-container-index-number') as string, 10);

                if ( isIntersecting ) {
                    if ( intersectionRatio >= 0 && intersectionRatio < 0.45 ) {
                        // console.log('Элемент появился в области наблюдения');
                    }

                    if ( intersectionRatio >= 0.45 && intersectionRatio < 0.75 ) {
                        // console.log('Элемент наполовину в области наблюдения');

                        componentThis.startScrollVisiableAnimation(imagePhotographyContainerIndexNumber);
                    }

                    if ( intersectionRatio === 1 ) {
                        // console.log('Элемент полностью в области наблюдения');
                    }
                } else {
                    // console.log('Нет пересечения');
                     
                    componentThis.currentScrollSnapSectionVisiableAnimationStates[imagePhotographyContainerIndexNumber].state = 'unvisiable';
                    componentThis.currentScrollSnapSectionVisiableAnimationStates[imagePhotographyContainerIndexNumber].finished = false;
                }
            });
        };

        if ( this.isPlatformBrowser ) {
            const nav: HTMLElement = document.querySelector('nav') as HTMLElement;
            const footer: HTMLElement = document.querySelector('footer') as HTMLElement;
            const intersectionObserverOptions: IIntersectionObserverInit = {
                root: document.getElementById('main-container') as HTMLDivElement, // root: undefined
                threshold: [ 0, 0.5, 1 ],
                rootMargin: `${ nav.offsetHeight }px 0px ${ footer.offsetHeight }px 0px`,
                trackVisibility: false
            }

            componentThis.imagePhotographyTypesGroups.map(group => group.nativeElement).forEach(( group, index ) => {
                if ( this.intersectionObservers === null ) this.intersectionObservers = [];

                this.intersectionObservers.push(new IntersectionObserver(callback, intersectionObserverOptions));
                this.intersectionObservers[index].observe(group);
            });
        }
    }

    public getCompressedImagesData (componentThis: HomeComponent, compressedImagesListDataStateKey: StateKey<ICompressedImageWithoutRelationFields[] | null>): void {
        this._clientService.getCompressedImagesData('home', 'horizontal').subscribe({
            next: imagesData => {
                componentThis.compressedImagesList = imagesData.length !== 0 ? imagesData : null;

                this._transferState.set(compressedImagesListDataStateKey, imagesData);
            },
            error: () => this._appService.createErrorModal()
        });
    }

    public getDiscountsData (componentThis: HomeComponent, discountsDataStateKey: StateKey<IDiscount[] | null>): void {
        this._clientService.getDiscountsData().subscribe({
            next: discountsData => {
                componentThis.discountsData = discountsData.length !== 0 ? discountsData : null;

                this._transferState.set(discountsDataStateKey, discountsData);
            },
            error: () => this._appService.createErrorModal()
        });
    }

    public getImagePhotographyTypesData (componentThis: HomeComponent, imagePhotographyTypesStateKey: StateKey<IImagePhotographyType[][] | null>): void {
        this._clientService.getImagePhotographyTypesData('home').subscribe({
            next: imagePhotographyTypesData => {
                componentThis.imagePhotographyTypes = imagePhotographyTypesData.length !== 0 ? imagePhotographyTypesData: null;

                this._transferState.set(imagePhotographyTypesStateKey, imagePhotographyTypesData);

                componentThis.setAnimationsStates();
            },
            error: () => this._appService.createErrorModal()
        });
    }
}