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
  tunnel: { config: TunnelConfig; gridVisible: boolean; spectrum: boolean; section: TunnelSection };
  effects: EffectsConfig;
  effort: EffortId;
  paths: { pathShape: PathShape; motionAwarePaths: boolean; bluePathLines: boolean; redPathLines: boolean };
  playback: { bpm: number; playbackMode: PlaybackMode };
  props: { bluePropType: string; redPropType: string };
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
    section: z.enum(["tunnel", "speed", "effects", "effort", "playback"]),
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
  props: z.object({ bluePropType: z.string(), redPropType: z.string() }),
  trailRender: z.any(),
});
