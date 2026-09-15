import type { Request } from "express";

import type { Client_order_type, Image_display_type, Image_photography_type } from "../../backend-nest/node_modules/@prisma/client";

import type { IClientSignData, IJWTPayload } from "./sign";
import type { IClientOrderWithoutRelationFields, ICompressedImageWithoutRelationFields } from "./models";

export const Image_photography_types = {
    individual: "individual",
    children: "children",
    wedding: "wedding",
    family: "family"
} as const
export type Image_photography_types = "individual" | "children" | "wedding" | "family";
export type Image_display_types = "horizontal" | "vertical";
export const Image_display_types = {
    horizontal: "horizontal",
    vertical: "vertical"
} as const
export type Client_order_statuses = "new" | "processed";
export type Client_order_types = "consultation" | "full";

export interface ICookieSerializeOptions {
    domain?: string;
    expires?: Date;
    httpOnly?: boolean;
    maxAge?: number;
    priority?: 'low' | 'medium' | 'high';
    sameSite?: boolean | 'lax' | 'none' | 'strict';
    secure?: boolean;
    signed?: boolean;
}

export interface IRequest extends Request {
    session: null;
    activeClientData?: IJWTPayload;
    validatedRequest?: boolean;
}

export interface IRequestBody {
    id?: number;
    clientType?: 'admin' | 'member';
    clientLogin?: string;
    sign?: {
        clientData?: IClientSignData;
        newLocale?: string;
    },
    client?: IClientRequestBody,
    adminPanel?: IAdminPanelRequestBody
}

export interface IAdminPanelRequestBody {
    originalImageName: string;
    displayTargetPage: 'home' | 'gallery' | 'original';
    newImagePhotographyType?: Image_photography_type; 
    newImageDescription?: string;
    imagePhotographyType?: Image_photography_type;
    newImageDisplayType?: Image_display_type;

    clientOrderId?: number;
    clientLogin?: string;

    photographyTypeName?: Image_photography_type;
    photographyTypeNewDescription?: string;

    discountContent?: string; 
    fromDate?: Date; 
    toDate?: Date;

    newDiscountContent?: string;
    newFromDate?: Date;
    newToDate?: Date;
    discountId?: number;
}

export interface IClientRequestBody {
    _id: number;
    uploadImageMeta: string;
    imagePhotographyType: Image_photography_type;
    imageDisplayType: Image_display_type;
    imageDescription?: string;

    orderType: Client_order_type;
    clientPhoneNumber: string;
    comment?: string;
}

export interface IClientBrowser {
    login: string;
    type: string;
    fullName: string;
    locale: string;
}

export interface IClientLocale {
    code: string; 
    title: string;
}

export interface IFullCompressedImageData {
    imagesList: ICompressedImageWithoutRelationFields[];
    count: number;
    additionalImagesIsExists: boolean;
}

export interface IGalleryCompressedImagesData {
    compressedImagesDataList: ICompressedImageWithoutRelationFields[];
    photographyTypeDescription: string;
    additionalImagesExists: boolean;
}

export interface IGalleryFullCompressedImagesData {
    'individual': IGalleryCompressedImagesData,
    'family': IGalleryCompressedImagesData,
    'wedding': IGalleryCompressedImagesData,
    'children': IGalleryCompressedImagesData
}

export interface ICompressImageData {
    inputImagePath: string;
    outputDirPath: string;
    originalImageSize: number;
    imageAdditionalData: IImageAdditionalData;
}

export interface IImageAdditionalData {
    photographyType: Image_photography_type;
    displayType: Image_display_type;
    description?: string;
}

export interface IDownloadingOriginalImageData {
    name: string;
    path: string;
    extension: string;
}

export interface IClientOrdersData {
    orders: IClientOrderWithoutRelationFields[];
    additionalOrdersExists: boolean;
}

export interface IOrdersClientsData {
    clients: string[];
    commonOrdersCount: number;
    additionalOrdersClientsExists: boolean;
}

export interface IClientOrdersInfoDataArr {
    login: string;
    ordersCount: number;
}

export interface IComponentInfo {
    url: string;
    changeTime: Date;
    priority: number;
}

export interface AnimationEvent {
    fromState: string | boolean;
    toState: string | boolean;
    totalTime: number;
    phaseName: string;
    element: any;
    triggerName: string;
    disabled: boolean;
}

export interface IIntersectionObserverInit { 
    delay?: number;
    root?: HTMLElement | Document;
    rootMargin?: string;
    scrollMargin?: string;
    threshold?: number | number[];
    trackVisibility?: boolean;
}

export interface IPreviousActiveImageOperations { /////////////////////////////// NEW //////////////////////////////////////
    upload: boolean;
    changeData: boolean;
    delete: boolean;
    changeDisplayTarget: boolean;
    setPhotographyType: boolean;
    getFullCompressedList: boolean;
    getThumbnail: boolean;
    changePhotographyTypeDescription: boolean;
}