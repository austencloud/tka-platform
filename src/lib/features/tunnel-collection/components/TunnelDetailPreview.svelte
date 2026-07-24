<!--
  TunnelDetailPreview.svelte — a live, in-page reproduction of a saved tunnel.

  Mounts the real kaleidoscope renderer (TunnelArtView) with a fully per-instance
  seam: a local TunnelViewController seeded from the saved config, and a local
  effects-config context built with persist:false so it never touches the user's
  global effects. TunnelArtView also reads three GLOBAL singletons that can't be
  passed as props (effort preset, path shapes, and the legacy trail settings) — so
  we sandbox those: capture the live values on mount, apply the snapshot's, and
  restore on destroy. Merely previewing a saved tunnel must not mutate the user's
  live viewer state.

  The controller itself persists its view state to localStorage via an internal
  $effect, so we also capture/restore that key around this preview's lifetime —
  otherwise browsing the collection would silently overwrite the tunnel config the
  real viewer boots with.
-->
<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import TunnelArtView from "$lib/shared/sequence-viewer/tunnel/TunnelArtView.svelte";
  import { TunnelViewController } from "$lib/shared/sequence-viewer/tunnel/tunnel-view-controller.svelte";
  import {
    loadTunnelViewState,
    saveTunnelViewState,
  } from "$lib/shared/sequence-viewer/tunnel/tunnel-view-state";
  import { createEffectsConfigState } from "$lib/shared/effects/state/effects-config-state.svelte";
  import { setEffectsConfigContext } from "$lib/shared/effects/state/effects-config-context";
  import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  import { animationSettings } from "$lib/shared/animation-engine/state/animation-settings-state.svelte";
  import { createSequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import type { ViewerPlaybackState } from "$lib/shared/sequence-viewer/domain/viewer-prop-groups";
  import type { CollectedTunnel } from "../domain/tunnel-collection-types";

  const { tunnel }: { tunnel: CollectedTunnel } = $props();

  // Autoplaying motion needs a user-reachable pause (WCAG 2.2.2) — the viewer
  // has a transport; this gallery preview gets its own toggle.
  let playing = $state(true);
  // Unwrap the $state proxy from the collection store into plain data ONCE —
  // structuredClone (inside createEffectsConfigState) throws DataCloneError on
  // Svelte 5 state proxies, and downstream transforms shouldn't see proxies
  // either. The record is immutable while previewing, so a one-time deep
  // snapshot is safe.
  const data = $state.snapshot(tunnel) as CollectedTunnel;
  const snap = data.snapshot;

  // Capture the pristine persisted tunnel-view state BEFORE constructing the
  // controller (its persist $effect writes this key on every config change).
  const prevTunnelViewState = loadTunnelViewState();

  // Per-instance effects context (NEVER the global; persist:false so it can't read
  // from or write to the shared tka_effects_config key).
  const effects = createEffectsConfigState(snap.effects, { persist: false });
  setEffectsConfigContext(effects);

  // Per-instance tunnel controller seeded from the saved config. gridMode is
  // recovered from the steps so the correct grid renders (same rule the viewer
  // uses). Steps were captured from a hydrated sequence, so they carry motions.
  const sequence = createSequenceData({
    id: data.id,
    name: data.name,
    word: data.name,
    steps: [...data.steps],
    gridMode: data.steps.find((s) => s.gridMode)?.gridMode,
  });
  const controller = new TunnelViewController({ getSequence: () => sequence });
  controller.applyConfig(snap.tunnel.config);
  controller.gridVisible = snap.tunnel.gridVisible;
  controller.spectrum = snap.tunnel.spectrum;
  controller.active = true;

  // Minimal stub playback: TunnelArtView only reads
  // playback.animationState.sequenceData, and falls back to the `sequence` prop
  // when it's undefined — which is exactly what we want here.
  const playback = {
    animationState: { sequenceData: undefined },
  } as unknown as ViewerPlaybackState;

  // Sandbox the three globals TunnelArtView / the controller read (effort, paths,
  // trail): snapshot the live values, apply the saved ones on mount, restore on
  // destroy.
  const vm = getAnimationVisibilityManager();
  const prev = {
    effort: vm.getEffortPreset(),
    pathShape: vm.getPathShape(),
    motionAware: vm.getMotionAwarePaths(),
    blueLines: vm.getVisibility("bluePathLines"),
    redLines: vm.getVisibility("redPathLines"),
    trail: animationSettings.trail,
  };

  onMount(() => {
    vm.setEffortPreset(snap.effort);
    vm.setPathShape(snap.paths.pathShape);
    vm.setMotionAwarePaths(snap.paths.motionAwarePaths);
    vm.setVisibility("bluePathLines", snap.paths.bluePathLines);
    vm.setVisibility("redPathLines", snap.paths.redPathLines);
    animationSettings.updateSettings({ trail: snap.trailRender });
  });

  onDestroy(() => {
    vm.setEffortPreset(prev.effort);
    vm.setPathShape(prev.pathShape);
    vm.setMotionAwarePaths(prev.motionAware);
    vm.setVisibility("bluePathLines", prev.blueLines);
    vm.setVisibility("redPathLines", prev.redLines);
    animationSettings.updateSettings({ trail: prev.trail });
    // Undo the controller's persisted view-state writes.
    saveTunnelViewState(prevTunnelViewState);
  });
</script>

<div class="preview-stage">
  <div class="art" role="img" aria-label="Live animated preview of {data.name}">
    <TunnelArtView
      {sequence}
      {playback}
      {controller}
      bpm={snap.playback.bpm}
      bluePropType={snap.props.bluePropType}
      redPropType={snap.props.redPropType}
      bind:playing
      stageFit="contain"
    />
  </div>
  <button
    type="button"
    class="pause-toggle"
    aria-pressed={!playing}
    aria-label={playing ? "Pause preview" : "Play preview"}
    onclick={() => (playing = !playing)}
  >
    <i class="fas {playing ? 'fa-pause' : 'fa-play'}" aria-hidden="true"></i>
  </button>
</div>

<style>
  .preview-stage {
    position: relative;
    /* Fit the square to BOTH the container's width AND height (100cqmin), so the
       tunnel never clips top/bottom or overflows onto the controls — robust at
       any aspect ratio (tiny phone, Z Fold near-square, 4K). The host
       .detail-preview is `container-type: size`. Replaces max-width:
       min(100%, 80vh), which ignored available height and let the square outgrow
       its slot on short / near-square viewports. */
    width: min(100cqw, 100cqh);
    height: min(100cqw, 100cqh);
    max-width: 100%;
    max-height: 100%;
    background: #000;
    border-radius: 12px;
    overflow: hidden;
    /* Ambient accent glow lifts the stage off the page. */
    box-shadow:
      0 0 0 1px var(--theme-stroke, rgba(255, 255, 255, 0.08)),
      0 12px 60px color-mix(in srgb, var(--theme-accent, #22d3ee) 14%, transparent);
  }

  .art {
    position: absolute;
    inset: 0;
  }

  .pause-toggle {
    position: absolute;
    right: 12px;
    bottom: 12px;
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.55);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    color: rgba(255, 255, 255, 0.85);
    font-size: 14px;
    cursor: pointer;
    backdrop-filter: blur(4px);
    transition: all var(--duration-fast, 150ms) var(--ease-out, ease);
  }
  @media (hover: hover) {
    .pause-toggle:hover {
      background: rgba(0, 0, 0, 0.75);
      border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.3));
      color: white;
    }
  }
  .pause-toggle:focus-visible {
    outline: 2px solid var(--theme-accent, #22d3ee);
    outline-offset: 2px;
  }
  @media (prefers-reduced-motion: reduce) {
    .pause-toggle {
      transition: none;
    }
  }
</style>
