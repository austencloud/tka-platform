import { getContext, setContext } from "svelte";
import type { DecomposeSlotState } from "../state/decompose-state.svelte";

const DECOMPOSE_CTX_KEY = Symbol("decompose");

export interface DecomposeContext {
  slotState: DecomposeSlotState;
}

export function setDecomposeContext(ctx: DecomposeContext) {
  setContext(DECOMPOSE_CTX_KEY, ctx);
}

export function getDecomposeContext(): DecomposeContext {
  return getContext<DecomposeContext>(DECOMPOSE_CTX_KEY);
}
