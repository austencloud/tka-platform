/**
 * PrintZipExporter
 *
 * Exports rendered card pairs as a ZIP file with fronts/ and backs/
 * subdirectories containing numbered PNG files. Designed for upload
 * to print services like MakePlayingCards.com that accept individual
 * card face images.
 */

import type { IPrintZipExporter, ZipCardPair } from "../contracts/IPrintZipExporter";

export class PrintZipExporter implements IPrintZipExporter {
  async exportDeckZIP(
    pairs: ZipCardPair[],
    deckName: string,
    onProgress?: (current: number, total: number) => void
  ): Promise<Blob> {
    // JSZip is lazy-loaded — it uses `new Function` internally (CSP-incompatible
    // when eagerly imported into the main chunk).
    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();
    const fronts = zip.folder("fronts")!;
    const backs = zip.folder("backs")!;
    const total = pairs.length;

    for (let i = 0; i < pairs.length; i++) {
      const pair = pairs[i]!;
      const index = String(i + 1).padStart(3, "0");
      const safeName = pair.label.replace(/[^a-zA-Z0-9_\-]/g, "_");

      const frontBlob = await canvasToBlob(pair.front);
      fronts.file(`${index}_${safeName}_front.png`, frontBlob);

      const backBlob = await canvasToBlob(pair.back);
      backs.file(`${index}_${safeName}_back.png`, backBlob);

      onProgress?.(i + 1, total);
    }

    return zip.generateAsync({ type: "blob" });
  }
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Canvas toBlob returned null"));
      },
      "image/png"
    );
  });
}
