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