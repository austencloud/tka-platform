import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { PropState } from "$lib/shared/foundation/domain/types/prop-state";
import type { AdditionalLayerProps } from "$lib/shared/animation-engine/domain/types/trail-capture-types";
import type { TipEffectMap } from "$lib/shared/animation-engine/domain/types/tip-effect-types";
import { interpolatePropAngles } from "$lib/shared/animation-engine/services/prop-interpolator";
import { applyEffort } from "$lib/shared/effort/domain/effort-easing-unified";
import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
import { buildTunnelLayers } from "./tunnel-layer-builder";
import { stepToIndexProgress, type Fold, type TunnelConfig } from "./tunnel-fold-math";
import {
  loadTunnelPresets,
  saveTunnelPresets,
  type TunnelPreset,
} from "./tunnel-presets";

const DEFAULT_PROP_STATE: PropState = { centerPathAngle: 0, staffRotationAngle: 0 };

export interface TunnelControllerSources {
  /** The viewer's currently open sequence. */
  getSequence: () => SequenceData | null | undefined;
}

/** Reduced-motion caps the fold so a dense kaleidoscope doesn't spin for users
 *  who asked for less motion. */
function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export class TunnelViewController {
  /** Effects with real per-tip GPU/2D cost per layer. */
  static readonly HEAVY_EFFECTS = new Set<string>(["fire", "charcoal", "trails"]);

  // Tunnel sub-mode on/off (speed + play/pause ride the pane's existing transport).
  active = $state(false);

  // Config (a saved preset stores exactly this).
  fold = $state<Fold>(4);
  mirror = $state(false);

  /** Tunnel-specific grid visibility. The kaleidoscope owns this (the global
   *  Visual/Display toggles don't reach the self-clocked tunnel), so it has its
   *  own control in the Tunnel section. Default off — the grid is clutter behind
   *  a dense overlay. */
  gridVisible = $state(false);
  effect = $state<TunnelConfig["effect"]>("none");

  presets = $state<TunnelPreset[]>([]);

  #sources: TunnelControllerSources;
  #layers = $state<SequenceData[]>([]);
  #buildToken = 0;

  constructor(sources: TunnelControllerSources) {
    this.#sources = sources;
    this.presets = loadTunnelPresets();

    // Rebuild the overlaid layers whenever the topology (sequence/fold/mirror)
    // changes. Effect/transport changes do NOT rebuild — they are per-frame.
    $effect(() => {
      const seq = this.#sources.getSequence();
      const fold = this.fold;
      const mirror = this.mirror;
      const on = this.active;
      if (!on || !seq) {
        this.#layers = [];
        return;
      }
      const token = ++this.#buildToken;
      void buildTunnelLayers(seq, { fold, mirror, effect: this.effect }).then((layers) => {
        if (token === this.#buildToken) this.#layers = layers;
      });
    });
  }

  /** Cap fold under reduced-motion (8/4 -> 2). */
  setFold(fold: Fold): void {
    this.fold = prefersReducedMotion() ? 2 : fold;
  }

  /** Uniform all-layer effect map. undefined when effect is "none". */
  tipEffectMap = $derived<TipEffectMap | undefined>(
    !this.active || this.effect === "none"
      ? undefined
      : { "*": { effect: this.effect } },
  );

  /** True when the current config is in the expensive zone (heavy effect on a
   *  large stack). Advisory — the strip can warn; not a hard cap. */
  heavyLoad = $derived(
    this.active &&
      TunnelViewController.HEAVY_EFFECTS.has(this.effect) &&
      (this.fold === 8 || this.mirror),
  );

  /** Base (un-rotated) sequence prop states at the playhead — the center pair
   *  of the kaleidoscope. currentStep is 1-indexed fractional (start < 1). */
  basePropsAt(currentStep: number): { blue: PropState; red: PropState } {
    const seq = this.#sources.getSequence();
    if (!seq) return { blue: { ...DEFAULT_PROP_STATE }, red: { ...DEFAULT_PROP_STATE } };
    return this.#propsFor(seq, currentStep);
  }

  /** Per-layer prop states at the live playhead. 1-indexed fractional currentStep. */
  additionalLayersAt(currentStep: number): AdditionalLayerProps[] {
    if (!this.active) return [];
    return this.#layers.map((seq) => {
      const p = this.#propsFor(seq, currentStep);
      return { blueProp: p.blue, redProp: p.red };
    });
  }

  #propsFor(
    seq: SequenceData,
    currentStep: number,
  ): { blue: PropState; red: PropState } {
    const steps = seq.steps ?? [];
    if (steps.length === 0) {
      return { blue: { ...DEFAULT_PROP_STATE }, red: { ...DEFAULT_PROP_STATE } };
    }
    const { idx, progress } = stepToIndexProgress(currentStep, steps.length);
    const step = steps[idx];
    if (!step) return { blue: { ...DEFAULT_PROP_STATE }, red: { ...DEFAULT_PROP_STATE } };
    // Honor the global Effort preset so the sidebar's Effort section shapes the
    // tunnel's motion — same easing the 2D engine applies to step progress
    // (sequence-animation-orchestrator). Base + all layers share this currentStep,
    // so they stay in sync.
    const easedProgress = applyEffort(
      getAnimationVisibilityManager().getEffortPreset(),
      progress,
    );
    const r = interpolatePropAngles(step, easedProgress);
    return {
      blue: r.isValid ? (r.blueAngles ?? { ...DEFAULT_PROP_STATE }) : { ...DEFAULT_PROP_STATE },
      red: r.isValid ? (r.redAngles ?? { ...DEFAULT_PROP_STATE }) : { ...DEFAULT_PROP_STATE },
    };
  }

  // ── Presets ──────────────────────────────────────────────────
  saveCurrentAs(name: string): void {
    const trimmed = name.trim() || `Look ${this.presets.length + 1}`;
    const preset: TunnelPreset = {
      id: `${trimmed}-${this.presets.length}-${Math.floor(performance.now())}`,
      name: trimmed,
      config: { fold: this.fold, mirror: this.mirror, effect: this.effect },
    };
    this.presets = [...this.presets, preset];
    saveTunnelPresets(this.presets);
  }

  applyPreset(p: TunnelPreset): void {
    this.effect = p.config.effect;
    this.setFold(p.config.fold);
    this.mirror = p.config.mirror;
  }

  deletePreset(id: string): void {
    this.presets = this.presets.filter((p) => p.id !== id);
    saveTunnelPresets(this.presets);
  }
}
