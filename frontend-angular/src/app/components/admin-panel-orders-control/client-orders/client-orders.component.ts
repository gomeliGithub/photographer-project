import { Component, ElementRef, EventEmitter, Input, Output, QueryList, ViewChildren } from '@angular/core';
import { CommonModule } from '@angular/common';

import { TranslateModule } from '@ngx-translate/core';

import { AppService } from '../../../app.service';
import { AdminPanelService } from '../../../services/admin-panel/admin-panel.service';

import { Client_order_statuses, IClientOrdersData, IOrdersClientsData } from "@photographer-project/types";

@Component({
  	selector: 'app-admin-panel-client-orders',
	standalone: true,
	imports: [ CommonModule, TranslateModule ],
  	templateUrl: './client-orders.component.html',
  	styleUrls: ['./client-orders.component.css'],
	host: { ngSkipHydration: 'true' }
})
export class ClientOrdersComponent {
	constructor (
		private readonly _appService: AppService,
		private readonly _adminPanelService: AdminPanelService
	) { }

    public firstSelectClient: boolean = false;

	@Input() public prevCurrentSelectedOrdersStatusType: Client_order_statuses;
	@Input() public currentSelectedOrdersStatusType: Client_order_statuses;
	@Input() public currentSelectedClientLogin: string;
	@Input() public clientOrders: IClientOrdersData;
	@Input() public ordersClientsData: IOrdersClientsData; 
	@Input() public additionalOrdersExists: boolean;
	@Input() public additionalOrdersClientsExists: boolean;
	@Input() public spinnerHidden: boolean;

	@Output() public prevCurrentSelectedOrdersStatusTypeChange = new EventEmitter();
	@Output() public currentSelectedOrdersStatusTypeChange = new EventEmitter();
	@Output() public currentSelectedClientLoginChange = new EventEmitter();
	@Output() public clientOrdersChange = new EventEmitter();
	@Output() public ordersClientsDataChange = new EventEmitter();
	@Output() public additionalOrdersExistsChange = new EventEmitter();
	@Output() public additionalOrdersClientsExistsChange = new EventEmitter();
	@Output() public spinnerHiddenChange = new EventEmitter();

	set prevCurrentSelectedOrdersStatusTypeValue (value: Client_order_statuses) {
	  	this.prevCurrentSelectedOrdersStatusType = value;
	  	this.prevCurrentSelectedOrdersStatusTypeChange.emit(this.prevCurrentSelectedOrdersStatusType);
	}

	set currentSelectedOrdersStatusTypeValue (value: Client_order_statuses) {
		this.currentSelectedOrdersStatusType = value;
		this.currentSelectedOrdersStatusTypeChange.emit(this.currentSelectedOrdersStatusType);
  	}
	
	set currentSelectedClientLoginValue (value: string) {
		this.currentSelectedClientLogin = value;
		this.currentSelectedClientLoginChange.emit(this.currentSelectedClientLogin);
	}

	set clientOrdersValue (value: IClientOrdersData) {
		this.clientOrders = value;
		this.clientOrdersChange.emit(this.clientOrders);
	}

	set ordersClientsDataValue (value: IOrdersClientsData) {
		this.ordersClientsData = value;
		this.ordersClientsDataChange.emit(this.ordersClientsData);
	}

	set additionalOrdersExistsValue (value: boolean) {
		this.additionalOrdersExists = value;
		this.additionalOrdersExistsChange.emit(this.additionalOrdersExists);
	}

	set additionalOrdersClientsExistsValue (value: boolean) {
		this.additionalOrdersClientsExists = value;
		this.additionalOrdersClientsExistsChange.emit(this.additionalOrdersClientsExists);
	}
	
	set spinnerHiddenValue (value: boolean) {
		this.spinnerHidden = value;
		this.spinnerHiddenChange.emit(this.spinnerHidden);
	}

	@ViewChildren('clientOrder', { read: ElementRef<HTMLTableRowElement> }) public readonly clientOrderViewRefs: QueryList<ElementRef<HTMLTableRowElement>>;
	@ViewChildren('getClientOrdersButton', { read: ElementRef<HTMLButtonElement> }) public readonly getClientOrdersButtonViewRefs: QueryList<ElementRef<HTMLButtonElement>>;

	public getClientOrders (event?: MouseEvent, selectMemberClick = false): void {
		this._adminPanelService.getNextClientOrdersData(this, event, selectMemberClick);
    }

	public getOrdersClients (): void {
		this._adminPanelService.getNextOrdersClientsData(this);
    }

	public changeClientOrderStatus (event: MouseEvent): void {
        const target: HTMLTableCellElement = event.target as HTMLTableCellElement;
        const targetRow: HTMLTableRowElement = ( target.parentElement as HTMLElement).parentElement as HTMLTableRowElement;

        const clientOrderId: number = parseInt(targetRow.getAttribute('order-id') as string, 10);

        this.spinnerHidden = false;

        this._adminPanelService.changeClientOrderStatus(clientOrderId, this.currentSelectedClientLogin).subscribe({
            next: () => window.location.reload(),
            error: () => {
                this.spinnerHidden = true;

                this._appService.createErrorModal();
            }
        });
    }
}