import { getContext, setContext } from "svelte";
import type { StickerLabState } from "../state/sticker-lab-state.svelte";

const STICKER_LAB_CONTEXT_KEY = Symbol("sticker-lab-context");

export function setStickerLabContext(state: StickerLabState): void {
  setContext(STICKER_LAB_CONTEXT_KEY, state);
}

export function getStickerLabContext(): StickerLabState {
  const state = getContext<StickerLabState | undefined>(STICKER_LAB_CONTEXT_KEY);
  if (!state) {
    throw new Error("StickerLabState not available. Did you forget setStickerLabContext()?");
  }
  return state;
}
