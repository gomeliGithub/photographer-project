import { PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser, isPlatformServer } from '@angular/common';
import { HttpInterceptorFn } from '@angular/common/http';

import { REQUEST } from '../../../express.tokens';

export const credentialsInterceptor: HttpInterceptorFn = ( req, next ) => {
    const platformId: Object = inject(PLATFORM_ID);
    
    const isBrowser: boolean = isPlatformBrowser(platformId);
    const isServer: boolean = isPlatformServer(platformId);
    
    if ( isBrowser ) {
        const authToken: string | null = localStorage.getItem('access_token');

        const clonedRequest = req.clone({
            setHeaders: {
                Authorization: authToken ? `Bearer ${ authToken }` : ''
            },
            withCredentials: true
        });
    
        return next(clonedRequest);
    }

    if ( isServer ) {
        const cookies = getCookiesFromRequest();
        
        if ( cookies !== null ) {
            const clonedRequest = req.clone({
                setHeaders: {
                    Cookie: cookies
                }
            });

            return next(clonedRequest);
        }
    }

    return next(req.clone());
};

function getCookiesFromRequest (): string | null {
    const request = inject(REQUEST);
    return request?.headers?.cookie || null;
}