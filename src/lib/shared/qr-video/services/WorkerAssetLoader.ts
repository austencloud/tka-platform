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

function sanitizeSvgForCreateImageBitmap(svgText: string): string {
  const viewBoxMatch = svgText.match(/viewBox="([^"]+)"/);
  if (!viewBoxMatch) return svgText;

  const hasWidth = /\bwidth="/.test(svgText);
  const hasHeight = /\bheight="/.test(svgText);
  if (hasWidth && hasHeight) return svgText;

  const parts = viewBoxMatch[1]!.split(/\s+/);
  const vbWidth = parts[2] ?? "100";
  const vbHeight = parts[3] ?? "100";

  return svgText.replace(
    "<svg",
    `<svg ${hasWidth ? "" : `width="${vbWidth}"`} ${hasHeight ? "" : `height="${vbHeight}"`}`
  );
}

function applyColorToSvg(svgText: string, color: string): string {
  return svgText.replace(/fill="[^"]*"/g, `fill="${color}"`);
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

async function loadSvgAsBitmap(url: string, colorOverride?: string): Promise<{ bitmap: ImageBitmap; viewBox: { width: number; height: number } }> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to load SVG: ${url} (${response.status})`);

  let svgText = await response.text();
  const viewBox = parseViewBox(svgText);

  if (colorOverride) {
    svgText = applyColorToSvg(svgText, colorOverride);
  }

  svgText = sanitizeSvgForCreateImageBitmap(svgText);

  const blob = new Blob([svgText], { type: "image/svg+xml" });
  const bitmap = await createImageBitmap(blob);

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
    loadSvgAsBitmap(`${baseUrl}${gridPath}`),
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
