<script lang="ts">
  // Test harness for the Download Animation panel rebuilt on the shared
  // ControlDock shell (single mandala-style bar instead of pill grid + giant
  // CTA). Renders the REAL AnimationPanel with the real export state, effects
  // context, and visibility manager — only the hero is a placeholder, since
  // this page exercises the chrome, not the animation engine.
  import AnimationPanel from "$lib/shared/animation-panel/components/AnimationPanel.svelte";
  import { getExportOptionsState } from "$lib/shared/animation-panel/state/export-options-state.svelte";
  import { createEffectsConfigState } from "$lib/shared/effects/state/effects-config-state.svelte";
  import { setEffectsConfigContext } from "$lib/shared/effects/state/effects-config-context";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import type { PlaybackMode } from "$lib/shared/animation-engine/state/animation-panel-state.svelte";

  // Provide the same context the real viewer orchestrator sets up so the
  // Effects tab body renders fully.
  setEffectsConfigContext(createEffectsConfigState());

  const exportOptions = getExportOptionsState();

  // ── Live-ish props the panel reads ──
  let bpm = $state(120);
  let isPlaying = $state(false);
  let playbackMode = $state<PlaybackMode>("continuous");
  let selectedPropType = $state<PropType>(PropType.STAFF);
  let isExporting = $state(false);

  // Simulate an export so the busy / progress state is visible.
  let exportTimer: ReturnType<typeof setTimeout> | undefined;
  function fakeExport() {
    if (isExporting) return;
    isExporting = true;
    exportTimer = setTimeout(() => (isExporting = false), 1800);
  }
  function cancelExport() {
    clearTimeout(exportTimer);
    isExporting = false;
  }

  // ── Device presets (iPhone SE = tightest, default) ──
  type Device = { id: string; label: string; w: number; h: number };
  const DEVICES: Device[] = [
    { id: "se", label: "iPhone SE", w: 375, h: 667 },
    { id: "i15", label: "iPhone 15", w: 393, h: 852 },
    { id: "pixel", label: "Pixel 7", w: 412, h: 915 },
    { id: "desktop", label: "Desktop", w: 1100, h: 720 },
  ];
  let deviceId = $state("se");
  const device = $derived(DEVICES.find((d) => d.id === deviceId) ?? DEVICES[0]!);
  const isDesktop = $derived(device.w >= 700);
</script>

<div class="page">
  <header class="harness">
    <div class="title">Download Animation · ControlDock</div>
    <div class="seg device-seg">
      {#each DEVICES as d}
        <button class:active={deviceId === d.id} onclick={() => (deviceId = d.id)}>{d.label}</button>
      {/each}
    </div>
  </header>

  <div
    class="phone"
    style:width="{device.w + 24}px"
    style:height="min({device.h + 24}px, calc(100vh - 6rem))"
  >
    <div class="screen">
      {#if isDesktop}
        <div class="viewer row">
          <div class="hero"><div class="ring" aria-hidden="true"></div><span class="hero-tag">animation hero</span></div>
          <div class="sidebar-slot">
            <AnimationPanel
              {exportOptions}
              {isExporting}
              canvasReady
              layout="sidebar"
              singlePlayDuration={2}
              {bpm}
              {isPlaying}
              renderMode="2d"
              {playbackMode}
              {selectedPropType}
              onPropChange={(p) => (selectedPropType = p)}
              onBpmChange={(v) => (bpm = v)}
              onPlaybackToggle={() => (isPlaying = !isPlaying)}
              onPlaybackModeChange={(m) => (playbackMode = m)}
              onExport={fakeExport}
              onCancel={cancelExport}
            />
          </div>
        </div>
      {:else}
        <div class="viewer col">
          <div class="hero"><div class="ring" aria-hidden="true"></div><span class="hero-tag">animation hero</span></div>
          <AnimationPanel
            {exportOptions}
            {isExporting}
            canvasReady
            layout="bottom"
            singlePlayDuration={2}
            {bpm}
            {isPlaying}
            renderMode="2d"
            {playbackMode}
            {selectedPropType}
            onPropChange={(p) => (selectedPropType = p)}
            onBpmChange={(v) => (bpm = v)}
            onPlaybackToggle={() => (isPlaying = !isPlaying)}
            onPlaybackModeChange={(m) => (playbackMode = m)}
            onExport={fakeExport}
            onCancel={cancelExport}
          />
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .page {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    background: #07070f;
    color: #e2e8f0;
  }
  .harness {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
  }
  .title { font-size: 0.85rem; font-weight: 600; opacity: 0.7; }
  .seg {
    display: flex;
    gap: 1px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    padding: 3px;
  }
  .seg button {
    padding: 0.35rem 0.7rem;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: inherit;
    cursor: pointer;
    opacity: 0.55;
    font-size: 0.72rem;
  }
  .seg button.active { background: rgba(99, 102, 241, 0.25); opacity: 1; }

  .phone {
    max-width: 100%;
    border-radius: 44px;
    padding: 12px;
    background: #15151f;
    box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.06), 0 30px 80px rgba(0, 0, 0, 0.6);
    transition: width 320ms cubic-bezier(0.2, 0.8, 0.2, 1), height 320ms cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  .screen {
    position: relative;
    width: 100%;
    height: 100%;
    border-radius: 32px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    background: radial-gradient(120% 90% at 50% 16%, #1a1a2e 0%, #0c0c14 60%, #08080e 100%);
  }

  .viewer { position: relative; flex: 1; min-height: 0; display: flex; }
  .viewer.col { flex-direction: column; }
  .viewer.row { flex-direction: row; }

  .hero {
    flex: 1;
    min-height: 0;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .ring {
    width: 46%;
    aspect-ratio: 1;
    max-width: 200px;
    border-radius: 50%;
    border: 2px solid rgba(99, 102, 241, 0.35);
    box-shadow: 0 0 60px 10px rgba(99, 102, 241, 0.22), inset 0 0 40px rgba(99, 102, 241, 0.16);
    position: relative;
    animation: spin 9s linear infinite;
  }
  .ring::before, .ring::after {
    content: "";
    position: absolute;
    inset: 22px;
    border-radius: 50%;
    border: 2px solid rgba(120, 200, 255, 0.3);
  }
  .ring::after { inset: 46px; border-color: rgba(255, 140, 180, 0.35); }
  @keyframes spin { to { transform: rotate(360deg); } }
  .hero-tag {
    position: absolute;
    bottom: 10px;
    left: 50%;
    transform: translateX(-50%);
    color: rgba(255, 255, 255, 0.35);
    font-size: 10px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .sidebar-slot {
    flex: 0 0 360px;
    max-width: 360px;
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  @media (prefers-reduced-motion: reduce) {
    .phone { transition: none !important; }
    .ring { animation: none !important; }
  }
</style>
