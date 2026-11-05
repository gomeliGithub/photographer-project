import { type SetStateAction, type Dispatch } from "react";

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