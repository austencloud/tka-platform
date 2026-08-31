import type { PlaybackMode } from "$lib/shared/animation-engine/state/animation-panel-state.svelte";
import {
  PLAYBACK_MAX_BPM,
  PLAYBACK_MIN_BPM,
} from "$lib/shared/animation-engine/domain/constants/timing";
import type { AnimationSettingsState } from "$lib/shared/animation-engine/state/animation-settings-state.svelte";
import type { AnimationVisibilityStateManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
import type { EffectsConfigState } from "$lib/shared/effects/state/effects-config-state.svelte";
import {
  captureTunnelSnapshot,
  applyTunnelSnapshot,
  SNAPSHOT_VERSION,
  type SnapshotDeps,
  type TunnelSnapshot,
} from "$lib/shared/sequence-viewer/tunnel/tunnel-snapshot";
import {
  DEFAULT_CONFIG,
  type TunnelConfig,
} from "$lib/shared/sequence-viewer/tunnel/tunnel-config";
import type { TunnelViewController } from "$lib/shared/sequence-viewer/tunnel/tunnel-view-controller.svelte";
import { DEFAULT_TUNNEL_CUSTOM_PROP_COLORS } from "$lib/shared/sequence-viewer/tunnel/tunnel-prop-colors";
import type {
  ChiralityHand,
  PropChiralitySeam,
} from "$lib/shared/settings/components/tabs/prop-type/prop-chirality-seam";

interface TunnelPresentationInputs {
  initialSnapshot?: TunnelSnapshot | null;
  initialFormation?: TunnelConfig;
  effects: EffectsConfigState;
  visibility: AnimationVisibilityStateManager;
  animationSettings: AnimationSettingsState;
  initialBluePropType: string;
  initialRedPropType: string;
  initialBlueBuugengFlipped: boolean;
  initialRedBuugengFlipped: boolean;
}

const clone = <T>(value: T): T => {
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value)) as T;
  }
};

/**
 * Tunnel-local presentation document. It adapts the existing control owners to
 * the snapshot boundary without allowing the creator to mutate global viewer
 * preferences while the user experiments.
 */
export function createTunnelPresentationState(
  inputs: TunnelPresentationInputs
) {
  const initialSnapshot = inputs.initialSnapshot
    ? clone(inputs.initialSnapshot)
    : null;
  let controller = $state<TunnelViewController | null>(null);
  let bpm = $state(initialSnapshot?.playback.bpm ?? 60);
  let playbackMode = $state<PlaybackMode>(
    initialSnapshot?.playback.playbackMode ?? "continuous"
  );
  let playing = $state(true);
  let bluePropType = $state(
    initialSnapshot?.props.bluePropType ?? inputs.initialBluePropType
  );
  let redPropType = $state(
    initialSnapshot?.props.redPropType ?? inputs.initialRedPropType
  );
  let blueBuugengFlipped = $state(
    initialSnapshot?.props.blueBuugengFlipped ??
      inputs.initialBlueBuugengFlipped
  );
  let redBuugengFlipped = $state(
    initialSnapshot?.props.redBuugengFlipped ?? inputs.initialRedBuugengFlipped
  );
  let unattachedTunnel = $state({
    config: clone(
      initialSnapshot?.tunnel.config ??
        inputs.initialFormation ??
        DEFAULT_CONFIG
    ),
    gridVisible: initialSnapshot?.tunnel.gridVisible ?? false,
    // New Tunnel choreography starts with the pictograph pair. Saved snapshots
    // still win exactly, including migrated Spectrum and authored Custom pairs.
    colors: clone(
      initialSnapshot?.tunnel.colors ?? {
        mode: "hands" as const,
        custom: DEFAULT_TUNNEL_CUSTOM_PROP_COLORS,
      }
    ),
    section: initialSnapshot?.tunnel.section ?? ("tunnel" as const),
    presetRecipe: clone(initialSnapshot?.tunnel.presetRecipe ?? null),
  });

  const propSettings: SnapshotDeps["settings"] = {
    get bluePropType() {
      return bluePropType;
    },
    get redPropType() {
      return redPropType;
    },
    get blueBuugengFlipped() {
      return blueBuugengFlipped;
    },
    get redBuugengFlipped() {
      return redBuugengFlipped;
    },
    updateSettings(patch) {
      if (patch.bluePropType !== undefined) bluePropType = patch.bluePropType;
      if (patch.redPropType !== undefined) redPropType = patch.redPropType;
      if (patch.blueBuugengFlipped !== undefined) {
        blueBuugengFlipped = patch.blueBuugengFlipped;
      }
      if (patch.redBuugengFlipped !== undefined) {
        redBuugengFlipped = patch.redBuugengFlipped;
      }
    },
  };

  const playback: SnapshotDeps["playback"] = {
    handleBpmChange(value) {
      bpm = value;
    },
    handlePlaybackModeChange(mode) {
      playbackMode = mode;
    },
  };

  function snapshotDeps(liveController: TunnelViewController): SnapshotDeps {
    return {
      controller: liveController,
      effects: inputs.effects,
      visibility: inputs.visibility,
      settings: propSettings,
      animationSettings: inputs.animationSettings,
      playback,
      animationPanel: {
        get playbackMode() {
          return playbackMode;
        },
      },
      getBpm: () => bpm,
    };
  }

  // The scoped owners exist before the stage controller mounts. Restore their
  // portions immediately so every settings panel opens on the saved values.
  if (initialSnapshot) {
    inputs.effects.replace(initialSnapshot.effects);
    inputs.visibility.setEffortPreset(initialSnapshot.effort);
    inputs.visibility.setPathPolicy({
      pathShape: initialSnapshot.paths.pathShape,
      motionAwarePaths: initialSnapshot.paths.motionAwarePaths,
    });
    inputs.visibility.setVisibility(
      "bluePathLines",
      initialSnapshot.paths.bluePathLines
    );
    inputs.visibility.setVisibility(
      "redPathLines",
      initialSnapshot.paths.redPathLines
    );
    inputs.animationSettings.updateSettings({
      trail: clone(initialSnapshot.trailRender),
    });
  }

  function attachController(next: TunnelViewController): void {
    controller = next;
    if (initialSnapshot) {
      applyTunnelSnapshot(snapshotDeps(next), initialSnapshot);
    } else {
      next.applyConfig(unattachedTunnel.config, unattachedTunnel.presetRecipe);
      next.gridVisible = unattachedTunnel.gridVisible;
      next.colors = unattachedTunnel.colors;
      next.section = unattachedTunnel.section;
    }
    unattachedTunnel = {
      config: clone(next.config),
      gridVisible: next.gridVisible,
      colors: next.colors,
      section: next.section,
      presetRecipe: clone(next.presetRecipe),
    };
  }

  function capture(): TunnelSnapshot {
    if (controller) {
      const snapshot = captureTunnelSnapshot(snapshotDeps(controller));
      unattachedTunnel = clone(snapshot.tunnel);
      return snapshot;
    }

    return {
      version: SNAPSHOT_VERSION,
      tunnel: clone(unattachedTunnel),
      effects: clone(inputs.effects.config),
      effort: inputs.visibility.getEffortPreset(),
      paths: {
        pathShape: inputs.visibility.getPathShape(),
        motionAwarePaths: inputs.visibility.getMotionAwarePaths(),
        bluePathLines: inputs.visibility.getVisibility("bluePathLines"),
        redPathLines: inputs.visibility.getVisibility("redPathLines"),
      },
      playback: { bpm, playbackMode },
      props: {
        bluePropType,
        redPropType,
        blueBuugengFlipped,
        redBuugengFlipped,
      },
      trailRender: clone(inputs.animationSettings.trail),
    };
  }

  return {
    get bpm() {
      return bpm;
    },
    get playbackMode() {
      return playbackMode;
    },
    get playing() {
      return playing;
    },
    get bluePropType() {
      return bluePropType;
    },
    get redPropType() {
      return redPropType;
    },
    get blueBuugengFlipped() {
      return blueBuugengFlipped;
    },
    get redBuugengFlipped() {
      return redBuugengFlipped;
    },
    get chirality(): PropChiralitySeam {
      const handState = (hand: ChiralityHand) => ({
        hand,
        get flipped() {
          return hand === "blue" ? blueBuugengFlipped : redBuugengFlipped;
        },
      });
      return {
        hands: [handState("blue"), handState("red")],
        onChange(hand, flipped) {
          if (hand === "blue") blueBuugengFlipped = flipped;
          else redBuugengFlipped = flipped;
        },
      };
    },
    get effects() {
      return inputs.effects;
    },
    get visibility() {
      return inputs.visibility;
    },
    get animationSettings() {
      return inputs.animationSettings;
    },
    attachController,
    capture,
    setBpm(value: number) {
      bpm = Math.max(
        PLAYBACK_MIN_BPM,
        Math.min(PLAYBACK_MAX_BPM, Math.round(value))
      );
    },
    setPlaybackMode(mode: PlaybackMode) {
      playbackMode = mode;
    },
    setPlaying(value: boolean) {
      playing = value;
    },
    togglePlaying() {
      playing = !playing;
    },
    setPropType(propType: string) {
      bluePropType = propType;
      redPropType = propType;
      inputs.animationSettings.setCurrentPropType(propType);
    },
  };
}

export type TunnelPresentationState = ReturnType<
  typeof createTunnelPresentationState
>;
