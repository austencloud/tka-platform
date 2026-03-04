<!--
  ExportVideoDrawer.svelte

  Video export settings panel.
  Desktop: side panel next to animation preview.
  Mobile: compact bottom overlay on top of animation.
-->
<script lang="ts">
  import { slide } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import type {
    ExportOptionsStateManager,
    VideoFps,
    VideoResolution,
  } from "../state/export-options-state.svelte";

  export interface ActiveEffect {
    id: string;
    label: string;
    icon: string;
    active: boolean;
  }

  type PanelLayout = "sidebar" | "bottom";

  interface Props {
    exportOptions: ExportOptionsStateManager;
    viewerEffects: ActiveEffect[];
    isExporting: boolean;
    canvasReady?: boolean;
    layout?: PanelLayout;
    onExport: () => void;
    onClose: () => void;
  }

  let {
    exportOptions,
    viewerEffects,
    isExporting,
    canvasReady = true,
    layout = "bottom",
    onExport,
    onClose,
  }: Props = $props();

  const exportDisabled = $derived(isExporting || !canvasReady);

  const fpsOptions: { value: VideoFps; label: string; badge?: string }[] = [
    { value: 30, label: "30" },
    { value: 60, label: "60" },
    { value: 120, label: "120", badge: "Pro" },
  ];

  const resOptions: { value: VideoResolution; label: string }[] = [
    { value: 720, label: "720p" },
    { value: 1080, label: "1080p" },
  ];

  // Initialize effect overrides from viewer state on first open
  $effect(() => {
    if (!exportOptions.videoEffectOverrides && viewerEffects.length > 0) {
      const overrides = {
        fire: viewerEffects.find((e) => e.id === "fire")?.active ?? false,
        led: viewerEffects.find((e) => e.id === "led")?.active ?? false,
        trails: viewerEffects.find((e) => e.id === "trails")?.active ?? false,
        charcoal:
          viewerEffects.find((e) => e.id === "charcoal")?.active ?? false,
      };
      exportOptions.setVideoEffectOverrides(overrides);
    }
  });

  function toggleEffect(id: string) {
    const current = exportOptions.videoEffectOverrides;
    if (!current) return;
    exportOptions.setVideoEffectOverrides({
      ...current,
      [id]: !current[id as keyof typeof current],
    });
  }

  const effectChips = $derived(
    viewerEffects.map((e) => ({
      ...e,
      active:
        exportOptions.videoEffectOverrides?.[
          e.id as keyof NonNullable<typeof exportOptions.videoEffectOverrides>
        ] ?? e.active,
    })),
  );
</script>

<div
  class="export-panel"
  class:sidebar={layout === "sidebar"}
  class:bottom={layout === "bottom"}
  transition:slide={{ duration: 250, easing: cubicOut, axis: layout === "sidebar" ? "x" : "y" }}
  role="region"
  aria-label="Video export settings"
>
  <div class="panel-header">
    <span class="panel-title">Export Video</span>
    <button
      type="button"
      class="close-btn"
      onclick={onClose}
      aria-label="Close export settings"
    >
      <i class="fas fa-times" aria-hidden="true"></i>
    </button>
  </div>

  <div class="panel-body">
    <!-- FPS -->
    <div class="setting-row">
      <span class="setting-label">FPS</span>
      <div class="chip-group">
        {#each fpsOptions as opt}
          <button
            type="button"
            class="chip"
            class:active={exportOptions.videoFps === opt.value}
            onclick={() => exportOptions.setVideoFps(opt.value)}
            aria-pressed={exportOptions.videoFps === opt.value}
          >
            {opt.label}
            {#if opt.badge}
              <span class="chip-badge">{opt.badge}</span>
            {/if}
          </button>
        {/each}
      </div>
    </div>

    <!-- Resolution -->
    <div class="setting-row">
      <span class="setting-label">Resolution</span>
      <div class="chip-group">
        {#each resOptions as opt}
          <button
            type="button"
            class="chip"
            class:active={exportOptions.videoResolution === opt.value}
            onclick={() => exportOptions.setVideoResolution(opt.value)}
            aria-pressed={exportOptions.videoResolution === opt.value}
          >
            {opt.label}
          </button>
        {/each}
      </div>
    </div>

    <!-- Loops -->
    <div class="setting-row">
      <span class="setting-label">Loops</span>
      <div class="loop-stepper">
        <button
          type="button"
          class="stepper-btn"
          onclick={() =>
            exportOptions.setVideoLoopCount(exportOptions.videoLoopCount - 1)}
          disabled={exportOptions.videoLoopCount <= 1}
          aria-label="Decrease loops"
        >
          <i class="fas fa-minus" aria-hidden="true"></i>
        </button>
        <span class="loop-value">{exportOptions.videoLoopCount}x</span>
        <button
          type="button"
          class="stepper-btn"
          onclick={() =>
            exportOptions.setVideoLoopCount(exportOptions.videoLoopCount + 1)}
          disabled={exportOptions.videoLoopCount >= 10}
          aria-label="Increase loops"
        >
          <i class="fas fa-plus" aria-hidden="true"></i>
        </button>
      </div>
    </div>

    <!-- Effect overrides -->
    {#if effectChips.length > 0}
      <div class="setting-row">
        <span class="setting-label">Effects</span>
        <div class="chip-group">
          {#each effectChips as effect}
            <button
              type="button"
              class="chip effect-chip"
              class:active={effect.active}
              onclick={() => toggleEffect(effect.id)}
              aria-pressed={effect.active}
            >
              <i class={effect.icon} aria-hidden="true"></i>
              {effect.label}
            </button>
          {/each}
        </div>
      </div>
    {/if}
  </div>

  <div class="panel-footer">
    <button
      type="button"
      class="export-btn"
      onclick={onExport}
      disabled={exportDisabled}
      aria-label="Export video"
    >
      {#if isExporting}
        <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
        Exporting...
      {:else if !canvasReady}
        <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
        Loading...
      {:else}
        <i class="fas fa-download" aria-hidden="true"></i>
        Export Video
      {/if}
    </button>
  </div>
</div>

<style>
  /* ============================================================
   * Base styles (shared between both layouts)
   * ============================================================ */

  .export-panel {
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    display: flex;
    flex-direction: column;
    z-index: 10;
  }

  /* ============================================================
   * Bottom layout (mobile / narrow) — overlay at bottom
   * ============================================================ */

  .export-panel.bottom {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    max-height: 45%;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-top-left-radius: 16px;
    border-top-right-radius: 16px;
    overflow-y: auto;
  }

  /* ============================================================
   * Sidebar layout (desktop / wide) — static side panel
   * ============================================================ */

  .export-panel.sidebar {
    position: relative;
    width: 300px;
    min-width: 260px;
    max-width: 340px;
    flex-shrink: 0;
    border-left: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    overflow-y: auto;
    justify-content: center;
  }

  /* ============================================================
   * Header
   * ============================================================ */

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px 8px;
    flex-shrink: 0;
  }

  .panel-title {
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: var(--theme-text, white);
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .close-btn:hover {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    color: var(--theme-text, white);
  }

  /* ============================================================
   * Body — settings rows
   * ============================================================ */

  .panel-body {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 4px 16px 12px;
    overflow-y: auto;
  }

  .sidebar .panel-body {
    gap: 18px;
    padding: 8px 20px 16px;
  }

  .setting-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .setting-label {
    min-width: 72px;
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    text-transform: uppercase;
    letter-spacing: 0.05em;
    flex-shrink: 0;
  }

  .chip-group {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  /* ============================================================
   * Chips
   * ============================================================ */

  .chip {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: 40px;
    min-width: 40px;
    padding: 6px 14px;
    background: color-mix(in srgb, var(--theme-card-bg) 70%, transparent);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 10px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    -webkit-tap-highlight-color: transparent;
  }

  .chip:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
    color: var(--theme-text, white);
  }

  .chip:active {
    transform: scale(0.92);
    transition-duration: 50ms;
  }

  .chip.active {
    background: color-mix(
      in srgb,
      var(--theme-accent, #6366f1) 35%,
      var(--theme-card-bg, rgba(0, 0, 0, 0.4))
    );
    border-color: color-mix(
      in srgb,
      var(--theme-accent, #6366f1) 60%,
      transparent
    );
    color: white;
    box-shadow: 0 2px 8px
      color-mix(in srgb, var(--theme-accent, #6366f1) 25%, transparent);
  }

  .chip:focus-visible {
    outline: 2px solid
      color-mix(in srgb, var(--theme-accent, #6366f1) 50%, transparent);
    outline-offset: 2px;
  }

  .chip-badge {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 2px 5px;
    border-radius: 4px;
    background: rgba(168, 85, 247, 0.3);
    color: #c084fc;
  }

  .effect-chip i {
    font-size: 12px;
  }

  /* ============================================================
   * Loop stepper
   * ============================================================ */

  .loop-stepper {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .stepper-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    background: color-mix(in srgb, var(--theme-card-bg) 70%, transparent);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    cursor: pointer;
    transition: all 0.15s ease;
    font-size: 12px;
  }

  .stepper-btn:hover:not(:disabled) {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
    color: var(--theme-text, white);
  }

  .stepper-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .loop-value {
    min-width: 36px;
    text-align: center;
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: var(--theme-text, white);
  }

  /* ============================================================
   * Footer — export button
   * ============================================================ */

  .panel-footer {
    padding: 8px 16px 12px;
    flex-shrink: 0;
  }

  .sidebar .panel-footer {
    padding: 12px 20px 16px;
  }

  .export-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    min-height: 48px;
    padding: 12px 24px;
    border: none;
    border-radius: 12px;
    background: var(--theme-accent, #6366f1);
    color: white;
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .export-btn:hover:not(:disabled) {
    filter: brightness(1.1);
    box-shadow: 0 4px 12px
      color-mix(in srgb, var(--theme-accent, #6366f1) 40%, transparent);
  }

  .export-btn:active:not(:disabled) {
    transform: scale(0.98);
    transition-duration: 50ms;
  }

  .export-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  /* ============================================================
   * Reduced motion
   * ============================================================ */

  @media (prefers-reduced-motion: reduce) {
    .chip,
    .stepper-btn,
    .close-btn,
    .export-btn {
      transition: none !important;
    }

    .chip:active,
    .export-btn:active {
      transform: none !important;
    }
  }
</style>
