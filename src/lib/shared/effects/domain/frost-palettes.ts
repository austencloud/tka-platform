import type { FrostIntent } from "./effects-config";

export interface FrostPalette {
  readonly id: FrostIntent["palette"];
  readonly crystal: string;
  readonly rim: string;
  readonly sparkle: string;
  readonly aura: string;
  readonly groundFrost: string;
  readonly auraOnly?: boolean;
  readonly emissive?: boolean;
}

const PALETTE_REGISTRY: Record<string, FrostPalette> = {
  glacial: {
    id: "glacial",
    crystal: "#a0d8ff",
    rim: "#e0f4ff",
    sparkle: "#ffffff",
    aura: "#b0e0ff",
    groundFrost: "#80c0e0",
  },
  breath: {
    id: "breath",
    crystal: "#d0e8f0",
    rim: "#f0f8ff",
    sparkle: "#ffffff",
    aura: "#d8eef8",
    groundFrost: "#b0d0e0",
    auraOnly: true,
  },
  black_ice: {
    id: "black_ice",
    crystal: "#202830",
    rim: "#405060",
    sparkle: "#80a0b0",
    aura: "#405868",
    groundFrost: "#182028",
  },
  aurora: {
    id: "aurora",
    crystal: "#60ff80",
    rim: "#ffffff",
    sparkle: "#c0ffd0",
    aura: "#80ffa0",
    groundFrost: "#40c080",
    emissive: true,
  },
  diamond: {
    id: "diamond",
    crystal: "#e8e8f0",
    rim: "#ffffff",
    sparkle: "#ffffff",
    aura: "#f0f0ff",
    groundFrost: "#d0d0e0",
  },
  cursed: {
    id: "cursed",
    crystal: "#4020a0",
    rim: "#8060d0",
    sparkle: "#c0a0ff",
    aura: "#7050b0",
    groundFrost: "#301880",
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

function deriveCustomPalette(hex: string): FrostPalette {
  const { h, s, l } = hexToHsl(hex);
  return {
    id: "custom",
    crystal: hex,
    rim: hslToHex(h, clamp01(s), clamp01(l + 0.3)),
    sparkle: hslToHex(h, clamp01(s - 0.5), clamp01(l + 0.5)),
    aura: hex,
    groundFrost: hslToHex(h, s, clamp01(l - 0.2)),
  };
}

export function resolveFrostPalette(intent: FrostIntent): FrostPalette {
  if (intent.palette === "custom") return deriveCustomPalette(intent.customColor);
  return PALETTE_REGISTRY[intent.palette] ?? PALETTE_REGISTRY.glacial!;
}
