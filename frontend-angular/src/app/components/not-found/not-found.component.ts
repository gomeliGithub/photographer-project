import { Component, Inject, InjectionToken, OnInit, Optional, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser, isPlatformServer } from '@angular/common';
import { RouterModule } from '@angular/router';

import { Request } from 'express';

import { TranslateModule } from '@ngx-translate/core';

import { AppService } from '../../app.service';

import { REQUEST } from '../../../express.tokens';

@Component({
    selector: 'app-not-found',
    standalone: true,
    imports: [ CommonModule, RouterModule, TranslateModule ],
    templateUrl: './not-found.component.html',
    styleUrls: ['./not-found.component.css']
})
export class NotFoundComponent implements OnInit {
    public isPlatformBrowser: boolean;
    public isPlatformServer: boolean;

    constructor (
        @Inject(PLATFORM_ID) private readonly platformId: string,

        @Optional() @Inject(REQUEST) private readonly _request: Request,

        private readonly _appService: AppService
    ) { }
    
    ngOnInit (): void {
        this._appService.getTranslations('PAGETITLES.NOTFOUND', true).subscribe(translation => this._appService.setTitle(translation));

        if ( isPlatformServer(this.platformId) ) {
            if ( this._request.res ) {
                this._request.res.status(404);
            }
        }
    }
}