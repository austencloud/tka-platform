export interface TndElement {
  readonly familyId: string;
  readonly name: string;
  readonly element: string;
  readonly accentColor: string;
  readonly darkComplement: string;
  readonly iconPath: string;
}

export const TND_ELEMENTS: readonly TndElement[] = [
  {
    familyId: "split-same",
    name: "Split-Same",
    element: "water",
    accentColor: "#63b7cd",
    darkComplement: "#1a5276",
    iconPath: "/images/elements/water-v2.png",
  },
  {
    familyId: "tog-same",
    name: "Tog-Same",
    element: "earth",
    accentColor: "#75A874",
    darkComplement: "#2a4a29",
    iconPath: "/images/elements/earth-v2.png",
  },
  {
    familyId: "quarter-same",
    name: "Quarter-Same",
    element: "sun",
    accentColor: "#ffde17",
    darkComplement: "#7a6a00",
    iconPath: "/images/elements/sun-v4.png",
  },
  {
    familyId: "split-opp",
    name: "Split-Opp",
    element: "fire",
    accentColor: "#f2673a",
    darkComplement: "#6b1a0a",
    iconPath: "/images/elements/fire-v2.png",
  },
  {
    familyId: "tog-opp",
    name: "Tog-Opp",
    element: "air",
    accentColor: "#78b7e3",
    darkComplement: "#1a4a6b",
    iconPath: "/images/elements/air-v2.png",
  },
  {
    familyId: "quarter-opp",
    name: "Quarter-Opp",
    element: "moon",
    accentColor: "#6a4199",
    darkComplement: "#2a1540",
    iconPath: "/images/elements/moon-v2.png",
  },
] as const;

export const TND_BY_FAMILY: Readonly<Record<string, TndElement>> =
  Object.fromEntries(TND_ELEMENTS.map(t => [t.familyId, t]));

export const VTG_RATIO_LEVEL_MAP: Readonly<Record<string, number>> = {
  "1:1": 1,
  "3:1": 2,
  "5:1": 2,
  "7:1": 2,
  "2:1": 3,
  "4:1": 3,
  "6:1": 3,
};

export const VTG_RATIO_TURNS_MAP: Readonly<Record<string, number>> = {
  "1:1": 0,
  "2:1": 0.5,
  "3:1": 1,
  "4:1": 1.5,
  "5:1": 2,
  "6:1": 2.5,
  "7:1": 3,
};

/** Inverse of VTG_RATIO_TURNS_MAP - maps turn values to ratio strings */
export const VTG_TURNS_RATIO_MAP: Readonly<Record<number, string>> = {
  0: "1:1",
  0.5: "2:1",
  1: "3:1",
  1.5: "4:1",
  2: "5:1",
  2.5: "6:1",
  3: "7:1",
};

export function getTndElement(familyId: string): TndElement | null {
  return TND_ELEMENTS.find((t) => t.familyId === familyId) ?? null;
}
