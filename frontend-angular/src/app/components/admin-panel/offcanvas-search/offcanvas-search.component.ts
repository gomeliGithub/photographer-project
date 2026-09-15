import { Component, inject, Input, TemplateRef, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';

import { NgbOffcanvas } from '@ng-bootstrap/ng-bootstrap';
import { TranslateModule } from '@ngx-translate/core';

import { Image_display_types, Image_photography_types, SortBy_Types } from '@photographer-project/types';

@Component({
    selector: 'app-offcanvas-search',
    standalone: true,
    imports: [ CommonModule, ReactiveFormsModule, TranslateModule ],
    templateUrl: './offcanvas-search.component.html',
    styleUrl: './offcanvas-search.component.css',
    encapsulation: ViewEncapsulation.None,
})
export class OffcanvasSearchComponent {
    private _offcanvasService = inject(NgbOffcanvas);

    @Input() searchImagesForm: FormGroup<{
        dateFrom: FormControl<string | null>;
        dateUntil: FormControl<string | null>;
        photographyTypes: FormArray<FormControl<boolean>>;
        displayTypes: FormArray<FormControl<boolean>>;
        sortBy: FormControl<SortBy_Types>;
    }>;
    @Input() imagePhotographyTypes: Image_photography_types[];
    @Input() imageDisplayTypes: Image_display_types[];
    @Input() sortBy_TypesArr: SortBy_Types[];
    @Input() searchImagesMethod: { callParentMethod: (componentThis: OffcanvasSearchComponent) => void };
    @Input() searchImagesFormResetMethod: { callParentMethod: () => void };

    public searchImagesButtonIsDisabled: boolean = false;

    public openNoBackdrop (content: TemplateRef<any>): void {
		this._offcanvasService.open(content, { panelClass: 'searchImagesOffcanvas', backdrop: false });
	}

    public searchImages (): void {
        this.searchImagesMethod.callParentMethod(this);
    }

    public searchImagesFormReset (): void {
        this.searchImagesFormResetMethod.callParentMethod();
    }
}