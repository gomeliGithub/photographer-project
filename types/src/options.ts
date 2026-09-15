import type { Client_order_status, Image_display_type, Image_photography_type, Prisma } from "../../backend-nest/node_modules/@prisma/client";
import type { DefaultArgs } from "../../backend-nest/node_modules/@prisma/client/runtime/library";

import { IJWTPayload } from "./sign";

export interface IClientGetOptions {
    selectFields?: Prisma.MemberSelect<DefaultArgs>;
    selectCompressedImagesFields?: Prisma.CompressedImageSelect<DefaultArgs>;
    orders?: {
        include: boolean,
        includeCount?: boolean,
        whereStatus?: Client_order_status
    }
    compressedImages?: IClientGetCompressedImagesOptions;
    skip?: number;
    take?: number;
}

export interface IClientGetCompressedImagesOptions {
    include: boolean,
    selectFields?: Prisma.CompressedImageSelect<DefaultArgs>;
    whereNameArr?: string[],
    wherePhotographyTypes?: Image_photography_type[],
    whereDisplayTypes?: Image_display_type[],
    displayedOnHomePage?: boolean,
    skip?: number;
    take?: number;
    dateFrom?: Date;
    dateUntil?: Date;
    orderBy?: Prisma.CompressedImageOrderByWithRelationInput;
}

export interface IDownloadOriginalImageOptions {
    imagePath?: string;
    compressedImageName?: string;
}

export interface ICompressedImageGetOptions {
    clientData?: IJWTPayload;
    find?: {
        imageTitles?: string[];
        selectFields?: Prisma.CompressedImageSelect<DefaultArgs>;
        photographyTypes?: Image_photography_type[];
        displayTypes?: Image_display_type[];
        displayedOnHomePage?: boolean;
    },
    imagesLimit?: number;
    imagesExistsCount?: number;
    dateFrom?: Date;
    dateUntil?: Date;
    sortBy?: SortBy_Types;
}

export interface IModalCreateOptions {
    title: string;
    type: string;
    body?: string;

    closeButton?: boolean;
    closeButtonCaption?: string;

    confirmButton?: boolean;
    confirmButtonCaption?: string;

    closeButtonListener?: Function;
    confirmButtonListener?: Function;
}

export interface IGetClientOrdersOptions {
    memberLogin?: string;
    fromDate?: Date;
    untilDate?: Date;
    status?: Client_order_status;
    ordersLimit?: number;
    existsCount?: number;
}

export interface IGetFullCompressedImagesDataOptions {
    imagesLimit?: number;
    imagesExistsCount?: number;
    dateFrom?: Date;
    dateUntil?: Date;
    photographyTypes?: string[];
    displayTypes?: string[];
    sortBy: SortBy_Types;
}

export interface IGetFullCompressedImagesListRequestOptions {
    imagesExistsCount?: string,
    imagesLimit?: string,
    dateFrom?: string,
    dateUntil?: string,
    sortBy?: string,
    photographyTypes?: string,
    displayTypes?: string
}

export interface IGetClientOrdersRequestOptions {
    memberLogin?: string,
    fromDate?: string,
    untilDate?: string,
    status?: string,
    ordersLimit?: string,
    existsCount?: string
}

export enum SortBy_Types {
    originalName = 'originalName',
    originalSize = 'originalSize',
    photographyType = 'photographyType',
    displayType = 'displayType',
    uploadDate = 'uploadDate',
    displayedOnHomePage = 'displayedOnHomePage',
    displayedOnGalleryPage = 'displayedOnGalleryPage'
}