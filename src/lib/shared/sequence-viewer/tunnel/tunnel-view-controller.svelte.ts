import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { PropState } from "$lib/shared/foundation/domain/types/prop-state";
import type { AdditionalLayerProps } from "$lib/shared/animation-engine/domain/types/trail-capture-types";
import { applyEffort } from "$lib/shared/effort/domain/effort-easing-unified";
import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
import { buildTunnelLayers } from "./tunnel-layer-builder";
import { sampleTunnelProps } from "./tunnel-prop-sampling";
import {
  DEFAULT_DENSITY,
  DEFAULT_LOOK_ID,
  getLook,
  propCount,
  REDUCED_MOTION_LOOK_ID,
  REDUCED_MOTION_MAX_PROPS,
  type TunnelLook,
} from "./tunnel-looks";
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

/** Reduced-motion caps a dense look so a heavy kaleidoscope doesn't spin for
 *  users who asked for less motion. */
function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export class TunnelViewController {
  /** Prop count at/above which a look is a "large stack" (advisory frame-drop
   *  warning). */
  static readonly LARGE_STACK_PROPS = 16;

  // Tunnel sub-mode on/off (speed + play/pause ride the pane's existing transport).
  active = $state(false);

  /** Selected look id (see `tunnel-looks.ts`). Initialized from the persisted
   *  view state so the tunnel reopens in the look the user left. */
  lookId = $state<string>(DEFAULT_LOOK_ID);

  /** Arm count for the density-tunable look (Radial). Ignored by fixed looks. */
  density = $state<number>(DEFAULT_DENSITY);

  /** Mirror toggle for a mirrorable density look (Radial) — adds the dihedral
   *  reflection copies (rotational → Mandala-style). Off by default; an explicit,
   *  labeled, opt-in choice (NOT the old hidden always-on multiplier). */
  radialMirror = $state<boolean>(false);

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

    // Restore the last-left look/tuning before any effect wires up.
    const view = loadTunnelViewState();
    this.lookId = view.lookId;
    this.density = view.density;
    this.radialMirror = view.radialMirror;
    this.gridVisible = view.gridVisible;
    this.spectrum = view.spectrum;
    this.section = view.section;

    // Persist the live view state on change.
    $effect(() => {
      const snapshot: TunnelViewState = {
        lookId: this.lookId,
        density: this.density,
        radialMirror: this.radialMirror,
        gridVisible: this.gridVisible,
        spectrum: this.spectrum,
        section: this.section,
      };
      saveTunnelViewState(snapshot);
    });

    // Rebuild the overlaid copies when the topology (sequence / look / density)
    // changes. Spin/phase are per-frame (a rigid rotation of the SAME copies) —
    // they never rebuild. Transport changes never rebuild either.
    $effect(() => {
      const seq = this.#sources.getSequence();
      const look = this.activeLook;
      const density = this.density;
      const mirror = this.radialMirror;
      const on = this.active;
      if (!on || !seq) {
        this.#layers = [];
        return;
      }
      const token = ++this.#buildToken;
      void buildTunnelLayers(seq, look, density, mirror).then((layers) => {
        if (token === this.#buildToken) this.#layers = layers;
      });
    });
  }

  /** The resolved look (falls back to the default if a stale id is persisted). */
  activeLook = $derived<TunnelLook>(getLook(this.lookId) ?? getLook(DEFAULT_LOOK_ID)!);

  /** Whether the active look exposes the Density stepper. */
  hasDensity = $derived(!!this.activeLook.density);

  /** Whether the active look exposes the Mirror toggle. */
  hasMirror = $derived(!!this.activeLook.density?.mirrorable);

  /** Arm-count options for the active look's Density stepper, narrowed to the
   *  mirror-safe range when Mirror is on ([] if fixed). */
  densityOptions = $derived.by<number[]>(() => {
    const d = this.activeLook.density;
    if (!d) return [];
    if (this.radialMirror && d.maxMirrorArms) {
      return d.options.filter((o) => o <= d.maxMirrorArms!);
    }
    return d.options;
  });

  /** Densest arm count allowed for a mirror state, honoring the mirror ceiling
   *  and the reduced-motion prop budget. */
  #maxAllowedDensity(mirror: boolean): number {
    const d = this.activeLook.density;
    if (!d) return this.density;
    let opts = d.options;
    if (mirror && d.maxMirrorArms) opts = opts.filter((o) => o <= d.maxMirrorArms!);
    if (prefersReducedMotion()) {
      opts = opts.filter((o) => propCount(this.activeLook, o, mirror) <= REDUCED_MOTION_MAX_PROPS);
    }
    return opts.length ? Math.max(...opts) : Math.min(...d.options);
  }

  /** Select a look. Under reduced motion, a dense look clamps to a calm one —
   *  the choice is stored clamped (matching the old fold cap), so the highlighted
   *  selection and the rendered kaleidoscope always agree. */
  setLook(id: string): void {
    const look = getLook(id);
    if (!look) return;
    if (
      prefersReducedMotion() &&
      propCount(look, this.density, this.radialMirror) > REDUCED_MOTION_MAX_PROPS
    ) {
      this.lookId = REDUCED_MOTION_LOOK_ID;
      return;
    }
    this.lookId = id;
  }

  /** Set the Radial arm count, clamped to the mirror-safe + reduced-motion max. */
  setDensity(arms: number): void {
    if (!this.activeLook.density) return;
    this.density = Math.min(arms, this.#maxAllowedDensity(this.radialMirror));
  }

  /** Toggle the dihedral Mirror on the active mirrorable look, clamping density
   *  to the mirror-safe max (mirror doubles the copies). */
  setRadialMirror(on: boolean): void {
    if (!this.activeLook.density?.mirrorable) return;
    this.radialMirror = on;
    this.density = Math.min(this.density, this.#maxAllowedDensity(on));
  }

  /** True when the active look is a large stack — advisory (the strip can warn a
   *  heavy effect may drop frames on weaker devices); not a hard cap. */
  heavyLoad = $derived(
    this.active &&
      propCount(this.activeLook, this.density, this.radialMirror) >=
        TunnelViewController.LARGE_STACK_PROPS,
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

  /** Per-copy prop states at the live playhead. 1-indexed fractional currentStep. */
  additionalLayersAt(currentStep: number): AdditionalLayerProps[] {
    if (!this.active) return [];
    return this.#layers.map((seq) => {
      const p = sampleTunnelProps(seq, currentStep, this.#ease);
      return { blueProp: p.blue, redProp: p.red };
    });
  }
}
