import { AfterContentChecked, AfterRenderPhase, AfterViewInit, ChangeDetectorRef, Component, ElementRef, Inject, OnDestroy, OnInit, PLATFORM_ID, QueryList, TransferState, ViewChildren, afterRender, makeStateKey } from '@angular/core';
import { CommonModule, isPlatformBrowser, isPlatformServer } from '@angular/common';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { animate, state, style, transition, trigger } from '@angular/animations';

import { NgbModule } from '@ng-bootstrap/ng-bootstrap';

import { TranslateModule } from '@ngx-translate/core';
import { DeviceDetectorService, DeviceInfo } from 'ngx-device-detector';

import { AppService } from '../../app.service';
import { ClientService } from '../../services/client/client.service';
import { HomeService } from '../../services/home/home.service';

import { AnimationEvent } from '@photographer-project/types';
import { ICompressedImageWithoutRelationFields, IDiscount, IImagePhotographyType } from '@photographer-project/types';

const compressedImagesListDataStateKey = makeStateKey<ICompressedImageWithoutRelationFields[] | null>('compressedImagesList');
const discountsDataStateKey = makeStateKey<IDiscount[] | null>('discountsData');
const imagePhotographyTypesStateKey = makeStateKey<IImagePhotographyType[][] | null>('imagePhotographyTypes');

@Component({
    selector: 'app-home',
    standalone: true,
    imports: [ CommonModule, NgbModule, RouterModule, TranslateModule ],
    templateUrl: './home.component.html',
    styleUrls: ['./home.component.css'],
    animations: [
        trigger('mouseTrigger', [
            state('enter', style({
                // opacity: 0.4,
                // transform: 'rotate3d(0, -5, 0, -0.5turn) scale(0.8)'
                transform: 'scale(0.85)'
            })),
            state('leave', style({
                // opacity: 1
            })),
            transition('enter => leave', [
                animate('0.5s ease'),
            ]),
            transition('leave => enter', [
                animate('0.5s ease')
            ])
        ]),
        trigger('link-button-container-animation', [
            state('enter', style({ opacity: 1, transform: 'translate(-50%, -80%) scale(1)' })),
            state('leave', style({ opacity: 0, transform: 'translate(-50%, -80%) scale(0)' })),
            transition('enter => leave', [
                animate('300ms ease', style({ opacity: 0, transform: 'translate(-50%, -80%) scale(0)' }))
            ]),
            transition('leave => enter', [
                animate('0.2s 400ms ease', style({ opacity: 1, transform: 'translate(-50%, -80%) scale(1)' }))
            ])
        ]),
        trigger('scroll-visiable-animation', [
            state('visiable', style({ opacity: 1, transform: 'translateY(0px)' })),
            state('unvisiable', style({ opacity: 0, transform: 'translateY(200px)' })),
            transition('unvisiable => visiable', [
                animate('0.9s 200ms ease-out', style({ opacity: 1, transform: 'translateY(0px)' }))
            ]),
            transition('visiable => unvisiable', [
                animate('0.9s 200ms ease-out', style({ opacity: 0, transform: 'translateY(200px)' }))
            ])
        ])
    ]
})
export class HomeComponent implements OnInit, AfterContentChecked, AfterViewInit, OnDestroy {
    public isPlatformBrowser: boolean;
    public isPlatformServer: boolean;

    public componentElementIsRendered: boolean = false;
    
    public deviceInfo: DeviceInfo | null = null;
    private _mediaQueryList: MediaQueryList;
    private _isCorrectScrollVisiableAnimationDevice: boolean = true;

    public isMobileDevice: boolean = false;
    public isTabletDevice: boolean = false;
    public isDesktopDevice: boolean = false;

    public compressedImagesDataIsLoaded: boolean = false;
    
    public currentMouseTriggerStates: string[] = [];
    public currentLinkButtonContainerAnimationStates: string[] = [];

    public currentScrollSnapSectionVisiableAnimationStates: { state: string, finished: boolean }[] = [];

    public compressedImagesList: ICompressedImageWithoutRelationFields[] | null;

    public discountsData: IDiscount[] | null;

    public imagePhotographyTypes: IImagePhotographyType[][] | null;
    public flatImagePhotographyTypes: IImagePhotographyType[] | null;

    @ViewChildren('imagePhotographyTypesGroup') public readonly imagePhotographyTypesGroups: QueryList<ElementRef<HTMLDivElement>>;

    constructor (
        @Inject(PLATFORM_ID) private readonly platformId: string,

        private readonly _router: Router,
        private readonly _changeDetector: ChangeDetectorRef,
        private readonly _transferState: TransferState,
        
        private readonly _deviceService: DeviceDetectorService,

        private readonly _appService: AppService,
        private readonly _clientService: ClientService,
        private readonly _homeService: HomeService,
    ) {
        this.isPlatformBrowser = isPlatformBrowser(this.platformId);
        this.isPlatformServer = isPlatformServer(this.platformId);
        
        afterRender(() => {
            if ( !this.componentElementIsRendered ) {
                this.componentElementIsRendered = true;
            }
        }, { phase: AfterRenderPhase.Read });
    }

    ngOnInit (): void {
        this._appService.getTranslations('PAGETITLES.HOME', true).subscribe(translation => {
            this._appService.setTitle(translation);
        });

        this._router.events.subscribe(evt => {
            if ( !( evt instanceof NavigationEnd ) ) return;
            else {
                if ( !evt.url.startsWith('/') ) this._clientService.setNavbarAnimationState('static');
            }
        });

        if ( this.isPlatformServer ) {
            this._homeService.getCompressedImagesData(this, compressedImagesListDataStateKey);
            this._homeService.getDiscountsData(this, discountsDataStateKey);
            this._homeService.getImagePhotographyTypesData(this, imagePhotographyTypesStateKey);
        } else if ( this.isPlatformBrowser ) {
            this.compressedImagesList = this._transferState.get<ICompressedImageWithoutRelationFields[] | null>(compressedImagesListDataStateKey, null);
            if ( this.compressedImagesList === null ) this._homeService.getCompressedImagesData(this, compressedImagesListDataStateKey);

            this.discountsData = this._transferState.get<IDiscount[] | null>(discountsDataStateKey, null);
            if ( this.discountsData === null ) this._homeService.getDiscountsData(this, discountsDataStateKey);

            this.imagePhotographyTypes = this._transferState.get<IImagePhotographyType[][] | null>(imagePhotographyTypesStateKey, null);
            if ( this.imagePhotographyTypes === null ) this._homeService.getImagePhotographyTypesData(this, imagePhotographyTypesStateKey);

            this.setAnimationsStates();

            if ( !this._isCorrectScrollVisiableAnimationDevice ) {
                this.startScrollVisiableAnimation(0);
                this.startScrollVisiableAnimation(1);
                this.startScrollVisiableAnimation(2);
            }
        }
    }

    ngAfterContentChecked (): void {
        this.setDeviceInfo();

        this._changeDetector.detectChanges();
    }

    ngAfterViewInit (): void {
        if ( this.isPlatformBrowser && this.imagePhotographyTypesGroups.length > 0 ) {
            this._mediaQueryList = window.matchMedia('(min-width: 1024px) and (orientation: landscape)');
            this._handleDeviceChange(this._mediaQueryList);
            this._mediaQueryList.addEventListener('change', this._onMediaChange);
        }
    }

    ngOnDestroy (): void {
        this.componentElementIsRendered = false;
        this.compressedImagesDataIsLoaded = false;

        this._destroyIntersectionObserver();
        if ( this.isPlatformBrowser ) this._mediaQueryList.removeEventListener('change', this._onMediaChange);
    }

    private _onMediaChange = (event: MediaQueryListEvent) => {
        if ( this.isPlatformBrowser ) this._handleDeviceChange(event);
    };

    private _handleDeviceChange (mq: MediaQueryList | MediaQueryListEvent): void {
        if ( mq.matches ) {
            // Если это ПК или планшет в альбоме — включаем Observer
            this._isCorrectScrollVisiableAnimationDevice = true;

            this._homeService.snapSectionScrollObserve(this);
        } else {
            // Если устройство не подходит — отключаем Observer и сбрасываем анимацию
            this._destroyIntersectionObserver();

            console.log('Wrong Device'); ///////////////////// DELETE /////////////////////

            if ( this.currentScrollSnapSectionVisiableAnimationStates.length !== 0 && this.currentScrollSnapSectionVisiableAnimationStates.every(states => states.finished === false) ) {
                this.startScrollVisiableAnimation(0);
                this.startScrollVisiableAnimation(1);
                this.startScrollVisiableAnimation(2);
            }

            this._isCorrectScrollVisiableAnimationDevice = false;
        }
    }

    private _destroyIntersectionObserver (): void {
        if ( this._homeService.intersectionObservers !== null ) {
            this._homeService.intersectionObservers.forEach(observer => observer.disconnect());
            this._homeService.intersectionObservers = null;
        }
    }

    public setAnimationsStates (): void {
        if ( this.imagePhotographyTypes !== null ) {
            this.flatImagePhotographyTypes = this.imagePhotographyTypes.flat();
            this.flatImagePhotographyTypes.forEach(() => {
                this.currentMouseTriggerStates.push('leave');
                this.currentLinkButtonContainerAnimationStates.push('leave');
            });

            ( this.imagePhotographyTypes as IImagePhotographyType[][] ).forEach(() => this.currentScrollSnapSectionVisiableAnimationStates.push({ state: 'unvisiable', finished: false }));

            this.currentScrollSnapSectionVisiableAnimationStates.push({ state: 'unvisiable', finished: false });

            this._changeDetector.detectChanges();
        }
    }

    public setDeviceInfo (): void {
        this.deviceInfo = this._deviceService.getDeviceInfo();
        
        this.isMobileDevice = this._deviceService.isMobile();
        this.isTabletDevice = this._deviceService.isTablet();
        this.isDesktopDevice = this._deviceService.isDesktop();
    }

    public startMouseTriggerAnimation (index: number): void {
        if ( this.isDesktopDevice ) this.currentMouseTriggerStates[index] = this.currentMouseTriggerStates[index] === 'enter' ? 'leave' : 'enter';
    }

    public startMouseTriggerAnimationClick (index: number): void {
        if ( this.isMobileDevice ) {
            this.currentMouseTriggerStates = this.currentMouseTriggerStates.map((_, i) => {
                if ( i !== index ) return 'leave';
                else return this.currentMouseTriggerStates[index] === 'enter' ? 'leave' : 'enter';
            });
        }
    }
    
    public startScrollVisiableAnimation (index: number): void {
        if ( !this.currentScrollSnapSectionVisiableAnimationStates[index].finished ) {
            this.currentScrollSnapSectionVisiableAnimationStates[index].state = 'visiable';
            this.currentScrollSnapSectionVisiableAnimationStates[index].finished = true;
        }
    }

    public scrollVisiableAnimationStarted (event: AnimationEvent): void {
        if ( event.toState === 'visiable' ) {
            const target: HTMLDivElement = event.element;

            target.classList.add('pe-none');
        }
    }

    public scrollVisiableAnimationDone (event: AnimationEvent): void {
        if ( event.toState === 'visiable' ) {
            const target: HTMLDivElement = event.element;

            target.classList.remove('pe-none');
        }
    }

    public setCurrentMouseTriggerStateIndex (name: string): number { 
        return ( this.flatImagePhotographyTypes as IImagePhotographyType[] ).findIndex(imagePhotographyTypeData => imagePhotographyTypeData.name === name);
    }

    public mouseTriggerAnimationStarted (event: AnimationEvent): void {
        const mouseTriggerElement: HTMLDivElement = event.element as HTMLDivElement;
        const indexNumber: number = parseInt(( mouseTriggerElement.parentElement as HTMLElement ).getAttribute('mouse-trigger-state-index') as string, 10);

        if ( event.toState === 'leave' ) this.currentLinkButtonContainerAnimationStates[indexNumber] = 'leave';
        if ( event.toState === 'enter' ) this.currentLinkButtonContainerAnimationStates[indexNumber] = 'enter';
    }
}