import { getContext, setContext } from "svelte";
import type { QftAppState } from "../_state/qft-app-state.svelte";

const QFT_APP_CONTEXT_KEY = Symbol("qft-app-context");

export function setQftAppContext(state: QftAppState): void {
  setContext(QFT_APP_CONTEXT_KEY, state);
}

export function getQftAppContext(): QftAppState {
  const state = getContext<QftAppState | undefined>(QFT_APP_CONTEXT_KEY);
  if (!state) {
    throw new Error("QfT app state is only available below QftApp.");
  }
  return state;
}
