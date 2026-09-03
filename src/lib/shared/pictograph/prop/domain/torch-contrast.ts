import { PropType } from "./enums/prop-type";
import type { ThemeMode } from "../../../utils/svg-color-utils";

/**
 * The torch's authored pictograph artwork is a near-black shaft with no flame.
 * On a dark pictograph surface that is a black stick on a black background, so
 * every surface that renders torch artwork applies this palette: the shaft and
 * metal are lifted off the background and the approved flame is appended.
 *
 * `background` is the surface each palette was tuned against and is used by the
 * contrast harness at /test/torch-contrast.
 */
export const TORCH_CONTRAST_PALETTE = {
  dark: {
    background: "#0a0a0f",
    shaft: "#d7d9dd",
    metal: "#aeb8c4",
    wick: "none",
    flame: "#f2673a",
  },
  light: {
    background: "#d8d8d2",
    shaft: "#000000",
    metal: "#66717f",
    wick: "none",
    flame: "#f2673a",
  },
} as const;

const TORCH_FLAME_CORE = "#f4ea02";
export const TORCH_FLAME_OUTLINE = "#7c2d12";

export function isTorchProp(propType?: PropType | string): boolean {
  return propType === PropType.TORCH || propType === PropType.BIGTORCH;
}

function setInlineFill(tag: string, fill: string): string {
  const stylePattern = /\sstyle=(["'])([\s\S]*?)\1/i;

  if (stylePattern.test(tag)) {
    return tag.replace(stylePattern, (_match, quote: string, style: string) => {
      const declarations = style
        .split(";")
        .map((declaration) => declaration.trim())
        .filter(Boolean)
        .filter((declaration) => !/^fill\s*:/i.test(declaration));

      declarations.push(`fill:${fill}`);
      return ` style=${quote}${declarations.join(";")};${quote}`;
    });
  }

  return tag.replace(/(\s*\/?>)$/, ` style="fill:${fill};"$1`);
}

export function recolorMarkedPart(
  svgMarkup: string,
  marker:
    | "data-torch-shaft"
    | "data-torch-metal"
    | "data-torch-wick"
    | "data-animated-torch-shaft",
  fill: string
): string {
  const markedTag = new RegExp(
    `<[^>]+\\s${marker}=(?:"[^"]*"|'[^']*')[^>]*>`,
    "gi"
  );

  return svgMarkup.replace(markedTag, (tag) => setInlineFill(tag, fill));
}

function stripTorchFlame(svgMarkup: string): string {
  return svgMarkup.replace(
    /\s*<g\b(?=[^>]*\bdata-torch-flame=(?:"true"|'true'))[^>]*>[\s\S]*?<\/g>/gi,
    ""
  );
}

/**
 * The flame artwork's own box, in its authored units. It is anchored at the
 * bottom centre, which is what the `translate(-48.77 -125)` inside the flame
 * transform below expresses.
 */
const FLAME_ART_HALF_WIDTH = 48.77;
const FLAME_ART_HEIGHT = 125;

/** Keeps the flame's own stroke off the edge of the expanded box. */
const FLAME_BOX_PAD = 1;

type FlamePlacement = { baseX: number; centerY: number; scale: number };

function flamePlacement(propType: PropType | string): FlamePlacement {
  return propType === PropType.BIGTORCH
    ? { baseX: 223.4, centerY: 12.55, scale: 0.58 }
    : { baseX: 284, centerY: 7.75, scale: 0.36 };
}

function appendTorchFlame(
  svgMarkup: string,
  propType: PropType | string,
  flameColor: string
): string {
  const isBigTorch = propType === PropType.BIGTORCH;
  const { baseX, centerY, scale } = flamePlacement(propType);
  const flameMarkup = `
    <g
      data-torch-flame="true"
      data-torch-flame-size="${isBigTorch ? "big" : "standard"}"
      pointer-events="none"
      transform="translate(${baseX} ${centerY}) rotate(90) scale(${scale}) translate(-48.77 -125)"
    >
      <path
        data-torch-flame-part="body"
        d="m97.54,79.19c0,19.84-13.58,36.71-32.51,42.97-.41.16-.82.25-1.23.41.16-.08.33-.25.49-.33,11.19-8.23,19.67-28.81-2.8-36.8,7.82,16.63-9.47,21.07-16.13,10.62-4.69-7.33-3.87-20.25-2.47-26.75,2.47-11.44,5.84-20.66,5.27-34.16-2.14,24.12-45.6,54.49-8.81,88.49.16.16.25.25.41.41-.58-.08-1.15-.16-1.73-.33C16.22,119.19,0,101,0,79.27c0-12.68,4.53-22.39,14.49-30.95-.91,2.72-1.98,5.43-2.8,8.15-4.94,16.79,9.38,21.65,7.98,5.76C16.63,27.74,53.09,19.84,43.38,0c15.72,7.57,28.23,19.1,25.35,37.45-.74,4.86-3.79,13.91-2.39,18.44,2.63,8.4,16.63,8.31,17.12-7.33,5.52,4.45,10.04,11.52,12.18,18.11,1.4,3.7,1.89,7.9,1.89,12.51Z"
        fill="${flameColor}"
        stroke="${TORCH_FLAME_OUTLINE}"
        stroke-width="1.25"
        stroke-linejoin="round"
        paint-order="stroke fill"
      />
      <path
        data-torch-flame-part="core"
        d="m63.79,122.57c-8.4,2.63-15.72,3.13-24.04,1.48-37.37-34,5.93-64.78,8.4-88.9.58,13.5-2.8,22.72-5.27,34.16-1.4,6.5-2.22,19.43,2.47,26.75,6.67,10.45,23.95,6.01,16.13-10.62,22.97,7.82,13.91,28.81,2.3,37.12Z"
        fill="${TORCH_FLAME_CORE}"
        fill-rule="evenodd"
      />
    </g>
  `;

  if (/<\/svg>/i.test(svgMarkup)) {
    return svgMarkup.replace(/<\/svg>/i, `${flameMarkup}</svg>`);
  }

  return `${svgMarkup}${flameMarkup}`;
}

/**
 * The flame reaches past the torch artwork's authored viewBox. In the live DOM
 * that is harmless — prop content is injected into the pictograph's own 950x950
 * SVG — but the raster path rasterizes each prop into exactly its own viewBox
 * and would clip the flame off the choreo card. Grow the box symmetrically and
 * shift the content by the same amount so the artwork's centre stays at
 * (width / 2, height / 2), which is the rotation anchor both paths use.
 */
function expandBoxAroundFlame(
  svgMarkup: string,
  propType: PropType | string
): string {
  const viewBoxMatch = svgMarkup.match(
    /<svg\b[^>]*\bviewBox\s*=\s*["']([^"']+)["']/i
  );
  if (!viewBoxMatch?.[1]) return svgMarkup;

  const box = viewBoxMatch[1].trim().split(/\s+/).map(Number);
  if (box.length !== 4 || box.some((value) => !Number.isFinite(value))) {
    return svgMarkup;
  }
  const [minX, minY, width, height] = box as [number, number, number, number];

  const { baseX, centerY, scale } = flamePlacement(propType);
  const flameLeft = baseX;
  const flameRight = baseX + FLAME_ART_HEIGHT * scale;
  const flameTop = centerY - FLAME_ART_HALF_WIDTH * scale;
  const flameBottom = centerY + FLAME_ART_HALF_WIDTH * scale;

  const overflowX = Math.max(0, minX - flameLeft, flameRight - (minX + width));
  const overflowY = Math.max(0, minY - flameTop, flameBottom - (minY + height));
  if (overflowX === 0 && overflowY === 0) return svgMarkup;

  const padX = overflowX + FLAME_BOX_PAD;
  const padY = overflowY + FLAME_BOX_PAD;

  const expanded = svgMarkup
    .replace(
      /(<svg\b[^>]*\bviewBox\s*=\s*["'])[^"']+(["'])/i,
      `$1${minX} ${minY} ${width + padX * 2} ${height + padY * 2}$2`
    )
    .replace(/(<svg\b[^>]*?)\swidth\s*=\s*["'][^"']*["']/i, "$1")
    .replace(/(<svg\b[^>]*?)\sheight\s*=\s*["'][^"']*["']/i, "$1");

  // The box grew on all four sides, so the artwork slides by the same margin
  // and keeps its centre at the middle of the new box.
  return expanded.replace(
    /(<svg\b[^>]*>)([\s\S]*)(<\/svg>)/i,
    (_match: string, open: string, inner: string, close: string) =>
      `${open}<g data-torch-contrast-frame="true" transform="translate(${padX} ${padY})">${inner}</g>${close}`
  );
}

/**
 * Give torch pictograph artwork a shaft, metal and flame that read against the
 * surface it is drawn on. Applied once, by the prop artwork loader, so the live
 * DOM, the worker raster, exports and print all inherit the same treatment.
 *
 * Non-torch artwork is returned untouched. Call this on authored artwork, once,
 * per theme — the loader does exactly that, keyed by theme mode. It is not
 * written to run over its own output.
 */
export function applyTorchContrastPalette(
  svgMarkup: string,
  propType: PropType | string | undefined,
  themeMode: ThemeMode
): string {
  if (!isTorchProp(propType)) return svgMarkup;

  const palette = TORCH_CONTRAST_PALETTE[themeMode];
  const withoutStaleFlame = stripTorchFlame(svgMarkup);
  const withVisibleShaft = recolorMarkedPart(
    withoutStaleFlame,
    "data-torch-shaft",
    palette.shaft
  );
  const withVisibleMetal = recolorMarkedPart(
    withVisibleShaft,
    "data-torch-metal",
    palette.metal
  );
  const withVisibleWick = recolorMarkedPart(
    withVisibleMetal,
    "data-torch-wick",
    palette.wick
  );

  const resolvedPropType = propType ?? PropType.TORCH;
  const withFlame = appendTorchFlame(
    withVisibleWick,
    resolvedPropType,
    palette.flame
  );

  return expandBoxAroundFlame(withFlame, resolvedPropType);
}
