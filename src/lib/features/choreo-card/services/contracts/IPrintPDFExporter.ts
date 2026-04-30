import type { CardSizeId } from '../../domain/card-sizes';

export interface CardPair {
  front: HTMLCanvasElement;
  back: HTMLCanvasElement;
  label: string;
}

export interface IPrintPDFExporter {
  /** One card per page, alternating front/back. For MPC upload. */
  exportDeckPDF(
    pairs: CardPair[],
    deckName: string,
    cardSize?: CardSizeId,
    onProgress?: (current: number, total: number) => void
  ): Promise<Blob>;

  /** Grid layout on Letter/A4 pages. Fronts page, then mirrored backs page.
   *  Designed for double-sided home printing - flip along long edge and
   *  each back lines up with its front. */
  exportHomePrintPDF(
    pairs: CardPair[],
    deckName: string,
    cardSize?: CardSizeId,
    onProgress?: (current: number, total: number) => void
  ): Promise<Blob>;
}
