import { IClientBrowser, Image_photography_types } from "./global";
import { ICompressedImageWithoutRelationFields, IDiscount, IImagePhotographyType } from "./models";
import { IModalProps } from "./props";

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

export interface IModalState {
    isOpen: boolean;
    props: IModalProps | null;
}

export interface IFormProccesingState {
    clientLogin?: string | null;
    clientPassword?: string | null;
    clientFullName?: string | null;
    clientEmail?: string | null;
}