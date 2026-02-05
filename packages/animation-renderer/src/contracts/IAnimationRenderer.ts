import type { PropState, TrailPoint, TrailSettings, QualityHints } from "@tka/types";

export interface AnimationVisibilitySettings {
  gridVisible: boolean;
  propsVisible: boolean;
  trailsVisible: boolean;
  blueMotionVisible: boolean;
  redMotionVisible: boolean;
}

export interface RenderSceneParams {
  blueProp: PropState | null;
  redProp: PropState | null;
  secondaryBlueProp?: PropState | null;
  secondaryRedProp?: PropState | null;
  gridVisible: boolean;
  gridMode: string | null;
  letter: string | null;
  turnsTuple: string | null;
  bluePropDimensions: { width: number; height: number };
  redPropDimensions: { width: number; height: number };
  blueTrailPoints: TrailPoint[];
  redTrailPoints: TrailPoint[];
  secondaryBlueTrailPoints?: TrailPoint[];
  secondaryRedTrailPoints?: TrailPoint[];
  trailSettings: TrailSettings;
  currentTime: number;
  visibility: AnimationVisibilitySettings;
  bluePropFlipped?: boolean;
  redPropFlipped?: boolean;
  bluePropType?: string;
  redPropType?: string;
  qualityHints?: QualityHints;
}

export interface IAnimationRenderer {
  initialize(
    container: HTMLElement,
    size: number,
    backgroundAlpha?: number
  ): Promise<void>;
  resize(newSize: number): Promise<void>;
  renderScene(params: RenderSceneParams): void;
  loadPropTextures(propType: string): Promise<void>;
  loadPerColorPropTextures(
    bluePropType: string,
    redPropType: string,
    darkMode?: boolean
  ): Promise<void>;
  loadSecondaryPropTextures(
    propType: string,
    blueColor: string,
    redColor: string
  ): Promise<void>;
  loadGridTexture(gridMode: string): Promise<void>;
  loadGlyphTexture(
    svgString: string,
    width: number,
    height: number
  ): Promise<void>;
  captureFrame(): Promise<ImageBitmap>;
  destroy(): void;
  getCanvas(): HTMLCanvasElement | null;
  setDarkMode(enabled: boolean, animate?: boolean): void;
  isBackgroundTransitioning(): boolean;
  getBluePropDimensions(): { width: number; height: number };
  getRedPropDimensions(): { width: number; height: number };
}
