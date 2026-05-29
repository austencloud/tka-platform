import type { EffectType } from "../../domain/types/TipEffectTypes";
import type { EffectRendererLike } from "./EffectRenderer";
import type { EffectRendererManager } from "../effect-renderer-manager";

/** Dispatch strategy for an effect — selects the host's lifecycle/render path. */
export type EffectKind = "canvas2d" | "webgl" | "led" | "trails";

/**
 * Single colocated descriptor for one effect. Lives in the effect's own module
 * and is aggregated into EFFECT_PLUGINS. Evolves the former OverlayEffectEntry:
 * RendererClass becomes createRenderer, and it gains defaultConfig + kind so the
 * render loop and effects-config-state derive from the same source.
 */
export interface EffectPlugin<C = unknown> {
  /** Effect id; matches an EffectType union member. */
  id: EffectType;
  /** Dispatch strategy. Most effects are "canvas2d"; fire/charcoal "webgl"; led + trails special. */
  kind: EffectKind;
  /** Factory producing a renderer satisfying the structural contract. */
  createRenderer(): EffectRendererLike;
  /** Default config seed for effects-config-state. */
  defaultConfig: C;
  /**
   * Legacy config-key string kept for reference (previously mapped to a named
   * RenderLoopConfig slot; now renderers live in RenderLoopConfig.renderers[id]).
   * Still carried by each plugin for documentation purposes.
   */
  configKey: string;
  /** Whether per-frame dispatch needs dt. Default false. */
  needsDt?: boolean;
  /** Skip triggerRender() after lifecycle sync. Default true (= trigger). */
  triggerRender?: boolean;
  /** Lifecycle hook after a successful renderer init. */
  onInit?(mgr: EffectRendererManager, renderer: EffectRendererLike): void;
  /** Lifecycle hook after disable + dispose. */
  onDisable?(mgr: EffectRendererManager): void;
}
