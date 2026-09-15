import type fs from 'fs';
import type { WebSocket } from 'ws';

import { IImageAdditionalData } from './global';

export interface IWebSocketClient {
    _id: number,
    activeAdminId: number,
    activeAdminLogin: string,
    activeWriteStream: fs.WriteStream | null,
    currentChunkNumber: number, 
    uploadedSize: number, 
    imageMetaName: string, 
    imageMetaSize: number,
    imagePath: string,
    lastkeepalive: number,
    connection: WebSocket | null,
    imageAdditionalData: IImageAdditionalData,
    compressImageIsDone: boolean,
    cancelUploadImageMessageIsReceived: boolean
}

export interface IWSMessage {
    event: string;
    text: string;
    percentUploaded?: number;
}

export interface IPercentUploadedOptions {
    imageMetaSize: number;
    uploadedSize: number;
}

export interface IImageMeta {
    name: string | null;
    size: number | null;
    type: string | null;
}

export interface ICurrentAdminImageData {
    currentAdminData: { 
        id: number, 
        login: string
    };
    imageMeta: IImageMeta;
    imageAdditionalData: IImageAdditionalData;
}