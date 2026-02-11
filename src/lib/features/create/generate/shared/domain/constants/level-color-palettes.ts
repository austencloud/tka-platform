/**
 * Level color palettes for the compact chip toolbar.
 * Two variants: standard (dark backgrounds) and bright (light backgrounds).
 */

export interface LevelColorEntry {
  color: string;
  shadowHsl: string;
  textColor: string;
}

export const LEVEL_COLORS: Record<number, LevelColorEntry> = {
  1: {
    color: `radial-gradient(ellipse at top left, rgb(186,230,253) 0%, rgb(125,211,252) 30%, rgb(56,189,248) 70%, rgb(14,165,233) 100%)`,
    shadowHsl: "200deg 80% 55%",
    textColor: "black",
  },
  2: {
    color: `radial-gradient(ellipse at top left, rgb(226,232,240) 0%, rgb(148,163,184) 30%, rgb(100,116,139) 70%, rgb(71,85,105) 100%)`,
    shadowHsl: "215deg 20% 40%",
    textColor: "white",
  },
  3: {
    color: `radial-gradient(ellipse at top left, rgb(254,240,138) 0%, rgb(253,224,71) 20%, rgb(250,204,21) 40%, rgb(234,179,8) 60%, rgb(202,138,4) 80%, rgb(161,98,7) 100%)`,
    shadowHsl: "45deg 80% 45%",
    textColor: "black",
  },
  4: {
    color: `radial-gradient(ellipse at top left, rgb(255,180,180) 0%, rgb(255,140,140) 20%, rgb(255,100,100) 40%, rgb(239,68,68) 60%, rgb(220,38,38) 80%, rgb(185,28,28) 100%)`,
    shadowHsl: "0deg 75% 50%",
    textColor: "white",
  },
};

export const LEVEL_COLORS_BRIGHT: Record<number, LevelColorEntry> = {
  1: {
    color: `radial-gradient(ellipse at top left, rgb(165,218,250) 0%, rgb(105,195,248) 30%, rgb(45,175,240) 70%, rgb(8,145,210) 100%)`,
    shadowHsl: "200deg 80% 45%",
    textColor: "black",
  },
  2: {
    color: `radial-gradient(ellipse at top left, rgb(148,163,184) 0%, rgb(100,116,139) 30%, rgb(71,85,105) 70%, rgb(51,65,85) 100%)`,
    shadowHsl: "215deg 20% 30%",
    textColor: "white",
  },
  3: {
    color: `radial-gradient(ellipse at top left, rgb(253,224,71) 0%, rgb(250,204,21) 20%, rgb(234,179,8) 40%, rgb(217,155,6) 60%, rgb(202,138,4) 80%, rgb(180,115,5) 100%)`,
    shadowHsl: "45deg 80% 40%",
    textColor: "black",
  },
  4: {
    color: `radial-gradient(ellipse at top left, rgb(255,140,140) 0%, rgb(255,100,100) 20%, rgb(239,68,68) 40%, rgb(220,38,38) 60%, rgb(185,28,28) 80%, rgb(153,27,27) 100%)`,
    shadowHsl: "0deg 75% 40%",
    textColor: "white",
  },
};

export const FALLBACK_LEVEL_COLOR: LevelColorEntry = {
  color: "linear-gradient(135deg, #64748b 0%, #475569 100%)",
  shadowHsl: "215deg 20% 40%",
  textColor: "white",
};
