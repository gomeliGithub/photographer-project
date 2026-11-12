import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';

import Importer from 'mysql-import';

import fsPromises from 'fs/promises';
import path from 'path';

import * as bcrypt from 'bcrypt';

import { PrismaModule } from './modules/prisma.module';
import { PrismaService } from '../prisma/prisma.service';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import { SignModule } from './modules/sign.module';
import { ClientModule } from './modules/client.module';
import { ImageControlModule } from './modules/image-control.module';
import { AdminPanelModule } from './modules/admin-panel.module';

import { ImageControlService } from './services/image-control/image-control.service';
import { WebSocketService } from './services/web-socket/web-socket.service';
import { MailService } from './services/mail/mail.service';
import { ValidateClientRequestsService } from './services/validate-client-requests/validate-client-requests.service';

import { IAdminWithoutRelationFields } from '@photographer-project/types';

const NODE_ENV: string = process.env['NODE_ENV'] as string; console.log(NODE_ENV); ////////

@Module({
    imports: [
        ConfigModule.forRoot({
            envFilePath: NODE_ENV === 'production' ? 'config/.env.production' : 'config/.env.development',
            isGlobal: true
        }),
        ScheduleModule.forRoot(),
        EventEmitterModule.forRoot(),
        PrismaModule,
        SignModule,
        ClientModule,
        ImageControlModule,
        AdminPanelModule
    ],
    controllers: [ AppController ],
    providers: [ AppService, WebSocketService, MailService, ValidateClientRequestsService ],
    exports: [ AppService, MailService, ValidateClientRequestsService ]
})
export class AppModule {
    constructor (
        private readonly _prisma: PrismaService,

        private readonly _appService: AppService
    ) {
        ( async () => { 
            const imageControlServiceRef: ImageControlService = await this._appService.getServiceRef(ImageControlModule, ImageControlService);
            const logsFolderIsExists: boolean = await imageControlServiceRef.checkFileExists(path.join(process.cwd(), 'logs'));
            if ( !logsFolderIsExists ) await fsPromises.mkdir(path.join(process.cwd(), 'logs'));

            await this._importDatabaseFromDump();
        } )();
    }

    /**
        * Import database data from dump file.
    */
    private async _importDatabaseFromDump (): Promise<void> {
        const imageControlServiceRef: ImageControlService = await this._appService.getServiceRef(ImageControlModule, ImageControlService);
        const databaseDumpsFolderIsExists: boolean = await imageControlServiceRef.checkFileExists(path.join(process.cwd(), 'databaseDumps'));
        if ( !databaseDumpsFolderIsExists ) await fsPromises.mkdir(path.join(process.cwd(), 'databaseDumps'));

        const databaseDumps: string[] = await fsPromises.readdir(path.join(process.cwd(), 'databaseDumps'), { encoding: 'utf-8', recursive: true });
        
        if ( databaseDumps.length !== 0 ) {
            const dumpsDate: Date[] = databaseDumps.map(data => new Date(parseInt(data.replace('dump_', '').replace('.sql', ''), 10))).sort((a, b) => b.getTime() - a.getTime());
            const lastDumpDate: Date = dumpsDate[0];

            const dumpFilePath: string = path.join(process.cwd(), 'databaseDumps', `dump_${ lastDumpDate.getTime() }.sql`);

            let membersCount: number = 0;
            let compressedImagesCount: number = 0;
            let imagePhotographyTypesCount: number = 0;
            let clientOrdersCount: number = 0;
            let discountsCount: number = 0;
            let jWTsCount: number = 0;

            try {
                membersCount = await this._prisma.member.count();
                compressedImagesCount = await this._prisma.compressedImage.count();
                imagePhotographyTypesCount = await this._prisma.imagePhotographyType.count();
                clientOrdersCount = await this._prisma.clientOrder.count();
                discountsCount = await this._prisma.discount.count();
                jWTsCount = await this._prisma.jWT.count();
            } catch ( err ) { 
                this._appService.logLineAsync(`${ process.env['SERVER_DOMAIN'] } [${ process.env['SERVER_API_PORT'] }] Database import error - One or few tables did't exists. DumpFile dump_${ lastDumpDate.getTime() }.sql`, true, 'server');
            }

            if ( membersCount === 0 && compressedImagesCount === 0 && imagePhotographyTypesCount === 0 && clientOrdersCount === 0 && discountsCount === 0 && jWTsCount === 0 ) {
                this._appService.logLineAsync(`${ process.env['SERVER_DOMAIN'] } [${ process.env['SERVER_API_PORT'] }] Starting importing data from the dump - ${ dumpFilePath }`, false, 'server');

                const importer = new Importer({ 
                    host: process.env['DATABASE_HOST'] as string, 
                    user: process.env['DATABASE_USER'] as string, 
                    password: process.env['DATABASE_PASSWORD'] as string, 
                    database: process.env['DATABASE_NAME'] as string
                });

                importer.onProgress(progress => {
                    const percent: number = Math.floor(progress.bytes_processed / progress.total_bytes * 10000) / 100;

                    this._appService.logLineAsync(`${ process.env['SERVER_DOMAIN'] } [${ process.env['SERVER_API_PORT'] }] ${ percent }% Completed`, false, 'server');
                });
                
                importer.import(dumpFilePath).then(() => {
                    const files_imported: {
                        file: string;
                        size: number;
                    }[] = importer.getImported();

                    this._appService.logLineAsync(`${ process.env['SERVER_DOMAIN'] } [${ process.env['SERVER_API_PORT'] }] ${ 'Database import success - ' + files_imported.length } SQL file(s) imported. DumpFile dump_${ lastDumpDate.getTime() }.sql`, false, 'server');
                }).catch(err => {
                    this._appService.logLineAsync(`${ process.env['SERVER_DOMAIN'] } [${ process.env['SERVER_API_PORT'] }] ${ 'Database import error - ' + err }. DumpFile dump_${ lastDumpDate.getTime() }.sql`, true, 'server');
                });
            } else await this._createOrUpdateMainAdmin();
        } else await this._createOrUpdateMainAdmin();
    }

    /**
        * Create admin instance and add to database or update password of first admin stored in database and save it.
    */
    private async _createOrUpdateMainAdmin (): Promise<void> {
        const existingAdmin: IAdminWithoutRelationFields | null = await this._prisma.admin.findUnique({ where: { id: 1 } });

        const newPasswordHash: string = await bcrypt.hash('12345Admin', parseInt(process.env['CLIENT_PASSWORD_BCRYPT_SALTROUNDS'] as string, 10));

        if ( existingAdmin === null ) await this._prisma.admin.create({ 
                data: {
                    login: 'mainAdmin',
                    password: newPasswordHash,
                    type: 'admin',
                    fullName: "Основной администратор",
                    email: 'irina01041971@mail.ru'
                }
            });
        else await this._prisma.admin.update({ where: { id: 1 }, data: {
            password: newPasswordHash
        }});
    }
}