/**
 * Rasterize an SVG string to a PNG Uint8Array at a specified pixel size.
 *
 * Pipeline: SVG string → Blob → object URL → <img> → <canvas>.drawImage → blob → ArrayBuffer.
 *
 * Browser-only (uses DOM APIs). Not usable in Node without a polyfill.
 */
export async function rasterizeSvgToPng(
  svg: string,
  widthPx: number,
  heightPx: number
): Promise<Uint8Array> {
  const blob = new Blob([svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);

  try {
    const img = await loadImage(url);

    const canvas = document.createElement("canvas");
    canvas.width = widthPx;
    canvas.height = heightPx;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas context unavailable");

    ctx.clearRect(0, 0, widthPx, heightPx);
    ctx.drawImage(img, 0, 0, widthPx, heightPx);

    const pngBlob = await canvasToBlob(canvas);
    const buffer = await pngBlob.arrayBuffer();
    return new Uint8Array(buffer);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const timer = setTimeout(() => {
      img.onload = null;
      img.onerror = null;
      reject(new Error(`SVG image load timed out after 10s: ${src}`));
    }, 10_000);
    img.onload = () => { clearTimeout(timer); resolve(img); };
    img.onerror = () => { clearTimeout(timer); reject(new Error(`Failed to load SVG image: ${src}`)); };
    img.src = src;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("canvas.toBlob returned null"))), "image/png");
  });
}
