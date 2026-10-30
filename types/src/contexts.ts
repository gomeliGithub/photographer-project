import { type Dispatch } from "react";

import { IActiveClientState, IModalState, INavbarState } from "./states";

export interface IBodyContext {
    activeClientData: IActiveClientState;
    isHomePage: boolean;
    navbarState: INavbarState | null;
    setNavbarState: Dispatch<INavbarState> | null;
    navbarTogglerListener: ( animationStart: boolean ) => void;
    isDesktopDevice: boolean;
    modalData: IModalState;
    setModalData: Dispatch<IModalState>;
    modalCloseListener: () => void;
}