/**
 * Pictograph Context - Svelte context helpers for PictographConfig
 *
 * Uses Svelte's setContext/getContext to pass config down the component tree.
 * Parent components call setPictographConfig() once at the top,
 * and all child rendering components call getPictographConfig() to read it.
 */

import { setContext, getContext } from "svelte";
import type { PictographConfig } from "./PictographConfig";
import { DEFAULT_PICTOGRAPH_CONFIG } from "./PictographConfig";

const PICTOGRAPH_CONFIG_KEY = Symbol("pictograph-config");

export function setPictographConfig(config: PictographConfig): void {
  setContext(PICTOGRAPH_CONFIG_KEY, config);
}

export function getPictographConfig(): PictographConfig {
  return getContext<PictographConfig>(PICTOGRAPH_CONFIG_KEY) ?? DEFAULT_PICTOGRAPH_CONFIG;
}
