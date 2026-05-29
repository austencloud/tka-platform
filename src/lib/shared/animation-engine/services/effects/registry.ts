/**
 * EFFECT_PLUGINS — single source of truth for all 16 effects.
 *
 * Each effect's descriptor lives in its own renderer module (colocated).
 * Adding a new effect = one new module + one import line here.
 * Retiring P2.3 / P2.4 will drive EffectRendererManager and the render
 * loop off this registry instead of the inline OVERLAY_REGISTRY.
 */

import type { EffectPlugin } from "./EffectPlugin";
import type { EffectType } from "../../domain/types/TipEffectTypes";

import { fireEffectPlugin } from "../implementations/fire/WebGLFireRenderer";
import { charcoalEffectPlugin } from "../implementations/charcoal/CharcoalSparkRenderer";
import { ledEffectPlugin } from "../implementations/led/WebGLLedRenderer";
import { trailsEffectPlugin } from "../implementations/TrailOverlayWebGL2";
import { zapEffectPlugin } from "../implementations/ZapOverlayRenderer";
import { sparklesEffectPlugin } from "../implementations/SparklesOverlayRenderer";
import { echoEffectPlugin } from "../implementations/EchoOverlayRenderer";
import { bloomEffectPlugin } from "../implementations/BloomOverlayRenderer";
import { waterEffectPlugin } from "../implementations/WaterOverlayRenderer";
import { bubblesEffectPlugin } from "../implementations/BubblesOverlayRenderer";
import { petalsEffectPlugin } from "../implementations/PetalsOverlayRenderer";
import { smokeEffectPlugin } from "../implementations/SmokeOverlayRenderer";
import { inkEffectPlugin } from "../implementations/InkOverlayRenderer";
import { frostEffectPlugin } from "../implementations/FrostOverlayRenderer";
import { silkEffectPlugin } from "../implementations/SilkOverlayRenderer";
import { pulseEffectPlugin } from "../implementations/PulseOverlayRenderer";

/** The single source of truth for all effects. Add a new effect by adding one line here. */
export const EFFECT_PLUGINS: readonly EffectPlugin[] = [
  fireEffectPlugin,
  charcoalEffectPlugin,
  ledEffectPlugin,
  trailsEffectPlugin,
  zapEffectPlugin,
  sparklesEffectPlugin,
  echoEffectPlugin,
  bloomEffectPlugin,
  waterEffectPlugin,
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
