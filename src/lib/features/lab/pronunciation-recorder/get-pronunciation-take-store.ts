import { browser } from "$app/environment";

import { PronunciationTakeStore } from "./services/implementations/PronunciationTakeStore";

let instance: PronunciationTakeStore | null = null;

export function getPronunciationTakeStore(): PronunciationTakeStore {
  if (!browser) throw new Error("getPronunciationTakeStore() is browser-only");
  return (instance ??= new PronunciationTakeStore());
}
