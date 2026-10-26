import { IClientBrowser } from "./global";
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