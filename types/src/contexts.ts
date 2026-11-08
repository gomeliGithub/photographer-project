import { type SetStateAction, type Dispatch } from "react";

import { Image_photography_types } from "./global";
import { IActiveClientState, IModalState, INavbarState } from "./states";

export interface IBodyContext {
    activeClientData: IActiveClientState;
    isHomePage: boolean;
    navbar: {
        state: INavbarState | null;
        setState: Dispatch<SetStateAction<INavbarState>> | null;
        togglerListener: ( animationStart: boolean ) => void;
    };
    isDesktopDevice: boolean;
    modal: {
        data: IModalState;
        setData: Dispatch<SetStateAction<IModalState>>;
        closeListener: () => void;
    };
}

export interface IPricesContext {
    selectedPhotographyType: {
        currentValue: Image_photography_types | null;
        setValue: Dispatch<SetStateAction<Image_photography_types | null>> | null;
    };
    sendOrderForm: {
        isShow: boolean;
        setIsShow: Dispatch<SetStateAction<boolean>> | null;
    };
}