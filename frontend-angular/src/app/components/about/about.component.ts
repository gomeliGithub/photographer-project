import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

import { TranslateModule } from '@ngx-translate/core';

import { AppService } from '../../app.service';

@Component({
    selector: 'app-about',
    standalone: true,
    imports: [ CommonModule, TranslateModule ],
    templateUrl: './about.component.html',
    styleUrl: './about.component.css'
})
export class AboutComponent {
    constructor (
        private readonly _appService: AppService,
    ) { }

    ngOnInit (): void {
        this._appService.getTranslations('PAGETITLES.ABOUT', true).subscribe(translation => {
            this._appService.setTitle(translation);
        });
    }
}