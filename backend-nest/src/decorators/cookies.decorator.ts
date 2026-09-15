import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import { IRequest } from '@photographer-project/types';

export const Cookies = createParamDecorator(
    ( data: string, ctx: ExecutionContext ) => {
        const request: IRequest = ctx.switchToHttp().getRequest<IRequest>();

        return data ? ( Object.keys(request.cookies).length === 0 ? request.signedCookies?.[data] : request.cookies?.[data] ) : request.cookies;
    }
);