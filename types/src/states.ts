import { IClientBrowser, Image_photography_types } from "./global";
import { ICompressedImageWithoutRelationFields, IDiscount, IImagePhotographyType } from "./models";

export interface INavbarState {
    element?: HTMLElement | null,
    isCollapsed?: boolean;
    animationState?: string;
    prevAnimationState?: string | null;
}

export interface IActiveClientState {
    data?: IClientBrowser | null;
    loading?: boolean;
}

export interface IHomePageDataState {
    compressedImages?: ICompressedImageWithoutRelationFields[] | null;
    discountsArr?: IDiscount[] | null;
    imagePhotographyTypes?: IImagePhotographyType[][] | null;
    isDesktopDevice?: boolean;
}

export interface IGalleryPageDataState {
    compressedImages?: {
        individual?: ICompressedImageWithoutRelationFields[] | null;
        children?: ICompressedImageWithoutRelationFields[] | null;
        wedding?: ICompressedImageWithoutRelationFields[] | null;
        family?: ICompressedImageWithoutRelationFields[] | null;
    };
    photographyType?: Image_photography_types;
    photographyTypeDescription?: string | null;
    currentImagesCount?: number;
    additionalImagesExists?: boolean;
}