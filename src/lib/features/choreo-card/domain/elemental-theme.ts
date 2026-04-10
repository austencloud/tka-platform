export interface ElementalTheme {
  readonly familyId: string;
  readonly element: string;
  readonly accentColor: string;
  readonly darkComplement: string;
  readonly iconPath: string;
}

export const VTG_ELEMENTAL_THEMES: readonly ElementalTheme[] = [
  {
    familyId: "split-same",
    element: "water",
    accentColor: "#63b7cd",
    darkComplement: "#1a5276",
    iconPath: "/images/elements/water.png",
  },
  {
    familyId: "tog-same",
    element: "earth",
    accentColor: "#75A874",
    darkComplement: "#2a4a29",
    iconPath: "/images/elements/earth.png",
  },
  {
    familyId: "quarter-same",
    element: "sun",
    accentColor: "#ffde17",
    darkComplement: "#7a6a00",
    iconPath: "/images/elements/sun.png",
  },
  {
    familyId: "split-opp",
    element: "fire",
    accentColor: "#f2673a",
    darkComplement: "#6b1a0a",
    iconPath: "/images/elements/fire.png",
  },
  {
    familyId: "tog-opp",
    element: "air",
    accentColor: "#78b7e3",
    darkComplement: "#1a4a6b",
    iconPath: "/images/elements/air.png",
  },
  {
    familyId: "quarter-opp",
    element: "moon",
    accentColor: "#6a4199",
    darkComplement: "#2a1540",
    iconPath: "/images/elements/moon.png",
  },
] as const;

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

/** Inverse of VTG_RATIO_TURNS_MAP — maps turn values to ratio strings */
export const VTG_TURNS_RATIO_MAP: Readonly<Record<number, string>> = {
  0: "1:1",
  0.5: "2:1",
  1: "3:1",
  1.5: "4:1",
  2: "5:1",
  2.5: "6:1",
  3: "7:1",
};

export function getElementalTheme(familyId: string): ElementalTheme | null {
  return VTG_ELEMENTAL_THEMES.find((t) => t.familyId === familyId) ?? null;
}
