import { ApplicationConfig, importProvidersFrom } from '@angular/core';
import { IMAGE_CONFIG } from '@angular/common';
import { provideRouter, withRouterConfig } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule, provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { BrowserModule, provideClientHydration } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';

import { NgbModule } from '@ng-bootstrap/ng-bootstrap';

import { CarouselModule } from 'ngx-owl-carousel-o';

import { routes } from './app.routes';

import { credentialsInterceptor } from './interceptors/credentials/credentials.interceptor';

import { AdminPanelModule } from './modules/admin-panel.module';
import { ClientModule } from './modules/client.module';

import { environment } from '../environments/environment';

const httpLoaderFactory: ( http: HttpClient ) => TranslateHttpLoader = (http: HttpClient) => new TranslateHttpLoader(http, '/assets/locale/', '.json');

export const appConfig: ApplicationConfig = {
    providers: [
        {
            provide: IMAGE_CONFIG,
            useValue: {
                disableImageSizeWarning: true, 
                disableImageLazyLoadWarning: true
            }
        },
        importProvidersFrom(
            BrowserModule,
            BrowserAnimationsModule,
            HttpClientModule,
            FormsModule,
            ReactiveFormsModule,
            TranslateModule.forRoot({
                loader: {
                    provide: TranslateLoader,
                    useFactory: httpLoaderFactory,
                    deps: [HttpClient]
                },
                defaultLanguage: environment.defaultLocale,
                useDefaultLang: true
            }),
            AdminPanelModule,
            ClientModule,
            NgbModule,
            CarouselModule
        ),
        provideRouter(routes,
            withRouterConfig({
                onSameUrlNavigation: 'reload'
            })
        ),
        provideHttpClient(withFetch(), withInterceptors([ credentialsInterceptor ])),
        provideClientHydration()
    ]
};