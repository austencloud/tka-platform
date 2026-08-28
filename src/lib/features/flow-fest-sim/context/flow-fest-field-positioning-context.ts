import { getContext, setContext } from "svelte";
import type { FlowFestFieldPositioningState } from "../state/flow-fest-field-positioning-state.svelte";

const FLOW_FEST_FIELD_POSITIONING_CONTEXT = Symbol(
  "flow-fest-field-positioning"
);

export interface FlowFestFieldPositioningContext {
  state: FlowFestFieldPositioningState;
}

export function setFlowFestFieldPositioningContext(
  context: FlowFestFieldPositioningContext
): void {
  setContext(FLOW_FEST_FIELD_POSITIONING_CONTEXT, context);
}

export function getFlowFestFieldPositioningContext(): FlowFestFieldPositioningContext {
  const context = getContext<FlowFestFieldPositioningContext>(
    FLOW_FEST_FIELD_POSITIONING_CONTEXT
  );
  if (!context) {
    throw new Error("Flow Fest field positioning context is not available");
  }
  return context;
}
