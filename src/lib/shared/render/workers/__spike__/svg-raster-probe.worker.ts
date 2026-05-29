// Throwaway spike. Confirms createImageBitmap(svgBlob) decodes a filtered,
// self-contained SVG inside a worker and produces non-blank pixels.
self.onmessage = async (e: MessageEvent<{ svg: string; w: number; h: number }>) => {
  try {
    const { svg, w, h } = e.data;
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const bmp = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bmp, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;
    let nonTransparent = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] !== 0) nonTransparent++;
    self.postMessage({ ok: true, bmpW: bmp.width, bmpH: bmp.height, nonTransparent });
  } catch (err) {
    self.postMessage({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};
