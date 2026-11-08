import { type ReactNode, type JSXElementConstructor, type ReactElement, type SyntheticEvent } from "react";
import { type Placement } from "react-bootstrap/esm/types";
import { type OverlayTriggerRenderProps } from "react-bootstrap/esm/OverlayTrigger";

import { Image_photography_types } from "./global";
import { ICompressedImageWithoutRelationFields, IDiscount } from "./models";

export interface ICarouselProps {
    type: 'images' | 'discount' | string, 
    itemData: ICompressedImageWithoutRelationFields[] | IDiscount[],
    interval?: number | null, 
    controls?: boolean, 
    indicators?: boolean
}

export interface IGalleryCarouselProps {
    imageData: ICompressedImageWithoutRelationFields[];
    photographyType: Image_photography_types;
}

export interface IModalProps {
    title: string;
    type: 'success' | 'warning' | 'error';
    body?: string;
    closeButton?: {
        caption: string;
        listener?: ( e?: SyntheticEvent ) => void
    };
    confirmButton?: {
        caption: string;
        listener?: ( e?: SyntheticEvent ) => void
    };
    internalCloseListener?: () => void;
}

export interface IGlobalErrorBoundaryProps {
    error: Error & { digest?: string };
    retry: () => void
}

export interface ITooltipProps {
    text: string;
    placement: Placement;
    bodyElement: ReactElement<unknown, string | JSXElementConstructor<any>> | ((props: OverlayTriggerRenderProps) => ReactNode);
}

export interface IFormProccesingProps {
    signOperation: 'up' | 'in';
}