// page-flip (StPageFlip) ships no type declarations. Declare the ESM build's
// surface we use. See src/routes/(public)/guide/level-1/book.
declare module "page-flip/dist/js/page-flip.module.js" {
  export interface PageFlipSettings {
    width: number;
    height: number;
    size?: "fixed" | "stretch";
    minWidth?: number;
    maxWidth?: number;
    minHeight?: number;
    maxHeight?: number;
    showCover?: boolean;
    usePortrait?: boolean;
    drawShadow?: boolean;
    maxShadowOpacity?: number;
    flippingTime?: number;
    startPage?: number;
    mobileScrollSupport?: boolean;
    useMouseEvents?: boolean;
    showPageCorners?: boolean;
    disableFlipByClick?: boolean;
  }

  export class PageFlip {
    constructor(element: HTMLElement, settings: PageFlipSettings);
    loadFromHTML(items: NodeListOf<Element> | HTMLElement[]): void;
    loadFromImages(urls: string[]): void;
    turnToPage(page: number): void;
    flip(page: number): void;
    flipNext(): void;
    flipPrev(): void;
    getPageCount(): number;
    getCurrentPageIndex(): number;
    on(event: "flip" | "changeState" | "changeOrientation" | "init" | "update", cb: (e: { data: number }) => void): void;
    destroy(): void;
  }
}
