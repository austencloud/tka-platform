import { PropType } from "./enums/prop-type";

export type PropRenderContext = "standard" | "editor";

export const EDITOR_TORCH_PALETTE = {
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
export const EDITOR_TORCH_FLAME_OUTLINE = "#7c2d12";

export function needsEditorContrast(
  context: PropRenderContext,
  propType?: PropType | string
): boolean {
  return (
    context === "editor" &&
    (propType === PropType.TORCH || propType === PropType.BIGTORCH)
  );
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

function stripEditorTorchMarkers(svgMarkup: string): string {
  return svgMarkup.replace(
    /\sdata-torch-(?:shaft|metal|wick)=(?:"[^"]*"|'[^']*')/gi,
    ""
  );
}

function stripEditorTorchFlame(svgMarkup: string): string {
  return svgMarkup.replace(
    /\s*<g\b(?=[^>]*\bdata-torch-flame=(?:"true"|'true'))[^>]*>[\s\S]*?<\/g>/gi,
    ""
  );
}

function appendEditorTorchFlame(
  svgMarkup: string,
  propType: PropType | string,
  flameColor: string
): string {
  const isBigTorch = propType === PropType.BIGTORCH;
  const baseX = isBigTorch ? 223.4 : 284;
  const centerY = isBigTorch ? 12.55 : 7.75;
  const scale = isBigTorch ? 0.58 : 0.36;
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
        stroke="${EDITOR_TORCH_FLAME_OUTLINE}"
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
 * Editor tiles recolor marked torch geometry and add the approved flame.
 * Standard rendering strips this treatment so animation and export keep the
 * canonical artwork.
 */
export function applyEditorTorchPalette(
  svgMarkup: string,
  context: PropRenderContext,
  propType: PropType | string | undefined,
  darkMode: boolean
): string {
  const withoutEditorFlame = stripEditorTorchFlame(svgMarkup);

  if (!needsEditorContrast(context, propType)) {
    return stripEditorTorchMarkers(withoutEditorFlame);
  }

  const palette = darkMode
    ? EDITOR_TORCH_PALETTE.dark
    : EDITOR_TORCH_PALETTE.light;
  const withVisibleShaft = recolorMarkedPart(
    withoutEditorFlame,
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

  return appendEditorTorchFlame(
    withVisibleWick,
    propType ?? PropType.TORCH,
    palette.flame
  );
}
