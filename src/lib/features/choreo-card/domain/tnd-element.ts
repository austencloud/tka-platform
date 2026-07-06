export interface TnDElement {
  readonly familyId: string;
  readonly name: string;
  readonly element: string;
  readonly accentColor: string;
  readonly darkComplement: string;
  readonly iconPath: string;
  /** CIELAB-tuned opacity (0–1) for card interior tint; compensates for each color's perceptual distance from white */
  readonly cardTintOpacity: number;
  /** Neutral, pedagogical one-liner stating this family's two axes: TIMING
   * (how far apart the hands are — the app's own alpha/beta/gamma language)
   * + DIRECTION (same vs opposite turning). NO aesthetic verdict: the color
   * coding carries feel, and the concrete look permutes with grid mode
   * (opposite-direction families reclassify between diamond and box), so the
   * copy names the axes, never a single fixed picture. Axes per the canonical
   * 6-Element Model (Split→alpha, Tog→beta, Quarter→gamma). */
  readonly description: string;
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
    description: "Hands apart, turning the same way.",
  },
  {
    familyId: "tog-same",
    name: "Tog-Same",
    element: "earth",
    accentColor: "#75A874",
    darkComplement: "#2a4a29",
    iconPath: "/images/elements/earth-v2.png",
    cardTintOpacity: 0.15,
    description: "Hands together, turning the same way.",
  },
  {
    familyId: "quarter-same",
    name: "Quarter-Same",
    element: "sun",
    accentColor: "#ffde17",
    darkComplement: "#7a6a00",
    iconPath: "/images/elements/sun-v4.png",
    cardTintOpacity: 0.09,
    description: "Hands at a right angle, turning the same way.",
  },
  {
    familyId: "split-opp",
    name: "Split-Opp",
    element: "fire",
    accentColor: "#f2673a",
    darkComplement: "#6b1a0a",
    iconPath: "/images/elements/fire-v2.png",
    cardTintOpacity: 0.09,
    description: "Hands apart, turning opposite ways.",
  },
  {
    familyId: "tog-opp",
    name: "Tog-Opp",
    element: "air",
    accentColor: "#bce4f7",
    darkComplement: "#3a6a8b",
    iconPath: "/images/elements/air-v2.png",
    cardTintOpacity: 0.16,
    description: "Hands together, turning opposite ways.",
  },
  {
    familyId: "quarter-opp",
    name: "Quarter-Opp",
    element: "moon",
    accentColor: "#6a4199",
    darkComplement: "#2a1540",
    iconPath: "/images/elements/moon-v2.png",
    cardTintOpacity: 0.09,
    description: "Hands at a right angle, turning opposite ways.",
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
