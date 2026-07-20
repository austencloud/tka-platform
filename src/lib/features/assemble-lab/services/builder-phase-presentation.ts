import type { BuilderPhase } from "../state/assemble-state.svelte";

export interface BuilderControlVisibility {
  readonly orientation: boolean;
  readonly motionSettings: boolean;
}

export function getBuilderControlVisibility(
  phase: BuilderPhase
): BuilderControlVisibility {
  return {
    orientation: phase === "placing",
    motionSettings:
      phase === "placing" || phase === "building" || phase === "animating",
  };
}

export function getBuilderPhaseInstruction(phase: BuilderPhase): string {
  switch (phase) {
    case "idle":
      return "Tap a starting point";
    case "placing":
      return "Set orientation and rotation, then tap a destination";
    case "building":
    case "animating":
      return "Set rotation, then tap the next point";
    case "complete":
      return "Sequence complete";
  }
}
