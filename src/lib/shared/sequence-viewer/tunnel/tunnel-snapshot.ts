import { z } from "zod";
import type { TunnelConfig } from "./tunnel-config";
import type { TunnelViewState } from "./tunnel-view-state";
import type { EffectsConfig } from "$lib/shared/effects/domain/effects-config";
import type { EffortId } from "$lib/shared/effort/domain/effort-types";
import type { TrailSettings } from "$lib/shared/animation-engine/domain/types/trail-types";
import type { PlaybackMode } from "$lib/shared/animation-engine/state/animation-panel-state.svelte";
import type { TunnelPresetRecipe } from "./tunnel-preset-recipe";
import type { TunnelComposition, TunnelSaveTarget } from "./tunnel-composition";
import {
  resolveTunnelPropColorState,
  type TunnelPropColorState,
} from "./tunnel-prop-colors";

export const SNAPSHOT_VERSION = 3;

type TunnelSection = TunnelViewState["section"];
type PathShape = "arc" | "linear" | "concave";

/** The complete, JSON-serializable reproduction state of a live tunnel. Trail
 *  visuals ride inside `effects.trails`, so they are not double-stored. */
export interface TunnelSnapshot {
  version: number;
  tunnel: {
    config: TunnelConfig;
    gridVisible: boolean;
    colors: TunnelPropColorState;
    section: TunnelSection;
    /** Preserves which recipe the author started from without treating generated
     * copies as authored choreography. Null is honest for old/custom work. */
    presetRecipe: TunnelPresetRecipe | null;
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

export interface TunnelSaveReceipt {
  target: TunnelSaveTarget;
  composition: TunnelComposition | null;
  snapshot: TunnelSnapshot;
}

export type TunnelSavedCallback = (receipt: TunnelSaveReceipt) => void;

// TunnelConfig / EffectsConfig / TrailSettings are large, internally-validated
// shapes; the boundary schema guards the envelope + enums and passes the deep
// blobs through as `z.any()` (same pattern mandala uses for nested StepData).
const RawTunnelSnapshotSchema = z
  .object({
    version: z.number(),
    tunnel: z.object({
      config: z.any(),
      gridVisible: z.boolean(),
      colors: z
        .object({
          mode: z.enum(["hands", "spectrum", "custom"]),
          custom: z.object({ blue: z.string(), red: z.string() }),
        })
        .optional(),
      spectrum: z.boolean().optional(),
      section: z.enum([
        "tunnel",
        "props",
        "speed",
        "effects",
        "effort",
        "playback",
      ]),
      presetRecipe: z.any().optional(),
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
  })
  .refine(
    (snapshot) =>
      snapshot.tunnel.colors !== undefined ||
      snapshot.tunnel.spectrum !== undefined,
    { message: "Tunnel snapshot requires colors or legacy spectrum state" }
  );

export const TunnelSnapshotSchema = RawTunnelSnapshotSchema.transform(
  (snapshot) => migrateTunnelSnapshot(snapshot as LegacyTunnelSnapshot)
);

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
      colors: controller.colors,
      section: controller.section,
      presetRecipe: controller.presetRecipe,
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

  // Tunnel topology + chrome (applyConfig clamps to the live budget; grid,
  // colors, and section are public reactive fields on the controller).
  controller.applyConfig(snap.tunnel.config, snap.tunnel.presetRecipe ?? null);
  controller.gridVisible = snap.tunnel.gridVisible;
  controller.colors = snap.tunnel.colors;
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

interface LegacyTunnelSnapshot extends Omit<TunnelSnapshot, "tunnel"> {
  tunnel: Omit<TunnelSnapshot["tunnel"], "colors"> & {
    colors?: unknown;
    spectrum?: boolean;
  };
}

/** Converts earlier snapshot shapes without changing their performed look.
 * Version 1 gains honest null recipe provenance; version 2's spectrum boolean
 * becomes the explicit color mode. Exact values are normalized on every read. */
export function migrateTunnelSnapshot(
  snapshot: TunnelSnapshot | LegacyTunnelSnapshot
): TunnelSnapshot {
  const legacySpectrum =
    "spectrum" in snapshot.tunnel ? snapshot.tunnel.spectrum : undefined;
  const {
    spectrum: _legacySpectrum,
    colors,
    ...tunnel
  } = snapshot.tunnel as LegacyTunnelSnapshot["tunnel"];
  const resolvedColors = resolveTunnelPropColorState(colors, legacySpectrum);
  if (
    snapshot.version >= SNAPSHOT_VERSION &&
    !("spectrum" in snapshot.tunnel) &&
    "presetRecipe" in snapshot.tunnel &&
    snapshot.tunnel.colors.mode === resolvedColors.mode &&
    snapshot.tunnel.colors.custom.blue === resolvedColors.custom.blue &&
    snapshot.tunnel.colors.custom.red === resolvedColors.custom.red
  ) {
    return snapshot as TunnelSnapshot;
  }
  return {
    ...snapshot,
    version: SNAPSHOT_VERSION,
    tunnel: {
      ...tunnel,
      colors: resolvedColors,
      presetRecipe:
        "presetRecipe" in snapshot.tunnel
          ? (snapshot.tunnel.presetRecipe ?? null)
          : null,
    },
  };
}
