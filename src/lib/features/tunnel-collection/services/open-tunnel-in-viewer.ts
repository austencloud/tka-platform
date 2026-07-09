import type { CollectedTunnel } from "../domain/tunnel-collection-types";
import {
  createSequenceData,
  type SequenceData,
} from "$lib/shared/foundation/domain/models/sequence-data";
import { openSequenceOverlay } from "$lib/shared/sequence-viewer/state/sequence-viewer-overlay-state.svelte";
import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
import { animationSettings } from "$lib/shared/animation-engine/state/animation-settings-state.svelte";
import { settingsService } from "$lib/shared/settings/state/settings-state.svelte";
import { saveTunnelViewState } from "$lib/shared/sequence-viewer/tunnel/tunnel-view-state";
import { persistViewerMode } from "$lib/shared/sequence-viewer/services/viewer-state-persistence";
import { EFFECTS_CONFIG_STORAGE_KEY } from "$lib/shared/effects/state/effects-config-state.svelte";
import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";

/**
 * Reproduce a saved tunnel in the real sequence viewer: apply the snapshot's
 * global/persisted state, then open the viewer overlay with its sequence. The
 * viewer boots showing the exact saved tunnel. Export is done from the viewer
 * (its existing Export button); this action deliberately does NOT auto-export.
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
 */
export function openTunnelInViewer(tunnel: CollectedTunnel): void {
  const snap = tunnel.snapshot;

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
      localStorage.setItem(EFFECTS_CONFIG_STORAGE_KEY, JSON.stringify(snap.effects));
    } catch {
      // quota exceeded / private browsing — the viewer still opens; it just
      // boots with the user's existing effects config instead of the saved one.
    }
  }

  // 4. Viewer mode → tunnel. A fresh createViewerState() reads this key via
  //    loadViewerMode() ('tunnel' is a valid persisted ViewerMode).
  persistViewerMode("tunnel");

  // 5. Build a SequenceData from the saved steps and open. The steps were
  //    captured from a live, already-hydrated viewer sequence, so each carries
  //    motions.blue/red — the orchestrator's hydrateSequence short-circuits on
  //    hasMotionData() and uses these steps verbatim (no re-derivation from the
  //    compositional fields the collection doesn't store). gridMode is recovered
  //    from the steps so the correct grid renders.
  const sequence: SequenceData = createSequenceData({
    id: tunnel.id,
    name: tunnel.name,
    word: tunnel.name,
    steps: [...tunnel.steps],
    gridMode: tunnel.steps.find((s) => s.gridMode)?.gridMode,
  });

  openSequenceOverlay(sequence, { initialBpm: snap.playback.bpm });
}
