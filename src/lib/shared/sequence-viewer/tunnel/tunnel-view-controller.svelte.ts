import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { PropState } from "$lib/shared/foundation/domain/types/prop-state";
import type { AdditionalLayerProps } from "$lib/shared/animation-engine/domain/types/trail-capture-types";
import { applyEffort } from "$lib/shared/effort/domain/effort-easing-unified";
import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
import { buildTunnelLayers } from "./tunnel-layer-builder";
import { sampleTunnelProps } from "./tunnel-prop-sampling";
import {
  DEFAULT_CONFIG,
  MAX_IMAGES,
  MAX_IMAGES_RM,
  clampConfig,
  configKey,
  copyModulators,
  getPreset,
  matchPreset,
  propCount,
  type TunnelConfig,
} from "./tunnel-config";
import {
  loadTunnelViewState,
  saveTunnelViewState,
  type TunnelViewState,
} from "./tunnel-view-state";

const DEFAULT_PROP_STATE: PropState = { centerPathAngle: 0, staffRotationAngle: 0 };

export interface TunnelControllerSources {
  /** The viewer's currently open sequence. */
  getSequence: () => SequenceData | null | undefined;
}

/** Reduced motion caps a dense ring so a heavy kaleidoscope doesn't spin for
 *  users who asked for less motion. */
function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export class TunnelViewController {
  /** Prop count at/above which a config is a "large stack" (advisory frame-drop
   *  warning). */
  static readonly LARGE_STACK_PROPS = 16;

  // Tunnel sub-mode on/off (speed + play/pause ride the pane's existing transport).
  active = $state(false);

  // ── Primitive config (individual fields so the rebuild effect can depend on
  //    the SPATIAL primitives only — stagger/speed tweaks never re-bake). ──
  /** Rotational arms (cyclic order). */
  fold = $state<number>(DEFAULT_CONFIG.fold);
  /** Reflect across the vertical axis (dihedral). */
  mirror = $state<boolean>(DEFAULT_CONFIG.mirror);
  /** Reflect across the horizontal axis (N↔S). */
  flip = $state<boolean>(DEFAULT_CONFIG.flip);
  /** Alternate arms motion-invert (counter-rotate). */
  counter = $state<boolean>(DEFAULT_CONFIG.counter);
  /** Alternate arms run time-reversed. */
  echo = $state<boolean>(DEFAULT_CONFIG.echo);
  /** Arm k shows the sequence offset by k×this steps (0 = off). */
  staggerSteps = $state<number>(DEFAULT_CONFIG.staggerSteps);
  /** Alternate arms traverse at ½× / 2×. */
  speed = $state<boolean>(DEFAULT_CONFIG.speed);

  /** Tunnel-specific grid visibility. The kaleidoscope owns this (the global
   *  Visual/Display toggles don't reach the self-clocked tunnel). Default off —
   *  the grid is clutter behind a dense overlay. */
  gridVisible = $state(false);

  /** Per-prop rainbow spectrum coloring. On (default) = every copy takes its own
   *  spectrum color; off = layers inherit the base/preset colors so the Effects
   *  panel's colors drive every prop. Persisted with the view state. */
  spectrum = $state(true);

  /** Active rail section in the Art settings panel, persisted with the view
   *  state so the panel reopens on the section the user last used. */
  section = $state<TunnelViewState["section"]>("tunnel");

  #sources: TunnelControllerSources;
  #layers = $state<SequenceData[]>([]);
  #buildToken = 0;

  constructor(sources: TunnelControllerSources) {
    this.#sources = sources;

    // Restore the last-left config before any effect wires up, clamped to the
    // live budget (a persisted dense ring shrinks under reduced motion).
    const view = loadTunnelViewState();
    const cfg = clampConfig(view.config, this.#maxImages());
    this.fold = cfg.fold;
    this.mirror = cfg.mirror;
    this.flip = cfg.flip;
    this.counter = cfg.counter;
    this.echo = cfg.echo;
    this.staggerSteps = cfg.staggerSteps;
    this.speed = cfg.speed;
    this.gridVisible = view.gridVisible;
    this.spectrum = view.spectrum;
    this.section = view.section;

    // Persist the live view state on change.
    $effect(() => {
      const snapshot: TunnelViewState = {
        config: this.config,
        gridVisible: this.gridVisible,
        spectrum: this.spectrum,
        section: this.section,
      };
      saveTunnelViewState(snapshot);
    });

    // Re-bake the overlaid copies when the SPATIAL topology changes (sequence /
    // fold / mirror / flip / counter / echo). Stagger + Speed are read ONLY in
    // the sample path (copyModulators), so tweaking them never lands here and
    // never re-runs the transforms. Transport changes never rebuild either.
    $effect(() => {
      const seq = this.#sources.getSequence();
      const spatial: TunnelConfig = {
        fold: this.fold,
        mirror: this.mirror,
        flip: this.flip,
        counter: this.counter,
        echo: this.echo,
        staggerSteps: 0,
        speed: false,
      };
      const on = this.active;
      if (!on || !seq) {
        this.#layers = [];
        return;
      }
      const token = ++this.#buildToken;
      void buildTunnelLayers(seq, spatial).then((layers) => {
        if (token === this.#buildToken) this.#layers = layers;
      });
    });
  }

  /** The live config as a plain object (for propCount / persistence / key). */
  get config(): TunnelConfig {
    return {
      fold: this.fold,
      mirror: this.mirror,
      flip: this.flip,
      counter: this.counter,
      echo: this.echo,
      staggerSteps: this.staggerSteps,
      speed: this.speed,
    };
  }

  /** On-screen prop count for the live config. */
  propCount = $derived(propCount(this.config));

  /** Stable signature (export filename suffix + build dedup). */
  configKey = $derived(configKey(this.config));

  /** Compat shim: ArtPane reads `activeLook.id` for the export-filename suffix.
   *  The named-look era is gone; the config signature is the stable key now.
   *  TODO: migrate ArtPane to `controller.configKey` and delete this. */
  get activeLook(): { id: string } {
    return { id: this.configKey };
  }

  /** Largest stagger offset that reads on the current sequence (its length − 1;
   *  a full-length offset wraps back to 0). A getter (not a `$derived` field) so
   *  it doesn't touch `#sources` during field initialization; still reactive when
   *  read in a template/derived because it reads the reactive sequence. */
  get staggerMax(): number {
    return Math.max(0, (this.#sources.getSequence()?.steps?.length ?? 1) - 1);
  }

  /** Image budget for the live dock (reduced motion tightens it). */
  #maxImages(): number {
    return prefersReducedMotion() ? MAX_IMAGES_RM : MAX_IMAGES;
  }

  /** The selected mandala preset id, or null when the config is a custom tweak
   *  (drives the Presets surface highlight + the "Custom" card). */
  activePresetId = $derived(matchPreset(this.config));

  /** Set the whole config (clamped to the live budget). */
  #setConfig(cfg: TunnelConfig): void {
    const c = clampConfig(cfg, this.#maxImages());
    this.fold = c.fold;
    this.mirror = c.mirror;
    this.flip = c.flip;
    this.counter = c.counter;
    this.echo = c.echo;
    this.staggerSteps = c.staggerSteps;
    this.speed = c.speed;
  }

  /** Select a curated mandala preset (the primary surface). */
  applyPreset(id: string): void {
    const p = getPreset(id);
    if (p) this.#setConfig(p.config);
  }

  /** Apply a generator change (fold/mirror/flip) clamped to the live budget so a
   *  dense combo can't exceed the perf ceiling. The prop-count readout makes any
   *  clamp visible — no silent lie. */
  #applyGenerators(next: Partial<Pick<TunnelConfig, "fold" | "mirror" | "flip">>): void {
    const clamped = clampConfig({ ...this.config, ...next }, this.#maxImages());
    this.fold = clamped.fold;
    this.mirror = clamped.mirror;
    this.flip = clamped.flip;
  }

  setFold(fold: number): void {
    this.#applyGenerators({ fold });
  }
  setMirror(on: boolean): void {
    this.#applyGenerators({ mirror: on });
  }
  setFlip(on: boolean): void {
    this.#applyGenerators({ flip: on });
  }

  // Modulators add no copies, so they never clamp.
  setCounter(on: boolean): void {
    this.counter = on;
  }
  setEcho(on: boolean): void {
    this.echo = on;
  }
  setSpeed(on: boolean): void {
    this.speed = on;
  }
  /** Set the canon offset, clamped to the sequence (the sampler also wraps). */
  setStagger(steps: number): void {
    this.staggerSteps = Math.max(0, Math.min(steps, this.staggerMax));
  }

  /** True when the live config is a large stack — advisory (a heavy effect may
   *  drop frames on weaker devices); not a hard cap. */
  heavyLoad = $derived(
    this.active && propCount(this.config) >= TunnelViewController.LARGE_STACK_PROPS,
  );

  /** Honor the global Effort preset so the sidebar's Effort section shapes the
   *  tunnel's motion — same easing the 2D engine applies to step progress. */
  #ease = (progress: number): number =>
    applyEffort(getAnimationVisibilityManager().getEffortPreset(), progress);

  /** Base (un-transformed) sequence prop states at the playhead — the center
   *  pair of the kaleidoscope. currentStep is 1-indexed fractional (start < 1). */
  basePropsAt(currentStep: number): { blue: PropState; red: PropState } {
    const seq = this.#sources.getSequence();
    if (!seq) return { blue: { ...DEFAULT_PROP_STATE }, red: { ...DEFAULT_PROP_STATE } };
    return sampleTunnelProps(seq, currentStep, this.#ease);
  }

  /** Per-copy prop states at the live playhead, each shifted by its Stagger +
   *  Speed modulator. 1-indexed fractional currentStep. The modulators align
   *  index-for-index with the baked layers (same generation order). */
  additionalLayersAt(currentStep: number): AdditionalLayerProps[] {
    if (!this.active) return [];
    const mods = copyModulators(this.config);
    return this.#layers.map((seq, i) => {
      const m = mods[i] ?? { staggerSteps: 0, speed: 1 };
      const p = sampleTunnelProps(seq, currentStep, this.#ease, m.staggerSteps, m.speed);
      return { blueProp: p.blue, redProp: p.red };
    });
  }
}
