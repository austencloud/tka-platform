/**
 * Gallery Generator Domain Models
 */

export interface RenderedImage {
  name: string;
  imageUrl: string;
  written: boolean;
}

export interface FailedSequence {
  name: string;
  error: string;
}

export interface RenderResult {
  name: string;
  imageUrl: string;
  blob: Blob;
  success: true;
}

export interface RenderError {
  name: string;
  error: string;
  success: false;
}

export type BatchRenderResult = RenderResult | RenderError;
