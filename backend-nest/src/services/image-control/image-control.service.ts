import { BadRequestException, Injectable } from '@nestjs/common';

import { ImagePhotographyType, Prisma } from '@prisma/client';

import { Buffer } from 'node:buffer';
import fsPromises from 'fs/promises';
import path from 'path';

import sharp from 'sharp';

import { PrismaService } from '../../../prisma/prisma.service';
import { AppService } from '../../app.service';

import { ICompressImageData, IRequest } from '@photographer-project/types';
import { ICompressedImageGetOptions, IClientGetCompressedImagesOptions, SortBy_Types } from '@photographer-project/types';
import { IAdminWithCompressedImagesCount, ICompressedImageWithoutRelationFields } from '@photographer-project/types';

@Injectable()
export class ImageControlService {
    public staticCompressedImagesDirPath: string;

    constructor (
        private readonly _prisma: PrismaService,

        private readonly _appService: AppService
    ) { 
        this.staticCompressedImagesDirPath = path.join(this._appService.staticFilesDirPath, 'images_thumbnail');
    }
    /**
        * Get compressed images data.
        * 
        * @param   options Get options.
        * 
        * @returns Compressed images array.
    */
    public async getCompressedImages (options: ICompressedImageGetOptions): Promise<ICompressedImageWithoutRelationFields[]> {
        const clientGetCompressedImagesOptions: IClientGetCompressedImagesOptions = {
            include: true,
            skip: options.imagesExistsCount,
            take: options.imagesLimit,
            dateFrom: options.dateFrom,
            dateUntil: options.dateUntil
        }

        if ( options && options.find ) { 
            if ( options.find.imageTitles ) clientGetCompressedImagesOptions.whereNameArr = options.find.imageTitles;
            if ( options.find.selectFields ) clientGetCompressedImagesOptions.selectFields = options.find.selectFields;
            if ( options.find.photographyTypes ) clientGetCompressedImagesOptions.wherePhotographyTypes = options.find.photographyTypes;
            if ( options.find.displayTypes ) clientGetCompressedImagesOptions.whereDisplayTypes = options.find.displayTypes;
            if ( options.find.displayedOnHomePage !== undefined ) clientGetCompressedImagesOptions.displayedOnHomePage = options.find.displayedOnHomePage;
        }

        const orderBy: Prisma.CompressedImageOrderByWithRelationInput = { };

        switch ( options.sortBy as SortBy_Types ) {
            case 'originalName': { orderBy.originalName = 'asc'; break; }
            case 'originalSize': { orderBy.originalSize = 'asc'; break; }
            case 'photographyType': { orderBy.photographyType = 'asc'; break; }
            case 'displayType': { orderBy.displayType = 'asc'; break; }
            case 'uploadDate': { orderBy.uploadDate = 'desc'; break; }
            case 'displayedOnHomePage': { orderBy.displayedOnHomePage = 'desc'; break; }
            case 'displayedOnGalleryPage': { orderBy.displayedOnGalleryPage = 'desc'; break; }
        }

        clientGetCompressedImagesOptions.orderBy = orderBy;

        const compressedImagesGetArgs: Prisma.Admin$compressedImagesArgs = {
            skip: options && options.imagesExistsCount,
            take: options && options.imagesLimit,
            select: options && options.find && options.find.selectFields ? options.find.selectFields : undefined,
            where: {
                name: options && options.find && options.find.imageTitles ? { in: options.find.imageTitles } : undefined,
                photographyType: options && options.find && options.find.photographyTypes ? {
                    in: options.find.photographyTypes
                } : undefined,
                displayType: options && options.find && options.find.displayTypes ? {
                    in: options.find.displayTypes
                } : undefined,
                displayedOnHomePage: options && options.find && options.find.displayedOnHomePage ? options.find.displayedOnHomePage : undefined,
                uploadDate: options && options.dateFrom && options.dateUntil ? {
                    gte: options.dateFrom,
                    lte: options.dateUntil
                } : undefined
            },
            orderBy
        };

        let compressedImagesData: ICompressedImageWithoutRelationFields[] = [];

        if ( options.clientData ) {
            const uncheckedCompressedImagesData = ( await this._prisma.admin.findUnique({ where: { login: options.clientData.login as string }, select: { compressedImages: compressedImagesGetArgs } }) )?.compressedImages;
            compressedImagesData = !uncheckedCompressedImagesData ? [] : uncheckedCompressedImagesData;
        } else compressedImagesData = await this._prisma.compressedImage.findMany(compressedImagesGetArgs);

        return compressedImagesData;
    }
    /**
        * Compressed image using sharp and save compressed image in file system and compressed image data in database.
        * 
        * @param   activeClientId Current active client id.
        * @param   compressImageData Original image data.
        * @param   options Sharp options for compressing.
        * 
        * @returns Logical result of compression.
    */
    public async compressImage (activeClientId: number, compressImageData: ICompressImageData, options?: sharp.SharpOptions): Promise<boolean> {
        const { fileTypeFromFile } = await import('file-type');

        let ext: string = "";

        const fileTypeFromFileResult = await fileTypeFromFile(compressImageData.inputImagePath);
        if ( fileTypeFromFileResult ) ext = fileTypeFromFileResult.ext;

        if ( !this._appService.supportedImageFileTypes.map(imageFileType => imageFileType.replace('image/', '')).includes(ext) ) return false;

        if ( !options ) options = { };

        const inputImageDirPath: string = path.dirname(compressImageData.inputImagePath);
        const inputImageName: string = path.basename(compressImageData.inputImagePath);

        const outputImageName: string = `${ path.basename(compressImageData.inputImagePath, path.extname(compressImageData.inputImagePath)) }_thumb.webp`;
        const outputImagePath: string = path.join(compressImageData.outputDirPath, outputImageName);

        const outputTempFilePath: string = this.getTempFileName(outputImagePath);

        try {
            const { width, height } = await sharp(compressImageData.inputImagePath).metadata();

            const semiTransparentRedBuffer: Buffer = await sharp(compressImageData.inputImagePath, options).webp({
                quality: 100,
                lossless: true
            }).resize(Math.round(width as number / 2), Math.round(height as number / 2)).toBuffer();

            await fsPromises.writeFile(outputTempFilePath, semiTransparentRedBuffer);
            await fsPromises.rename(outputTempFilePath, outputImagePath);

            await this._prisma.admin.update({
                data: { 
                    compressedImages: { 
                        create: {
                            name: outputImageName,
                            dirPath: compressImageData.outputDirPath,
                            originalName: inputImageName,
                            originalDirPath: inputImageDirPath,
                            originalSize: compressImageData.originalImageSize,
                            photographyType: compressImageData.imageAdditionalData.photographyType,
                            displayType: compressImageData.imageAdditionalData.displayType,
                            description: compressImageData.imageAdditionalData.description
                        }
                    }
                },
                where: { 
                    id: activeClientId,
                },
                include: { 
                    compressedImages: {
                        take: 4,
                        skip: 0
                    } 
                }
            });

            return true;
        } catch {
            const compressedImageIsExists: boolean = await this.checkFileExists(outputImagePath);
            if ( compressedImageIsExists ) await fsPromises.unlink(outputImagePath);

            const compressedImageDataIsExists: boolean = await this.findSameAdminCompressedImage(activeClientId as number, 4, 0, outputImageName);
            if ( compressedImageDataIsExists ) {
                await this._prisma.admin.update({
                    data: { compressedImages: { delete: { name: outputImageName }, } },
                    where: { id: activeClientId }
                });
            }

            return false;
        }
    }
    /**
        * Create image thumbnail for client.
        * 
        * @param   request Currently request object.
        * @param   originalName Original image name for thumbnail.
        * 
        * @returns Image thumbnail binary.
    */
    public async createImageThumbnail (request: IRequest, originalName: string): Promise<Buffer> {
        const originalImagePath: string = path.join(this._appService.clientOriginalImagesDir, originalName);

        if ( !this.checkFileExists(originalImagePath) ) throw new BadRequestException(`${ request.url } "GetImageThumbnail - original image does not exists"`);
        else {
            const originalImageThumbnail: Buffer = await this._appService.managePromisesCache('resizeImageThumbnail', sharp(originalImagePath).webp({
                quality: 100,
                lossless: true
            }).resize(1500, 1500, { fit: 'inside' }).toBuffer());

            return originalImageThumbnail;
        }
    }
    /**
        * Get temp file name for operations.
        * 
        * @param   targetFilePath File destination path.
        * @param   postfix Postfix that is added to the file name.
        * 
        * @returns Temp file name.
    */
    public getTempFileName (targetFilePath: string, postfix = "_tmp"): string {
        const targetPathParts: path.ParsedPath = path.parse(targetFilePath);

        return targetPathParts.dir + path.sep + targetPathParts.name + postfix + targetPathParts.ext;
    }
    /**
        * Create dirs for original and compressed images in file system.
    */
    public async createImageDirs (): Promise<void> {
        const originalImagesDirPath: string = this._appService.clientOriginalImagesDir;
        const compressedImagesDirPath: string = this._appService.clientCompressedImagesDir;

        if ( !( await this.checkFileExists(originalImagesDirPath) ) ) await fsPromises.mkdir(originalImagesDirPath);
        if ( !( await this.checkFileExists(compressedImagesDirPath) ) ) await fsPromises.mkdir(compressedImagesDirPath);
    }
    /**
        * Check specific file is exists.
        * 
        * @param   filePath File destination path for checking.
        * 
        * @returns Logical result of checking.
    */
    public async checkFileExists (filePath: string): Promise<boolean> {
        try {
            await fsPromises.access(filePath, fsPromises.constants.F_OK);

            return true;
        } catch { 
            return false;
        }
    }
    /**
        * Recursive finding a compressed image by name among already downloaded compressed images.
        * 
        * @param   adminId Current active admin id.
        * @param   take Number of images to check.
        * @param   skip Number of images checked.
        * @param   imageName Compressed image name for searching.
        * @param   originalImageName Original image name for searching.
        * 
        * @returns Logical result of finding.
    */
    public async findSameAdminCompressedImage (adminId: number, take: number, skip: number, imageName: string | null, originalImageName?: string): Promise<boolean> {
        const adminData: IAdminWithCompressedImagesCount = ( await this._prisma.admin.findUnique({
            where: {
                id: adminId
            },
            include: {
                compressedImages: {
                    take,
                    skip,
                    select: {
                        originalName: true,
                        name: true,
                        originalSize: false,
                        photographyType: false,
                        displayType: false,
                        description: false,
                        uploadDate: false,
                        displayedOnHomePage: false,
                        displayedOnGalleryPage: false,
                        dirPath: false,
                        originalDirPath: false,
                        admin: false,
                        adminId: false
                    }
                },
                _count: {
                    select: {
                        compressedImages: true
                    }
                }
            }
        }) as IAdminWithCompressedImagesCount );

        if ( adminData._count.compressedImages === skip ) return false;

        const existingCompressedImage: ICompressedImageWithoutRelationFields | undefined = adminData.compressedImages.find(data => imageName !== null ? data.name === imageName : data.originalName === originalImageName as string);

        if ( !existingCompressedImage ) {
            return await this.findSameAdminCompressedImage(adminId, take, 
                skip + take <= adminData._count.compressedImages ? skip + take : skip + ( adminData._count.compressedImages - skip ),
                imageName, originalImageName
            );
        }

        return true;
    }
    /**
        * Delete image from database and file system.
        * 
        * @param   request Currently request object.
        * @param   imagePath Original image for delete.
        * 
        * @returns Logical result of delete.
    */
    public async deleteImage (request: IRequest, imagePath: string): Promise<boolean> {
        const compressedImageData: ICompressedImageWithoutRelationFields | null = await this._prisma.compressedImage.findFirst({ where: { originalName: path.basename(imagePath) } });

        if ( compressedImageData === null ) return false;

        const currentCompressedImagePath: string = path.join(compressedImageData.dirPath, compressedImageData.name);

        const originalImageTempName: string = this.getTempFileName(imagePath);
        const compressedImageTempName: string = this.getTempFileName(currentCompressedImagePath);

        const activeClientId: number = request.activeClientData?.id as number;

        try {
            await fsPromises.copyFile(imagePath, originalImageTempName);
            await fsPromises.copyFile(currentCompressedImagePath, compressedImageTempName);

            await fsPromises.unlink(imagePath);
            await fsPromises.unlink(currentCompressedImagePath);

            await fsPromises.unlink(originalImageTempName);
            await fsPromises.unlink(compressedImageTempName);

            await this._prisma.admin.update({ data: { compressedImages: { delete: { name: compressedImageData.name } } }, where: { id: activeClientId } });

            const existingImagePhotographyType: ImagePhotographyType | null = await this._prisma.imagePhotographyType.findFirst({ where: { compressedImageName: compressedImageData.name } });
            if ( existingImagePhotographyType !== null ) await this._prisma.imagePhotographyType.update({ data: { compressedImageOriginalName: null, compressedImageName: null }, where: { compressedImageName: compressedImageData.name } });
            
            return true;
        } catch {
            if ( await this.checkFileExists(originalImageTempName) ) {
                if ( !( await this.checkFileExists(imagePath) ) ) await fsPromises.rename(originalImageTempName, imagePath);

                await fsPromises.unlink(originalImageTempName);
            }

            if ( await this.checkFileExists(compressedImageTempName) ) {
                if ( !( await this.checkFileExists(currentCompressedImagePath) ) ) await fsPromises.rename(compressedImageTempName, currentCompressedImagePath);

                await fsPromises.unlink(compressedImageTempName);
            }

            const compressedImageIsExists: boolean = await this.findSameAdminCompressedImage(activeClientId, 4, 0, compressedImageData.name);

            if ( !compressedImageIsExists ) {
                await this._prisma.admin.update({ 
                    data: {
                        compressedImages: {
                            create: {
                                name: compressedImageData.name,
                                dirPath: compressedImageData.dirPath,
                                originalName: compressedImageData.originalName,
                                originalDirPath: compressedImageData.originalDirPath,
                                originalSize: compressedImageData.originalSize,
                                photographyType: compressedImageData.photographyType,
                                displayType: compressedImageData.displayType,
                                description: compressedImageData.description,
                                uploadDate: compressedImageData.uploadDate,
                                displayedOnHomePage: compressedImageData.displayedOnHomePage,
                                displayedOnGalleryPage: compressedImageData.displayedOnGalleryPage
                            } 
                        } 
                    }, 
                    where: { id: activeClientId } 
                });
            }

            return false;
        }
    }

    private async _customCompressedImages (): Promise<void> {
        const paths: string[] = await fsPromises.readdir(this._appService.clientOriginalImagesDir);

        for ( const data of paths ) {
            const fullPath: string = path.join(this._appService.clientOriginalImagesDir, data);

            const { width, height } = await sharp(fullPath).metadata();

            const outputImageName: string = `${ path.basename(fullPath, path.extname(fullPath)) }_thumb.webp`;
            const outputImagePath: string = path.join(this._appService.clientCompressedImagesDir, 'NEW', outputImageName);

            await sharp(fullPath).webp({
                quality: 100,
                lossless: true
            }).resize(Math.round(width as number / 2), Math.round(height as number / 2)).toFile(outputImagePath);

            console.log(`File ${ data } is compressed`);
        }
    }
}