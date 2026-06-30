/**
 * EFFECT_PLUGINS — single source of truth for all 16 effects.
 *
 * Each effect's descriptor lives in its own renderer module (colocated).
 * Adding a new effect = one new module + one import line here.
 * Retiring P2.3 / P2.4 will drive EffectRendererManager and the render
 * loop off this registry instead of the inline OVERLAY_REGISTRY.
 */

import type { EffectPlugin } from "./effect-plugin";
import type { EffectType } from "../../domain/types/tip-effect-types";

import { fireEffectPlugin } from "../fire/web-gl-fire-renderer";
import { charcoalEffectPlugin } from "../charcoal/charcoal-spark-renderer";
import { ledEffectPlugin } from "../led/web-gl-led-renderer";
import { trailsEffectPlugin } from "../trail-overlay-web-gl2";
import { zapEffectPlugin } from "../zap-overlay-renderer";
import { sparklesEffectPlugin } from "../sparkles-overlay-renderer";
import { ghostEffectPlugin } from "../ghost-overlay-renderer";
import { bloomEffectPlugin } from "../bloom-overlay-renderer";
import { gooEffectPlugin } from "../goo-overlay-renderer";
import { bubblesEffectPlugin } from "../bubbles-overlay-renderer";
import { petalsEffectPlugin } from "../petals-overlay-renderer";
import { smokeEffectPlugin } from "../smoke-overlay-renderer";
import { inkEffectPlugin } from "../ink-overlay-renderer";
import { frostEffectPlugin } from "../frost-overlay-renderer";
import { silkEffectPlugin } from "../silk-overlay-renderer";
import { pulseEffectPlugin } from "../pulse-overlay-renderer";

/** The single source of truth for all effects. Add a new effect by adding one line here. */
export const EFFECT_PLUGINS: readonly EffectPlugin[] = [
  fireEffectPlugin,
  charcoalEffectPlugin,
  ledEffectPlugin,
  trailsEffectPlugin,
  zapEffectPlugin,
  sparklesEffectPlugin,
  ghostEffectPlugin,
  bloomEffectPlugin,
  gooEffectPlugin,
  bubblesEffectPlugin,
  petalsEffectPlugin,
  smokeEffectPlugin,
  inkEffectPlugin,
  frostEffectPlugin,
  silkEffectPlugin,
  pulseEffectPlugin,
];

export const EFFECT_PLUGIN_BY_ID = Object.fromEntries(
  EFFECT_PLUGINS.map((p) => [p.id, p])
) as Record<EffectType, EffectPlugin>;
