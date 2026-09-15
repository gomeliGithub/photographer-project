import { ChangeDetectionStrategy, Component, ElementRef, Inject, OnInit, PLATFORM_ID, ViewChild } from '@angular/core';
import { CommonModule, isPlatformBrowser, isPlatformServer } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { animate, state, style, transition, trigger } from '@angular/animations';

import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { TranslateModule } from '@ngx-translate/core';

import { AppService } from '../../../app/app.service';
import { ClientService } from '../../services/client/client.service';

import { AnimationEvent, Image_photography_types } from '@photographer-project/types';

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'app-prices',
    standalone: true,
    imports: [ CommonModule, ReactiveFormsModule, NgbModule, TranslateModule ],
    templateUrl: './prices.component.html',
    styleUrl: './prices.component.css',
    animations: [
        trigger('send-order-form-animation', [
            state('hide', style({
                transform: 'translate(-400%, 0) rotate3d(1, 1, 1, 90deg)'
            })),
            state('show', style({
                transform: 'translate(0, 0) rotate3d(0, 0, 0, 0)'
            })),
            transition('hide => show', [
                animate('0.5s 300ms ease-in', style({ transform: 'translate(0, 0) rotate3d(0, 0, 0, 0)' }))
            ]),
            transition('show => hide', [
                animate('0.2s', style({ transform: 'translate(-400%, 0) rotate3d(1, 1, 1, 90deg)' }))
            ])
        ])
    ]
})
export class PricesComponent implements OnInit  {
    public isPlatformBrowser: boolean;
    public isPlatformServer: boolean;

    public photographyType: Image_photography_types;

    public sendOrderForm: FormGroup<{
        orderType: FormControl<string | null>,
        clientPhoneNumber: FormControl<string | null>,
        comment: FormControl<string | null>
    }>;

    public linkContainerAnimationStates: string[] = [];
    public linkContainerAnimationDisplayValues: string[] = [];

    public sendOrderFormAnimationState: string = 'hide';

    constructor (
        @Inject(PLATFORM_ID) private readonly _platformId: string,

        private readonly _appService: AppService,
        private readonly _clientService: ClientService
    ) {
        this.isPlatformBrowser = isPlatformBrowser(this._platformId);
        this.isPlatformServer = isPlatformServer(this._platformId);

        this.sendOrderForm = new FormGroup({
            'orderType': new FormControl("", [ Validators.required, this.orderTypeValidator ]),
            'clientPhoneNumber': new FormControl("", [ Validators.required, Validators.pattern(/(?:\+|\d)[\d\-\(\) ]{9,}\d/g) ]),
            'comment': new FormControl("", Validators.maxLength(30))
        });
    }

    @ViewChild('sendOrderFormContainer', { static: false }) private readonly sendOrderFormContainerViewRef: ElementRef<HTMLDivElement>;

    ngOnInit (): void {
        this._appService.getTranslations('PAGETITLES.PRICES', true).subscribe(translation => {
            this._appService.setTitle(translation);
        });
    }

    public orderTypeValidator (control: FormControl<string>): { [ s: string ]: boolean } | null {
        const clientOrderTypes: string[] = [ 'consultation', 'full' ];

        if ( !clientOrderTypes.includes(control.value) ) {
            return { 'orderType': true };
        }

        return null;
    }

    public sendOrder (): void {
        this._clientService.sendOrder(this.photographyType, this.sendOrderForm.value);

        this.sendOrderForm.reset();
        this.changeSendOrderFormAnimationState();
    }

    public startLinkContainerAnimation (index: number): void {
        this.linkContainerAnimationStates[index] = this.linkContainerAnimationStates[index] === 'leave' ? 'enter' : 'leave';
    }

    public linkContainerAnimationStarted (event: AnimationEvent, index: number): void {
        if ( event.toState === 'enter' ) this.linkContainerAnimationDisplayValues[index] = 'block';
    }

    public linkContainerAnimationDone (event: AnimationEvent, index: number): void {
        if ( event.toState === 'leave' ) this.linkContainerAnimationDisplayValues[index] = 'none';
    }

    public changeSendOrderFormAnimationState (): void {
        this.sendOrderFormAnimationState = this.sendOrderFormAnimationState === 'hide' ? 'show' : 'hide';
    }

    public sendOrderFormAnimationDone (event: AnimationEvent): void {
        if ( event.toState === 'hide' ) {
            this.sendOrderForm.reset();

            this.sendOrderFormContainerViewRef.nativeElement.classList.remove('position-relative');
            this.sendOrderFormContainerViewRef.nativeElement.classList.add('position-absolute');
        }

        if ( event.toState === 'show' ) {
            this.sendOrderFormContainerViewRef.nativeElement.classList.remove('position-absolute');
            this.sendOrderFormContainerViewRef.nativeElement.classList.add('position-relative');
        }
    }
}