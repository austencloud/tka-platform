declare module 'dom-to-image-more' {
  export function toBlob(node: Node, options?: unknown): Promise<Blob>;
  export function toPng(node: Node, options?: unknown): Promise<string>;
  export function toJpeg(node: Node, options?: unknown): Promise<string>;
  export function toSvg(node: Node, options?: unknown): Promise<string>;
  export function toPixelData(node: Node, options?: unknown): Promise<Uint8ClampedArray>;
}
