export interface RenderedCard {
  frontUrl: string;
  backUrl: string;
  label: string;
}

export interface CachedCard {
  rendered: RenderedCard;
  frontBlob: Blob;
  backBlob: Blob;
}

export const cardCache = new Map<string, CachedCard>();
