import { PLATFORM_ID, StateKey, inject } from '@angular/core';
import { isPlatformServer } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ActivatedRouteSnapshot, CanActivateFn, Router, RouterStateSnapshot } from '@angular/router';
import { TransferState, makeStateKey } from '@angular/core';

import { catchError, map, of } from 'rxjs';

import { environment } from '../../../environments/environment';

export const ClientGuard: CanActivateFn = ( _: ActivatedRouteSnapshot, state: RouterStateSnapshot ) => {
    const http: HttpClient = inject(HttpClient);
    const router: Router = inject(Router);
    const platformId: Object = inject(PLATFORM_ID);
    const transferState: TransferState = inject(TransferState);

    const isServer: boolean = isPlatformServer(platformId);
    
    const AUTHSTATEKEY: StateKey<boolean> = makeStateKey<boolean>('authState_' + state.url);

    if ( transferState.hasKey(AUTHSTATEKEY) ) {
        return transferState.get(AUTHSTATEKEY, false) ? true : of(router.parseUrl('/sign/in'));
    }

    if ( !isServer ) {
        return http.get<boolean>(`${ environment.apiServerURL }/admin-panel/checkAccess`).pipe(map(checkAccessResult => {
            transferState.set(AUTHSTATEKEY, checkAccessResult);

            return checkAccessResult ? true : router.parseUrl('/sign/in');
        }),
        catchError(() => {
            transferState.set(AUTHSTATEKEY, false);

            return of(router.parseUrl('/sign/in'));
        }));
    } else return true;
};