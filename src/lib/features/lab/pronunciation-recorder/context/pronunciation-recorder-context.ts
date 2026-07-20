import { getContext, setContext } from "svelte";

import type { PronunciationRecorderState } from "../state/pronunciation-recorder-state.svelte";

const KEY = Symbol("pronunciation-recorder");

export interface PronunciationRecorderContext {
  state: PronunciationRecorderState;
}

export function setPronunciationRecorderContext(
  context: PronunciationRecorderContext
): void {
  setContext(KEY, context);
}

export function getPronunciationRecorderContext(): PronunciationRecorderContext {
  const context = getContext<PronunciationRecorderContext>(KEY);
  if (!context) {
    throw new Error("Pronunciation recorder context is unavailable.");
  }
  return context;
}
