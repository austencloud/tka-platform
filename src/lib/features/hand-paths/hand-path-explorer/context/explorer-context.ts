import { getContext, setContext } from "svelte";
import type { ExplorerState } from "../state/explorer-state.svelte";

const EXPLORER_CTX_KEY = Symbol("hand-path-explorer");

export interface ExplorerContext {
  state: ExplorerState;
}

export function setExplorerContext(ctx: ExplorerContext): void {
  setContext(EXPLORER_CTX_KEY, ctx);
}

export function getExplorerContext(): ExplorerContext {
  return getContext<ExplorerContext>(EXPLORER_CTX_KEY);
}
