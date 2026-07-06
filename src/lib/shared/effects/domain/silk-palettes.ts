import type { SilkIntent } from "./effects-config";

export interface SilkPalette {
  readonly id: SilkIntent["palette"];
  readonly body: string;      // ribbon center fill
  readonly edge: string;      // ribbon edge highlight
  readonly emissive?: boolean; // ember only - uses lighter blend
  readonly hueShift?: boolean; // ethereal only - shifts color along length
  readonly bodyAlt?: string;   // ethereal end-of-ribbon body color
  readonly edgeAlt?: string;   // ethereal end-of-ribbon edge color
}

const PALETTE_REGISTRY: Record<string, SilkPalette> = {
  satin: {
    id: "satin",
    body: "#c0c0d0",
    edge: "#ffffff",
  },
  velvet: {
    id: "velvet",
    body: "#600018",
    edge: "#ff2040",
  },
  ethereal: {
    id: "ethereal",
    body: "#c080ff",
    bodyAlt: "#80c0ff",
    edge: "#80d0ff",
    hueShift: true,
    edgeAlt: "#ff80c0",
  },
  shadow: {
    id: "shadow",
    body: "#101020",
    edge: "#404060",
  },
  gold_leaf: {
    id: "gold_leaf",
    body: "#a07000",
    edge: "#ffd700",
  },
  ember: {
    id: "ember",
    body: "#ff6000",
    edge: "#ffcc00",
    emissive: true,
  },
};

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h, s, l };
}

function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h * 6) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  const sector = Math.floor(h * 6);
  if (sector === 0 || sector === 6) { r = c; g = x; }
  else if (sector === 1) { r = x; g = c; }
  else if (sector === 2) { g = c; b = x; }
  else if (sector === 3) { g = x; b = c; }
  else if (sector === 4) { r = x; b = c; }
  else { r = c; b = x; }
  const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function deriveCustomPalette(hex: string): SilkPalette {
  const { h, s, l } = hexToHsl(hex);
  return {
    id: "custom",
    body: hex,
    edge: hslToHex(h, clamp01(s), clamp01(l + 0.3)),
  };
}

/**
 * Shared resolver: menagerie reuses silk's exact palette registry. Takes just
 * the palette fields structurally so both intents can call it.
 */
export function resolvePaletteByIntent(intent: {
  palette: SilkIntent["palette"];
  customColor: string;
}): SilkPalette {
  if (intent.palette === "custom") return deriveCustomPalette(intent.customColor);
  return PALETTE_REGISTRY[intent.palette] ?? PALETTE_REGISTRY.satin!;
}

export function resolveSilkPalette(intent: SilkIntent): SilkPalette {
  return resolvePaletteByIntent(intent);
}
