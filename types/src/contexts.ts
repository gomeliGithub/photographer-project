import { type Dispatch } from "react";

import { IActiveClientState, INavbarState } from "./states";

export interface IBodyContext {
    activeClientData: IActiveClientState;
    isHomePage: boolean;
    navbarState: INavbarState | null;
    setNavbarState: Dispatch<INavbarState> | null;
    navbarTogglerListener: ( animationStart: boolean ) => void;
    isDesktopDevice: boolean;
}