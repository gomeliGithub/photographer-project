import { BadRequestException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Response } from 'express';

import { Client_order_type, Client_type, Image_display_type, Image_photography_type, Prisma } from '@prisma/client';
import { DefaultArgs } from '@prisma/client/runtime/library';

import ms, { StringValue } from 'ms';

import path from 'path';

import { AdminPanelModule } from '../../modules/admin-panel.module';
import { SignModule } from '../../modules/sign.module';
import { ImageControlModule } from '../../modules/image-control.module';

import { PrismaService } from '../../../prisma/prisma.service';
import { AppService } from '../../app.service';
import { JwtControlService } from '../sign/jwt-control.service';
import { MailService } from '../mail/mail.service';
import { AdminPanelService } from '../admin-panel/admin-panel.service';
import { SignService } from '../sign/sign.service';
import { ImageControlService } from '../image-control/image-control.service';

import { IClientOrdersInfoDataArr, IClientRequestBody, ICookieSerializeOptions, IDownloadingOriginalImageData, IGalleryCompressedImagesData, IRequest, IRequestBody } from '@photographer-project/types';
import { IClientGetOptions, IDownloadOriginalImageOptions, IGetClientOrdersOptions } from '@photographer-project/types';
import { IAdmin, IAdminWithoutRelationFields, IClientOrderWithoutRelationFields, ICompressedImageWithoutRelationFields, IDiscount, IImagePhotographyType, IMember, IMemberWithClientOrdersCount, IMemberWithoutRelationFields } from '@photographer-project/types';
import { IJWTPayload } from '@photographer-project/types';

@Injectable()
export class ClientService {
    public compressedImagesDirPath: string;

    constructor (
        private readonly _prisma: PrismaService,
        private readonly _jwtService: JwtService,
        
        private readonly _appService: AppService,
        private readonly _jwtControlService: JwtControlService,
        private readonly _mailService: MailService
    ) { 
        this.compressedImagesDirPath = path.join(this._appService.staticFilesDirPath, 'images_thumbnail');
    }
    /**
        * Get compressed images data object from database.
        * 
        * @param   imagesType Images type to select image folder.
        * @param   imageDisplayType Image orientation.
        * @param   imagesExistsCount Number of images already received.
        * 
        * @returns Compressed images object with additional data.
    */
    public async getCompressedImagesData (imagesType: 'home' | string, imageDisplayType: Image_display_type, imagesExistsCount: number): Promise<IGalleryCompressedImagesData | ICompressedImageWithoutRelationFields[]> {
        const imagesLimit: number = 8;

        const imageControlServiceRef: ImageControlService = await this._appService.getServiceRef(ImageControlModule, ImageControlService);
        const compressedImagesData: ICompressedImageWithoutRelationFields[] = await imageControlServiceRef.getCompressedImages({
            find: {
                selectFields: { 
                    name: true,
                    photographyType: true,
                    displayType: true,
                    description: true,
                    uploadDate: true,
                    dirPath: false,
                    originalName: false,
                    originalDirPath: false,
                    originalSize: false,
                    displayedOnHomePage: false,
                    displayedOnGalleryPage: false,
                    admin: false,
                    adminId: false
                },
                displayTypes: [ imageDisplayType ],
                displayedOnHomePage: imagesType === 'home' ? true : undefined,
                photographyTypes: imagesType !== 'home' ? [ imagesType ] as Image_photography_type[] : undefined
            },
            imagesLimit: imagesType !== 'home' ? imagesLimit : undefined,
            imagesExistsCount: imagesType !== 'home' ? imagesExistsCount : undefined
        });

        if ( imagesType !== 'home' ) {
            const commonCompressedImagesCount: number = await this._prisma.compressedImage.count({ where: { displayType: imageDisplayType, photographyType: imagesType as Image_photography_type } });

            return {
                compressedImagesDataList: compressedImagesData,
                photographyTypeDescription: ( await this.getImagePhotographyTypesData('gallery', false, imagesType) ).description as string,
                additionalImagesExists: commonCompressedImagesCount > ( imagesExistsCount as number ) + compressedImagesData.length && commonCompressedImagesCount > imagesLimit
            }
        }

        return compressedImagesData;
    }
    /**
        * Get discounts data for client from database.
        * 
        * @returns Discounts data array.
    */
    public async getDiscountsData (): Promise<IDiscount[]> {
        const adminPanelServiceRef: AdminPanelService = await this._appService.getServiceRef(AdminPanelModule, AdminPanelService);

        return adminPanelServiceRef.getDiscountsData();
    }
    /**
        * Get data from the downloading original image from database.
        * 
        * @param   request Currently request object.
        * @param   options Download original image options.
        * 
        * @returns Original image data object.
    */
    public async getDownloadingOriginalImageData (request: IRequest, options: IDownloadOriginalImageOptions): Promise<IDownloadingOriginalImageData> {
        const downloadingOriginalImageData: IDownloadingOriginalImageData = { 
            name: '',
            path: '',
            extension: ''
        };

        if ( options.imagePath ) {
            const existingCompressedImageData: ICompressedImageWithoutRelationFields | null = await this._prisma.compressedImage.findUnique({ where: { name: path.basename(options.imagePath) } });

            if ( existingCompressedImageData !== null ) {
                downloadingOriginalImageData.name = existingCompressedImageData.originalName;
                downloadingOriginalImageData.path = options.imagePath;
                downloadingOriginalImageData.extension = path.extname(path.basename(existingCompressedImageData.originalName)).replace('.', '');
            } else throw new BadRequestException(`${ request.url } "DownloadOriginalImage - original image does not exists"`);
        } else if ( options.compressedImageName ) {
            const existingCompressedImageData: ICompressedImageWithoutRelationFields | null = await this._prisma.compressedImage.findUnique({ where: { name: options.compressedImageName } });

            if ( existingCompressedImageData !== null ) {
                downloadingOriginalImageData.name = existingCompressedImageData.originalName;
                downloadingOriginalImageData.path = path.join(existingCompressedImageData.originalDirPath, existingCompressedImageData.originalName);
                downloadingOriginalImageData.extension = path.extname(path.basename(existingCompressedImageData.originalName)).replace('.', '');
            } else throw new BadRequestException(`${ request.url } "DownloadOriginalImage - compressed image does not exists"`);
        }

        return downloadingOriginalImageData;
    }
    /**
        * Get image photography types data from database.
        * 
        * @param   {'home'} targetPage The page where the images should be located.
        * @param   includeDescription Include a description of each image in the resulting data.
        * 
        * @returns Image photography types data array or single object.
    */
    /**
        * Get image photography types data from database.
        * 
        * @param   {'admin'} targetPage The page where the images should be located.
        * @param   includeDescription Include a description of each image in the resulting data.
        * 
        * @returns Image photography types data array or single object.
    */
    /**
        * Get image photography types data from database.
        * 
        * @param   {'home' | 'admin'} targetPage The page where the images should be located.
        * @param   includeDescription Include a description of each image in the resulting data.
        * 
        * @returns Image photography types data array or single object.
    */
    /**
        * Get image photography types data from database.
        * 
        * @param   {'gallery'} targetPage The page where the images should be located.
        * @param   includeDescription Include a description of each image in the resulting data.
        * @param   {string|undefined} [photographyTypeName] Gallery photography type. If specified, only photos of this type will be retrieved (Optional).
        * 
        * @returns Image photography types data array or single object.
    */
    /**
        * Get image photography types data from database.
        * 
        * @param   {'home' | 'admin' | 'gallery'} targetPage The page where the images should be located.
        * @param   includeDescription Include a description of each image in the resulting data.
        * @param   {string|undefined} [photographyTypeName] Gallery photography type. If specified, only photos of this type will be retrieved (Optional).
        * 
        * @returns Image photography types data array or single object.
    */
    /**
        * Get image photography types data from database.
        * 
        * @param   {'home' | 'admin' | 'gallery'} targetPage The page where the images should be located.
        * @param   includeDescription Include a description of each image in the resulting data.
        * @param   {string|undefined} [photographyTypeName] Gallery photography type. If specified, only photos of this type will be retrieved (Optional).
        * 
        * @returns Image photography types data array or single object.
    */
    public async getImagePhotographyTypesData (targetPage: 'home', includeDescription: boolean): Promise<IImagePhotographyType[][]>
    public async getImagePhotographyTypesData (targetPage: 'admin', includeDescription: boolean): Promise<IImagePhotographyType[]>
    public async getImagePhotographyTypesData (targetPage: 'home' | 'admin', includeDescription: boolean): Promise<IImagePhotographyType[][] | IImagePhotographyType[]>
    public async getImagePhotographyTypesData (targetPage: 'gallery', includeDescription: boolean, photographyTypeName?: string): Promise<IImagePhotographyType>
    public async getImagePhotographyTypesData (targetPage: 'home' | 'admin' | 'gallery', includeDescription: boolean, photographyTypeName?: string): Promise<IImagePhotographyType[][] | IImagePhotographyType[] | IImagePhotographyType>
    public async getImagePhotographyTypesData (targetPage: 'home' | 'admin' | 'gallery', includeDescription: boolean, photographyTypeName?: string): Promise<IImagePhotographyType[][] | IImagePhotographyType[] | IImagePhotographyType> {
        const photographyTypesData: IImagePhotographyType[] = await this._prisma.imagePhotographyType.findMany({ 
            select: {
                name: true,
                compressedImageOriginalName: true,
                compressedImageName: true,
                description: includeDescription
            }
        });

        let photographyTypesDataRawDataFinalResult: IImagePhotographyType[][] | IImagePhotographyType[] | IImagePhotographyType | undefined = undefined;

        switch ( targetPage ) {
            case 'home': { 
                const reducedPhotographyTypesData: IImagePhotographyType[][] = [];
                if ( targetPage === 'home' ) for ( let i = 0; i < photographyTypesData.length; i += 2 ) {
                    reducedPhotographyTypesData.push(photographyTypesData.slice(i, i + 2));
                }

                photographyTypesDataRawDataFinalResult = reducedPhotographyTypesData; 
                
                break; 
            }
            case 'admin': { photographyTypesDataRawDataFinalResult = photographyTypesData; break; }
            case 'gallery': { photographyTypesDataRawDataFinalResult = photographyTypesData.find(data => data.name === photographyTypeName) as IImagePhotographyType; break; }
        }

        return photographyTypesDataRawDataFinalResult;
    }
    /**
        * Change client locale using cookies.
        * 
        * @param   request Currently request object.
        * @param   newLocale New client locale name.
        * @param   response Currently response object.
        * 
        * @returns Updated access token.
    */
    public async changeLocale (request: IRequest, newLocale: string, response: Response): Promise<string | null> {
        const token: string | undefined = this._jwtControlService.extractTokenFromHeader(request, false);

        let decodedToken: IJWTPayload | null = null;
        let tokenExpiresIn: number | null = null;
        let updatedAccess_token: string | null = null;

        let tokenIsValid: boolean = false;

        if ( await this._jwtControlService.tokenValidate(request, token as string, false) ) tokenIsValid = true;

        const cookieSerializeOptions: ICookieSerializeOptions = this._appService.cookieSerializeOptions;

        if ( request.activeClientData ) {
            if ( tokenIsValid ) {
                decodedToken = this._jwtService.decode(token as string) as IJWTPayload;

                const dateNow: Date = new Date(Date.now());

                const tokenExpiresAt: number = new Date(ms(`${ decodedToken.exp }s` as StringValue)).getTime();
                tokenExpiresIn = Math.round(new Date(tokenExpiresAt - dateNow.getTime()).getTime() / 1000);

                decodedToken.locale = newLocale;

                delete decodedToken.iat;
                delete decodedToken.exp;

                updatedAccess_token = await this._jwtService.signAsync(decodedToken, { secret: process.env['JWT_SECRETCODE'] as string, expiresIn: tokenExpiresIn }); 

                cookieSerializeOptions.maxAge = request.activeClientData ? ms(`${ tokenExpiresIn as number }s`) : cookieSerializeOptions.maxAge;
            } else throw new BadRequestException(`${ request.url } "ChangeLocale - token is invalid"`);
        }

        response.cookie('locale', newLocale, cookieSerializeOptions);

        return updatedAccess_token as string | null;
    }
    /**
        * Create client order, save into database and send mail to admin mail address.
        * 
        * @param   request Currently request object.
        * @param   requestBody Currently request body object.
        * @param   response Currently response object.
        * @param   clientLocale Client currently language from cookie.
    */
    public async createOrder (request: IRequest, requestBody: IRequestBody, response: Response, clientLocale: string): Promise<void> {
        const signServiceRef: SignService = await this._appService.getServiceRef(SignModule, SignService);
        const activeClientData: IJWTPayload = await signServiceRef.getActiveClient(request, response, clientLocale);

        const { clientPhoneNumber, comment } = requestBody.client as IClientRequestBody;
        let { imagePhotographyType, orderType } = requestBody.client as IClientRequestBody;

        const dateNow: Date = new Date(Date.now());
        const id: number = parseInt(`${ dateNow.getFullYear() }${ dateNow.getMonth() }${ dateNow.getHours() }${ dateNow.getMinutes() }${ dateNow.getSeconds() }`, 10);

        const existingClientOrderData: IClientOrderWithoutRelationFields | null = await this._prisma.clientOrder.findUnique({ where: { id } });
        if ( existingClientOrderData !== null ) throw new BadRequestException(`${ request.url } "CreateOrder - order instance with same id is exists, login --- ${ activeClientData.login ?? '-' }"`);

        if ( activeClientData.type === 'member' ) {
            await this._prisma.member.update({
                data: { clientOrders: { create: {
                id,
                photographyType: imagePhotographyType,
                type: orderType,
                phoneNumber: clientPhoneNumber,
                comment: comment
            }}},
                where: { id: activeClientData.id as number }
            });
        }
        
        switch ( imagePhotographyType ) {
            case 'individual': { imagePhotographyType = "Индивидуальная съёмка" as Image_photography_type; break; }
            case 'children': { imagePhotographyType = "Детская съёмка" as Image_photography_type; break; }
            case 'wedding': { imagePhotographyType = "Свадебная съёмка" as Image_photography_type; break; }
            case 'family': { imagePhotographyType = "Семейная съёмка" as Image_photography_type; break; }
        }

        switch ( orderType ) {
            case 'consultation': { orderType = "Консультация" as Client_order_type; break; }
            case 'full': { orderType = "Полноценный заказ" as Client_order_type; break; }
        }

        const mailBody: string = `
            <div>
                <div>
                    <p>Тип съёмки - <span style="font-weight: 600;">${ imagePhotographyType }</span></p>
                </div>
                <div>
                    <p>Тип заказа - <span style="font-weight: 600;">${ orderType }</span></p>
                </div>
                <div>
                    <p>Номер телефона клиента - <span style="font-weight: 600;">${ clientPhoneNumber }</span></p>
                </div>
                <div>
                    <p>Логин клиента - <span style="font-weight: 600;">${ activeClientData.login ?? 'Гость' }</span></p>
                </div>
                <div>
                    <p>Дополнительная информация от клиента - ${ comment ?? '<span style="font-weight: 600;">Отсутствует</span>' }</p>
                </div>
            </div>
        `;

        await this._mailService.sendEmail(process.env['CLIENT_ORDERS_RECIPIENTEMAIL'] as string, 'Новый заказ', mailBody);

        if ( activeClientData.type === 'member' ) await this.registerClientLastActivityLoginTime(activeClientData, 'activityDate');
    }
    /**
        * Get clients data from database.
        * 
        * @param   {'member'} clientType Client type for select.
        * 
        * @returns Clients data array of object or single object.
    */
    /**
        * Get clients data from database.
        * 
        * @param   {'admin'} clientType Client type for select.
        * 
        * @returns Clients data array of object or single object.
    */
    /**
        * Get clients data from database.
        * 
        * @param   {'member'} clientType Client type for select.
        * @param   {string|undefined} [loginList] List of clients login for select (Optional).
        * 
        * @returns Clients data array of object or single object.
    */
    /**
        * Get clients data from database.
        * 
        * @param   {'admin'} clientType Client type for select.
        * @param   {string|undefined} [loginList] List of clients login for select (Optional).
        * 
        * @returns Clients data array of object or single object.
    */
    /**
        * Get clients data from database.
        * 
        * @param   {'member'} clientType Client type for select.
        * @param   {string[]|undefined} [loginList] List of clients login for select (Optional).
        * 
        * @returns Clients data array of object or single object.
    */
    /**
        * Get clients data from database.
        * 
        * @param   {'admin'} clientType Client type for select.
        * @param   {string[]|undefined} [loginList] List of clients login for select (Optional).
        * 
        * @returns Clients data array of object or single object.
    */
    /**
        * Get clients data from database.
        * 
        * @param   {'member'} clientType Client type for select.
        * @param   {string|undefined} [loginList] List of clients login for select (Optional).
        * @param   {IClientGetOptions|undefined} [options] Client get options object (Optional).
        * 
        * @returns Clients data array of object or single object.
    */
    /**
        * Get clients data from database.
        * 
        * @param   {'admin'} clientType Client type for select.
        * @param   {string|undefined} [loginList] List of clients login for select (Optional).
        * @param   {IClientGetOptions|undefined} [options] Client get options object (Optional).
        * 
        * @returns Clients data array of object or single object.
    */

    /**
        * Get clients data from database.
        * 
        * @param   {'member'} clientType Client type for select.
        * @param   {string[]|undefined} [loginList] List of clients login for select (Optional).
        * @param   {IClientGetOptions|undefined} [options] Client get options object (Optional).
        * 
        * @returns Clients data array of object or single object.
    */
    /**
        * Get clients data from database.
        * 
        * @param   {'admin'} clientType Client type for select.
        * @param   {string[]|undefined} [loginList] List of clients login for select (Optional).
        * @param   {IClientGetOptions|undefined} [options] Client get options object (Optional).
        * 
        * @returns Clients data array of object or single object.
    */
    /**
        * Get clients data from database.
        * 
        * @param   {Client_type} clientType Client type for select.
        * @param   {string|string[]|undefined} [loginList] List of clients login for select (Optional).
        * @param   {IClientGetOptions|undefined} [options] Client get options object (Optional).
        * 
        * @returns Clients data array of object or single object.
    */
    public async getClientsData (clientType: 'member'): Promise<IMember | IMemberWithClientOrdersCount | IMemberWithoutRelationFields | IMember[] | IMemberWithClientOrdersCount[] | IMemberWithoutRelationFields[] | null>
    public async getClientsData (clientType: 'admin'): Promise<IAdmin | IAdminWithoutRelationFields | IAdmin[] | IAdminWithoutRelationFields[] | null>
    public async getClientsData (clientType: 'member', loginList?: string): Promise<IMember | IMemberWithClientOrdersCount | IMemberWithoutRelationFields | null>
    public async getClientsData (clientType: 'admin', loginList?: string): Promise<IAdmin | IAdminWithoutRelationFields | null>
    public async getClientsData (clientType: 'member', loginList?: string[]): Promise<IMember[] | IMemberWithClientOrdersCount[] | IMemberWithoutRelationFields[]>
    public async getClientsData (clientType: 'admin', loginList?: string[]): Promise<IAdmin[] | IAdminWithoutRelationFields[]>
    public async getClientsData (clientType: 'member', loginList?: string, options?: IClientGetOptions): Promise<IMember | IMemberWithClientOrdersCount | IMemberWithoutRelationFields | null>
    public async getClientsData (clientType: 'admin', loginList?: string, options?: IClientGetOptions): Promise<IAdmin | IAdminWithoutRelationFields | null>
    public async getClientsData (clientType: 'member', loginList?: string[], options?: IClientGetOptions): Promise<IMember[] | IMemberWithClientOrdersCount[] | IMemberWithoutRelationFields[]>
    public async getClientsData (clientType: 'admin', loginList?: string[], options?: IClientGetOptions): Promise<IAdmin[] | IAdminWithoutRelationFields[]>
    public async getClientsData (clientType: Client_type, loginList?: string | string[], options?: IClientGetOptions)
    : Promise<IMember | IMemberWithClientOrdersCount | IMemberWithoutRelationFields | IAdmin | IAdminWithoutRelationFields | IMember[] | IMemberWithClientOrdersCount[] | IMemberWithoutRelationFields[] | IAdmin[] | IAdminWithoutRelationFields[] | null>
    public async getClientsData (clientType: Client_type, loginList?: string | string[], options?: IClientGetOptions)
    : Promise<IMember | IMemberWithClientOrdersCount | IMemberWithoutRelationFields | IAdmin | IAdminWithoutRelationFields | IMember[] | IMemberWithClientOrdersCount[] | IMemberWithoutRelationFields[] | IAdmin[] | IAdminWithoutRelationFields[] | null> {
        const findArgs: Prisma.MemberFindManyArgs<DefaultArgs> | Prisma.MemberFindFirstArgs<DefaultArgs> | Prisma.AdminFindManyArgs<DefaultArgs> | Prisma.AdminFindFirstArgs<DefaultArgs> = {
            skip: options ? options.skip : undefined,
            take: options ? options.take : undefined,
            select: options && options.selectFields ? options.selectFields : undefined
        };

        let clients: IMember | IMemberWithoutRelationFields | IAdmin | IAdminWithoutRelationFields | IMember[] | IMemberWithoutRelationFields[] | IAdmin[] | IAdminWithoutRelationFields[] | null = null;

        if ( clientType === 'member' ) {
            if ( options ) {
                if ( options.orders ) {
                    if ( options.orders.include && options.orders.include === true ) {
                        if ( !findArgs.select || findArgs.select === null ) {
                            findArgs.select = { 
                                clientOrders: undefined
                            } as Prisma.MemberSelect<DefaultArgs>;
                        } else ( findArgs.select as Prisma.MemberSelect<DefaultArgs> ).clientOrders = undefined;

                        ( findArgs.select as Prisma.MemberSelect<DefaultArgs> ).clientOrders = {
                            where: {
                                status: options.orders.whereStatus
                            }
                        };
                    }

                    if ( options.orders.includeCount && options.orders.includeCount === true ) {
                        if ( !findArgs.select || findArgs.select === null ) {
                            findArgs.select = { 
                                _count: undefined
                            };
                        } else findArgs.select._count = undefined;

                        findArgs.select._count = {
                            select: {
                                clientOrders: {
                                    where: { status: options.orders.whereStatus }
                                }
                            }
                        };
                    }
                }
            }

            if ( loginList ) {
                if ( !Array.isArray(loginList) ) {
                    if ( !findArgs.where ) {
                        findArgs.where = {
                            login: loginList
                        };
                    } else findArgs.where.login = loginList;

                    clients = await this._prisma.member.findFirst(findArgs as Prisma.MemberFindFirstArgs<DefaultArgs>);
                } else {
                    if ( !findArgs.where ) {
                        findArgs.where = {
                            login: {
                                in: loginList
                            }
                        }
                    } else {
                        findArgs.where.login = {
                            in: loginList
                        };
                    }
                    
                    clients = await this._prisma.member.findMany(findArgs as Prisma.MemberFindManyArgs<DefaultArgs>);
                }
            } else clients = await this._prisma.member.findMany(findArgs as Prisma.MemberFindManyArgs<DefaultArgs>);
        } else if ( clientType === 'admin' ) {
            if ( options ) {
                if ( options.compressedImages ) {
                    if ( options.compressedImages.include && options.compressedImages.include === true ) {
                        ( findArgs as Prisma.AdminFindManyArgs<DefaultArgs> | Prisma.AdminFindFirstArgs<DefaultArgs> ).select = { 
                            compressedImages: undefined
                        };

                        ( findArgs.select as Prisma.AdminSelect<DefaultArgs> ).compressedImages = {
                            select: options.compressedImages.selectFields,
                            where: {
                                name: { in: options.compressedImages.whereNameArr },
                                photographyType: { in: options.compressedImages.wherePhotographyTypes },
                                displayType: { in: options.compressedImages.whereDisplayTypes },
                                uploadDate: options.compressedImages.dateFrom && options.compressedImages.dateUntil ? {
                                    gte: options.compressedImages.dateFrom,
                                    lte: options.compressedImages.dateUntil
                                } : undefined
                            },
                            orderBy: options.compressedImages.orderBy,
                            skip: options.compressedImages.skip,
                            take: options.compressedImages.take
                        };
                    }
                }
            }

            if ( loginList ) {
                if ( !Array.isArray(loginList) ) {
                    if ( !findArgs.where ) {
                        findArgs.where = {
                            login: loginList
                        };
                    }

                    clients = await this._prisma.admin.findFirst(findArgs as Prisma.AdminFindFirstArgs<DefaultArgs>);
                } else {
                    ( findArgs.where as Prisma.AdminWhereInput ).login = {
                        in: loginList
                    };

                    clients = await this._prisma.admin.findMany(findArgs as Prisma.AdminFindManyArgs<DefaultArgs>);
                }
            } else clients = await this._prisma.admin.findMany(findArgs as Prisma.AdminFindManyArgs<DefaultArgs>);
        }

        return clients;
    }
    /**
        * Check client exists in database.
        * 
        * @param   login Login for checking client.
        * 
        * @returns Client data.
    */
    public async checkAnyClientDataExists (login: string | null): Promise<IAdminWithoutRelationFields | IMemberWithoutRelationFields | null> {
        let clientData: IAdminWithoutRelationFields | IMemberWithoutRelationFields | null = null;

        if ( login === null ) login = '';

        clientData = await this.getClientsData('member', login);

        if ( clientData === null ) clientData = await this.getClientsData('admin', login);

        return clientData;
    }

    /**
        * Get client orders info from database.
        * 
        * @param   {string} loginList Login list for search orders of specific client or clients.
        * @param   options Client orders options object.
        * 
        * @returns {Promise<IClientOrdersInfoDataArr>} Client orders info array of objects or single object.
    */
    /**
        * Get client orders info from database.
        * 
        * @param   {string[]} loginList Login list for search orders of specific client or clients.
        * @param   options Client orders options object.
        * 
        * @returns {Promise<IClientOrdersInfoDataArr[]>} Client orders info array of objects or single object.
    */
    /**
        * Get client orders info from database.
        * 
        * @param   {null} loginList Login list for search orders of specific client or clients.
        * @param   options Client orders options object.
        * 
        * @returns {Promise<IClientOrdersInfoDataArr[]>} Client orders info array of objects or single object.
    */
    /**
        * Get client orders info from database.
        * 
        * @param   {string|string[]|null} loginList Login list for search orders of specific client or clients.
        * @param   options Client orders options object.
        * 
        * @returns {Promise<IClientOrdersInfoDataArr[]>} Client orders info array of objects or single object.
    */
    public async getClientOrdersInfo (loginList: string, options: IGetClientOrdersOptions): Promise<IClientOrdersInfoDataArr>
    public async getClientOrdersInfo (loginList: string[], options: IGetClientOrdersOptions): Promise<IClientOrdersInfoDataArr[]>
    public async getClientOrdersInfo (loginList: null, options: IGetClientOrdersOptions): Promise<IClientOrdersInfoDataArr[]>
    public async getClientOrdersInfo (loginList: string | string[] | null, options: IGetClientOrdersOptions): Promise<IClientOrdersInfoDataArr[]>
    public async getClientOrdersInfo (loginList: string | string[] | null, options: IGetClientOrdersOptions): Promise<IClientOrdersInfoDataArr | IClientOrdersInfoDataArr[]> {
        const memberIncludeClientOrderCount: Prisma.MemberInclude<DefaultArgs> = {
            _count: {
                select: {
                    clientOrders: {
                        where: {
                            status: options.status,
                            createdDate: {
                                gte: options.fromDate,
                                lte: options.untilDate
                            }
                        }
                    }
                }
            }
        };

        const clientFindManyArgs: Prisma.MemberFindManyArgs<DefaultArgs> = {
            skip: options.existsCount,
            take: options.ordersLimit,
            include: memberIncludeClientOrderCount
        }

        let clientsOrdersInfoData: IClientOrdersInfoDataArr | IClientOrdersInfoDataArr[] | null = null;

        if ( loginList === null ) {
            const clientsData: IMemberWithClientOrdersCount[] = ( await this._prisma.member.findMany(clientFindManyArgs) as IMemberWithClientOrdersCount[] );

            if ( clientsOrdersInfoData === null ) clientsOrdersInfoData = [];

            if ( !options.existsCount || options.existsCount === 0 ) { 
                ( ( ( ( clientFindManyArgs.include as Prisma.MemberInclude<DefaultArgs> )._count as Prisma.MemberCountOutputTypeDefaultArgs<DefaultArgs> )
                .select?.clientOrders as Prisma.MemberCountOutputTypeCountClientOrdersArgs<DefaultArgs> ).where as Prisma.ClientOrderWhereInput ).memberId = {
                    equals: null
                };

                ( clientsOrdersInfoData as IClientOrdersInfoDataArr[] ).push({
                    login: 'guest',
                    ordersCount: await this._prisma.clientOrder.count({
                        where: {
                            status: options.status,
                            createdDate: {
                                gte: options.fromDate,
                                lte: options.untilDate
                            }
                        }
                    })
                });

                delete ( ( ( clientFindManyArgs.include as Prisma.MemberInclude<DefaultArgs> )._count as Prisma.MemberCountOutputTypeDefaultArgs<DefaultArgs> )
                .select?.clientOrders as Prisma.MemberCountOutputTypeCountClientOrdersArgs<DefaultArgs> ).where?.memberId;
            }

            for ( const client of clientsData ) {
                try {
                    ( clientsOrdersInfoData as IClientOrdersInfoDataArr[] ).push({
                        login: client.login,
                        ordersCount: client._count.clientOrders
                    });
                } catch { }
            }
        } else if ( typeof loginList === 'string' ) {
            const clientData: IMemberWithClientOrdersCount = ( await this._prisma.member.findUnique({ 
                where: { login: loginList },
                include: memberIncludeClientOrderCount
            }) as IMemberWithClientOrdersCount );

            try {
                clientsOrdersInfoData = {
                    login: loginList,
                    ordersCount: clientData._count.clientOrders
                } as IClientOrdersInfoDataArr;
            } catch { }
        } else if ( Array.isArray(loginList) ) {
            for ( const login of loginList ) {
                const clientData: IMemberWithClientOrdersCount = ( await this._prisma.member.findUnique({ 
                    where: { login: login },
                    include: memberIncludeClientOrderCount
                }) as IMemberWithClientOrdersCount );

                if ( !clientsOrdersInfoData ) clientsOrdersInfoData = [];

                try {
                    ( clientsOrdersInfoData as IClientOrdersInfoDataArr[] ).push({
                        login,
                        ordersCount: clientData._count.clientOrders
                    });
                } catch { }
            }
        }

        return clientsOrdersInfoData as IClientOrdersInfoDataArr | IClientOrdersInfoDataArr[];
    }
    /**
        * Register client last activity date or sign in date and save into database.
        * 
        * @param   clientData JWT payload.
    */
    public async registerClientLastActivityLoginTime (clientData: IJWTPayload, activityType: 'activityDate' | 'signInDate'): Promise<void> {
        if ( clientData.type === 'member' ) await this._prisma.member.update({
            data: activityType === 'activityDate' ? { lastActiveDate: new Date(Date.now()) } : { lastSignInDate: new Date(Date.now()) },
            where: { id: clientData.id as number }
        });
        else if ( clientData.type === 'admin' ) await this._prisma.admin.update({
            data: activityType === 'activityDate' ? { lastActiveDate: new Date(Date.now()) } : { lastSignInDate: new Date(Date.now()) },
            where: { id: clientData.id as number }
        });
    }
}