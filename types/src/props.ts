import { ICompressedImageWithoutRelationFields, IDiscount } from "./models";

export interface ICarouselProps {
    type: 'images' | 'discount' | string, 
    itemData: ICompressedImageWithoutRelationFields[] | IDiscount[],
    interval?: number | null, 
    controls?: boolean, 
    indicators?: boolean
}