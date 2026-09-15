import { NestFactory } from '@nestjs/core';

import cookieParser from 'cookie-parser';

import { AppModule } from './app.module';
import { AppService } from './app.service';

import { generateCookieSecret, generateJWT_SecretCode } from './services/sign/sign.generateKeys';

import { HttpExceptionFilter } from './filters/http-exception/http-exception.filter';

import { BigIntInterceptor } from './interceptors/big-int/big-int.interceptor';
import { CacheInterceptor } from './interceptors/cache/cache.interceptor';

async function bootstrap() {
    process.env['JWT_SECRETCODE'] = generateJWT_SecretCode();
    process.env['COOKIE_SECRET'] = generateCookieSecret();

    const app = await NestFactory.create(AppModule, {
        logger: [ 'error', 'warn', 'log' ]
    });

    app.enableShutdownHooks();

    app.enableCors({
        origin: process.env['CORS_ORIGIN'], 
        methods: [ 'GET', 'PUT', 'POST', 'DELETE' ], 
        credentials: true,
        exposedHeaders: [ 'Content-Disposition' ]
    });

    app.use(cookieParser(process.env['COOKIE_SECRET']));

    app.setGlobalPrefix('/api');

    const appService = app.get(AppService);

    app.useGlobalFilters(new HttpExceptionFilter(appService));
    app.useGlobalInterceptors(new BigIntInterceptor(), new CacheInterceptor());

    await app.listen(parseInt(process.env['SERVER_API_PORT'] as string));
}

bootstrap();