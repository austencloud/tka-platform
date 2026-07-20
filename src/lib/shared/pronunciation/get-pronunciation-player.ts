import { browser } from "$app/environment";
import { PronunciationPlayer } from "./services/pronunciation-player";

let instance: PronunciationPlayer | null = null;

export function getPronunciationPlayer(): PronunciationPlayer {
  if (!browser) throw new Error("getPronunciationPlayer() is browser-only");
  return (instance ??= new PronunciationPlayer());
}
