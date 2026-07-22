export interface TnDElement {
  readonly familyId: string;
  readonly name: string;
  readonly element: string;
  readonly accentColor: string;
  readonly darkComplement: string;
  readonly iconPath: string;
  /** CIELAB-tuned opacity (0–1) for card interior tint; compensates for each color's perceptual distance from white */
  readonly cardTintOpacity: number;
  /** Per-icon visual-size multiplier for badge display. The source PNGs differ
   *  in aspect and internal density — the tall dense leaf reads much bigger than
   *  the sparse sun rays or the wide cloud when fit into one square box. These
   *  scales normalize perceived glyph size (tuned against the real assets). */
  readonly iconScale: number;
}

export const TND_ELEMENTS: readonly TnDElement[] = [
  {
    familyId: "split-same",
    name: "Split-Same",
    element: "water",
    accentColor: "#3568a0",
    darkComplement: "#1a3a5e",
    iconPath: "/images/elements/water-v2.png",
    cardTintOpacity: 0.25,
    iconScale: 0.9,
  },
  {
    familyId: "tog-same",
    name: "Tog-Same",
    element: "earth",
    accentColor: "#75A874",
    darkComplement: "#2a4a29",
    iconPath: "/images/elements/earth-v2.png",
    cardTintOpacity: 0.15,
    iconScale: 0.78,
  },
  {
    familyId: "quarter-same",
    name: "Quarter-Same",
    element: "sun",
    accentColor: "#ffde17",
    darkComplement: "#7a6a00",
    iconPath: "/images/elements/sun-v4.png",
    cardTintOpacity: 0.09,
    iconScale: 1.06,
  },
  {
    familyId: "split-opp",
    name: "Split-Opp",
    element: "fire",
    accentColor: "#f2673a",
    darkComplement: "#6b1a0a",
    iconPath: "/images/elements/fire-v2.png",
    cardTintOpacity: 0.09,
    iconScale: 0.88,
  },
  {
    familyId: "tog-opp",
    name: "Tog-Opp",
    element: "air",
    accentColor: "#bce4f7",
    darkComplement: "#3a6a8b",
    iconPath: "/images/elements/air-v2.png",
    cardTintOpacity: 0.16,
    iconScale: 1.12,
  },
  {
    familyId: "quarter-opp",
    name: "Quarter-Opp",
    element: "moon",
    accentColor: "#6a4199",
    darkComplement: "#2a1540",
    iconPath: "/images/elements/moon-v2.png",
    cardTintOpacity: 0.09,
    iconScale: 0.84,
  },
] as const;

export const TND_BY_FAMILY: Readonly<Record<string, TnDElement>> =
  Object.fromEntries(TND_ELEMENTS.map(t => [t.familyId, t]));

export const TND_RATIO_LEVEL_MAP: Readonly<Record<string, number>> = {
  "1:1": 1,
  "3:1": 2,
  "5:1": 2,
  "7:1": 2,
  "2:1": 3,
  "4:1": 3,
  "6:1": 3,
};

export const TND_RATIO_TURNS_MAP: Readonly<Record<string, number>> = {
  "1:1": 0,
  "2:1": 0.5,
  "3:1": 1,
  "4:1": 1.5,
  "5:1": 2,
  "6:1": 2.5,
  "7:1": 3,
};

/** Inverse of TND_RATIO_TURNS_MAP - maps turn values to ratio strings */
export const TND_TURNS_RATIO_MAP: Readonly<Record<number, string>> = {
  0: "1:1",
  0.5: "2:1",
  1: "3:1",
  1.5: "4:1",
  2: "5:1",
  2.5: "6:1",
  3: "7:1",
};

export function getTnDElement(familyId: string): TnDElement | null {
  return TND_ELEMENTS.find((t) => t.familyId === familyId) ?? null;
}

const ICON_LEGACY: Readonly<Record<string, string>> = {
  "/images/elements/sun-v2.png": "/images/elements/sun-v4.png",
};

export function getTnDElementByIconPath(iconPath: string): TnDElement | null {
  const normalized = ICON_LEGACY[iconPath] ?? iconPath;
  return TND_ELEMENTS.find((t) => t.iconPath === normalized) ?? null;
}
