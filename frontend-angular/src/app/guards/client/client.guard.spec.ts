import { TestBed } from '@angular/core/testing';

import { ClientGuard } from './client.guard';

describe('AdminPanelGuard', () => {
    let guard: typeof ClientGuard;

    beforeEach(() => {
        TestBed.configureTestingModule({});
        guard = TestBed.inject(ClientGuard);
    });

    it('should be created', () => {
        expect(guard).toBeTruthy();
    });
});