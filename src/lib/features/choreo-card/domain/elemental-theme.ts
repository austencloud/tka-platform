export interface ElementalTheme {
  readonly familyId: string;
  readonly element: string;
  readonly accentColor: string;
  readonly svgPath: string;
}

export const VTG_ELEMENTAL_THEMES: readonly ElementalTheme[] = [
  {
    familyId: "split-same",
    element: "water",
    accentColor: "#63b7cd",
    svgPath: "/images/elements/water.svg",
  },
  {
    familyId: "tog-same",
    element: "earth",
    accentColor: "#75A874",
    svgPath: "/images/elements/earth.svg",
  },
  {
    familyId: "quarter-same",
    element: "sun",
    accentColor: "#ffde17",
    svgPath: "/images/elements/sun.svg",
  },
  {
    familyId: "split-opp",
    element: "fire",
    accentColor: "#f2673a",
    svgPath: "/images/elements/fire.svg",
  },
  {
    familyId: "tog-opp",
    element: "air",
    accentColor: "#78b7e3",
    svgPath: "/images/elements/air.svg",
  },
  {
    familyId: "quarter-opp",
    element: "moon",
    accentColor: "#6a4199",
    svgPath: "/images/elements/moon.svg",
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
