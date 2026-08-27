import { z } from "zod";
import type { TunnelConfig } from "./tunnel-config";
import type { TunnelViewState } from "./tunnel-view-state";
import type { EffectsConfig } from "$lib/shared/effects/domain/effects-config";
import type { EffortId } from "$lib/shared/effort/domain/effort-types";
import type { TrailSettings } from "$lib/shared/animation-engine/domain/types/trail-types";
import type { PlaybackMode } from "$lib/shared/animation-engine/state/animation-panel-state.svelte";

export const SNAPSHOT_VERSION = 1;

type TunnelSection = TunnelViewState["section"];
type PathShape = "arc" | "linear" | "concave";

/** The complete, JSON-serializable reproduction state of a live tunnel. Trail
 *  visuals ride inside `effects.trails`, so they are not double-stored. */
export interface TunnelSnapshot {
  version: number;
  tunnel: {
    config: TunnelConfig;
    gridVisible: boolean;
    spectrum: boolean;
    section: TunnelSection;
  };
  effects: EffectsConfig;
  effort: EffortId;
  paths: {
    pathShape: PathShape;
    motionAwarePaths: boolean;
    bluePathLines: boolean;
    redPathLines: boolean;
  };
  playback: { bpm: number; playbackMode: PlaybackMode };
  props: {
    bluePropType: string;
    redPropType: string;
    /** Optional only for snapshots saved before creator draft v4. */
    blueBuugengFlipped?: boolean;
    redBuugengFlipped?: boolean;
  };
  trailRender: TrailSettings;
}

// TunnelConfig / EffectsConfig / TrailSettings are large, internally-validated
// shapes; the boundary schema guards the envelope + enums and passes the deep
// blobs through as `z.any()` (same pattern mandala uses for nested StepData).
export const TunnelSnapshotSchema = z.object({
  version: z.number(),
  tunnel: z.object({
    config: z.any(),
    gridVisible: z.boolean(),
    spectrum: z.boolean(),
    section: z.enum([
      "tunnel",
      "props",
      "speed",
      "effects",
      "effort",
      "playback",
    ]),
  }),
  effects: z.any(),
  effort: z.string(),
  paths: z.object({
    pathShape: z.enum(["arc", "linear", "concave"]),
    motionAwarePaths: z.boolean(),
    bluePathLines: z.boolean(),
    redPathLines: z.boolean(),
  }),
  playback: z.object({
    bpm: z.number(),
    playbackMode: z.enum(["continuous", "step"]),
  }),
  props: z.object({
    bluePropType: z.string(),
    redPropType: z.string(),
    blueBuugengFlipped: z.boolean().optional(),
    redBuugengFlipped: z.boolean().optional(),
  }),
  trailRender: z.any(),
});

import type { TunnelViewController } from "./tunnel-view-controller.svelte";
import type { EffectsConfigState } from "$lib/shared/effects/state/effects-config-state.svelte";
import type { AnimationVisibilityStateManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
import type { AnimationSettingsState } from "$lib/shared/animation-engine/state/animation-settings-state.svelte";

/** Everything capture/apply needs, passed in by the caller (no ambient store
 *  access) so the module is testable in isolation. */
export interface SnapshotDeps {
  controller: TunnelViewController;
  effects: EffectsConfigState;
  visibility: AnimationVisibilityStateManager;
  settings: {
    bluePropType: string;
    redPropType: string;
    blueBuugengFlipped?: boolean;
    redBuugengFlipped?: boolean;
    updateSettings: (p: {
      bluePropType?: string;
      redPropType?: string;
      blueBuugengFlipped?: boolean;
      redBuugengFlipped?: boolean;
    }) => unknown;
  };
  animationSettings: AnimationSettingsState;
  playback: {
    handleBpmChange: (bpm: number) => void;
    handlePlaybackModeChange: (mode: PlaybackMode) => void;
  };
  animationPanel: { playbackMode: PlaybackMode };
  getBpm: () => number;
}

const clone = <T>(v: T): T => {
  try {
    return structuredClone(v);
  } catch {
    return JSON.parse(JSON.stringify(v));
  }
};

export function captureTunnelSnapshot(deps: SnapshotDeps): TunnelSnapshot {
  const {
    controller,
    effects,
    visibility,
    settings,
    animationSettings,
    animationPanel,
    getBpm,
  } = deps;
  return {
    version: SNAPSHOT_VERSION,
    tunnel: {
      config: clone(controller.config),
      gridVisible: controller.gridVisible,
      spectrum: controller.spectrum,
      section: controller.section,
    },
    effects: clone(effects.config),
    effort: visibility.getEffortPreset(),
    paths: {
      pathShape: visibility.getPathShape(),
      motionAwarePaths: visibility.getMotionAwarePaths(),
      bluePathLines: visibility.getVisibility("bluePathLines"),
      redPathLines: visibility.getVisibility("redPathLines"),
    },
    playback: { bpm: getBpm(), playbackMode: animationPanel.playbackMode },
    props: {
      bluePropType: settings.bluePropType,
      redPropType: settings.redPropType,
      blueBuugengFlipped: settings.blueBuugengFlipped ?? false,
      redBuugengFlipped: settings.redBuugengFlipped ?? false,
    },
    trailRender: clone(animationSettings.trail),
  };
}

export function applyTunnelSnapshot(
  deps: SnapshotDeps,
  snap: TunnelSnapshot
): void {
  const {
    controller,
    effects,
    visibility,
    settings,
    animationSettings,
    playback,
  } = deps;

  // Tunnel topology + chrome (applyConfig clamps to the live budget; grid/spectrum/
  // section are public $state fields on the controller).
  controller.applyConfig(snap.tunnel.config);
  controller.gridVisible = snap.tunnel.gridVisible;
  controller.spectrum = snap.tunnel.spectrum;
  controller.section = snap.tunnel.section;

  // Effects (its own capture/restore pair).
  effects.replace(snap.effects);

  // Effort + paths (global visibility manager).
  visibility.setEffortPreset(snap.effort);
  visibility.setPathShape(snap.paths.pathShape);
  visibility.setMotionAwarePaths(snap.paths.motionAwarePaths);
  visibility.setVisibility("bluePathLines", snap.paths.bluePathLines);
  visibility.setVisibility("redPathLines", snap.paths.redPathLines);

  // Trail render params (bulk trail set).
  animationSettings.updateSettings({ trail: snap.trailRender });

  // Playback (mode first, then bpm ramp).
  playback.handlePlaybackModeChange(snap.playback.playbackMode);
  playback.handleBpmChange(snap.playback.bpm);

  // Prop types.
  settings.updateSettings({
    bluePropType: snap.props.bluePropType,
    redPropType: snap.props.redPropType,
    ...(snap.props.blueBuugengFlipped !== undefined
      ? { blueBuugengFlipped: snap.props.blueBuugengFlipped }
      : {}),
    ...(snap.props.redBuugengFlipped !== undefined
      ? { redBuugengFlipped: snap.props.redBuugengFlipped }
      : {}),
  });
}
