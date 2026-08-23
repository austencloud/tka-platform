import { getContext, setContext } from "svelte";
import type { StageChoreographyState } from "../state/stage-choreography-state.svelte";

const STAGE_CHOREOGRAPHY_CONTEXT = Symbol("stage-choreography");

export function setStageChoreographyContext(
  state: StageChoreographyState
): void {
  setContext(STAGE_CHOREOGRAPHY_CONTEXT, state);
}

export function getStageChoreographyContext(): StageChoreographyState {
  const state = getContext<StageChoreographyState | undefined>(
    STAGE_CHOREOGRAPHY_CONTEXT
  );
  if (!state) {
    throw new Error(
      "Stage choreography context is unavailable outside StageModule"
    );
  }
  return state;
}
