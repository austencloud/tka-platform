export interface ArrowSvgData {
  id: string;
  svgContent: string;
  dimensions: SVGDimensions;
  imageSrc?: string | undefined;
  viewBox?: string | undefined;
  center?: { x: number; y: number } | undefined;
  // Arrow tip z-promotion: pre-split shaft/tip SVG content
  shaftSrc?: string;
  tipSrc?: string;
  tipBBox?: { x: number; y: number; width: number; height: number };
}

export interface SVGDimensions {
  width: number;
  height: number;
  viewBox?: string | undefined;
  center?: { x: number; y: number } | undefined;
}
export interface ISvgConfig {
  readonly SVG_SIZE: number;
  readonly CENTER_X: number;
  readonly CENTER_Y: number;
}
