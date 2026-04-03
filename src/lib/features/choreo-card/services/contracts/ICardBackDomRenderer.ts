import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

export interface CardBackDomRenderOptions {
  width: number;
  height: number;
  bleedPx: number;
  theme: string;
}

export interface ICardBackDomRenderer {
  render(sequence: SequenceData, options: CardBackDomRenderOptions): Promise<HTMLCanvasElement>;
}
