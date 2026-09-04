import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { PropState } from "$lib/shared/foundation/domain/types/prop-state";
import type { AdditionalLayerProps } from "$lib/shared/animation-engine/domain/types/trail-capture-types";
import { applyEffort } from "$lib/shared/effort/domain/effort-easing-unified";
import {
  getAnimationVisibilityManager,
  type AnimationVisibilityStateManager,
} from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
import {
  buildTunnelCompositionLayers,
  type BuiltTunnelLayer,
} from "./tunnel-layer-builder";
import { sampleTunnelProps } from "./tunnel-prop-sampling";
import {
  DEFAULT_CONFIG,
  MAX_IMAGES,
  MAX_IMAGES_RM,
  clampConfig,
  configKey,
  copyModulators,
  effectiveSpeed,
  getPreset,
  imageCount,
  matchPreset,
  propCount,
  speedFill,
  type SpeedFill,
  type TunnelConfig,
} from "./tunnel-config";
import {
  builtInTunnelPresetRecipe,
  cloneTunnelPresetRecipe,
  isTunnelPresetRecipeModified,
  savedTunnelPresetRecipe,
  type TunnelPresetRecipe,
} from "./tunnel-preset-recipe";
import { performerRing } from "./performer-ring-model";
import {
  activeTunnelPropColorPair,
  resolveTunnelPropColorState,
  tunnelPropColor,
  type TunnelPropColorMode,
  type TunnelPropColorPair,
  type TunnelPropColorState,
} from "./tunnel-prop-colors";
import { getBaseMotionColors } from "$lib/shared/animation-engine/services/svg-generator";
import {
  createIndependentTunnelPerformer,
  createTunnelComposition,
  tunnelLayerCycleSteps,
  type TunnelComposition,
} from "./tunnel-composition";
import {
  loadTunnelViewState,
  saveTunnelViewState,
  type TunnelViewState,
} from "./tunnel-view-state";
import {
  consumeStagedViewerCustomColors,
  ensureViewerCustomColorPreference,
  loadViewerCustomColorPreference,
  saveViewerCustomColorPreference,
} from "../services/viewer-custom-color-preferences";
import {
  createViewerCustomColorState,
  type ViewerCustomColorState,
} from "../state/viewer-custom-colors-state.svelte";

const DEFAULT_PROP_STATE: PropState = {
  centerPathAngle: 0,
  staffRotationAngle: 0,
};

export interface TunnelControllerSources {
  /** The viewer's currently open sequence. */
  getSequence: () => SequenceData | null | undefined;
  /** An authored cast. Absent keeps the classic one-sequence tunnel path. */
  getComposition?: () => TunnelComposition | null | undefined;
  /** Receives the exact baked layer objects used by the animation canvas. */
  onLayersChange?: (layers: readonly BuiltTunnelLayer[]) => void;
  /** Scoped effort owner for embedded editors. Defaults to the global viewer. */
  visibilityManager?: AnimationVisibilityStateManager;
  /** Embedded editors must not rewrite the viewer's last-used view state. */
  persistViewState?: boolean;
  /** A URL-seeded view state (the `tn` slice). Takes the place of
   *  `loadTunnelViewState()` entirely so a shared link's kaleidoscope never
   *  reads the recipient's disk. Callers that pass this SHOULD also pass
   *  `persistViewState: false` — the seam only replaces the read; it does not
   *  itself suppress the write. */
  initialViewState?: TunnelViewState;
  /** A parent-scoped pair shared with another art controller. */
  customColorState?: ViewerCustomColorState;
  /** Keep a viewer's formation baked while 2D is showing so returning to
   * Tunnel can reverse the existing reveal instead of rebuilding in public. */
  prepareWhileInactive?: boolean;
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
  /** Alternate arms motion-invert (opposite spin). */
  invert = $state<boolean>(DEFAULT_CONFIG.invert);
  /** Alternate arms run time-reversed. */
  echo = $state<boolean>(DEFAULT_CONFIG.echo);
  /** Arm k shows the sequence offset by k×this steps (0 = off). */
  staggerSteps = $state<number>(DEFAULT_CONFIG.staggerSteps);
  /** Per-performer speed overrides (arm 1..n → multiplier); absent arm = 1×. The
   *  single source of truth for speed (fills just populate it). */
  speedOverrides = $state<Record<number, number>>({
    ...DEFAULT_CONFIG.speedOverrides,
  });
  /** The performer selected in the Speed drawer (0 = you, 1..n = copies), or null.
   *  Transient UI focus — NOT part of the config/persistence; drives the sidebar
   *  highlight + the render spotlight-dim. */
  selectedArm = $state<number | null>(null);
  /** The authored card selected in the creator. Every formation arm driven by
   * that stable performer ID stays bright together. This is workspace focus,
   * not saved choreography or presentation state. */
  selectedPerformerId = $state<string | null>(null);

  /** Tunnel-specific grid visibility. The kaleidoscope owns this (the global
   *  Visual/Display toggles don't reach the self-clocked tunnel). Default off —
   *  the grid is clutter behind a dense overlay. */
  gridVisible = $state(false);

  /** One explicit appearance mode plus the last authored exact pair. Keeping
   * the pair while another mode is active lets authors compare looks without
   * losing their values. */
  colorMode = $state<TunnelPropColorMode>("spectrum");
  readonly customColorState: ViewerCustomColorState;

  get customPropColors(): TunnelPropColorPair {
    return this.customColorState.colors;
  }

  get colors(): TunnelPropColorState {
    return {
      mode: this.colorMode,
      custom: { ...this.customPropColors },
    };
  }

  set colors(value: TunnelPropColorState) {
    const resolved = resolveTunnelPropColorState(value);
    this.colorMode = resolved.mode;
    this.customColorState.hydrate(resolved.custom);
  }

  /** Compatibility for older preview/test callers. New Tunnel authoring code
   * uses `colorMode` so Custom cannot be collapsed into a boolean. */
  get spectrum(): boolean {
    return this.colorMode === "spectrum";
  }

  set spectrum(value: boolean) {
    this.colorMode = value ? "spectrum" : "hands";
  }

  get exactPropColors(): TunnelPropColorPair | null {
    return activeTunnelPropColorPair({
      mode: this.colorMode,
      custom: this.customPropColors,
    });
  }

  setCustomPropColor(hand: "left" | "right", value: string): void {
    this.customColorState.setColor(hand, value);
  }

  /** Active rail section in the Art settings panel, persisted with the view
   *  state so the panel reopens on the section the user last used. */
  section = $state<TunnelViewState["section"]>("tunnel");
  /** Recipe provenance stays attached while the values are edited. It describes
   * the configuration only; it never authors extra choreography performers. */
  presetRecipe = $state<TunnelPresetRecipe | null>(null);
  /** Transient Look-panel disclosure. It is not saved choreography or a global
   * preference; the controller only keeps it stable across panel remounts. */
  lookEditorOpen = $state(false);

  #sources: TunnelControllerSources;
  #layers = $state<BuiltTunnelLayer[]>([]);
  #layersReady = $state(false);
  #buildToken = 0;
  buildError = $state<string | null>(null);

  constructor(sources: TunnelControllerSources) {
    this.#sources = sources;

    // Restore the last-left config before any effect wires up, clamped to the
    // live budget (a persisted dense ring shrinks under reduced motion). A
    // `tn`-slice seed replaces the disk read outright — never merged with it —
    // so a shared link never picks up the recipient's own leftover state.
    const view = sources.initialViewState ?? loadTunnelViewState();
    const persistViewState = sources.persistViewState ?? true;
    if (sources.customColorState) {
      this.customColorState = sources.customColorState;
    } else {
      const stagedColors = consumeStagedViewerCustomColors();
      const preferenceColors = persistViewState
        ? ensureViewerCustomColorPreference()
        : loadViewerCustomColorPreference(undefined, false);
      this.customColorState = createViewerCustomColorState(
        stagedColors ?? preferenceColors,
        persistViewState ? saveViewerCustomColorPreference : undefined
      );
    }
    if (sources.initialViewState && !sources.customColorState) {
      // A seeded link carries the sender's exact pair; the freshly built
      // (non-saving, given persistViewState:false) custom-color state must
      // show it instead of the recipient's preference. A caller-supplied
      // shared state is never overwritten from a seed.
      this.customColorState.hydrate(sources.initialViewState.colors.custom);
    }
    const requestedConfig =
      sources.getComposition?.()?.formation ?? view.config;
    const cfg = clampConfig(requestedConfig, this.#maxImages());
    this.fold = cfg.fold;
    this.mirror = cfg.mirror;
    this.flip = cfg.flip;
    this.invert = cfg.invert;
    this.echo = cfg.echo;
    this.staggerSteps = cfg.staggerSteps;
    this.speedOverrides = { ...cfg.speedOverrides };
    this.gridVisible = view.gridVisible;
    this.colorMode = view.colors.mode;
    this.section = view.section;
    this.presetRecipe = cloneTunnelPresetRecipe(view.presetRecipe);

    // Persist the live view state on change.
    if (persistViewState) {
      $effect(() => {
        const snapshot: TunnelViewState = {
          config: this.config,
          gridVisible: this.gridVisible,
          colors: this.colors,
          section: this.section,
          presetRecipe: this.presetRecipe,
        };
        saveTunnelViewState(snapshot);
      });
    }

    // Drop a stale spotlight when the cast shrinks (e.g. fold 8 → 2) so a
    // dangling selectedArm can't dim every performer at once.
    $effect(() => {
      if (this.selectedArm != null && this.selectedArm >= this.performerCount) {
        this.selectedArm = null;
      }
      if (
        this.selectedPerformerId &&
        this.#layers.length > 0 &&
        !this.#layers.some(
          (layer) => layer.performerId === this.selectedPerformerId
        )
      ) {
        this.selectedPerformerId = null;
      }
    });

    // Re-bake the overlaid copies when the SPATIAL topology changes (sequence /
    // fold / mirror / flip / invert / echo). Stagger + Speed are read ONLY in
    // the sample path (copyModulators), so tweaking them never lands here and
    // never re-runs the transforms. Transport changes never rebuild either.
    $effect(() => {
      const seq = this.#sources.getSequence();
      const authored = this.#sources.getComposition?.() ?? null;
      const spatial: TunnelConfig = {
        fold: this.fold,
        mirror: this.mirror,
        flip: this.flip,
        invert: this.invert,
        echo: this.echo,
        staggerSteps: 0,
        speedOverrides: {},
      };
      const shouldPrepare = this.#sources.prepareWhileInactive
        ? true
        : this.active;
      if (!shouldPrepare || !seq) {
        this.#layers = [];
        this.#layersReady = false;
        this.#sources.onLayersChange?.([]);
        this.buildError = null;
        return;
      }
      const composition =
        authored ??
        createTunnelComposition(
          [createIndependentTunnelPerformer(seq, 0, "You")],
          {
            id: `viewer-${seq.id}`,
            name: seq.name || seq.word || "Untitled sequence",
            formation: spatial,
          }
        );
      const token = ++this.#buildToken;
      this.#layersReady = false;
      void buildTunnelCompositionLayers(composition, spatial)
        .then((layers) => {
          if (token !== this.#buildToken) return;
          this.#layers = layers;
          this.#layersReady = true;
          this.#sources.onLayersChange?.(layers);
          this.buildError = null;
        })
        .catch((error) => {
          if (token !== this.#buildToken) return;
          this.#layers = [];
          this.#layersReady = false;
          this.#sources.onLayersChange?.([]);
          this.buildError =
            error instanceof Error
              ? error.message
              : "The tunnel could not be built.";
        });
    });
  }

  /** A reveal may start only after every copy has a sampled layer. Otherwise
   * the completed build joins an already-visible canvas as a one-frame pop. */
  get layersReady(): boolean {
    return this.#layersReady;
  }

  /** The live config as a plain object (for propCount / persistence / key). */
  get config(): TunnelConfig {
    return {
      fold: this.fold,
      mirror: this.mirror,
      flip: this.flip,
      invert: this.invert,
      echo: this.echo,
      staggerSteps: this.staggerSteps,
      speedOverrides: { ...this.speedOverrides },
    };
  }

  /** On-screen prop count for the live config. */
  propCount = $derived(propCount(this.config));

  /** Number of performers (rendered copies) for the live config. Each performer
   *  has two hands, so `propCount === performerCount * 2`. */
  performerCount = $derived(imageCount(this.config));

  /** Number of authored performers that must fit into the current formation. */
  get authoredPerformerCount(): number {
    return this.#sources.getComposition?.()?.performers.length ?? 1;
  }

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
    const longest = this.#layers.reduce(
      (max, layer) => Math.max(max, layer.sequence.steps.length),
      this.#sources.getSequence()?.steps?.length ?? 1
    );
    return Math.max(0, longest - 1);
  }

  /** Image budget for the live dock (reduced motion tightens it). */
  #maxImages(): number {
    return prefersReducedMotion() ? MAX_IMAGES_RM : MAX_IMAGES;
  }

  /** The selected mandala preset id, or null when the config is a custom tweak
   *  (drives the Presets surface highlight + the "Custom" card). */
  activePresetId = $derived(matchPreset(this.config));

  presetRecipeModified = $derived(
    isTunnelPresetRecipeModified(this.presetRecipe, this.config)
  );

  /** Set the whole config (clamped to the live budget). */
  #setConfig(cfg: TunnelConfig): boolean {
    const c = clampConfig(cfg, this.#maxImages());
    if (imageCount(c) < this.authoredPerformerCount) return false;
    this.fold = c.fold;
    this.mirror = c.mirror;
    this.flip = c.flip;
    this.invert = c.invert;
    this.echo = c.echo;
    this.staggerSteps = c.staggerSteps;
    this.speedOverrides = { ...c.speedOverrides };
    return true;
  }

  /** Select a curated built-in mandala preset (the primary surface). */
  applyPreset(id: string): void {
    const p = getPreset(id);
    const recipe = builtInTunnelPresetRecipe(id);
    if (p && recipe && this.#setConfig(p.config)) this.presetRecipe = recipe;
  }

  /** Apply a raw config. Snapshot restore supplies its retained recipe; a raw
   * edit deliberately keeps the existing recipe origin and becomes modified. */
  applyConfig(
    cfg: TunnelConfig,
    recipe: TunnelPresetRecipe | null | undefined = undefined
  ): void {
    if (this.#setConfig(cfg) && recipe !== undefined) {
      this.presetRecipe = cloneTunnelPresetRecipe(recipe);
    }
  }

  applyUserPreset(id: string, name: string, config: TunnelConfig): void {
    if (this.#setConfig(config)) {
      this.presetRecipe = savedTunnelPresetRecipe(id, name, config);
    }
  }

  resetPresetRecipe(): void {
    if (!this.presetRecipe) return;
    this.#setConfig(this.presetRecipe.config);
  }

  /** Apply a generator change (fold/mirror/flip) clamped to the live budget so a
   *  dense combo can't exceed the perf ceiling. The prop-count readout makes any
   *  clamp visible — no silent lie. */
  #applyGenerators(
    next: Partial<Pick<TunnelConfig, "fold" | "mirror" | "flip">>
  ): void {
    const clamped = clampConfig({ ...this.config, ...next }, this.#maxImages());
    if (imageCount(clamped) < this.authoredPerformerCount) return;
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
  setInvert(on: boolean): void {
    this.invert = on;
  }
  setEcho(on: boolean): void {
    this.echo = on;
  }
  /** Apply a one-tap speed fill — writes concrete per-performer overrides across
   *  the current copies (the drawer then shows + edits them). */
  applySpeedFill(kind: SpeedFill): void {
    this.speedOverrides = speedFill(kind, imageCount(this.config));
  }
  /** Pin one performer's speed (arm 0 = base "you", 1..n = copies). Setting 1×
   *  clears the override so the map stays minimal. Immutable update so `$derived`
   *  consumers re-run. */
  setPerformerSpeed(arm: number, rate: number): void {
    if (arm < 0) return;
    const next = { ...this.speedOverrides };
    if (rate === 1) delete next[arm];
    else next[arm] = rate;
    this.speedOverrides = next;
  }
  /** Back to every copy at 1× and clear the selection. */
  resetSpeed(): void {
    this.speedOverrides = {};
    this.selectedArm = null;
    this.selectedPerformerId = null;
  }
  /** True when any performer runs at a non-1× rate (drives the Reset affordance). */
  hasSpeedOverrides = $derived(Object.keys(this.speedOverrides).length > 0);
  /** Steps on the shared clock before every independently looping performer
   *  returns to its starting phase. */
  loopSteps = $derived.by(() => {
    if (this.#layers.length === 0) {
      return Math.max(1, this.#sources.getSequence()?.steps.length ?? 1);
    }
    const mods = copyModulators(this.config);
    return tunnelLayerCycleSteps(
      this.#layers.map((layer, arm) => ({
        sequence: layer.sequence,
        speed:
          layer.speed *
          (arm === 0
            ? effectiveSpeed(this.config, 0)
            : (mods[arm - 1]?.speed ?? 1)),
      }))
    );
  });

  /** Base loops the shared playhead must span before every performer returns to
   *  its home phase together. Retained for the settings and export consumers
   *  that describe duration in base-sequence loops. */
  loopCycles = $derived.by(() => {
    const baseSteps = Math.max(
      1,
      this.#layers[0]?.sequence.steps.length ??
        this.#sources.getSequence()?.steps.length ??
        1
    );
    return Math.max(1, Math.ceil(this.loopSteps / baseSteps));
  });
  /** Toggle the spotlight selection for a performer (click again to clear). */
  selectPerformer(arm: number): void {
    this.selectedPerformerId = null;
    this.selectedArm = this.selectedArm === arm ? null : arm;
  }
  /** Select one authored card without pretending its generated formation arms
   * are additional authored performers. */
  selectAuthoredPerformer(performerId: string | null): void {
    this.selectedArm = null;
    this.selectedPerformerId =
      performerId && performerId !== this.selectedPerformerId
        ? performerId
        : null;
  }
  spotlightLayers = $derived.by(() => {
    if (!this.selectedPerformerId) return this.selectedArm;
    return this.#layers.flatMap((layer, arm) =>
      layer.performerId === this.selectedPerformerId ? [arm] : []
    );
  });
  /** Per-performer speed rows for the Speed drawer, in the same overlay order as
   *  the Performer Ring: index 0 = the base "you" (locked 1×), 1..n = the copies
   *  (arm k). Its swatches describe the actual stage props: spectrum hues when
   *  that authored appearance is active, otherwise the pictograph blue/red pair. */
  speedPerformers = $derived.by(() => {
    const cfg = this.config;
    const layerCount = Math.max(0, imageCount(cfg) - 1);
    const handColors = getBaseMotionColors();
    const exactColors = this.exactPropColors;
    return performerRing(cfg).map((_p, i) => ({
      arm: i,
      label: this.#layers[i]?.performerLabel ?? (i === 0 ? "You" : `Copy ${i}`),
      rate: effectiveSpeed(cfg, i),
      leftHex: exactColors
        ? exactColors.left
        : i === 0 || !this.spectrum
          ? handColors.left
          : tunnelPropColor(i * 2, layerCount).hex,
      rightHex: exactColors
        ? exactColors.right
        : i === 0 || !this.spectrum
          ? handColors.right
          : tunnelPropColor(i * 2 + 1, layerCount).hex,
    }));
  });
  /** Set the canon offset, clamped to the sequence (the sampler also wraps). */
  setStagger(steps: number): void {
    this.staggerSteps = Math.max(0, Math.min(steps, this.staggerMax));
  }

  /** True when the live config is a large stack — advisory (a heavy effect may
   *  drop frames on weaker devices); not a hard cap. */
  heavyLoad = $derived(
    this.active &&
      propCount(this.config) >= TunnelViewController.LARGE_STACK_PROPS
  );

  /** Honor the global Effort preset so the sidebar's Effort section shapes the
   *  tunnel's motion — same easing the 2D engine applies to step progress. */
  #ease = (progress: number): number =>
    applyEffort(
      (
        this.#sources.visibilityManager ?? getAnimationVisibilityManager()
      ).getEffortPreset(),
      progress
    );

  /** Base (un-transformed) sequence prop states at the playhead — the center
   *  pair of the kaleidoscope. currentStep is 1-indexed fractional (start < 1). */
  basePropsAt(currentStep: number): { left: PropState; right: PropState } {
    const layer = this.#layers[0];
    const seq = layer?.sequence ?? this.#sources.getSequence();
    if (!seq)
      return {
        left: { ...DEFAULT_PROP_STATE },
        right: { ...DEFAULT_PROP_STATE },
      };
    const baseSpeed = (layer?.speed ?? 1) * (this.speedOverrides[0] ?? 1);
    return sampleTunnelProps(
      seq,
      currentStep,
      this.#ease,
      layer?.stepOffset ?? 0,
      baseSpeed
    );
  }

  /** Per-copy prop states at the live playhead, each shifted by its Stagger +
   *  Speed modulator. 1-indexed fractional currentStep. The modulators align
   *  index-for-index with the baked layers (same generation order). */
  additionalLayersAt(currentStep: number): AdditionalLayerProps[] {
    if (!this.active) return [];
    const mods = copyModulators(this.config);
    return this.#layers.slice(1).map((layer, i) => {
      const m = mods[i] ?? { staggerSteps: 0, speed: 1 };
      const p = sampleTunnelProps(
        layer.sequence,
        currentStep,
        this.#ease,
        layer.stepOffset + m.staggerSteps,
        layer.speed * m.speed
      );
      // Every copy inherits the viewer's global prop — a layer carries no explicit
      // per-hand prop type, so the engine falls back to the global prop (the same
      // rule the center pair uses). The `AdditionalLayerProps` per-layer prop-type
      // fields stay optional/unused: the shared additional-layers plumbing keeps
      // them for other callers, but the tunnel never sets them.
      return {
        leftProp: p.left,
        rightProp: p.right,
      } satisfies AdditionalLayerProps;
    });
  }
}
