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
  svg = svg.replace(/fill:(?!none)[^;}"]+/g, `fill:${color}`);

  // If no fill attributes were present (e.g. α/β/γ position glyphs default to
  // black), inject a fill on the root <svg> so all child paths inherit the color.
  if (!(/fill="/.test(svg))) {
    svg = svg.replace(/<svg\b/, `<svg fill="${color}"`);
  }

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

export async function loadLetterGlyphs(
  baseUrl: string,
  letterPaths: string[],
  darkMode: boolean
): Promise<ImageBitmap[]> {
  return Promise.all(
    letterPaths.map(async (path) => {
      const resp = await fetch(`${baseUrl}${path}`);
      if (!resp.ok) throw new Error(`Failed to load glyph: ${path} (${resp.status})`);
      let svgText = await resp.text();
      const vb = parseViewBox(svgText);

      if (darkMode) {
        svgText = applyColorToSvg(svgText, "#ffffff");
      }

      const size = 120;
      const aspect = vb.width / vb.height;
      const w = aspect >= 1 ? size : Math.round(size * aspect);
      const h = aspect >= 1 ? Math.round(size / aspect) : size;

      return rasterizeSvgViaImage(svgText, w, h);
    })
  );
}

function applyGridDarkMode(svgText: string): string {
  let svg = svgText;
  svg = svg.replace(/fill:currentColor/g, "fill:#d0d0d0");
  svg = svg.replace(/currentColor/g, "#d0d0d0");
  svg = svg.replace(/<circle([^>]*?)(?:\s+fill="[^"]*")?(\s*\/>)/g, (match, attrs, close) => {
    if (/fill="/.test(attrs)) return match;
    if (/class=".*(?:invisible|layer2)/.test(attrs)) return match;
    return `<circle${attrs} fill="#d0d0d0"${close}`;
  });
  return svg;
}

export async function loadAssets(
  baseUrl: string,
  gridMode: string,
  propType: string,
  darkMode = true,
  onProgress?: (phase: string) => void
): Promise<LoadedAssets> {
  onProgress?.("loading-assets");

  const gridPath = GRID_SVGS[gridMode] ?? GRID_SVGS.diamond!;
  const propPath = `${PROP_SVG_PATH}/${propType}.svg`;

  const gridUrl = `${baseUrl}${gridPath}`;
  const gridResp = await fetch(gridUrl);
  if (!gridResp.ok) throw new Error(`Failed to load grid: ${gridUrl}`);
  let gridSvg = await gridResp.text();
  if (darkMode) {
    gridSvg = applyGridDarkMode(gridSvg);
  }
  const gridVb = parseViewBox(gridSvg);
  const gridBitmap = await rasterizeSvgViaImage(gridSvg, gridVb.width, gridVb.height);

  const [bluePropResult, redPropResult] = await Promise.all([
    loadSvgAsBitmap(`${baseUrl}${propPath}`, "#2E5BFF"),
    loadSvgAsBitmap(`${baseUrl}${propPath}`, "#ED1C24"),
  ]);

  return {
    gridImage: gridBitmap,
    bluePropImage: bluePropResult.bitmap,
    redPropImage: redPropResult.bitmap,
    bluePropViewBox: bluePropResult.viewBox,
    redPropViewBox: redPropResult.viewBox,
  };
}
