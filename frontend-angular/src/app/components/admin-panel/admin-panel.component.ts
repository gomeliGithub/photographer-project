import { AfterViewChecked, AfterViewInit, ChangeDetectorRef, Component, ElementRef, HostBinding, Inject, OnInit, PLATFORM_ID, QueryList, ViewChildren } from '@angular/core';
import { CommonModule, DOCUMENT, isPlatformBrowser, isPlatformServer } from '@angular/common';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { animate, state, style, transition, trigger } from '@angular/animations';

import { Subscription } from 'rxjs';

import { NgbModalRef, NgbModule, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslateModule } from '@ngx-translate/core';

import { OffcanvasSearchComponent } from './offcanvas-search/offcanvas-search.component';

import { ImageSizePipe } from '../../pipes/image-size/image-size.pipe';
import { BooleanPipe } from '../../pipes/boolean/boolean.pipe';

import { AppService } from '../../app.service';
import { AdminPanelService } from '../../services/admin-panel/admin-panel.service';
import { ClientService } from '../../services/client/client.service';
import { WebSocketService } from '../../services/web-socket/web-socket.service';

import { AnimationEvent, Image_display_types, Image_photography_types, IPreviousActiveImageOperations } from '@photographer-project/types';
import { ICompressedImageWithoutRelationFields, IImagePhotographyType } from '@photographer-project/types';
import { IGetFullCompressedImagesDataOptions, SortBy_Types } from '@photographer-project/types';
import { IImageMeta } from '@photographer-project/types';

@Component({
    selector: 'app-admin-panel',
    standalone: true,
	imports: [ CommonModule, ReactiveFormsModule, NgbModule, ImageSizePipe, BooleanPipe, TranslateModule, OffcanvasSearchComponent ],
    templateUrl: './admin-panel.component.html',
    styleUrls: ['./admin-panel.component.css'],
    animations: [
        trigger('compressed-image-containers-animation', [
            state('leave', style({ opacity: 0, transform: 'rotate(90deg)' })),
            state('enter', style({ opacity: 1, transform: 'rotate(0deg)' })),
            transition('leave => enter', [
                animate('1s ease-in-out', style({ opacity: 1, transform: 'rotate(0deg)' }))
            ]),
            transition('enter => leave', [
                animate('1s ease-in-out', style({ opacity: 0, transform: 'rotate(90deg)' }))
            ])
        ]),
        trigger('compressed-image-containers-delete-animation', [
            transition(':leave', [
                style({ opacity: 1, transform: 'translate3d(0, 0, 0)' }),
                animate('400ms ease-in-out', style({ opacity: 0, transform: 'translate3d(-120%, -120%, 0) rotate(-90deg)' })),
            ])
        ]),
        trigger('compressed-image-data-containers-animation', [
            state('static', style({ 
                opacity: 0, 
                width: 'calc(100% + {{ wOffset }}%)',
                height: 'calc(100% + {{ hOffset }}%)'
            }), { params: { wOffset: 0, hOffset: 0 } }), // opacity: 0 
            state('showed', style({ 
                opacity: 1, 
                width: 'calc(100% + {{ wOffset }}%)',
                height: 'calc(100% + {{ hOffset }}%)'
            }), { params: { wOffset: 0, hOffset: 0 } }), // opacity: 1
            transition('static => showed', [
                animate('0.5s ease-in-out', style({ 
                    opacity: 1, 
                    width: 'calc(100% + {{ wOffset }}%)',
                    height: 'calc(100% + {{ hOffset }}%)'
                })) // opacity: 1
            ]),
            transition('showed => static', [
                animate('0.5s ease-in-out', style({ 
                    opacity: 0, 
                    width: 'calc(100% + {{ wOffset }}%)',
                    height: 'calc(100% + {{ hOffset }}%)'
                })) // opacity: 0 
            ])
        ]),
        trigger('image-thumbnail-container-animation', [
            state('true', style({
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)' 
            })),
            state('false', style({
                top: '50%',
                left: '50%',
                transform: 'translate(-230%, -50%)' 
            })),
            transition('false => true', [
                animate('1s ease', style({ transform: 'translate(-50%, -50%)' }))
            ]),
            transition('true => false', [
                animate('0.5s ease', style({ transform: 'translate(-230%, -50%)' }))
            ])
        ])
    ],
    host: { ngSkipHydration: 'true' }
})
export class AdminPanelComponent implements OnInit, AfterViewChecked, AfterViewInit {
    public isPlatformBrowser: boolean;
    public isPlatformServer: boolean;

    private _mediaQueryList: MediaQueryList;
    public PCOrTabletDevice: boolean;

    public uploadImageForm: FormGroup<{
        imagePhotographyType: FormControl<string | null>;
        imageDisplayType: FormControl<string | null>;
        image: FormControl<FileList | null>;
        imageDescription: FormControl<string | null>;
    }>;
    public uploadImageButtonIsDisabled: boolean = false;
    public uploadImageAccordionButtonTooltipIsHidden: boolean = false;

    public changeImageDataForm: FormGroup<{
        newImagePhotographyType: FormArray<FormControl<Image_photography_types | null>>;
        newImageDisplayType: FormArray<FormControl<Image_display_types | null>>;
        newImageDescription: FormArray<FormControl<string | null>>;
    }>;

    public changeImageDataFormElementPEIsNone: boolean = true;

    public changeImageDataFormPreviousValues: { [controlName: string]: ( string | null )[] } = {
        newImagePhotographyType: [],
        newImageDisplayType: [],
        newImageDescription: []
    };
    public changeImageDataFormSubmitButtonsHiddenStatus: boolean[] = [];

    public searchImagesForm: FormGroup<{
        dateFrom: FormControl<string | null>;
        dateUntil: FormControl<string | null>;
        photographyTypes: FormArray<FormControl<boolean>>;
        displayTypes: FormArray<FormControl<boolean>>;
        sortBy: FormControl<SortBy_Types>;
    }>;

    public imagePhotographyTypes: Image_photography_types[] = [];
    public imageDisplayTypes: Image_display_types[] = [];
    public sortBy_TypesArr: SortBy_Types[] = (() => {
        const result: SortBy_Types[] = [];

        for ( const data in SortBy_Types ) result.push(data as SortBy_Types);

        return result;
    })();


    public compressedImagesStates: {
        containersAnimationCurrent: string[];
        dataContainersAnimationCurrent: string[];
        containersDeleteStatus: boolean[];
        thumbnailUrls: string[];
        containerAnimationIsDone: boolean;
        buttonsIsHidden: boolean;
        dataIsLoaded: boolean
    } = {
        containersAnimationCurrent: [],
        dataContainersAnimationCurrent: [],
        containersDeleteStatus: [],
        thumbnailUrls: [],
        containerAnimationIsDone: false,
        buttonsIsHidden: true,
        dataIsLoaded: false
    };

    public imageThumbnailStates: {
        url: string | null;
        containerAnimation: boolean;
        containerIsVisible: boolean;
    } = {
        url: null,
        containerAnimation: false,
        containerIsVisible: false
    }

    public fullCompressedImagesStates: {
        list: ICompressedImageWithoutRelationFields[];
        listCount: number;
        additionalIsExists: boolean;
    } = {
        list: [],
        listCount: 0,
        additionalIsExists: false
    }

    public searchImagesFormStates: {
        currentDateFrom: Date | undefined;
        currentDateUntil: Date | undefined;
        currentPhotographyTypes: Image_photography_types[] | undefined;
        currentDisplayTypes: Image_display_types[] | undefined;
        previousPhotographyTypes: Image_photography_types[];
        previousDisplayTypes: Image_display_types[];
        previousPhotographyTypesNotChange: boolean;
        previousDisplayTypesNotChange: boolean;
    } = {
        currentDateFrom: undefined,
        currentDateUntil: undefined,
        currentPhotographyTypes: undefined,
        currentDisplayTypes: undefined,
        previousPhotographyTypes: [],
        previousDisplayTypes: [],
        previousPhotographyTypesNotChange: false,
        previousDisplayTypesNotChange: false
    }

    public requiredImageFileTypes: string[] = [ 'image/jpg', 'image/jpeg', 'image/png' ];

    public imageFile: File | null;

    public imagePhotographyTypesData: IImagePhotographyType[] | null;

    public deleteImageIsCompleted: boolean = false;

    public currentLoadedImageThumbnailOriginalName: string | null;

    public spinnerHidden: boolean = true;

    public readonly previousActiveImageOperations: IPreviousActiveImageOperations = {
        upload: false,
        changeData: false,
        delete: false,
        changeDisplayTarget: false,
        setPhotographyType: false,
        getFullCompressedList: false,
        getThumbnail: false,
        changePhotographyTypeDescription: false
    };

    public imagePhotographyTypeDescriptionPreviousValues: { value: string, unchanged: boolean }[] = [];

    public activeImageDataContainers: number[] = [];
    public widthOffset: number = 0;
    public heightOffset: number = 0;

    constructor (
        @Inject(PLATFORM_ID) private readonly platformId: string,
        @Inject(DOCUMENT) private readonly _document: Document,

        public changeDetectorRef: ChangeDetectorRef,

        private readonly _appService: AppService,
        private readonly _adminPanelService: AdminPanelService,
        private readonly _clientService: ClientService,
        private readonly _webSocketService: WebSocketService
    ) {
        this.isPlatformBrowser = isPlatformBrowser(this.platformId);
        this.isPlatformServer = isPlatformServer(this.platformId);
        
        this.uploadImageForm = new FormGroup({
            'imagePhotographyType': new FormControl("", [ Validators.required, this.imagePhotographyTypeValidator ]),
            'imageDisplayType': new FormControl("", [ Validators.required, this.imageDisplayTypeValidator ]),
            'image': new FormControl([] as unknown as FileList, [ Validators.required, this.imageValidator ]),
            'imageDescription': new FormControl("", Validators.maxLength(20))
        });

        this.changeImageDataForm = new FormGroup({
            'newImagePhotographyType': new FormArray([new FormControl()]),
            'newImageDisplayType': new FormArray([new FormControl()]),
            'newImageDescription': new FormArray([new FormControl()])
        });

        this.searchImagesForm = new FormGroup({
            'dateFrom': new FormControl(null) as FormControl<string | null>,
            'dateUntil': new FormControl(null) as FormControl<string | null>,
            'photographyTypes': new FormArray([new FormControl()]),
            'displayTypes': new FormArray([new FormControl()]),
            'sortBy': new FormControl(SortBy_Types.uploadDate) as FormControl<SortBy_Types>,
        });
    }

    public documentBody: HTMLBodyElement = this._document.getElementsByTagName('body')[0];

    @HostBinding('className') public get componentClassValue (): string {
        return this._webSocketService.componentClass;
    }

    @ViewChildren('imagePhotographyTypeDescription', { read: ElementRef<HTMLInputElement> })
    public imagePhotographyTypeDescriptionViewRefs: QueryList<ElementRef<HTMLInputElement>>;

    @ViewChildren(NgbTooltip) tooltips: QueryList<NgbTooltip>;

    ngOnInit (): void {
        if ( this.isPlatformBrowser ) {
            this._appService.getTranslations('PAGETITLES.ADMINPANEL.IMAGESCONTROL', true).subscribe(translation => this._appService.setTitle(translation));

            for ( const data in Image_photography_types ) {
                this.imagePhotographyTypes.push(data as Image_photography_types);
            }
            for ( const data in Image_display_types ) {
                this.imageDisplayTypes.push(data as Image_display_types);
            }

            this.searchImagesForm.controls.photographyTypes = new FormArray(this.imagePhotographyTypes.map(() => new FormControl(false) as FormControl<boolean>));
            this.searchImagesForm.controls.displayTypes = new FormArray(this.imageDisplayTypes.map(() => new FormControl(false) as FormControl<boolean>));

            this.getFullCompressedImagesData(false, { sortBy: this.sortBy_TypesArr[4] });

            this._clientService.getImagePhotographyTypesData('admin').subscribe({
                next: imagePhotographyTypesData => {
                    this.imagePhotographyTypesData = imagePhotographyTypesData.length !== 0 ? imagePhotographyTypesData : null;
                    if ( this.imagePhotographyTypesData !== null ) {
                        this.imagePhotographyTypesData.forEach(data => this.imagePhotographyTypeDescriptionPreviousValues.push({ value: data.description !== null ? data.description : '', unchanged: true }));
                    }
                },
                error: () => this._appService.createErrorModal()
            });

            this._adminPanelService.spinnerHiddenStatusChange.subscribe(value => {
                this.spinnerHidden = value;
            });
        }
    }

    ngAfterViewChecked (): void {
        if ( !this.compressedImagesStates.containerAnimationIsDone && this.compressedImagesStates.thumbnailUrls && this.fullCompressedImagesStates.list && this.compressedImagesStates.thumbnailUrls.length === this.fullCompressedImagesStates.list.length ) {
            this.compressedImagesStates.containersAnimationCurrent.forEach(( data, index, arr ) => data === 'leave' ? arr[index] = 'enter' : null);

            this.changeDetectorRef.detectChanges();

            this.compressedImagesStates.containerAnimationIsDone = true;
        }
    }

    ngAfterViewInit (): void {
        if ( this.isPlatformBrowser ) {
            this._mediaQueryList = window.matchMedia('(min-width: 1024px) and (orientation: landscape)');
            this._handleDeviceChange(this._mediaQueryList);
            this._mediaQueryList.addEventListener('change', this._onMediaChange);
        }
    }

    public get progressBarVisible (): boolean {
        return this._webSocketService.progressBarVisible;
    }

    public get progressBarValue (): number {
        return this._webSocketService.progressBarValue;
    }

    public uploadImageAccordionHide (): void {
        this.uploadImageAccordionButtonTooltipIsHidden = true;
    }

    public uploadImageAccordionShow (): void {
        this.uploadImageAccordionButtonTooltipIsHidden = true;
    }

    public uploadImageAccordionHidden (): void {
        this.uploadImageAccordionButtonTooltipIsHidden = false;
    }

    public uploadImageAccordionShown (): void {
        this.uploadImageAccordionButtonTooltipIsHidden = false;
    }

    public changeDocumentBodyUserInteractions (): void {
        if ( this.documentBody.classList.contains('pe-none') ) this.documentBody.classList.remove('pe-none');
        else this.documentBody.classList.add('pe-none');
    }

    public closeAllTooltips (btnTooltip: HTMLButtonElement): void {
        this.tooltips.forEach((tooltip: NgbTooltip) => {
            if ( tooltip.isOpen() ) {
                tooltip.close();
                btnTooltip.blur();
            }
        });
    }

    private _onMediaChange = (event: MediaQueryListEvent) => {
        if ( this.isPlatformBrowser ) this._handleDeviceChange(event);
    };

    private _handleDeviceChange (mq: MediaQueryList | MediaQueryListEvent): void {
        if ( mq.matches ) this.PCOrTabletDevice = true;
        else this.PCOrTabletDevice = false;
    }

    public fileChange (event: any): void {
        const fileList: FileList = event.target.files;

        if ( fileList.length < 1 ) {
            return;
        }

        this.imageFile = fileList[0];
    }

    public imageValidator (): { [ s: string ]: boolean } | null {
        if ( this && this.imageFile !== null && ( ( this.imageFile.size > 104857600 || this.imageFile.name.length < 4 ) 
            || !this.requiredImageFileTypes.includes(this.imageFile.type) )
        ) {
            this.imageFile = null;

            return { 'image' : true };
        }

        return null;
    }

    public imagePhotographyTypeValidator (control: FormControl<string>): { [ s: string ]: boolean } | null {
        if ( !( control.value in Image_photography_types ) ) {
            return { 'imagePhotographyType': true, 'newImagePhotographyType': true };
        }

        return null;
    }

    public imageDisplayTypeValidator (control: FormControl<string>): { [ s: string ]: boolean } | null {
        if ( !( control.value in Image_display_types ) ) {
            return { 'imageDisplayType': true, 'newDisplayType': true };
        }

        return null;
    }

    public changeImageFormControlChange (formArrayName: 'newImagePhotographyType' | 'newImageDisplayType' | 'newImageDescription', formControlIndex: number): void {
        this._adminPanelService.changeImageFormControlChange(this, formArrayName, formControlIndex);
    }

    public loadAndShowImageThumbnail (event: MouseEvent): void {
        if ( !this.previousActiveImageOperations.getThumbnail ) {
            this.previousActiveImageOperations.getThumbnail = true;

            const imageButton: HTMLButtonElement = !( event.target instanceof HTMLButtonElement ) ? ( event.target as HTMLButtonElement ).parentElement as HTMLButtonElement : event.target as HTMLButtonElement;

            if ( imageButton ) {
                const loadAndShowSubscription: Subscription | undefined = this._adminPanelService.loadAndShowImageThumbnail(this, imageButton, false);
                if ( loadAndShowSubscription ) loadAndShowSubscription.add(() => this.previousActiveImageOperations.getThumbnail = false);
                else {
                    this._appService.createErrorModal();

                    this.previousActiveImageOperations.getThumbnail = false;
                }

                // this._adminPanelService.loadAndShowImageThumbnail(this, imageButton, false);
            } else {
                this._appService.createErrorModal();

                this.previousActiveImageOperations.getThumbnail = false;
            }
        } else this._appService.createWarningModal(this._appService.getTranslations('ADMINPANEL.PREVIOUSACTIVEIMAGEOPERATIONSMESSAGES.GETTHUMBNAIL'));
    }

    public loadAndShowImageThumbnailRecursive (compressedImagesList: ICompressedImageWithoutRelationFields[], currentIndex: number): void {
        this._adminPanelService.loadAndShowImageThumbnail(this, null, true, compressedImagesList[currentIndex].originalName, compressedImagesList, currentIndex);
    }

    public imageThumbnailContainerAnimationDone (event: AnimationEvent): void {
        if ( event.toState === false ) {
            this.imageThumbnailStates.url = null;
            this.imageThumbnailStates.containerIsVisible = false;
            this.currentLoadedImageThumbnailOriginalName = null;
        }
    }

    public switchImageThumbnailContainerVisible (): void {
        this.imageThumbnailStates.containerAnimation = !this.imageThumbnailStates.containerAnimation;
    }

    public uploadImage (): void {
        if ( !this.previousActiveImageOperations.upload ) {
            this.previousActiveImageOperations.upload = true;

            const { imagePhotographyType, imageDisplayType, imageDescription } = this.uploadImageForm.value;

            const imageMetaJson: IImageMeta = {
                name         : this.imageFile ? this.imageFile.name : null,
                size         : this.imageFile ? this.imageFile.size : null,
                type         : this.imageFile ? this.imageFile.type : null
            };

            if ( this.imageFile !== null ) this._adminPanelService.uploadImage(this, imagePhotographyType, imageDisplayType, imageDescription, imageMetaJson);
            else {
                this._appService.createErrorModal();

                this.previousActiveImageOperations.upload = false;
            }
        } else this._appService.createWarningModal(this._appService.getTranslations('UPLOADIMAGERESPONSES.PREVIOUSUPLOADIMAGEOPERATIONISACTIVE'));
    }

    public cancelUploadImage (): void {
        if ( this.imageFile !== null ) this._adminPanelService.cancelUploadImage();
        else this._appService.createErrorModal();
    }

    public deleteImage (event: MouseEvent, compressedImageIndex: number): void {
        if ( !this.previousActiveImageOperations.delete ) {
            this.previousActiveImageOperations.delete = true;

            const deleteImageButton: HTMLButtonElement = !( event.target instanceof HTMLButtonElement ) ? ( event.target as HTMLElement ).parentElement?.parentElement as HTMLButtonElement : event.target as HTMLButtonElement;

            if ( deleteImageButton ) {
                const deleteSubscription: Subscription | undefined = this._adminPanelService.deleteImage(this, deleteImageButton, compressedImageIndex);
                if ( deleteSubscription ) deleteSubscription.add(() => this.previousActiveImageOperations.delete = false);
                else {
                    this._appService.createErrorModal();

                    this.previousActiveImageOperations.delete = false;
                }

                // this._adminPanelService.deleteImage(this, deleteImageButton, compressedImageIndex);
            } else {
                this._appService.createErrorModal();

                this.previousActiveImageOperations.delete = false;
            }
        } else this._appService.createWarningModal(this._appService.getTranslations('ADMINPANEL.PREVIOUSACTIVEIMAGEOPERATIONSMESSAGES.DELETE'));
    }

    public changeImageDisplayTarget (event: MouseEvent): void {
        if ( !this.previousActiveImageOperations.changeDisplayTarget ) {
            this.previousActiveImageOperations.changeDisplayTarget = true;

            const imageButton: HTMLButtonElement = !( event.target instanceof HTMLButtonElement ) ? ( event.target as HTMLElement ).parentElement?.parentElement as HTMLButtonElement : event.target as HTMLButtonElement;

            if ( imageButton ) {
                const changeSubscription: Subscription | undefined = this._adminPanelService.changeImageDisplayTarget(this, imageButton);
                if ( changeSubscription ) changeSubscription.add(() => this.previousActiveImageOperations.changeDisplayTarget = false);
                else {
                    this._appService.createErrorModal();

                    this.previousActiveImageOperations.changeDisplayTarget = false;
                }

                // this._adminPanelService.changeImageDisplayTarget(this, imageButton);
            } else {
                this._appService.createErrorModal();

                this.previousActiveImageOperations.changeDisplayTarget = false;
            }
        } else this._appService.createWarningModal(this._appService.getTranslations('ADMINPANEL.PREVIOUSACTIVEIMAGEOPERATIONSMESSAGES.CHANGEDISPLAYTARGET'));
    }

    public changeImageData (event: SubmitEvent): void {
        if ( !this.previousActiveImageOperations.changeData ) {
            this.previousActiveImageOperations.changeData = true;

            const submitButton: HTMLButtonElement = event.submitter as HTMLButtonElement;
            const originalImageName: string | null = submitButton.getAttribute('originalImageName');
            if ( originalImageName !== null ) {
                this._adminPanelService.changeImageData(this, originalImageName).add(() => this.previousActiveImageOperations.changeData = false);
            } else {
                this._appService.createErrorModal();

                this.previousActiveImageOperations.changeData = false;
            }
        } else this._appService.createWarningModal(this._appService.getTranslations('ADMINPANEL.PREVIOUSACTIVEIMAGEOPERATIONSMESSAGES.CHANGEDATA'));
    }

    public setPhotographyTypeImage (event: MouseEvent): void {
        if ( !this.previousActiveImageOperations.setPhotographyType ) {
            this.previousActiveImageOperations.setPhotographyType = true;

            const imageButton: HTMLButtonElement = !( event.target instanceof HTMLButtonElement ) ? ( event.target as HTMLElement ).parentElement?.parentElement as HTMLButtonElement : event.target as HTMLButtonElement;

            if ( imageButton ) {
                const setSubscription: Subscription | undefined = this._adminPanelService.setPhotographyTypeImage(this, imageButton);
                if ( setSubscription ) setSubscription.add(() => this.previousActiveImageOperations.setPhotographyType = false);
                else {
                    this._appService.createErrorModal();

                    this.previousActiveImageOperations.setPhotographyType = false;
                }

                // this._adminPanelService.setPhotographyTypeImage(this, imageButton);
            } else {
                this._appService.createErrorModal();

                this.previousActiveImageOperations.setPhotographyType = false;
            }
        } else this._appService.createWarningModal(this._appService.getTranslations('ADMINPANEL.PREVIOUSACTIVEIMAGEOPERATIONSMESSAGES.SETPHOTOGRAPHYTYPE'));
    }

    public changePhotographyTypeDescription (event: MouseEvent, index: number): void {
        if ( !this.previousActiveImageOperations.changePhotographyTypeDescription ) {
            this.previousActiveImageOperations.changePhotographyTypeDescription = true;

            const target: HTMLButtonElement = event.target as HTMLButtonElement;

            if ( target ) {
                const changeSubscription: Subscription | NgbModalRef | undefined = this._adminPanelService.changePhotographyTypeDescription(this, target, index);
                if ( changeSubscription ) {
                    if ( changeSubscription instanceof Subscription ) {
                        changeSubscription.add(() => this.previousActiveImageOperations.changePhotographyTypeDescription = false);
                    }
                } else {
                    this._appService.createErrorModal();

                    this.previousActiveImageOperations.changePhotographyTypeDescription = false;
                }

                // this._adminPanelService.changePhotographyTypeDescription(this, target);
            } else {
                this._appService.createErrorModal();

                this.previousActiveImageOperations.changePhotographyTypeDescription = false;
            }
        } else this._appService.createWarningModal(this._appService.getTranslations('ADMINPANEL.PREVIOUSACTIVEIMAGEOPERATIONSMESSAGES.CHANGEPHOTOGRAPHYTYPEDESCRIPTION'));
    }

    public compressedImageContainersAnimationStarted (event: AnimationEvent): void { 
        if ( event.toState === 'leave' && this.fullCompressedImagesStates.additionalIsExists ) this.changeImageDataFormElementPEIsNone = true;

        if ( event.toState === 'enter' ) this.compressedImagesStates.buttonsIsHidden = true;
    }

    public compressedImageContainersAnimationDone (event: AnimationEvent): void {
        if ( event.toState === 'enter' ) this.changeImageDataFormElementPEIsNone = false;

        if ( this.deleteImageIsCompleted ) {
            this.deleteImageIsCompleted = false;
            this._appService.createSuccessModal();
        }

        if ( event.toState === 'enter' ) this.compressedImagesStates.buttonsIsHidden = false;
    }

    public compressedImageContainersDeleteAnimationStarted (index: number): void {
        this.compressedImageDataContainerClick(index);
    }

    public compressedImageDataContainerClick (index: number): void {
        const currentState: string = this.compressedImagesStates.dataContainersAnimationCurrent[index];

        this.compressedImagesStates.dataContainersAnimationCurrent[index] = currentState === 'showed' ? 'static' : 'showed';

        if ( currentState === 'static' ) this.activeImageDataContainers.push(index);
        else this.activeImageDataContainers = this.activeImageDataContainers.filter(value => value !== index);

        if ( this.fullCompressedImagesStates.list[index].displayType === 'vertical' ) {
            if ( currentState === 'showed' ) {
                this.widthOffset = 0;
            } else {
                this.widthOffset = 70; // 300;
            }
        }

        if ( this.fullCompressedImagesStates.list[index].displayType === 'horizontal' ) {
            if ( currentState === 'showed' ) {
                this.heightOffset = 0;
            } else {
                this.heightOffset = 30;
            }
        }
    }

    public compressedImageDataContainersAnimationStarted (event: AnimationEvent): void {
        const target: HTMLDivElement = event.element;

        this.changeImageDataFormElementPEIsNone = true;

        if ( event.toState === 'showed' ) {
            target.classList.remove('invisible');
            target.classList.add('visible');
        }
    }

    public compressedImageDataContainersAnimationDone (event: AnimationEvent): void {
        const target: HTMLDivElement = event.element;

        this.changeImageDataFormElementPEIsNone = false;

        if ( event.toState === 'static' ) {
            target.classList.remove('visible');
            target.classList.add('invisible');
        }
    }

    public searchImages (componentThis: OffcanvasSearchComponent): void {
        this._adminPanelService.searchImages(this, componentThis);
    }

    public getFullCompressedImagesData (isSearch: boolean, getParams: IGetFullCompressedImagesDataOptions, additionalImagesClick: boolean = false, offcanvasComponentThis?: OffcanvasSearchComponent): void {
        if ( !this.previousActiveImageOperations.getFullCompressedList ) {
            this.previousActiveImageOperations.getFullCompressedList = true;

            let imagesExistsCount: number = this.fullCompressedImagesStates.list ? this.fullCompressedImagesStates.list.length : 0;

            if ( isSearch ) imagesExistsCount = this.searchImagesFormStates.previousPhotographyTypesNotChange && this.searchImagesFormStates.previousDisplayTypesNotChange ? this.fullCompressedImagesStates.list.length : 0;
            
            this.changeDocumentBodyUserInteractions();

            this._adminPanelService.getFullCompressedImagesData(this, isSearch, {
                imagesLimit: getParams.imagesLimit, 
                imagesExistsCount,
                dateFrom: getParams.dateFrom,
                dateUntil: getParams.dateUntil,
                photographyTypes: getParams.photographyTypes,
                displayTypes: getParams.displayTypes,
                sortBy: getParams.sortBy
            }, additionalImagesClick).add(() => {
                this.previousActiveImageOperations.getFullCompressedList = false;

                if ( offcanvasComponentThis ) offcanvasComponentThis.searchImagesButtonIsDisabled = false; //////////////////////////////////////// CHECK /////////////////////////////////
            });
        } else this._appService.createWarningModal(this._appService.getTranslations('ADMINPANEL.PREVIOUSACTIVEIMAGEOPERATIONSMESSAGES.GETFULLCOMPRESSEDLIST'));
    }

    public searchImagesFormReset (): void {
        this.searchImagesForm.reset();

        this.searchImagesFormStates.currentDateFrom = undefined;
        this.searchImagesFormStates.currentDateUntil = undefined;
        this.searchImagesFormStates.currentPhotographyTypes = undefined;
        this.searchImagesFormStates.currentDisplayTypes = undefined;
        this.searchImagesFormStates.previousPhotographyTypes = [];
        this.searchImagesFormStates.previousDisplayTypes = [];
        this.searchImagesFormStates.previousPhotographyTypesNotChange = false;
        this.searchImagesFormStates.previousDisplayTypesNotChange = false;
    }

    public getSearchImagesMethod (): { callParentMethod: (componentThis: OffcanvasSearchComponent) => void } {
        return {
            callParentMethod: (componentThis: OffcanvasSearchComponent) => {
                this.searchImages(componentThis)
            }
        }
    }

    public getSearchImagesFormResetMethod (): { callParentMethod: () => void } {
        return {
            callParentMethod: () => {
                this.searchImagesFormReset()
            }
        }
    }

    public imagePhotographyTypeDescriptionInput (photographyTypeName: string, index: number): void { ///////////////////// NEW //////////////////////
        const photographyTypeTextareaValue: string = ( this.imagePhotographyTypeDescriptionViewRefs.find(imagePhotographyTypeDescription => {
            return imagePhotographyTypeDescription.nativeElement.getAttribute('photography-type-name') === photographyTypeName;
        }) as ElementRef<HTMLInputElement> ).nativeElement.value;

        if ( this.imagePhotographyTypeDescriptionPreviousValues[index].value === photographyTypeTextareaValue ) this.imagePhotographyTypeDescriptionPreviousValues[index].unchanged = true;
        else this.imagePhotographyTypeDescriptionPreviousValues[index].unchanged = false;
    } ///////////////////// NEW //////////////////////
}