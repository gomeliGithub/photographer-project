import { type Dispatch } from "react";

import { IActiveClientState, IModalState, INavbarState } from "./states";

export interface IBodyContext {
    activeClientData: IActiveClientState;
    isHomePage: boolean;
    navbar: {
        state: INavbarState | null;
        setState: Dispatch<INavbarState> | null;
        togglerListener: ( animationStart: boolean ) => void;
    };
    isDesktopDevice: boolean;
    modal: {
        data: IModalState;
        setData: Dispatch<IModalState>;
        closeListener: () => void;
    };
}