import { type Dispatch } from "react";

import { INavbarState } from "./states";

export interface IBodyContext {
    isHomePage: boolean;
    navbarState: INavbarState | null;
    setNavbarState: Dispatch<INavbarState> | null;
    navbarTogglerListener: ( animationStart: boolean ) => void;
    isDesktopDevice: boolean;
}