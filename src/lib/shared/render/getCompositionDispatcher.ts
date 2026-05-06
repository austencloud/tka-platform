// src/lib/shared/render/getCompositionDispatcher.ts
import { browser } from "$app/environment";
import { CompositionDispatcher } from "./services/implementations/CompositionDispatcher";
import { getImageComposer } from "./getImageComposer";
import { getTextRenderer } from "./getTextRenderer";

let instance: CompositionDispatcher | null = null;

export function getCompositionDispatcher(): CompositionDispatcher {
  if (!browser) throw new Error("getCompositionDispatcher() is browser-only");
  return (instance ??= new CompositionDispatcher(getImageComposer(), getTextRenderer()));
}
