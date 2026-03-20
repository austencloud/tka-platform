import type { CardBackCanvasOptions } from "./ICardBackCanvasRenderer";

export interface IInfoCardCanvasRenderer {
  renderFront(options: CardBackCanvasOptions): Promise<HTMLCanvasElement>;
  renderBack(options: CardBackCanvasOptions): Promise<HTMLCanvasElement>;
}
