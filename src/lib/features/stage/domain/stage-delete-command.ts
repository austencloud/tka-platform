import type { StageSelection } from "../state/stage-edit-mode.svelte";

export type StageDeleteCommand =
  | { kind: "none" }
  | { kind: "remove-performers"; performerIds: readonly string[] }
  | { kind: "remove-formation"; formationId: string }
  | { kind: "remove-clip"; performerId: string; clipId: string }
  | { kind: "reset-travel"; formationId: string; performerId: string }
  | { kind: "explain-required-spot"; formationId: string; performerId: string };

/**
 * Delete follows the object the person selected. The playhead and current lens
 * are deliberately absent: neither is permission to remove nearby work.
 */
export function resolveStageDeleteCommand(
  selection: StageSelection
): StageDeleteCommand {
  switch (selection.kind) {
    case "performers":
      return {
        kind: "remove-performers",
        performerIds: selection.performerIds,
      };
    case "formation":
      return { kind: "remove-formation", formationId: selection.formationId };
    case "clip":
      return {
        kind: "remove-clip",
        performerId: selection.performerId,
        clipId: selection.clipId,
      };
    case "travel":
      return {
        kind: "reset-travel",
        formationId: selection.formationId,
        performerId: selection.performerId,
      };
    case "spot":
      return {
        kind: "explain-required-spot",
        formationId: selection.formationId,
        performerId: selection.performerId,
      };
    case "none":
      return { kind: "none" };
  }
}
