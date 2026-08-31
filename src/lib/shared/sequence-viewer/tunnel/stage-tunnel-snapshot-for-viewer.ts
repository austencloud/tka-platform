import { animationSettings } from "$lib/shared/animation-engine/state/animation-settings-state.svelte";
import {
  getAnimationVisibilityManager,
  type AnimationVisibilityStateManager,
} from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
import { EFFECTS_CONFIG_STORAGE_KEY } from "$lib/shared/effects/state/effects-config-state.svelte";
import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import { settingsService } from "$lib/shared/settings/state/settings-state.svelte";
import { saveTunnelViewState } from "./tunnel-view-state";
import type { TunnelSnapshot } from "./tunnel-snapshot";

export interface TunnelViewerStagingDependencies {
  visibility: AnimationVisibilityStateManager;
  animationSettings: typeof animationSettings;
  settings: Pick<typeof settingsService, "updateSettings">;
  saveViewState: typeof saveTunnelViewState;
  storage: Pick<Storage, "setItem"> | null;
}

function defaultDependencies(): TunnelViewerStagingDependencies {
  return {
    visibility: getAnimationVisibilityManager(),
    animationSettings,
    settings: settingsService,
    saveViewState: saveTunnelViewState,
    storage: typeof localStorage === "undefined" ? null : localStorage,
  };
}

/**
 * Stage a saved tunnel into the existing viewer's canonical persistence seams.
 * The overlay mounts its controller and effects state after this synchronous
 * handoff, so those per-mount owners boot from the values written here.
 */
export function stageTunnelSnapshotForViewer(
  snapshot: TunnelSnapshot,
  dependencies: TunnelViewerStagingDependencies = defaultDependencies()
): void {
  const { visibility, animationSettings, settings, saveViewState, storage } =
    dependencies;

  visibility.setEffortPreset(snapshot.effort);
  visibility.setPathPolicy({
    pathShape: snapshot.paths.pathShape,
    motionAwarePaths: snapshot.paths.motionAwarePaths,
  });
  visibility.setVisibility("bluePathLines", snapshot.paths.bluePathLines);
  visibility.setVisibility("redPathLines", snapshot.paths.redPathLines);
  animationSettings.updateSettings({ trail: snapshot.trailRender });
  void settings.updateSettings({
    bluePropType: snapshot.props.bluePropType as PropType,
    redPropType: snapshot.props.redPropType as PropType,
    ...(snapshot.props.blueBuugengFlipped !== undefined
      ? { blueBuugengFlipped: snapshot.props.blueBuugengFlipped }
      : {}),
    ...(snapshot.props.redBuugengFlipped !== undefined
      ? { redBuugengFlipped: snapshot.props.redBuugengFlipped }
      : {}),
  });

  saveViewState({
    config: snapshot.tunnel.config,
    gridVisible: snapshot.tunnel.gridVisible,
    colors: snapshot.tunnel.colors,
    section: snapshot.tunnel.section,
    presetRecipe: snapshot.tunnel.presetRecipe ?? null,
  });

  if (!storage) return;
  try {
    storage.setItem(
      EFFECTS_CONFIG_STORAGE_KEY,
      JSON.stringify(snapshot.effects)
    );
  } catch {
    // Storage may be unavailable. The live viewer can still open, but its
    // per-mount effects owner will retain the previous persisted config.
  }
}
