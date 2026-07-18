export const ASSEMBLY_STEPS = [
  {
    value: "grid",
    number: "01",
    label: "The grid",
    stageLabel: "The notation grid",
    delayMs: 700,
  },
  {
    value: "hands",
    number: "02",
    label: "Place the hands",
    stageLabel: "Hands placed on the grid",
    delayMs: 700,
  },
  {
    value: "props",
    number: "03",
    label: "Add the props",
    stageLabel: "Props added to the grid",
    delayMs: 700,
  },
  {
    value: "motion",
    number: "04",
    label: "Add motion",
    stageLabel: "Motion added to the pictograph",
    delayMs: 1200,
  },
  {
    value: "sequence",
    number: "05",
    label: "Build the sequence",
    stageLabel: "The complete sequence card",
    delayMs: 1400,
  },
  {
    value: "playback",
    number: "06",
    label: "Play it back",
    stageLabel: "The animated sequence",
    delayMs: 0,
  },
] as const;

export type AssemblyStep = (typeof ASSEMBLY_STEPS)[number]["value"];
export type AssemblyStepDefinition = (typeof ASSEMBLY_STEPS)[number];

export function getInitialAssemblyStep(reducedMotion: boolean): AssemblyStep {
  return reducedMotion ? "motion" : "grid";
}

export function getNextAssemblyStep(current: AssemblyStep): AssemblyStep | null {
  const index = ASSEMBLY_STEPS.findIndex((step) => step.value === current);
  return ASSEMBLY_STEPS[index + 1]?.value ?? null;
}

interface PlaybackActivation {
  active: boolean;
  sectionVisible: boolean;
  documentVisible: boolean;
}

export function shouldEnableAssemblyPlayback({
  active,
  sectionVisible,
  documentVisible,
}: PlaybackActivation): boolean {
  return active && sectionVisible && documentVisible;
}
