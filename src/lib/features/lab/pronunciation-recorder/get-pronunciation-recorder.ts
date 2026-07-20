import { browser } from "$app/environment";

import { PronunciationRecorder } from "./services/implementations/PronunciationRecorder";

let instance: PronunciationRecorder | null = null;

export function getPronunciationRecorder(): PronunciationRecorder {
  if (!browser) throw new Error("getPronunciationRecorder() is browser-only");
  return (instance ??= new PronunciationRecorder());
}
