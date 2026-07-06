import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { PropState } from "$lib/shared/foundation/domain/types/prop-state";
import type { AdditionalLayerProps } from "$lib/shared/animation-engine/domain/types/trail-capture-types";
import { applyEffort } from "$lib/shared/effort/domain/effort-easing-unified";
import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
import { buildTunnelLayers } from "./tunnel-layer-builder";
import { sampleTunnelProps } from "./tunnel-prop-sampling";
import {
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
  /** Prop count at/above which a look is considered a "large stack" (advisory
   *  frame-drop warning). Kaleidoscope + Mandala (16 props) cross it. */
  static readonly LARGE_STACK_PROPS = 16;

  // Tunnel sub-mode on/off (speed + play/pause ride the pane's existing transport).
  active = $state(false);

  /** Selected look id (see `tunnel-looks.ts`). Initialized from the persisted
   *  view state so the tunnel reopens in the look the user left. */
  lookId = $state<string>(DEFAULT_LOOK_ID);

  /** Tunnel-specific grid visibility. The kaleidoscope owns this (the global
   *  Visual/Display toggles don't reach the self-clocked tunnel), so it has its
   *  own control in the Tunnel section. Default off — the grid is clutter behind
   *  a dense overlay. */
  gridVisible = $state(false);

  /** Per-prop rainbow spectrum coloring. On (default) = every kaleidoscope copy
   *  takes its own spectrum color; off = layers inherit the base/preset colors
   *  so the Effects panel's "Choose a Look" / custom trail colors drive every
   *  prop. Persisted with the view state. */
  spectrum = $state(true);

  /** Active rail section in the Art settings panel, persisted with the view
   *  state so the panel reopens on the section the user last used. */
  section = $state<TunnelViewState["section"]>("tunnel");

  #sources: TunnelControllerSources;
  #layers = $state<SequenceData[]>([]);
  #buildToken = 0;

  constructor(sources: TunnelControllerSources) {
    this.#sources = sources;

    // Restore the last-left look (look / grid / spectrum / section) before any
    // effect wires up, so persistence reflects the user's prior session.
    const view = loadTunnelViewState();
    this.lookId = view.lookId;
    this.gridVisible = view.gridVisible;
    this.spectrum = view.spectrum;
    this.section = view.section;

    // Persist the live view state on change.
    $effect(() => {
      const snapshot: TunnelViewState = {
        lookId: this.lookId,
        gridVisible: this.gridVisible,
        spectrum: this.spectrum,
        section: this.section,
      };
      saveTunnelViewState(snapshot);
    });

    // Rebuild the overlaid copies whenever the topology (sequence/look) changes.
    // Transport changes do NOT rebuild — they are per-frame.
    $effect(() => {
      const seq = this.#sources.getSequence();
      const look = this.activeLook;
      const on = this.active;
      if (!on || !seq) {
        this.#layers = [];
        return;
      }
      const token = ++this.#buildToken;
      void buildTunnelLayers(seq, look).then((layers) => {
        if (token === this.#buildToken) this.#layers = layers;
      });
    });
  }

  /** The resolved look (falls back to the default if a stale id is persisted). */
  activeLook = $derived<TunnelLook>(getLook(this.lookId) ?? getLook(DEFAULT_LOOK_ID)!);

  /** Select a look. Under reduced motion, a dense look clamps to a calm one —
   *  the choice is stored clamped (matching the old fold cap), so the highlighted
   *  selection and the rendered kaleidoscope always agree. */
  setLook(id: string): void {
    const look = getLook(id);
    if (
      look &&
      prefersReducedMotion() &&
      propCount(look) > REDUCED_MOTION_MAX_PROPS
    ) {
      this.lookId = REDUCED_MOTION_LOOK_ID;
      return;
    }
    this.lookId = id;
  }

  /** True when the active look is a large stack — advisory (the strip can warn a
   *  heavy effect may drop frames on weaker devices); not a hard cap. */
  heavyLoad = $derived(
    this.active && propCount(this.activeLook) >= TunnelViewController.LARGE_STACK_PROPS,
  );

  /** Honor the global Effort preset so the sidebar's Effort section shapes the
   *  tunnel's motion — same easing the 2D engine applies to step progress. Base
   *  + all layers share this, so they stay in sync. */
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
