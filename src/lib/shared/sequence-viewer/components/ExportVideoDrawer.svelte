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
  import type { VideoExportProgress } from "$lib/features/compose/services/contracts/IVideoExportOrchestrator";

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
    exportProgress?: VideoExportProgress | null;
    canvasReady?: boolean;
    layout?: PanelLayout;
    /** Duration of a single playthrough in seconds (used to show total duration with repeats) */
    singlePlayDuration?: number;
    onExport: () => void;
    onCancel?: () => void;
  }

  let {
    exportOptions,
    viewerEffects,
    isExporting,
    exportProgress = null,
    canvasReady = true,
    layout = "bottom",
    singlePlayDuration = 0,
    onExport,
    onCancel,
  }: Props = $props();

  const exportDisabled = $derived(isExporting || !canvasReady);

  /** Format seconds into a human-readable duration like "4.2s" or "1m 12s" */
  function formatDuration(seconds: number): string {
    if (seconds <= 0) return "";
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  }

  const totalDuration = $derived(singlePlayDuration * exportOptions.videoLoopCount);
  const durationLabel = $derived(
    singlePlayDuration > 0 ? formatDuration(totalDuration) : ""
  );

  const fpsOptions: { value: VideoFps; label: string; badge?: string }[] = [
    { value: 30, label: "30" },
    { value: 60, label: "60" },
    { value: 120, label: "120" },
  ];

  const resOptions: { value: VideoResolution; label: string }[] = [
    { value: 720, label: "720p" },
    { value: 1080, label: "1080p" },
    { value: 2160, label: "4K" },
    { value: 4320, label: "8K" },
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

    <!-- Repeat -->
    <div class="setting-row">
      <span class="setting-label">Repeat</span>
      <div class="repeat-control">
        <div class="repeat-stepper">
          <button
            type="button"
            class="stepper-btn"
            onclick={() =>
              exportOptions.setVideoLoopCount(exportOptions.videoLoopCount - 1)}
            disabled={exportOptions.videoLoopCount <= 1}
            aria-label="Decrease repeat count"
          >
            <i class="fas fa-minus" aria-hidden="true"></i>
          </button>
          <span class="repeat-value">{exportOptions.videoLoopCount}x</span>
          <button
            type="button"
            class="stepper-btn"
            onclick={() =>
              exportOptions.setVideoLoopCount(exportOptions.videoLoopCount + 1)}
            disabled={exportOptions.videoLoopCount >= 10}
            aria-label="Increase repeat count"
          >
            <i class="fas fa-plus" aria-hidden="true"></i>
          </button>
        </div>
        {#if durationLabel}
          <span class="duration-hint">{durationLabel}</span>
        {/if}
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
    {#if isExporting}
      <div class="export-progress-row" role="status" aria-live="polite">
        <div class="progress-info">
          <span class="progress-stage">
            {#if !exportProgress}
              Starting...
            {:else}
              Exporting
            {/if}
          </span>
          <span class="progress-pct">{exportProgress ? Math.round(exportProgress.progress * 100) : 0}%</span>
        </div>
        <div
          class="progress-bar"
          role="progressbar"
          aria-valuenow={exportProgress ? Math.round(exportProgress.progress * 100) : 0}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Export progress"
        >
          <div class="progress-fill" style="width: {exportProgress ? exportProgress.progress * 100 : 0}%"></div>
        </div>
        {#if onCancel}
          <button
            type="button"
            class="cancel-btn"
            onclick={onCancel}
            aria-label="Cancel export"
          >
            <i class="fas fa-times" aria-hidden="true"></i>
            Cancel
          </button>
        {/if}
      </div>
    {:else}
      <button
        type="button"
        class="export-btn"
        onclick={onExport}
        disabled={exportDisabled}
        aria-label="Export video"
      >
        {#if !canvasReady}
          <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
          Loading...
        {:else}
          <i class="fas fa-download" aria-hidden="true"></i>
          Export Video
        {/if}
      </button>
    {/if}
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
    flex-shrink: 0;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    overflow-y: auto;
  }

  /* ============================================================
   * Sidebar layout (desktop / wide) — static side panel
   * ============================================================ */

  .export-panel.sidebar {
    position: relative;
    width: 360px;
    min-width: 320px;
    flex: 0 1 400px;
    border-left: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    overflow-y: auto;
    justify-content: center;
  }

  /* ============================================================
   * Body — settings rows
   * ============================================================ */

  .panel-body {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 12px 16px;
    overflow-y: auto;
  }

  .sidebar .panel-body {
    gap: 24px;
    padding: 24px 28px;
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

  .repeat-control {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .repeat-stepper {
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

  .repeat-value {
    min-width: 36px;
    text-align: center;
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: var(--theme-text, white);
  }

  .duration-hint {
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    white-space: nowrap;
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
    min-height: var(--min-touch-target);
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
   * Export progress
   * ============================================================ */

  .export-progress-row {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 100%;
  }

  .progress-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .progress-stage {
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  .progress-pct {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: var(--theme-text, white);
  }

  .progress-bar {
    width: 100%;
    height: 6px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-radius: 3px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: var(--theme-accent, #6366f1);
    border-radius: 3px;
    transition: width 0.2s ease;
  }

  .cancel-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    width: 100%;
    min-height: var(--min-touch-target);
    padding: 10px 20px;
    background: transparent;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .cancel-btn:hover {
    background: color-mix(in srgb, var(--semantic-error, #f87171) 15%, transparent);
    border-color: var(--semantic-error, #f87171);
    color: var(--semantic-error, #f87171);
  }

  /* ============================================================
   * Reduced motion
   * ============================================================ */

  @media (prefers-reduced-motion: reduce) {
    .chip,
    .stepper-btn,
    .export-btn,
    .cancel-btn,
    .progress-fill {
      transition: none !important;
    }

    .chip:active,
    .export-btn:active {
      transform: none !important;
    }
  }
</style>
