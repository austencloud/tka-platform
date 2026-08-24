import { getContext, setContext } from "svelte";
import type { TunnelCreatorState } from "../state/tunnel-creator-state.svelte";

const TUNNEL_CREATOR_CONTEXT = Symbol("tunnel-creator");

export function setTunnelCreatorContext(state: TunnelCreatorState): void {
  setContext(TUNNEL_CREATOR_CONTEXT, state);
}

export function getTunnelCreatorContext(): TunnelCreatorState {
  const state = getContext<TunnelCreatorState>(TUNNEL_CREATOR_CONTEXT);
  if (!state) throw new Error("Tunnel Creator context is not available.");
  return state;
}
