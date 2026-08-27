import type { CollectedTunnel } from "../domain/tunnel-collection-types";
import { collectedTunnelSequence } from "../domain/collected-tunnel-source";
import { openSequenceOverlay } from "$lib/shared/sequence-viewer/state/sequence-viewer-overlay-state.svelte";
import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
import { animationSettings } from "$lib/shared/animation-engine/state/animation-settings-state.svelte";
import { settingsService } from "$lib/shared/settings/state/settings-state.svelte";
import { saveTunnelViewState } from "$lib/shared/sequence-viewer/tunnel/tunnel-view-state";
import { persistViewerMode } from "$lib/shared/sequence-viewer/services/viewer-state-persistence";
import { EFFECTS_CONFIG_STORAGE_KEY } from "$lib/shared/effects/state/effects-config-state.svelte";
import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import {
  captureSettingsCheckpoint,
  revertSettingsCheckpoint,
} from "$lib/shared/collections/settings-checkpoint.svelte";
import { showToast } from "$lib/shared/toast/state/toast-state.svelte";
import { closeSequenceOverlay } from "$lib/shared/sequence-viewer/state/sequence-viewer-overlay-state.svelte";

/**
 * Reproduce a saved tunnel in the real sequence viewer: apply the snapshot's
 * global/persisted state, then open the viewer overlay with its sequence. The
 * viewer boots showing the exact saved tunnel. With `autoExport`, an intent
 * flag is seeded so the viewer fires its tunnel video export once ready.
 *
 * Two seam classes are in play, and the ordering below is load-bearing:
 *
 *  - **Live singletons** (visibility manager, animationSettings, settingsService)
 *    are app-wide; setting them here applies immediately and the freshly-mounted
 *    viewer reads the same instances.
 *  - **Per-mount state** (tunnel controller, effects config, viewer mode) is
 *    reconstructed every time the viewer mounts. The viewer overlay is gated by
 *    `{#if overlay.sequence}` in SequenceViewerDrawerHost, so it unmounts on
 *    close and mounts FRESH on open — a fresh `TunnelViewController`
 *    (`loadTunnelViewState`), `createEffectsConfigState({persist:true})`
 *    (`loadStoredConfig` → EFFECTS_CONFIG_STORAGE_KEY), and `createViewerState`
 *    (`loadViewerMode`) each re-read localStorage at construct time. So we
 *    pre-seed those localStorage keys BEFORE calling `openSequenceOverlay`.
 *    `openSequenceOverlay` flips reactive state; the fresh mount runs in a later
 *    microtask, after these synchronous writes have landed.
 *
 * Every one of these writes overwrites settings the user configured for
 * themselves, with no prior warning. So the very first thing this function
 * does is snapshot the pre-apply state (`captureSettingsCheckpoint`), and
 * once the tunnel is open it shows a toast with an Undo button that puts
 * everything back (`revertSettingsCheckpoint`) and closes the viewer this
 * call opened — undoing the whole gesture, not just the settings.
 */
/** Session key: ArtPane consumes this once on mount and auto-fires the tunnel
 *  video export as soon as the playback controller is ready. sessionStorage so
 *  a stray flag can't survive into a later browser session. */
export const TUNNEL_AUTO_EXPORT_INTENT_KEY = "tka_tunnel_auto_export";

export function openTunnelInViewer(
  tunnel: CollectedTunnel,
  options: { autoExport?: boolean } = {}
): void {
  const snap = tunnel.snapshot;

  // First act, before any global gets touched — see the settings-checkpoint
  // paragraph above.
  captureSettingsCheckpoint(tunnel.name);

  if (options.autoExport && typeof sessionStorage !== "undefined") {
    try {
      sessionStorage.setItem(TUNNEL_AUTO_EXPORT_INTENT_KEY, "1");
    } catch {
      // storage unavailable — viewer still opens; user exports manually.
    }
  }

  // 1. Live singletons — effort, path shapes, trail, and prop types apply
  //    directly (mirrors applyTunnelSnapshot's global-visibility writes, which
  //    can't be reused here because that helper is bound to the live tunnel
  //    controller + effects instance that don't exist until the viewer mounts).
  const vm = getAnimationVisibilityManager();
  vm.setEffortPreset(snap.effort);
  vm.setPathShape(snap.paths.pathShape);
  vm.setMotionAwarePaths(snap.paths.motionAwarePaths);
  vm.setVisibility("bluePathLines", snap.paths.bluePathLines);
  vm.setVisibility("redPathLines", snap.paths.redPathLines);
  animationSettings.updateSettings({ trail: snap.trailRender });
  // Snapshot stores prop types as plain strings (PropType enum values); the
  // settings singleton types them as PropType, so cast at this boundary.
  settingsService.updateSettings({
    bluePropType: snap.props.bluePropType as PropType,
    redPropType: snap.props.redPropType as PropType,
  });

  // 2. Tunnel config + chrome — a fresh TunnelViewController reads this key in
  //    its constructor via loadTunnelViewState().
  saveTunnelViewState({
    config: snap.tunnel.config,
    gridVisible: snap.tunnel.gridVisible,
    spectrum: snap.tunnel.spectrum,
    section: snap.tunnel.section,
  });

  // 3. Effects — there is NO app-level effects singleton; every host builds its
  //    own instance via createEffectsConfigState() + context (verified: the
  //    orchestrator/ViewerSplitPane each call the factory, no shared `.replace()`
  //    is reachable pre-mount). The only pre-open seam is the persistence key:
  //    a fresh persist:true instance boots from EFFECTS_CONFIG_STORAGE_KEY, so
  //    write the snapshot's effects there synchronously before opening. The
  //    factory's load path re-runs the (idempotent) migration chain over this
  //    already-current config on next mount.
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(
        EFFECTS_CONFIG_STORAGE_KEY,
        JSON.stringify(snap.effects)
      );
    } catch {
      // quota exceeded / private browsing — the viewer still opens; it just
      // boots with the user's existing effects config instead of the saved one.
    }
  }

  // 4. Viewer mode → tunnel. A fresh createViewerState() reads this key via
  //    loadViewerMode() ('tunnel' is a valid persisted ViewerMode).
  persistViewerMode("tunnel");

  // 5. Rebuild the saved sequence and open. A tunnel with no authored
  //    composition passes `undefined` here and the tunnel controller falls back
  //    to a one-performer cast around this same sequence — see
  //    collected-tunnel-source.ts for why that fallback now has one owner.
  openSequenceOverlay(collectedTunnelSequence(tunnel), {
    initialBpm: snap.playback.bpm,
    tunnelComposition: tunnel.composition,
  });

  showToast({
    message: options.autoExport
      ? `Creating video for "${tunnel.name}"`
      : `Opened "${tunnel.name}" with its saved settings`,
    type: "success",
    duration: 8000,
    action: {
      label: "Undo",
      onClick: () => {
        revertSettingsCheckpoint();
        closeSequenceOverlay();
      },
    },
  });
}
