import { Directive, EventEmitter, HostListener, Output } from '@angular/core';

import { ClientService } from '../../services/client/client.service';

@Directive({
    selector: '[appGlobalScroll]',
    standalone: true
})
export class GlobalScrollDirective {
    constructor(private readonly _clientService: ClientService) { }

    @Output() appScroll = new EventEmitter<Event>();

    @HostListener('scroll', [ '$event', '$event.target' ]) public onWindowScroll ($event: Event, target: HTMLDivElement) { 
        const scrollTop: number = target.scrollTop;
        const scrollHeight: number = target.scrollHeight;
        const clientHeight: number = target.clientHeight;

        // 1. Анимация навбара
        if ( scrollTop > 50 ) {
            this._clientService.setNavbarAnimationState('scrolled');
        } else {
            this._clientService.setNavbarAnimationState('static');
        }

        // 2. Проверка достижения низа страницы (с запасом в 1 пиксель)
        if ( scrollTop + clientHeight >= scrollHeight - 1 ) {
            this._clientService.setScrollPageBottomStatus(true);
        }

        this._clientService.setPrevNavbarAnimationStateChange(undefined);
        this.appScroll.emit($event);
    }
}