export interface ZipCardPair {
  front: HTMLCanvasElement;
  back: HTMLCanvasElement;
  label: string;
}

export interface IPrintZipExporter {
  exportDeckZIP(
    pairs: ZipCardPair[],
    deckName: string,
    onProgress?: (current: number, total: number) => void
  ): Promise<Blob>;
}
