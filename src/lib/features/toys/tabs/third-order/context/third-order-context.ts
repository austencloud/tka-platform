import { getContext, setContext } from "svelte";
import type { ThirdOrderState } from "../state/third-order-state.svelte";

const THIRD_ORDER_CONTEXT = Symbol("third-order-toy");

export function setThirdOrderContext(state: ThirdOrderState): ThirdOrderState {
  setContext(THIRD_ORDER_CONTEXT, state);
  return state;
}

export function getThirdOrderContext(): ThirdOrderState {
  const state = getContext<ThirdOrderState | undefined>(THIRD_ORDER_CONTEXT);
  if (!state) throw new Error("Third Order toy context is unavailable");
  return state;
}
