import { BadRequestException, ConflictException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { Response } from 'express';

import { Client_order_status, Image_display_type, Image_photography_type, Prisma } from '@prisma/client';
import { DefaultArgs } from '@prisma/client/runtime/library';

import fsPromises from 'fs/promises';
import path from 'path';

import { ImageControlModule } from '../../modules/image-control.module';
import { SignModule } from '../../modules/sign.module';
import { ClientModule } from '../../modules/client.module';

import { PrismaService } from '../../../prisma/prisma.service';
import { AppService } from '../../app.service';
import { SignService } from '../sign/sign.service';
import { ImageControlService } from '../image-control/image-control.service';
import { ClientService } from '../client/client.service';

import { IAdminPanelRequestBody, IClientOrdersData, IClientOrdersInfoDataArr, IFullCompressedImageData, IOrdersClientsData, IPreviousActiveImageOperations, IRequest, IRequestBody} from '@photographer-project/types';
import { IImageMeta } from '@photographer-project/types';
import { IClientOrderWithoutRelationFields, ICompressedImageWithoutRelationFields, IDiscount, IImagePhotographyType, IMember, IMemberWithClientOrdersCount } from '@photographer-project/types';
import { IGetClientOrdersOptions, IGetFullCompressedImagesDataOptions } from '@photographer-project/types';
import { IJWTPayload } from '@photographer-project/types';

@Injectable()
export class AdminPanelService {
    public staticCompressedImagesDirPath: string;

    public readonly previousActiveImageOperations: IPreviousActiveImageOperations = { /////////////////////////////// NEW //////////////////////////////////////
        upload: false,
        changeData: false,
        delete: false,
        changeDisplayTarget: false,
        setPhotographyType: false,
        getFullCompressedList: false,
        getThumbnail: false,
        changePhotographyTypeDescription: false
    };

    constructor (
        private readonly _prisma: PrismaService,

        private readonly _appService: AppService
    ) {
        this.staticCompressedImagesDirPath = path.join(this._appService.staticFilesDirPath, 'images_thumbnail');

        ( async () => {
            const imageControlServiceRef: ImageControlService = await this._appService.getServiceRef(ImageControlModule, ImageControlService);
            await imageControlServiceRef.createImageDirs();
        } )();
    }

    /**
        * Check access for admin request.
        * 
        * @param   request Currently request object.
        * @param   __secure_fgp Secure fingerprint from cookie.
        
        * @returns Result of checking access.
    */
    public async checkAccess (request: IRequest, __secure_fgp: string): Promise<boolean> {
        if ( !__secure_fgp || __secure_fgp === '' ) return false;

        const signServiceRef: SignService = await this._appService.getServiceRef(SignModule, SignService);
        const validateClientAuthResult: boolean = await signServiceRef.validateClient(request, [ 'admin' ], false);

        return validateClientAuthResult;
    }

    /**
        * Get original image thumbnail from file system.
        * 
        * @param   request Currently request object.
        * @param   originalName Name of original image.
        * 
        * @returns Image thumbnail buffer.
    */
    public async getImageThumbnail (request: IRequest, originalName: string): Promise<Buffer> {
        // const imageControlServiceRef: ImageControlService = await this._appService.getServiceRef(ImageControlModule, ImageControlService);
        // return imageControlServiceRef.createImageThumbnail(request, originalName);

        if ( !this.previousActiveImageOperations.getThumbnail ) { /////////////////////////////////// NEW ///////////////////////////////////// !this.previousGetImageThumbnailProcessIsActive
            this.previousActiveImageOperations.getThumbnail = true; /////////////////////////////////// NEW ///////////////////////////////////// this.previousGetImageThumbnailProcessIsActive = true;

            try {
                const imageControlServiceRef: ImageControlService = await this._appService.getServiceRef(ImageControlModule, ImageControlService);
                const imageBuffer: Buffer<ArrayBufferLike> = await imageControlServiceRef.createImageThumbnail(request, originalName);

                this.previousActiveImageOperations.getThumbnail = false; /////////////////////////////////// NEW ///////////////////////////////////// this.previousGetImageThumbnailProcessIsActive = false;

                return imageBuffer;
            } catch ( err: any ) { /////////////////////////////////// NEW /////////////////////////////////////
                this.previousActiveImageOperations.getThumbnail = false; /////////////////////////////////// NEW ///////////////////////////////////// this.previousGetImageThumbnailProcessIsActive = false;

                return err; /////////////////////////////////// NEW /////////////////////////////////////
            } /////////////////////////////////// NEW /////////////////////////////////////
        } else throw new ConflictException(`${ request.url } "CreateImageThumbnail - previous get image thumbnail process is active"`); /////////////////////////////////// NEW /////////////////////////////////////
    }

    /**
        * Upload new image to file system and database.
        * 
        * @param   request Currently request object.
        * @param   requestBody Currently request body object.
        * 
        * @returns Result of start upload.
    */
    public async uploadImage (request: IRequest, requestBody: IRequestBody): Promise<string | { currentAdminId: number, currentAdminLogin: string }> {
        const signServiceRef: SignService = await this._appService.getServiceRef(SignModule, SignService);
        const { id: activeAdminId, login: activeAdminLogin } = await signServiceRef.getActiveClient(request) as IJWTPayload;

        let imageMeta: IImageMeta | null = null;

        try {
            imageMeta = JSON.parse(requestBody?.client?.uploadImageMeta as string);

            if ( Object.keys(imageMeta as IImageMeta).some(key => key in [ 'name', 'size', 'type' ]) ) throw new Error('Required keys are missing');
        } catch {
            throw new BadRequestException(`${ request.url } "UploadImage - not valid image meta, login --- ${ activeAdminLogin as string }"`);
        }

        const newOriginalImagePath: string = path.join(this._appService.clientOriginalImagesDir, imageMeta?.name as string);
        const validateRequestResult: 'PREVIOUSUPLOADIMAGEPROCESSISACTIVE' | 'NOTSUPPORTEDFORMAT' | 'PENDING' | 'FILEEXISTS' | 'MAXCOUNT' | 'MAXSIZE' | 'MAXNAMELENGTH' | null = await this._validateUploadImageRequest(
            newOriginalImagePath, 
            this._appService.clientOriginalImagesDir,
            imageMeta as IImageMeta
        );

        if ( validateRequestResult !== null ) return validateRequestResult;

        return {
            currentAdminId: activeAdminId as number,
            currentAdminLogin: activeAdminLogin as string
        };
    }
    
    /**
        * Check new image upload possibility.
        * 
        * @param   activeUploadsClientNumber Active client uploads count.
        * @param   activeClientData Active admin data.
        * @param   newOriginalImagePath New original image path.
        * @param   originalImagesDirClientPath Compressed images dir path.
        * @param   imageMeta New image meta data.
     
        * @returns Result of validate.
    */
    private async _validateUploadImageRequest (
        newOriginalImagePath: string, 
        originalImagesDirClientPath: string, 
        imageMeta: IImageMeta
    ): Promise<'PREVIOUSUPLOADIMAGEPROCESSISACTIVE' | 'NOTSUPPORTEDFORMAT' | 'PENDING' | 'FILEEXISTS' | 'MAXCOUNT' | 'MAXSIZE' | 'MAXNAMELENGTH' | null> {
        if ( !this.previousActiveImageOperations.upload ) { // !this.previousUploadImageProcessIsActive
            this.previousActiveImageOperations.upload = true; // this.previousUploadImageProcessIsActive = true;
        } else return 'PREVIOUSUPLOADIMAGEPROCESSISACTIVE';

        if ( !this._appService.supportedImageFileTypes.includes(imageMeta?.type as string) ) return 'NOTSUPPORTEDFORMAT';

        const imageControlServiceRef: ImageControlService = await this._appService.getServiceRef(ImageControlModule, ImageControlService);
        if ( await imageControlServiceRef.checkFileExists(newOriginalImagePath) ) return 'FILEEXISTS';
    
        const uploadedFilesCount: number = ( await fsPromises.readdir(originalImagesDirClientPath) ).length;
        const TWENTY_MEGABYTES: number = 20000000;
    
        if ( uploadedFilesCount >= 100 ) return 'MAXCOUNT';
        else if ( imageMeta.size as number > TWENTY_MEGABYTES ) return 'MAXSIZE';
        else if ( ( imageMeta.name as string ).length < 4 ) return 'MAXNAMELENGTH';

        return null;
    }

    /**
        * Get compressed images data from database.
        * 
        * @param   request Currently request object.
        * @param   options Sort options.
        * 
        * @returns Sorted compressed images data object.
    */
    public async getFullCompressedImagesList (request: IRequest, options: IGetFullCompressedImagesDataOptions): Promise<IFullCompressedImageData> {
        if ( !this.previousActiveImageOperations.getFullCompressedList ) { /////////////////////////////////////// NEW ////////////////////////////////////// !this.previousGetFullCompressedImagesListProcessIsActive
            this.previousActiveImageOperations.getFullCompressedList = true; /////////////////////////////////////// NEW ////////////////////////////////////// this.previousGetFullCompressedImagesListProcessIsActive = true;

            if ( !options.imagesExistsCount ) options.imagesExistsCount = 0;
            if ( !options.imagesLimit ) options.imagesLimit = 5;

            /*
            const imageControlServiceRef: ImageControlService = await this._appService.getServiceRef(ImageControlModule, ImageControlService);
            const compressedImagesData: ICompressedImageWithoutRelationFields[] = await imageControlServiceRef.getCompressedImages({
                clientData: request.activeClientData,
                find: {
                    selectFields: {
                        originalName: true,
                        originalSize: true,
                        name: true,
                        photographyType: true,
                        displayType: true,
                        description: true,
                        uploadDate: true,
                        displayedOnHomePage: true,
                        displayedOnGalleryPage: true,
                        dirPath: false,
                        originalDirPath: false,
                        admin: false,
                        adminId: false
                    },
                    photographyTypes: options.photographyTypes && options.photographyTypes.length !== 0 ? options.photographyTypes as Image_photography_type[] : undefined,
                    displayTypes: options.displayTypes && options.displayTypes.length !== 0 ? options.displayTypes as Image_display_type[] : undefined,
                },
                imagesLimit: options.imagesLimit,
                imagesExistsCount: options.imagesExistsCount,
                dateFrom: options.dateFrom,
                dateUntil: options.dateUntil,
                sortBy: options.sortBy
            });

            const commonCompressedImagesCount: number = await this._prisma.compressedImage.count({
                where: {
                    photographyType: options.photographyTypes ? {
                        in: options.photographyTypes as Image_photography_type[]
                    } : undefined,
                    displayType: options.displayTypes ? {
                        in: options.displayTypes as Image_display_type[]
                    } : undefined,
                    uploadDate: options.dateFrom && options.dateUntil ? {
                        gte: options.dateFrom,
                        lte: options.dateUntil
                    } : undefined
                },
            });

            const imagesData: IFullCompressedImageData = {
                imagesList: compressedImagesData, 
                count: compressedImagesData.length,
                additionalImagesIsExists: commonCompressedImagesCount > options.imagesExistsCount + compressedImagesData.length && commonCompressedImagesCount > options.imagesLimit
            }

            this.previousGetFullCompressedImagesListProcessIsActive = false; /////////////////////////////////////// NEW //////////////////////////////////////

            return imagesData;
            */

            try {
                const imageControlServiceRef: ImageControlService = await this._appService.getServiceRef(ImageControlModule, ImageControlService);
                const compressedImagesData: ICompressedImageWithoutRelationFields[] = await imageControlServiceRef.getCompressedImages({
                    clientData: request.activeClientData,
                    find: {
                        selectFields: {
                            originalName: true,
                            originalSize: true,
                            name: true,
                            photographyType: true,
                            displayType: true,
                            description: true,
                            uploadDate: true,
                            displayedOnHomePage: true,
                            displayedOnGalleryPage: true,
                            dirPath: false,
                            originalDirPath: false,
                            admin: false,
                            adminId: false
                        },
                        photographyTypes: options.photographyTypes && options.photographyTypes.length !== 0 ? options.photographyTypes as Image_photography_type[] : undefined,
                        displayTypes: options.displayTypes && options.displayTypes.length !== 0 ? options.displayTypes as Image_display_type[] : undefined,
                    },
                    imagesLimit: options.imagesLimit,
                    imagesExistsCount: options.imagesExistsCount,
                    dateFrom: options.dateFrom,
                    dateUntil: options.dateUntil,
                    sortBy: options.sortBy
                });

                const commonCompressedImagesCount: number = await this._prisma.compressedImage.count({
                    where: {
                        photographyType: options.photographyTypes ? {
                            in: options.photographyTypes as Image_photography_type[]
                        } : undefined,
                        displayType: options.displayTypes ? {
                            in: options.displayTypes as Image_display_type[]
                        } : undefined,
                        uploadDate: options.dateFrom && options.dateUntil ? {
                            gte: options.dateFrom,
                            lte: options.dateUntil
                        } : undefined
                    },
                });
            

                const imagesData: IFullCompressedImageData = {
                    imagesList: compressedImagesData, 
                    count: compressedImagesData.length,
                    additionalImagesIsExists: commonCompressedImagesCount > options.imagesExistsCount + compressedImagesData.length && commonCompressedImagesCount > options.imagesLimit
                }

                this.previousActiveImageOperations.getFullCompressedList = false; /////////////////////////////////////// NEW ////////////////////////////////////// this.previousGetFullCompressedImagesListProcessIsActive = false;
            
                return imagesData;
            } catch ( err: any ) {
                this.previousActiveImageOperations.getFullCompressedList = false; /////////////////////////////////////// NEW ////////////////////////////////////// this.previousGetFullCompressedImagesListProcessIsActive = false;

                return err; /////////////////////////////////////// NEW //////////////////////////////////////
            }
        } else throw new ConflictException(`${ request.url } "SetPhotographyTypeImage - previous get full compressed images list process is active"`); /////////////////////////////////////// NEW //////////////////////////////////////
    }

    /**
        * Get client orders data from database.
        * 
        * @param   options Sort options.
        * 
        * @returns Sorted client orders object.
    */
    public async getClientOrdersData (options: IGetClientOrdersOptions): Promise<IClientOrdersData> {
        const clientServiceRef: ClientService = await this._appService.getServiceRef(ClientModule, ClientService);
        const existingClientData: IMemberWithClientOrdersCount | null = ( await clientServiceRef.getClientsData('member', options.memberLogin as string, {
            orders: {
                include: true,
                includeCount: true,
                whereStatus: options.status as Client_order_status
            }
        }) as IMemberWithClientOrdersCount );

        options = this._setGetClientOrdersDefaultOptions(options);

        const clientOrdersFindManyArgs: Prisma.ClientOrderFindManyArgs<DefaultArgs> = {
            select: {
                id: true,
                photographyType: true,
                type: true,
                phoneNumber: true,
                comment: true,
                createdDate: true,
                status: true,
                member: false,
                memberId: false
            },
            where: {
                status: options.status,
                createdDate: {
                    gte: options.fromDate,
                    lte: options.untilDate
                }
            },
            take: options.ordersLimit as number,
            skip: options.existsCount as number
        };

        let clientOrdersData: IClientOrdersData | null = null;

        let ordersData: IClientOrderWithoutRelationFields[] | undefined = undefined;
        let commonOrdersCount: number | null = null;

        if ( existingClientData !== null ) {
            ordersData = existingClientData.clientOrders;

            commonOrdersCount = existingClientData._count.clientOrders;
        } else {
            ( clientOrdersFindManyArgs.where as Prisma.ClientOrderWhereInput)['memberId'] = { equals: null }

            ordersData = await this._prisma.clientOrder.findMany(clientOrdersFindManyArgs);
            commonOrdersCount = await this._prisma.clientOrder.count({
                where: {
                    status: options.status,
                    memberId: { equals: null }
                }
            });
        }

        clientOrdersData = {
            orders: ordersData ? ordersData : [],
            additionalOrdersExists: commonOrdersCount > ( options.existsCount as number ) + ( ordersData ? ordersData.length : 0 ) && commonOrdersCount > ( options.ordersLimit as number ),
        }

        return clientOrdersData;
    }

    /**
        * Get orders clients data from database.
        * 
        * @param   options Sort options.
        * 
        * @returns Sorted orders clients object.
    */
    public async getOrdersClientsData (options: IGetClientOrdersOptions): Promise<IOrdersClientsData> {
        const clientServiceRef: ClientService = await this._appService.getServiceRef(ClientModule, ClientService);

        options = this._setGetClientOrdersDefaultOptions(options);

        const clientOrdersInfoDataArr: IClientOrdersInfoDataArr[] = await clientServiceRef.getClientOrdersInfo(null, {
            status: options.status,
            existsCount: options.existsCount,
            ordersLimit: options.ordersLimit
        });

        const commonOrdersClientsCount: number = await this._prisma.member.count();
        const clientOrdersInfoDataArrCount: number = options.existsCount === 0 ? clientOrdersInfoDataArr.length - 1 : clientOrdersInfoDataArr.length;

        let ordersClientsData: IOrdersClientsData = {
            clients: clientOrdersInfoDataArr.map(ordersClientData => ordersClientData.login),
            commonOrdersCount: commonOrdersClientsCount,
            additionalOrdersClientsExists: commonOrdersClientsCount > ( options.existsCount as number ) + clientOrdersInfoDataArrCount && commonOrdersClientsCount > ( options.ordersLimit as number )
        }

        return ordersClientsData;
    }

    /**
        * Set client orders sort options to default.
        * 
        * @param   options Sort options.
        * 
        * @returns Default client orders options.
    */
    private _setGetClientOrdersDefaultOptions (options: IGetClientOrdersOptions): IGetClientOrdersOptions {
        if ( !options.status ) options.status = 'new';
        if ( !options.fromDate ) options.fromDate = undefined;
        if ( !options.untilDate ) options.untilDate = new Date();
        if ( !options.existsCount ) options.existsCount = 0;
        if ( !options.ordersLimit ) options.ordersLimit = 2;

        return options
    }

    /**
        * Get discounts data from database.
        * 
        * @param   forClient Get for client.
        * 
        * @returns Discounts data array.
    */
    public async getDiscountsData (forClient = true): Promise<IDiscount[]> {
        const discountFindManyArgs: Prisma.DiscountFindManyArgs<DefaultArgs> = { };
        const dateNow: Date = new Date(Date.now());

        if ( forClient ) {
            discountFindManyArgs.select = {
                id: true,
                content: true,
                expirationFromDate: false,
                expirationToDate: false
            };

            discountFindManyArgs.where = {
                expirationFromDate: { lte: dateNow },
                expirationToDate: { gte: dateNow }
            };
        }

        const discountsData: IDiscount[] = await this._prisma.discount.findMany(discountFindManyArgs);

        return discountsData;
    }

    /**
        * Create discount instance and add to database.
        * 
        * @param   request Currently request object.
        * @param   requestBody Currently request body object.
        * 
        * @returns Success string.
    */
    public async createDiscount (request: IRequest, requestBody: IRequestBody): Promise<string> {
        const commonDiscountsCount: number = await this._prisma.discount.count();
        if ( commonDiscountsCount >= 3 ) return 'MAXCOUNT'; 

        const { discountContent, fromDate, toDate } = requestBody.adminPanel as IAdminPanelRequestBody;

        const dateNow: Date = new Date(Date.now());
        const id: number = parseInt(`${ dateNow.getFullYear() }${ dateNow.getMonth() }${ dateNow.getHours() }${ dateNow.getMinutes() }${ dateNow.getSeconds() }`, 10);
        const discountData: IDiscount | null = await this._prisma.discount.findUnique({ where: { id }});
        if ( discountData !== null ) throw new BadRequestException(`${ request.url } "CreateDiscount - discount instance is exists"`);

        await this._prisma.discount.create({
            data: {
                id,
                content: discountContent as string,
                expirationFromDate: fromDate as Date,
                expirationToDate: toDate as Date
            }
        });

        return 'SUCCESS';
    }

    /**
        * Change discount data stored in database and save it.
        * 
        * @param request Currently request object.
        * @param requestBody Currently request body object.
    */
    public async changeDiscountData (request: IRequest, requestBody: IRequestBody): Promise<void> {
        const { newDiscountContent, newFromDate, newToDate, discountId } = requestBody.adminPanel as IAdminPanelRequestBody;

        const discountData: IDiscount | null = await this._prisma.discount.findUnique({ where: { id: discountId as number }});
        if ( discountData === null ) throw new BadRequestException(`${ request.url } "ChangeDiscountData - discount instance does not exists"`);

        let discountUpdateArgs: Prisma.DiscountUpdateArgs<DefaultArgs> | null = null

        if ( newDiscountContent || newFromDate || newToDate ) {
            discountUpdateArgs = {
                data: { },
                where: { id: discountData.id }
            }

            if ( newDiscountContent ) discountUpdateArgs.data.content = newDiscountContent;
            if ( newFromDate && newToDate ) {
                discountUpdateArgs.data.expirationFromDate = newFromDate;
                discountUpdateArgs.data.expirationToDate = newToDate;
            }

            await this._prisma.discount.update(discountUpdateArgs);
        }
    }

    /**
        * Delete discount data from database.
        * 
        * @param request Currently request object.
        * @param discountId Value of id field of discount record stored in database.
    */
    public async deleteDiscount (request: IRequest, discountId: number): Promise<void> {
        const discountData: IDiscount | null = await this._prisma.discount.findUnique({ where: { id: discountId } });
        if ( discountData === null ) throw new BadRequestException(`${ request.url } "DeleteDiscount - discount instance does not exists"`);

        await this._prisma.discount.delete({ where: { id: discountData.id } });
    }

    /**
        * Change status of client order stored in database and save it.
        * 
        * @param request Currently request object.
        * @param requestBody Currently request body object.
    */
    public async changeClientOrderStatus (request: IRequest, requestBody: IRequestBody): Promise<void> {
        const clientOrderData: IClientOrderWithoutRelationFields | null = await this._prisma.clientOrder.findUnique({ where: { id: requestBody.adminPanel?.clientOrderId as number } });
        if ( clientOrderData === null ) throw new BadRequestException(`${ request.url } "ChangeClientOrderStatus - client order instance does not exists"`);

        const clientServiceRef: ClientService = await this._appService.getServiceRef(ClientModule, ClientService);
        const clientData: IMember | null = ( await clientServiceRef.getClientsData('member', requestBody.adminPanel?.clientLogin as string, { orders: { include: true } }) as IMember | null );

        if ( clientData !== null ) {
            if ( clientData.clientOrders.every(data => data.id !== clientOrderData.id) ) {
                throw new BadRequestException(`${ request.url } "ChangeClientOrderStatus - client order instance of client '${ requestBody.adminPanel?.clientLogin as string }' does not exists"`);
            }
        }

        await this._prisma.clientOrder.update({ data: { status: 'processed' }, where: { id: clientOrderData.id } });
    }

    /**
        * Delete image data from database and file system.
        * 
        * @param   request Currently request object.
        * @param   requestBody Currently request body object.
        * 
        * @returns Success string.
    */
    public async deleteImage (request: IRequest, requestBody: IRequestBody): Promise<string> {
        if ( !this.previousActiveImageOperations.delete ) { ///////////////////////////////// NEW ////////////////////////////////// !this.previousDeleteImageProcessIsActive
            this.previousActiveImageOperations.delete = true; ///////////////////////////////// NEW ////////////////////////////////// this.previousDeleteImageProcessIsActive = true;

            const originalImageName: string = requestBody.adminPanel?.originalImageName as string;
            const originalImagePath: string = path.join(this._appService.clientOriginalImagesDir, originalImageName);

            const imageControlServiceRef: ImageControlService = await this._appService.getServiceRef(ImageControlModule, ImageControlService);
            const compressedImageIsExists: boolean = await imageControlServiceRef.findSameAdminCompressedImage(request.activeClientData?.id as number, 4, 0, null, originalImageName);
            const imageIsExists: boolean = await imageControlServiceRef.checkFileExists(path.join(this._appService.clientOriginalImagesDir, originalImageName));
            if ( !compressedImageIsExists || !imageIsExists ) {
                this.previousActiveImageOperations.delete = false; ///////////////////////////////// NEW ////////////////////////////////// this.previousDeleteImageProcessIsActive = false;

                throw new BadRequestException(`${ request.url } "DeleteImage - ${ !compressedImageIsExists ? 'compressed image does not exists' : 'original image does not exists' }"`);
            }

            const deleteImageResult: boolean = await this._appService.managePromisesCache('deleteImage', imageControlServiceRef.deleteImage(request, originalImagePath));
            if ( deleteImageResult ) {
                this.previousActiveImageOperations.delete = false; ///////////////////////////////// NEW ////////////////////////////////// this.previousDeleteImageProcessIsActive = false;

                return 'SUCCESS';
            } else {
                this.previousActiveImageOperations.delete = false; ///////////////////////////////// NEW ////////////////////////////////// this.previousDeleteImageProcessIsActive = false;

                throw new InternalServerErrorException(`${ request.url } "DeleteImage - delete error"`);
            }
        } else throw new ConflictException(`${ request.url } "DeleteImage - previous delete image process is active"`); ///////////////////////////////// NEW //////////////////////////////////
    }

    /**
        * Change display target of image stored in database and file system and save it.
        * 
        * @param   request Currently request object.
        * @param   requestBody Currently request body object.
        * @param   response Currently response object.
        * @param   clientLocale Client currently language from cookie.
        * 
        * @returns Result of validation possibility changing or success string.
    */
    public async changeImageDisplayTarget (request: IRequest, requestBody: IRequestBody, response: Response, clientLocale: string): Promise<string> {
        if ( !this.previousActiveImageOperations.changeDisplayTarget ) { //////////////////////////////////////////// NEW //////////////////////////////////////////////// !this.previousChangeImageDisplayTargetProcessIsActive
            this.previousActiveImageOperations.changeDisplayTarget = true; //////////////////////////////////////////// NEW //////////////////////////////////////////////// this.previousChangeImageDisplayTargetProcessIsActive = true;

            const { originalImagePath } = await this._getOriginalImagePathWithActiveAdminLogin(request, requestBody, response, clientLocale);
            const existingCompressedImageData: ICompressedImageWithoutRelationFields | null = await this._prisma.compressedImage.findFirst({ where: { originalName: path.basename(originalImagePath) } });
            if ( existingCompressedImageData === null ) {
                this.previousActiveImageOperations.changeDisplayTarget = false; //////////////////////////////////////////// NEW //////////////////////////////////////////////// this.previousChangeImageDisplayTargetProcessIsActive = false;

                throw new BadRequestException(`${ request.url } "ChangeImageDisplayTarget - 'compressed image does not exists'"`);
            }

            const displayTargetPage: 'home' | 'gallery' | 'original' = requestBody.adminPanel?.displayTargetPage as 'home' | 'gallery' | 'original';
            if ( displayTargetPage === 'home' ) {
                const homeImagesCount: number = ( await fsPromises.readdir(path.join(this.staticCompressedImagesDirPath, 'home')) ).length;

                if ( homeImagesCount >= 20 ) {
                    this.previousActiveImageOperations.changeDisplayTarget = false; //////////////////////////////////////////// NEW //////////////////////////////////////////////// this.previousChangeImageDisplayTargetProcessIsActive = false;

                    return 'MAXCOUNT';
                }
            } else if ( displayTargetPage === 'gallery' ) {
                const galleryImagesCount: number = ( await fsPromises.readdir(path.join(this.staticCompressedImagesDirPath, 'gallery', existingCompressedImageData.photographyType)) ).length;

                if ( galleryImagesCount >= 25 ) {
                    this.previousActiveImageOperations.changeDisplayTarget = false; //////////////////////////////////////////// NEW //////////////////////////////////////////////// this.previousChangeImageDisplayTargetProcessIsActive = false;

                    return 'MAXCOUNT';
                }
            }

            const compressedImageUpdateArgs: Prisma.CompressedImageUpdateArgs<DefaultArgs> = {
                data: {},
                where: { name: existingCompressedImageData.name }
            };

            if ( displayTargetPage === 'home') {
                compressedImageUpdateArgs.data.displayedOnHomePage = true;
        
                if ( existingCompressedImageData.displayedOnHomePage ) compressedImageUpdateArgs.data.displayedOnHomePage = false;
                else if ( existingCompressedImageData.displayedOnGalleryPage ) compressedImageUpdateArgs.data.displayedOnGalleryPage = false;
            } else if ( displayTargetPage === 'gallery' ) {
                compressedImageUpdateArgs.data.displayedOnGalleryPage = true;
        
                if ( existingCompressedImageData.displayedOnGalleryPage ) compressedImageUpdateArgs.data.displayedOnGalleryPage = false;
                else if ( existingCompressedImageData.displayedOnHomePage ) compressedImageUpdateArgs.data.displayedOnHomePage = false;
            } else if ( displayTargetPage === 'original' ) {
                if ( existingCompressedImageData.displayedOnHomePage ) compressedImageUpdateArgs.data.displayedOnHomePage = false;
                else if ( existingCompressedImageData.displayedOnGalleryPage ) compressedImageUpdateArgs.data.displayedOnGalleryPage = false;
            }

            const staticFilesHomeImagePath: string = path.join(this.staticCompressedImagesDirPath, 'home');
            const staticFilesGalleryImagePath: string = path.join(this.staticCompressedImagesDirPath, 'gallery', existingCompressedImageData.photographyType);
            const compressedImageOriginalPath: string = path.join(this._appService.clientCompressedImagesDir);

            let newImagePath: string = '';
            let newDirPath: string = '';

            if ( displayTargetPage === 'home' ) {
                if ( existingCompressedImageData.displayType !== 'horizontal' ) {
                    this.previousActiveImageOperations.changeDisplayTarget = false; //////////////////////////////////////////// NEW //////////////////////////////////////////////// this.previousChangeImageDisplayTargetProcessIsActive = false;

                    return 'WRONGDISPLAYTYPE';
                }
        
                newImagePath = path.join(staticFilesHomeImagePath, existingCompressedImageData.name);
                newDirPath = staticFilesHomeImagePath;
            }
            else if ( displayTargetPage === 'gallery' ) {
                if ( existingCompressedImageData.displayType !== 'vertical' ) {
                    this.previousActiveImageOperations.changeDisplayTarget = false; //////////////////////////////////////////// NEW //////////////////////////////////////////////// this.previousChangeImageDisplayTargetProcessIsActive = false;

                    return 'WRONGDISPLAYTYPE';
                }
        
                newImagePath = path.join(staticFilesGalleryImagePath, existingCompressedImageData.name);
                newDirPath = staticFilesGalleryImagePath;
            } else if ( displayTargetPage === 'original' ) {
                newImagePath = path.join(compressedImageOriginalPath, existingCompressedImageData.name);
                newDirPath = compressedImageOriginalPath;
            }

            compressedImageUpdateArgs.data.dirPath = newDirPath;
            
            await this._appService.managePromisesCache('changeImageDisplayTargetRename', fsPromises.rename(path.join(existingCompressedImageData.dirPath, existingCompressedImageData.name), newImagePath));
            await this._prisma.compressedImage.update(compressedImageUpdateArgs);

            this.previousActiveImageOperations.changeDisplayTarget = false; //////////////////////////////////////////// NEW //////////////////////////////////////////////// this.previousChangeImageDisplayTargetProcessIsActive = false;

            return 'SUCCESS';
        } throw new ConflictException(`${ request.url } "ChangeImageDisplayTarget - previous change image display target process is active"`); //////////////////////////////////////////// NEW ////////////////////////////////////////////////
    }

    /**
        * Change data of image stored in database and save it.
        * 
        * @param   request Currently request object.
        * @param   requestBody Currently request body object.
        * @param   response Currently response object.
        * @param   clientLocale Client currently language from cookie.
        * 
        * @returns Success string.
    */
    public async changeImageData (request: IRequest, requestBody: IRequestBody, response: Response, clientLocale: string): Promise<string> {
        if ( !this.previousActiveImageOperations.changeData ) { ///////////////////////////////// NEW ////////////////////////////////// !this.previousChangeImageProcessIsActive
            this.previousActiveImageOperations.changeData = true; ///////////////////////////////// NEW ////////////////////////////////// this.previousChangeImageProcessIsActive = true;

            try { ///////////////////////////////// NEW //////////////////////////////////
                const { originalImagePath } = await this._getOriginalImagePathWithActiveAdminLogin(request, requestBody, response, clientLocale);
                const { newImagePhotographyType, newImageDescription, newImageDisplayType } = requestBody.adminPanel as IAdminPanelRequestBody;
                if ( newImagePhotographyType || newImageDescription !== undefined || newImageDisplayType ) {
                    const existingCompressedImageData: ICompressedImageWithoutRelationFields | null = await this._prisma.compressedImage.findFirst({ where: { originalName: path.basename(originalImagePath) } });

                    if ( existingCompressedImageData === null ) {
                        // this.previousChangeImageProcessIsActive = false; ///////////////////////////////// NEW //////////////////////////////////

                        throw new BadRequestException(`${ request.url } "ChangeImageData - 'compressed image does not exists'"`);
                    }

                    const compressedImageUpdateArgs: Prisma.CompressedImageUpdateArgs<DefaultArgs> = {
                        data: { },
                        where: { name: existingCompressedImageData.name }
                    };

                    if ( newImagePhotographyType ) {
                        compressedImageUpdateArgs.data.photographyType = newImagePhotographyType;

                        const staticFilesHomeImagePath: string = path.join(this.staticCompressedImagesDirPath, 'home', existingCompressedImageData.name);
                        const staticFilesGalleryImagePath: string = path.join(this.staticCompressedImagesDirPath, 'gallery', existingCompressedImageData.photographyType, existingCompressedImageData.name);
                        const compressedImageOriginalPath: string = path.join(this._appService.clientCompressedImagesDir, existingCompressedImageData.name);

                        const currentPath: string = path.join(existingCompressedImageData.dirPath, existingCompressedImageData.name);

                        if ( currentPath !== staticFilesHomeImagePath && currentPath !== compressedImageOriginalPath ) {
                            const staticFilesGalleryImageNewPath: string = path.join(this.staticCompressedImagesDirPath, 'gallery', newImagePhotographyType, existingCompressedImageData.name);

                            await this._appService.managePromisesCache('changeImageData', fsPromises.rename(staticFilesGalleryImagePath, staticFilesGalleryImageNewPath));
                        }
                    }

                    if ( newImageDescription !== undefined && newImageDescription !== '' ) compressedImageUpdateArgs.data.description = newImageDescription;
                    if ( newImageDisplayType ) compressedImageUpdateArgs.data.displayType = newImageDisplayType;

                    await this._prisma.compressedImage.update(compressedImageUpdateArgs);

                    this.previousActiveImageOperations.changeData = false; ///////////////////////////////// NEW ////////////////////////////////// this.previousChangeImageProcessIsActive = false;
                }

                return 'SUCCESS';
            } catch ( err: any ) { ///////////////////////////////// NEW //////////////////////////////////
                this.previousActiveImageOperations.changeData = false; ///////////////////////////////// NEW ////////////////////////////////// this.previousChangeImageProcessIsActive = false;

                return err;
            }
        } else throw new ConflictException(`${ request.url } "ChangeImageData - previous change image process is active"`); ///////////////////////////////// NEW //////////////////////////////////
    }

    /**
        * Set photography type image of image stored in database and file system and save it.
        * 
        * @param request Currently request object.
        * @param requestBody Currently request body object.
        * @param response Currently response object.
        * @param clientLocale Client currently language from cookie.
        * 
        * @returns Result of validation possibility setting or success string.
    */
    public async setPhotographyTypeImage (request: IRequest, requestBody: IRequestBody, response: Response, clientLocale: string): Promise<string> {
        if ( !this.previousActiveImageOperations.setPhotographyType ) { ////////////////////////////////////////// NEW ////////////////////////////////////////// !this.previousSetPhotographyTypeImageProcessIsActive
            this.previousActiveImageOperations.setPhotographyType = true; ////////////////////////////////////////// NEW ////////////////////////////////////////// this.previousSetPhotographyTypeImageProcessIsActive = true;

            const { originalImagePath } = await this._getOriginalImagePathWithActiveAdminLogin(request, requestBody, response, clientLocale);
            const existingCompressedImageData: ICompressedImageWithoutRelationFields | null = await this._prisma.compressedImage.findFirst({ where: { originalName: path.basename(originalImagePath) } });
            if ( existingCompressedImageData === null ) {
                this.previousActiveImageOperations.setPhotographyType = false; ////////////////////////////////////////// NEW ////////////////////////////////////////// this.previousSetPhotographyTypeImageProcessIsActive = false;

                throw new BadRequestException(`${ request.url } "SetPhotographyTypeImage - 'compressed image does not exists'"`);
            }
            if ( existingCompressedImageData.displayType !== 'horizontal' ) {
                this.previousActiveImageOperations.setPhotographyType = false; ////////////////////////////////////////// NEW ////////////////////////////////////////// this.previousSetPhotographyTypeImageProcessIsActive = false;

                return 'WRONGDISPLAYTYPE';
            }

            const imagePhotographyType: string = requestBody.adminPanel?.imagePhotographyType as Image_photography_type;

            const newPath: string = path.join(this.staticCompressedImagesDirPath, 'home', 'imagePhotographyTypes', existingCompressedImageData.name);
            const currentPath: string = path.join(existingCompressedImageData.dirPath, existingCompressedImageData.name);

            const currentPhotographyType: IImagePhotographyType = ( await this._prisma.imagePhotographyType.findUnique({ where: { name: imagePhotographyType } }) as IImagePhotographyType );
            if ( currentPhotographyType && currentPhotographyType.compressedImageOriginalName && currentPhotographyType.compressedImageName && path.extname(currentPhotographyType.compressedImageOriginalName) !== '' ) {
                const deletePhotographyTypeImagePath: string = path.join(this.staticCompressedImagesDirPath, 'home', 'imagePhotographyTypes', currentPhotographyType.compressedImageName);

                const imageControlServiceRef: ImageControlService = await this._appService.getServiceRef(ImageControlModule, ImageControlService);
                if ( await imageControlServiceRef.checkFileExists(deletePhotographyTypeImagePath) ) {
                    await this._appService.managePromisesCache('setPhotographyTypeImageUnlink', fsPromises.unlink(deletePhotographyTypeImagePath));
                }
            }

            await this._appService.managePromisesCache('setPhotographyTypeImageCopy', fsPromises.copyFile(currentPath, newPath));
            
            await this._prisma.imagePhotographyType.update({
                data: { 
                    compressedImageOriginalName: existingCompressedImageData.originalName,
                    compressedImageName: existingCompressedImageData.name
                }, where: { name: imagePhotographyType } 
            });

            this.previousActiveImageOperations.setPhotographyType = false; ////////////////////////////////////////// NEW ////////////////////////////////////////// this.previousSetPhotographyTypeImageProcessIsActive = false;

            return 'SUCCESS';
        } else throw new ConflictException(`${ request.url } "SetPhotographyTypeImage - previous set photography type image process is active"`); ////////////////////////////////////////// NEW //////////////////////////////////////////
    }

    /**
        * Change description of photography type stored in database and save it.
        * 
        * @param requestBody Currently request body object.
    */
    public async changePhotographyTypeDescription (request: IRequest, requestBody: IRequestBody): Promise<void> {
        if ( !this.previousActiveImageOperations.changePhotographyTypeDescription ) { ///////////////////////////// NEW //////////////////////////// !this.previousChangePhotographyTypeDescriptionProcessIsActive
            this.previousActiveImageOperations.changePhotographyTypeDescription = true; ///////////////////////////// NEW //////////////////////////// this.previousChangePhotographyTypeDescriptionProcessIsActive = true;

            const { photographyTypeName, photographyTypeNewDescription } = requestBody.adminPanel as IAdminPanelRequestBody;
            await this._prisma.imagePhotographyType.update({ data: { description: photographyTypeNewDescription }, where: { name: photographyTypeName } });

            this.previousActiveImageOperations.changePhotographyTypeDescription = false; ///////////////////////////// NEW //////////////////////////// this.previousChangePhotographyTypeDescriptionProcessIsActive = false;
        } else throw new ConflictException(`${ request.url } "ChangePhotographyTypeDescription - previous change photography type description process is active"`); ///////////////////////////// NEW ////////////////////////////
    }

    /**
        * Get original image path from request body and active admin login.
        * 
        * @param   request Currently request object.
        * @param   requestBody Currently request body object.
        * @param   response Currently response object.
        * @param   clientLocale Client currently language from cookie.
        * 
        * @returns Original image path and active admin login.
    */
    private async _getOriginalImagePathWithActiveAdminLogin (request: IRequest, requestBody: IRequestBody, response: Response, clientLocale: string): Promise<{ originalImagePath: string, activeAdminLogin: string }> {
        const activeAdminLogin: string = await this._getActiveAdminLogin(request, response, clientLocale);

        const originalImagePath: string = await this._validateImageControlRequests(request, requestBody);

        return { originalImagePath, activeAdminLogin };
    }

    /**
        * Validate possibility changing image data stored in database and file system.
        * 
        * @param   request Currently request object.
        * @param   requestBody Currently request body object.
        * 
        * @returns Original image path from request body.
    */
    private async _validateImageControlRequests (request: IRequest, requestBody: IRequestBody): Promise<string> {
        const originalImageName: string = requestBody.adminPanel?.originalImageName as string;
        const originalImagePath: string = path.join(this._appService.clientOriginalImagesDir, originalImageName);

        const imageControlServiceRef: ImageControlService = await this._appService.getServiceRef(ImageControlModule, ImageControlService);
        const compressedImageIsExists: boolean = await imageControlServiceRef.findSameAdminCompressedImage(request.activeClientData?.id as number, 4, 0, null, originalImageName);
        const imageIsExists: boolean = await imageControlServiceRef.checkFileExists(path.join(this._appService.clientOriginalImagesDir, originalImageName));

        if ( !compressedImageIsExists || !imageIsExists ) {
            throw new BadRequestException(`${ request.url } "ValidateImageControlRequests - ${ !compressedImageIsExists ? 'compressed image does not exists' : 'original image does not exists' }"`);
        }

        const existingCompressedImageData: ICompressedImageWithoutRelationFields = ( await this._prisma.compressedImage.findFirst({ where: { originalName: originalImageName } }) as ICompressedImageWithoutRelationFields );
        if ( existingCompressedImageData.displayedOnGalleryPage && ( [ 'home', 'gallery', 'original' ].includes(requestBody.adminPanel?.displayTargetPage as string)
            || ( requestBody.adminPanel?.newImagePhotographyType as string ) in Image_photography_type
        ) ) {
            const staticFilesGalleryImagePath: string = path.join(this.staticCompressedImagesDirPath, 'gallery', existingCompressedImageData.photographyType, existingCompressedImageData.name);

            if ( path.join(existingCompressedImageData.dirPath, existingCompressedImageData.name) !== staticFilesGalleryImagePath ) {
                throw new InternalServerErrorException(`${ request.url } "ValidateImageControlRequests - compressed image '${ ( existingCompressedImageData as ICompressedImageWithoutRelationFields ).name }' does not exists in directory"`);
            }
        }
        
        return originalImagePath;
    }
    /**
        * Upload new image to file system and database.
        * 
        * @param   request Currently request object.
        * @param   response Currently response object.
        * @param   clientLocale Client currently language from cookie.
        * 
        * @returns Active admin login.
    */
    private async _getActiveAdminLogin (request: IRequest, response?: Response, clientLocale?: string): Promise<string> {
        const signServiceRef: SignService = await this._appService.getServiceRef(SignModule, SignService);

        return ( await signServiceRef.getActiveClient(request, response, clientLocale) as IJWTPayload ).login as string;
    }
}