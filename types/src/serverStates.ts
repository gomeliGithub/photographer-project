import { Image_photography_types } from "./global";
import { ICompressedImageWithoutRelationFields, IDiscount, IImagePhotographyType } from "./models";

export interface IHomePageDataState {
    compressedImages: ICompressedImageWithoutRelationFields[] | null;
    discountsArr: IDiscount[] | null;
    imagePhotographyTypes: IImagePhotographyType[][] | null;
    fetchError: boolean;
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
    fetchError: boolean;
}