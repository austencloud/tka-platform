<!--
  MandalaModule.svelte — Unified mandala gallery with detail panel + meditation/export modes
-->
<script lang="ts">
  import SequenceMandala from "$lib/shared/mandala/components/SequenceMandala.svelte";
  import type { UndulationEasing } from "$lib/shared/mandala/domain/mandala-types";
  import TKAWordGlyph from "$lib/shared/choreo-card/components/TKAWordGlyph.svelte";
  import MeditationControls from "./tabs/meditate/components/MeditationControls.svelte";
  import MeditationOverlay from "./tabs/meditate/components/MeditationOverlay.svelte";
  import { createMeditationSession } from "./tabs/meditate/state/meditation-session.svelte";
  import { createMeditationAudioService } from "./tabs/meditate/services/meditation-audio";
  import { getPatternCycleTime, type BreathingPattern, type AmbientTrack } from "./tabs/meditate/domain/meditation-types";
  import { exportMandalaPNG, downloadBlob } from "./tabs/export/services/mandala-export";
  import { mandalaCollectionState } from "./tabs/collection/state/mandala-collection-state.svelte";
  import { DEFAULT_MANDALAS } from "./tabs/meditate/domain/default-mandalas";
  import type { CollectedMandala } from "./tabs/collection/domain/mandala-collection-types";
  import type { StepLike } from "$lib/shared/mandala/services/contracts/types";
  import { onMount } from "svelte";

  // ── Phase management ──
  type Phase = "gallery" | "detail" | "meditate-config" | "meditate-session" | "export";
  let phase = $state<Phase>("gallery");

  // ── Selected mandala ──
  let selectedMandala = $state<CollectedMandala | null>(null);

  // ── All sources ──
  interface MandalaItem {
    id: string;
    name: string;
    steps: StepLike[];
    variant: "blue" | "red" | "both";
    bluePropType: string;
    redPropType: string;
    createdAt: number;
    group: "curated" | "collection";
  }

  const items = $derived.by((): MandalaItem[] => {
    const curated: MandalaItem[] = DEFAULT_MANDALAS.map((m) => ({
      ...m,
      createdAt: 0,
      group: "curated",
    }));
    const collected: MandalaItem[] = mandalaCollectionState.collection.map((m) => ({
      id: m.id,
      name: m.name,
      steps: m.steps as StepLike[],
      variant: m.variant,
      bluePropType: m.bluePropType,
      redPropType: m.redPropType,
      createdAt: m.createdAt,
      group: "collection",
    }));
    return [...curated, ...collected];
  });

  // ── Detail panel ──
  const dateLabel = $derived(
    selectedMandala
      ? new Date(selectedMandala.createdAt).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "",
  );

  let detailPreviewEl = $state<HTMLElement | null>(null);
  let detailPreviewSize = $state(300);

  $effect(() => {
    if (!detailPreviewEl) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        detailPreviewSize = Math.min(width, height) * 0.75;
      }
    });
    ro.observe(detailPreviewEl);
    return () => ro.disconnect();
  });

  // ── Delete confirmation ──
  let deleteConfirming = $state(false);
  let deleteTimer: ReturnType<typeof setTimeout> | undefined;

  function handleDeleteClick() {
    if (!selectedMandala) return;
    if (deleteConfirming) {
      clearTimeout(deleteTimer);
      mandalaCollectionState.remove(selectedMandala.id);
      deleteConfirming = false;
      selectedMandala = null;
      phase = "gallery";
    } else {
      deleteConfirming = true;
      deleteTimer = setTimeout(() => { deleteConfirming = false; }, 3000);
    }
  }

  // ── Meditation ──
  const ANIMATE_MIN = 0;
  const ANIMATE_MAX = 250;
  const BASE_PERIOD = 5;

  const reducedMotion = typeof window !== "undefined"
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;

  const meditationSession = createMeditationSession();
  let audioService = createMeditationAudioService();

  let meditateStageEl = $state<HTMLElement | null>(null);
  let meditateContainerSize = $state(300);

  $effect(() => {
    if (!meditateStageEl) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        meditateContainerSize = Math.min(width, height) * 0.85;
      }
    });
    ro.observe(meditateStageEl);
    return () => ro.disconnect();
  });

  const sessionPeriod = $derived.by(() => {
    if (meditationSession.status === "running" && meditationSession.pattern) {
      return getPatternCycleTime(meditationSession.pattern);
    }
    return BASE_PERIOD;
  });

  const sessionEasing = $derived.by((): UndulationEasing => {
    if (meditationSession.status === "running" && meditationSession.pattern) {
      return meditationSession.pattern.defaultEasing;
    }
    return "sine";
  });

  const mandalaRotation = $derived(reducedMotion ? 0 : 90);
  const mandalaTipDx = $derived(meditationSession.holdPulseDx);
  const meditateSize = $derived(Math.min(meditateContainerSize, 600));

  function handleMeditateStart(pattern: BreathingPattern, durationMinutes: number) {
    phase = "meditate-session";
    meditationSession.start(pattern, durationMinutes, ANIMATE_MIN, ANIMATE_MAX, handleSessionComplete);
  }

  function handleSessionComplete() {
    audioService.playCompletionBell();
    audioService.stopAmbient();
  }

  function handleMeditateStop() {
    meditationSession.stop();
    audioService.stopAmbient();
    phase = "meditate-config";
  }

  function handleMeditateExit() {
    meditationSession.stop();
    audioService.stopAmbient();
    phase = "detail";
  }

  function handleAmbientChange(track: AmbientTrack) {
    if (track === "none") audioService.stopAmbient();
    else audioService.startAmbient(track);
  }

  function handleVolumeChange(volume: number) {
    audioService.setVolume(volume);
  }

  function handleMeditateAgain() {
    if (meditationSession.pattern) {
      phase = "meditate-session";
      meditationSession.start(
        meditationSession.pattern,
        meditationSession.durationMinutes,
        ANIMATE_MIN, ANIMATE_MAX,
        handleSessionComplete,
      );
    }
  }

  // ── Export ──
  const RESOLUTIONS = [
    { label: "1x", size: 540 },
    { label: "2x", size: 1080 },
    { label: "4x", size: 2160 },
  ] as const;

  const BACKGROUNDS = ["transparent", "black", "white"] as const;
  type Background = (typeof BACKGROUNDS)[number];

  let resolution = $state<number>(1080);
  let background = $state<Background>("transparent");
  let strokeWidth = $state(2.5);
  let exporting = $state(false);
  let exportPreviewEl = $state<HTMLElement | null>(null);
  let exportPreviewSize = $state(400);

  $effect(() => {
    if (!exportPreviewEl) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        exportPreviewSize = Math.min(width, height) * 0.8;
      }
    });
    ro.observe(exportPreviewEl);
    return () => ro.disconnect();
  });

  const resolutionLabel = $derived(
    RESOLUTIONS.find((r) => r.size === resolution)?.label ?? "2x",
  );

  async function handleExport() {
    if (!selectedMandala || exporting) return;
    exporting = true;
    try {
      const blob = await exportMandalaPNG(
        selectedMandala.steps as StepLike[],
        selectedMandala.bluePropType,
        selectedMandala.redPropType,
        { size: resolution, background, strokeWidth },
      );
      const safeName = selectedMandala.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      downloadBlob(blob, `mandala-${safeName}-${resolution}px.png`);
    } catch (err) {
      console.error("[MandalaExport] Export failed:", err);
    } finally {
      exporting = false;
    }
  }

  // ── Navigation ──
  function selectMandala(item: MandalaItem) {
    selectedMandala = {
      id: item.id,
      name: item.name,
      steps: item.steps as any,
      variant: item.variant,
      bluePropType: item.bluePropType,
      redPropType: item.redPropType,
      createdAt: item.createdAt,
    };
    deleteConfirming = false;
    phase = "detail";
  }

  function backToGallery() {
    meditationSession.stop();
    audioService.stopAmbient();
    selectedMandala = null;
    phase = "gallery";
  }

  function backToDetail() {
    phase = "detail";
  }

  onMount(() => {
    return () => {
      meditationSession.dispose();
      audioService.dispose();
    };
  });
</script>

<div class="mandala-module">
  <!-- ═══ GALLERY ═══ -->
  {#if phase === "gallery"}
    <div class="gallery-view">
      {#if items.length === 0}
        <div class="empty-state">
          <i class="fas fa-dharmachakra empty-icon" aria-hidden="true"></i>
          <p class="empty-title">No mandalas yet</p>
          <p class="empty-hint">Right-click a mandala in the workspace to save one</p>
        </div>
      {:else}
        <div class="gallery-grid">
          {#each items as item (item.id)}
            <button
              type="button"
              class="gallery-card"
              onclick={() => selectMandala(item)}
              aria-label="View {item.name}"
            >
              <div class="card-thumb">
                <SequenceMandala
                  sequence={{ steps: item.steps }}
                  size={140}
                  show={item.variant}
                  bluePropType={item.bluePropType}
                  redPropType={item.redPropType}
                />
              </div>
              <div class="card-label">
                <TKAWordGlyph word={item.name} height={16} darkMode />
              </div>
            </button>
          {/each}
        </div>
      {/if}
    </div>

  <!-- ═══ DETAIL PANEL ═══ -->
  {:else if phase === "detail" && selectedMandala}
    <div class="detail-layout">
      <div class="detail-preview" bind:this={detailPreviewEl}>
        <SequenceMandala
          sequence={{ steps: selectedMandala.steps }}
          size={detailPreviewSize}
          show={selectedMandala.variant}
          animate={true}
          animateMin={ANIMATE_MIN}
          animateMax={ANIMATE_MAX}
          animatePeriod={BASE_PERIOD}
          animateEasing="sine"
          animateRotation={mandalaRotation}
          bluePropType={selectedMandala.bluePropType}
          redPropType={selectedMandala.redPropType}
        />
      </div>

      <div class="detail-panel">
        <button
          type="button"
          class="back-btn"
          onclick={backToGallery}
          aria-label="Back to gallery"
        >
          <i class="fas fa-arrow-left" aria-hidden="true"></i>
          <span>Gallery</span>
        </button>

        <div class="detail-info">
          <div class="detail-glyphs">
            <TKAWordGlyph word={selectedMandala.name} height={28} darkMode />
          </div>
          {#if selectedMandala.createdAt}
            <span class="detail-date">{dateLabel}</span>
          {/if}
        </div>

        <div class="detail-actions">
          <button
            type="button"
            class="action-btn meditate-btn"
            onclick={() => { phase = "meditate-config"; }}
          >
            <i class="fas fa-spa" aria-hidden="true"></i>
            <span>Meditate</span>
          </button>

          <button
            type="button"
            class="action-btn export-btn"
            onclick={() => { phase = "export"; }}
          >
            <i class="fas fa-download" aria-hidden="true"></i>
            <span>Export PNG</span>
          </button>

          <button
            type="button"
            class="action-btn delete-btn"
            class:confirming={deleteConfirming}
            onclick={handleDeleteClick}
          >
            {#if deleteConfirming}
              <i class="fas fa-check" aria-hidden="true"></i>
              <span>Confirm Delete</span>
            {:else}
              <i class="fas fa-trash-alt" aria-hidden="true"></i>
              <span>Delete</span>
            {/if}
          </button>
        </div>
      </div>
    </div>

  <!-- ═══ MEDITATE CONFIG ═══ -->
  {:else if phase === "meditate-config" && selectedMandala}
    <div class="meditate-layout">
      <div class="meditate-stage" bind:this={meditateStageEl}>
        <SequenceMandala
          sequence={{ steps: selectedMandala.steps }}
          size={meditateSize}
          show="both"
          animate={true}
          animateMin={ANIMATE_MIN}
          animateMax={ANIMATE_MAX}
          animatePeriod={BASE_PERIOD}
          animateEasing="sine"
          animateRotation={mandalaRotation}
          bluePropType={selectedMandala.bluePropType}
          redPropType={selectedMandala.redPropType}
        />
      </div>
      <div class="controls-rail">
        <MeditationControls
          status={meditationSession.status}
          onStart={handleMeditateStart}
          onStop={handleMeditateStop}
          onExit={handleMeditateExit}
          onAmbientChange={handleAmbientChange}
          onVolumeChange={handleVolumeChange}
        />
      </div>
    </div>

  <!-- ═══ MEDITATE SESSION ═══ -->
  {:else if phase === "meditate-session" && selectedMandala}
    <div class="session-viewport" bind:this={meditateStageEl}>
      <SequenceMandala
        sequence={{ steps: selectedMandala.steps }}
        size={meditateSize}
        show="both"
        animate={true}
        animateMin={ANIMATE_MIN}
        animateMax={ANIMATE_MAX}
        animatePeriod={sessionPeriod}
        animateEasing={sessionEasing}
        animateRotation={mandalaRotation}
        tipDx={mandalaTipDx}
        bluePropType={selectedMandala.bluePropType}
        redPropType={selectedMandala.redPropType}
      />
      <MeditationOverlay
        status={meditationSession.status}
        currentPhase={meditationSession.currentPhase}
        phaseElapsed={meditationSession.phaseElapsed}
        phaseDuration={meditationSession.phaseDuration}
        pattern={meditationSession.pattern}
        elapsedSeconds={meditationSession.elapsedSeconds}
        durationMinutes={meditationSession.durationMinutes}
        breathCount={meditationSession.breathCount}
        onMeditateAgain={handleMeditateAgain}
        onBackToMandala={backToGallery}
      />
      <button
        type="button"
        class="session-exit-btn"
        onclick={handleMeditateStop}
        aria-label="End meditation session"
      >
        <i class="fas fa-xmark" aria-hidden="true"></i>
      </button>
    </div>

  <!-- ═══ EXPORT ═══ -->
  {:else if phase === "export" && selectedMandala}
    <div class="export-layout">
      <div class="export-controls">
        <button
          type="button"
          class="back-btn"
          onclick={backToDetail}
          aria-label="Back to mandala"
        >
          <i class="fas fa-arrow-left" aria-hidden="true"></i>
          <span>Back</span>
        </button>

        <h3 class="export-title">Export Settings</h3>

        <div class="control-group">
          <span class="control-label">Resolution</span>
          <div class="chip-row" role="radiogroup" aria-label="Resolution">
            {#each RESOLUTIONS as res (res.size)}
              <button
                type="button"
                class="chip"
                class:active={resolution === res.size}
                role="radio"
                aria-checked={resolution === res.size}
                onclick={() => { resolution = res.size; }}
              >
                {res.label}
                <span class="chip-detail">{res.size}px</span>
              </button>
            {/each}
          </div>
        </div>

        <div class="control-group">
          <span class="control-label">Background</span>
          <div class="chip-row" role="radiogroup" aria-label="Background color">
            {#each BACKGROUNDS as bg (bg)}
              <button
                type="button"
                class="chip"
                class:active={background === bg}
                role="radio"
                aria-checked={background === bg}
                onclick={() => { background = bg; }}
              >
                {#if bg === "transparent"}
                  <span class="bg-swatch transparent-swatch"></span>
                {:else}
                  <span class="bg-swatch" style:background={bg}></span>
                {/if}
                {bg}
              </button>
            {/each}
          </div>
        </div>

        <div class="control-group">
          <label class="control-label" for="stroke-width">
            Stroke Width
            <span class="control-value">{strokeWidth.toFixed(1)}</span>
          </label>
          <input
            id="stroke-width"
            type="range"
            min="0.5"
            max="5"
            step="0.5"
            bind:value={strokeWidth}
            class="range-input"
          />
        </div>

        <button
          type="button"
          class="download-btn"
          onclick={handleExport}
          disabled={exporting}
        >
          {#if exporting}
            <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
            Exporting...
          {:else}
            <i class="fas fa-download" aria-hidden="true"></i>
            Download PNG
          {/if}
        </button>
      </div>

      <div class="export-preview" bind:this={exportPreviewEl}>
        <SequenceMandala
          sequence={{ steps: selectedMandala.steps }}
          size={exportPreviewSize}
          show="both"
          bluePropType={selectedMandala.bluePropType}
          redPropType={selectedMandala.redPropType}
          strokeWidth={strokeWidth}
        />
        <span class="resolution-label">{resolutionLabel} · {resolution}px</span>
      </div>
    </div>
  {/if}
</div>

<style>
  .mandala-module {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: transparent;
  }

  /* ── Gallery ── */
  .gallery-view {
    width: 100%;
    height: 100%;
    overflow-y: auto;
    padding: 32px;
  }

  .gallery-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 16px;
  }

  .gallery-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 20px 12px 16px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    border-radius: 14px;
    cursor: pointer;
    transition: all var(--duration-fast, 150ms) var(--ease-out, ease);
    min-height: var(--min-touch-target, 44px);
  }

  @media (hover: hover) {
    .gallery-card:hover {
      background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.07));
      border-color: color-mix(in srgb, var(--theme-accent, #6366f1) 40%, transparent);
      transform: translateY(-2px);
    }
  }

  .gallery-card:active {
    transform: scale(0.97);
    transition-duration: 50ms;
  }

  .gallery-card:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--theme-accent, #6366f1) 50%, transparent);
    outline-offset: 2px;
  }

  .card-thumb {
    width: 140px;
    height: 140px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .card-label {
    max-width: 100%;
    overflow: hidden;
    display: flex;
    justify-content: center;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
  }

  /* ── Empty state ── */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 8px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
  }

  .empty-icon { font-size: 48px; opacity: 0.3; }
  .empty-title { font-size: 16px; font-weight: 500; margin: 0; }
  .empty-hint { font-size: 13px; margin: 0; opacity: 0.7; }

  /* ── Detail layout ── */
  .detail-layout {
    display: flex;
    height: 100%;
  }

  .detail-preview {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 0;
  }

  .detail-panel {
    width: 320px;
    flex-shrink: 0;
    padding: 24px;
    border-left: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.06));
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 28px;
  }

  .back-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: var(--min-touch-target, 44px);
    padding: 8px 16px;
    background: transparent;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 10px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-fast, 150ms) var(--ease-out, ease);
    align-self: flex-start;
  }

  @media (hover: hover) {
    .back-btn:hover {
      background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
      border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
      color: var(--theme-text, white);
    }
  }

  .back-btn:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--theme-accent, #6366f1) 50%, transparent);
    outline-offset: 2px;
  }

  .detail-info {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .detail-glyphs {
    overflow: hidden;
    color: var(--theme-text, white);
  }

  .detail-date {
    font-size: 13px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
  }

  .detail-actions {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .action-btn {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    min-height: 48px;
    padding: 12px 18px;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-fast, 150ms) var(--ease-out, ease);
  }

  .action-btn:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--theme-accent, #6366f1) 50%, transparent);
    outline-offset: 2px;
  }

  .meditate-btn {
    background: linear-gradient(135deg, #818cf8, #6366f1);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: white;
    box-shadow: 0 4px 12px color-mix(in srgb, #6366f1 30%, transparent);
  }

  .export-btn {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    color: var(--theme-text, white);
  }

  .delete-btn {
    background: transparent;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    margin-top: auto;
  }

  .delete-btn.confirming {
    background: var(--semantic-error, #ef4444);
    border-color: var(--semantic-error, #ef4444);
    color: white;
  }

  @media (hover: hover) {
    .meditate-btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 16px color-mix(in srgb, #6366f1 40%, transparent);
    }
    .export-btn:hover {
      background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.1));
      border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    }
    .delete-btn:hover {
      color: var(--semantic-error, #ef4444);
      border-color: color-mix(in srgb, var(--semantic-error, #ef4444) 30%, transparent);
    }
    .delete-btn.confirming:hover {
      background: color-mix(in srgb, var(--semantic-error, #ef4444) 80%, black);
    }
  }

  .action-btn:active {
    transform: scale(0.98);
    transition-duration: 50ms;
  }

  /* ── Meditation ── */
  .meditate-layout {
    display: flex;
    height: 100%;
  }

  .meditate-stage {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 0;
  }

  .controls-rail {
    width: 300px;
    flex-shrink: 0;
    border-left: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.06));
    overflow-y: auto;
  }

  .session-viewport {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .session-exit-btn {
    position: absolute;
    top: 16px;
    left: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--min-touch-target, 44px);
    height: var(--min-touch-target, 44px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 10px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: 16px;
    cursor: pointer;
    transition: all var(--duration-fast, 150ms) var(--ease-out, ease);
    z-index: 30;
  }

  @media (hover: hover) {
    .session-exit-btn:hover {
      background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.1));
      border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
      color: var(--theme-text, white);
    }
  }

  .session-exit-btn:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--theme-accent, #6366f1) 50%, transparent);
    outline-offset: 2px;
  }

  /* ── Export ── */
  .export-layout {
    display: flex;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  .export-controls {
    width: 300px;
    flex-shrink: 0;
    padding: 24px 20px;
    border-right: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.06));
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .export-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--theme-text, white);
    letter-spacing: 0.02em;
    margin: 0;
  }

  .export-preview {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    min-width: 0;
    padding: 24px;
  }

  .resolution-label {
    font-size: 13px;
    font-weight: 500;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    letter-spacing: 0.02em;
  }

  .control-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .control-label {
    font-size: 12px;
    font-weight: 500;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    text-transform: uppercase;
    letter-spacing: 0.04em;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .control-value {
    color: var(--theme-text, rgba(255, 255, 255, 0.7));
    font-variant-numeric: tabular-nums;
  }

  .chip-row {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .chip {
    display: flex;
    align-items: center;
    gap: 4px;
    min-height: var(--min-touch-target, 44px);
    padding: 0 14px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 10px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-fast, 150ms) var(--ease-out, ease);
    white-space: nowrap;
  }

  @media (hover: hover) {
    .chip:hover {
      background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
      border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
      color: var(--theme-text, white);
    }
  }

  .chip.active {
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 25%, var(--theme-card-bg, rgba(0, 0, 0, 0.4)));
    border-color: color-mix(in srgb, var(--theme-accent, #6366f1) 50%, transparent);
    color: white;
  }

  .chip:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--theme-accent, #6366f1) 50%, transparent);
    outline-offset: 2px;
  }

  .chip-detail { font-size: 11px; opacity: 0.5; }

  .bg-swatch {
    width: 14px;
    height: 14px;
    border-radius: 3px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.2));
    flex-shrink: 0;
  }

  .transparent-swatch {
    background: repeating-conic-gradient(
      rgba(255, 255, 255, 0.15) 0% 25%,
      rgba(255, 255, 255, 0.05) 0% 50%
    ) 0 0 / 8px 8px;
  }

  .range-input {
    width: 100%;
    height: var(--min-touch-target, 44px);
    -webkit-appearance: none;
    appearance: none;
    background: transparent;
    cursor: pointer;
  }

  .range-input::-webkit-slider-runnable-track {
    height: 4px;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 2px;
  }

  .range-input::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--theme-accent, #6366f1);
    border: 2px solid rgba(255, 255, 255, 0.9);
    margin-top: -7px;
  }

  .range-input::-moz-range-track {
    height: 4px;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 2px;
    border: none;
  }

  .range-input::-moz-range-thumb {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--theme-accent, #6366f1);
    border: 2px solid rgba(255, 255, 255, 0.9);
  }

  .range-input:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--theme-accent, #6366f1) 50%, transparent);
    outline-offset: 2px;
  }

  .download-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    min-height: 48px;
    margin-top: auto;
    background: linear-gradient(135deg, var(--theme-accent, #6366f1), color-mix(in srgb, var(--theme-accent, #6366f1) 80%, #8b5cf6));
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 12px;
    color: white;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-normal, 200ms) var(--ease-out, ease);
    box-shadow: 0 4px 12px color-mix(in srgb, var(--theme-accent, #6366f1) 30%, transparent);
  }

  @media (hover: hover) {
    .download-btn:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 6px 16px color-mix(in srgb, var(--theme-accent, #6366f1) 40%, transparent);
    }
  }

  .download-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .download-btn:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--theme-accent, #6366f1) 50%, transparent);
    outline-offset: 2px;
  }

  /* ── Responsive ── */
  @media (min-width: 1200px) {
    .gallery-grid {
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    }
    .card-thumb { width: 160px; height: 160px; }
  }

  @media (max-width: 768px) {
    .gallery-view { padding: 20px; }
    .gallery-grid {
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 12px;
    }
    .card-thumb { width: 110px; height: 110px; }

    .detail-layout { flex-direction: column; }
    .detail-preview { flex: 1; min-height: 40%; }
    .detail-panel {
      width: 100%;
      max-height: 55%;
      border-left: none;
      border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.06));
    }

    .meditate-layout { flex-direction: column; }
    .meditate-stage { flex: 1; min-height: 0; }
    .controls-rail {
      width: 100%;
      max-height: 50%;
      border-left: none;
      border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.06));
    }

    .export-layout { flex-direction: column-reverse; }
    .export-controls {
      width: 100%;
      max-height: 55%;
      border-right: none;
      border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.06));
    }
    .export-preview { flex: 1; min-height: 0; padding: 16px; }
  }

  @media (max-width: 480px) {
    .gallery-view { padding: 16px; }
    .gallery-grid {
      grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
      gap: 10px;
    }
    .card-thumb { width: 90px; height: 90px; }
    .gallery-card { padding: 12px 6px 10px; gap: 8px; }
  }

  @media (prefers-reduced-motion: reduce) {
    .gallery-card, .action-btn, .session-exit-btn, .chip, .download-btn, .back-btn {
      transition: none !important;
    }
    .gallery-card:hover, .action-btn:active, .session-exit-btn:active {
      transform: none;
    }
  }
</style>
