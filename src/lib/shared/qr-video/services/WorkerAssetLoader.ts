export interface LoadedAssets {
  gridImage: ImageBitmap;
  bluePropImage: ImageBitmap;
  redPropImage: ImageBitmap;
  bluePropViewBox: { width: number; height: number };
  redPropViewBox: { width: number; height: number };
}

const GRID_SVGS: Record<string, string> = {
  diamond: "/images/grid/diamond_grid.svg",
  box: "/images/grid/box_grid.svg",
};

const PROP_SVG_PATH = "/images/props/animated";

function applyColorToSvg(svgText: string, color: string): string {
  let svg = svgText.replace(/fill="[^"]*"/g, `fill="${color}"`);
  svg = svg.replace(/fill:[^;"]+/g, `fill:${color}`);
  return svg;
}

function parseViewBox(svgText: string): { width: number; height: number } {
  const match = svgText.match(/viewBox="([^"]+)"/);
  if (!match) return { width: 252.8, height: 77.8 };
  const parts = match[1]!.split(/\s+/);
  return {
    width: parseFloat(parts[2] ?? "252.8"),
    height: parseFloat(parts[3] ?? "77.8"),
  };
}

function rasterizeSvgViaImage(
  svgText: string,
  width: number,
  height: number
): Promise<ImageBitmap> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      createImageBitmap(canvas).then(resolve, reject);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load SVG via <img>"));
    };
    img.src = url;
  });
}

async function loadSvgAsBitmap(
  url: string,
  colorOverride?: string,
  renderSize = 512
): Promise<{ bitmap: ImageBitmap; viewBox: { width: number; height: number } }> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to load SVG: ${url} (${response.status})`);

  let svgText = await response.text();
  const viewBox = parseViewBox(svgText);

  if (colorOverride) {
    svgText = applyColorToSvg(svgText, colorOverride);
  }

  const aspect = viewBox.width / viewBox.height;
  const w = aspect >= 1 ? renderSize : Math.round(renderSize * aspect);
  const h = aspect >= 1 ? Math.round(renderSize / aspect) : renderSize;

  const bitmap = await rasterizeSvgViaImage(svgText, w, h);
  return { bitmap, viewBox };
}

export async function loadAssets(
  baseUrl: string,
  gridMode: string,
  propType: string,
  onProgress?: (phase: string) => void
): Promise<LoadedAssets> {
  onProgress?.("loading-assets");

  const gridPath = GRID_SVGS[gridMode] ?? GRID_SVGS.diamond!;
  const propPath = `${PROP_SVG_PATH}/${propType}.svg`;

  const [gridResult, bluePropResult, redPropResult] = await Promise.all([
    loadSvgAsBitmap(`${baseUrl}${gridPath}`, undefined, 950),
    loadSvgAsBitmap(`${baseUrl}${propPath}`, "#2E5BFF"),
    loadSvgAsBitmap(`${baseUrl}${propPath}`, "#ED1C24"),
  ]);

  return {
    gridImage: gridResult.bitmap,
    bluePropImage: bluePropResult.bitmap,
    redPropImage: redPropResult.bitmap,
    bluePropViewBox: bluePropResult.viewBox,
    redPropViewBox: redPropResult.viewBox,
  };
}
