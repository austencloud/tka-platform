import type { CardBackData } from "../../components/card-back/card-back-data";

export interface CardBackCanvasOptions {
  width: number;
  height: number;
  bleedPx: number;
  theme: string;
}

export interface ICardBackCanvasRenderer {
  render(data: CardBackData, options: CardBackCanvasOptions): Promise<HTMLCanvasElement>;
}
