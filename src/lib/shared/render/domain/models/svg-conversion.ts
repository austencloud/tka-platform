export interface RenderQualitySettings {
  antialiasing: boolean;
  smoothScaling?: boolean;
  imageSmoothingQuality?: "low" | "medium" | "high";
  scale?: number;
  dpi?: number;
  quality?: number;
}

export interface SVGConversionOptions {
  format?: string;
  quality?: RenderQualitySettings | number;
  width?: number;
  height?: number;
  backgroundColor?: string;
  preserveAspectRatio?: boolean;
}

export interface ConversionResult {
  success: boolean;
  canvas?: HTMLCanvasElement;
  error?: string;
  metadata: {
    originalWidth: number;
    originalHeight: number;
    finalWidth: number;
    finalHeight: number;
    conversionTime: number;
  };
}
