export interface CardPair {
  front: HTMLCanvasElement;
  back: HTMLCanvasElement;
  label: string;
}

export interface IPrintPDFExporter {
  exportDeckPDF(
    pairs: CardPair[],
    deckName: string,
    onProgress?: (current: number, total: number) => void
  ): Promise<Blob>;
}
