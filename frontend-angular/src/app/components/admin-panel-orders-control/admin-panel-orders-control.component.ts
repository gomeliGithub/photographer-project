import { Component, ElementRef, Inject, OnInit, PLATFORM_ID, QueryList, ViewChildren } from '@angular/core';
import { CommonModule, isPlatformBrowser, isPlatformServer } from '@angular/common';

import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { TranslateModule } from '@ngx-translate/core';

import { ClientOrdersComponent } from './client-orders/client-orders.component';

import { AppService } from '../../app.service';
import { AdminPanelService } from '../../services/admin-panel/admin-panel.service';

import { Client_order_statuses, IClientOrdersData, IOrdersClientsData } from "@photographer-project/types";

@Component({
    selector: 'app-admin-panel-orders-control',
    standalone: true,
	imports: [ CommonModule, ClientOrdersComponent, NgbModule, TranslateModule ],
    templateUrl: './admin-panel-orders-control.component.html',
    styleUrls: ['./admin-panel-orders-control.component.css'],
    host: { ngSkipHydration: 'true' }
})
export class AdminPanelOrdersControlComponent implements OnInit {
    public isPlatformBrowser: boolean;
    public isPlatformServer: boolean;

    public clientOrders: IClientOrdersData = {
        orders: [],
        additionalOrdersExists: false,
    };
    public ordersClientsData: IOrdersClientsData = {
        clients: [],
        commonOrdersCount: 0,
        additionalOrdersClientsExists: false
    };

    public additionalOrdersExists: boolean = false;
    public additionalOrdersClientsExists: boolean = false;

    public prevCurrentSelectedOrdersStatusType: Client_order_statuses;
    public currentSelectedOrdersStatusType: Client_order_statuses = 'new';
    public currentSelectedClientLogin: string;

    public spinnerHidden: boolean = true;

    constructor (
        @Inject(PLATFORM_ID) private readonly platformId: string,

        private readonly _appService: AppService,
        private readonly _adminPanelService: AdminPanelService
    ) { 
        this.isPlatformBrowser = isPlatformBrowser(this.platformId);
        this.isPlatformServer = isPlatformServer(this.platformId);
    }

    @ViewChildren('clientOrder', { read: ElementRef<HTMLTableRowElement> }) public readonly clientOrderViewRefs: QueryList<ElementRef<HTMLTableRowElement>>;
    @ViewChildren('getClientOrdersButton', { read: ElementRef<HTMLButtonElement> }) public readonly getClientOrdersButtonViewRefs: QueryList<ElementRef<HTMLButtonElement>>;

    ngOnInit (): void {
        if ( this.isPlatformBrowser ) {
            this._appService.getTranslations('PAGETITLES.ADMINPANEL.ORDERSCONTROL', true).subscribe(translation => this._appService.setTitle(translation));

            this._adminPanelService.getNextClientOrdersData(this);
            this._adminPanelService.getNextOrdersClientsData(this);
        }
    }

    public clientOrdersTabClick (event: MouseEvent): void {
        const target: HTMLButtonElement = event.target as HTMLButtonElement;
        const ordersType: Client_order_statuses = target.getAttribute('orders-status-type') as Client_order_statuses;

        this.prevCurrentSelectedOrdersStatusType = this.currentSelectedOrdersStatusType;
        this.currentSelectedOrdersStatusType = ordersType;

        this.additionalOrdersExists = false;
        this.additionalOrdersClientsExists = false;

        this._adminPanelService.getNextClientOrdersData(this);
        this._adminPanelService.getNextOrdersClientsData(this);
    }
}