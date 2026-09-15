// import { Image_photography_type } from "../../../backend-nest/node_modules/@prisma/client";

import { IClientLocale, Image_photography_types } from "@photographer-project/types";

export const environment = {
    production: false,
    domainURL: 'http://localhost:80',
    apiServerURL: 'http://localhost:3000/api',
    webSocketServerURL: 'ws://localhost:8080', // 'ws://localhost:82',
    locales: [
        { code: 'ru', title: 'Русский' }, 
        { code: 'en', title: 'English'}
    ] as IClientLocale[],
    defaultLocale: 'ru',
    photographyTypes: Image_photography_types,
    signOps: [ 'up', 'in' ]
};