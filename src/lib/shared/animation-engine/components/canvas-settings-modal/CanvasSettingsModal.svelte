<!--
  CanvasSettingsModal.svelte - Full-screen canvas settings experience

  Layout: Canvas preview on left, controls on right.
  Controls: Effect picker (mutually exclusive: None/Fire/LED/Trails) with detail
  controls for the active effect, plus display toggles (grid mode, element visibility).

  Architecture:
  - Own AnimatorCanvas instance with independent RAF playback
  - Effects are mutually exclusive (fire/LED already enforced in visibility manager)
  - All changes go through global AnimationVisibilityStateManager
-->
<script lang="ts">
  import BaseModal from "$lib/shared/foundation/ui/modal/BaseModal.svelte";
  import AnimatorCanvas from "../AnimatorCanvas.svelte";
  import { getAnimationVisibilityManager } from "../../state/animation-visibility-state.svelte";
  import type { GridMode } from "../../state/animation-visibility-state.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
  import type { PropState } from "../../domain/PropState";
  import type { StartPositionData } from "../../../../features/create/shared/domain/models/StartPositionData";
  import type { StepData } from "../../../../features/create/shared/domain/models/StepData";
  import { onDestroy } from "svelte";
  import FireCategory from "./categories/FireCategory.svelte";
  import CharcoalCategory from "./categories/CharcoalCategory.svelte";
  import LedCategory from "./categories/LedCategory.svelte";

  interface Props {
    open: boolean;
    initialCategory?: string;
    sequenceData?: SequenceData | null;
    blueProp: PropState | null;
    redProp: PropState | null;
    letter?: Letter | null;
    stepData?: StartPositionData | StepData | null;
    word?: string | null;
  }

  let {
    open = $bindable(),
    initialCategory = undefined,
    sequenceData = null,
    blueProp,
    redProp,
    letter = null,
    stepData = null,
    word = null,
  }: Props = $props();

  // Playback state
  let isPlaying = $state(true);
  let playbackStep = $state(0);
  let rafId: number | null = null;
  let lastFrameTime = 0;

  const vm = getAnimationVisibilityManager();

  // ── Reactive state from visibility manager ──
  let fireEnabled = $state(vm.isFireEffectEnabled());
  let charcoalEnabled = $state(vm.getFireUseCharcoal());
  let ledEnabled = $state(vm.isLedEffectEnabled());
  let trailsVisible = $state(vm.isTrailsVisible());
  let gridMode = $state(vm.getGridMode());
  let stepNumbers = $state(vm.getVisibility("stepNumbers"));
  let beatPosition = $state(vm.getVisibility("beatPosition"));
  let propsVisible = $state(vm.getVisibility("props"));
  let wordHeader = $state(vm.getVisibility("wordHeader"));
  let progressBar = $state(vm.getVisibility("progressBar"));
  let tkaGlyph = $state(vm.getVisibility("tkaGlyph"));

  function syncFromManager(): void {
    fireEnabled = vm.isFireEffectEnabled();
    charcoalEnabled = vm.getFireUseCharcoal();
    ledEnabled = vm.isLedEffectEnabled();
    trailsVisible = vm.isTrailsVisible();
    gridMode = vm.getGridMode();
    stepNumbers = vm.getVisibility("stepNumbers");
    beatPosition = vm.getVisibility("beatPosition");
    propsVisible = vm.getVisibility("props");
    wordHeader = vm.getVisibility("wordHeader");
    progressBar = vm.getVisibility("progressBar");
    tkaGlyph = vm.getVisibility("tkaGlyph");
  }

  vm.registerObserver(syncFromManager);
  onDestroy(() => vm.unregisterObserver(syncFromManager));

  // ── Active effect ──
  type ActiveEffect = "none" | "fire" | "charcoal" | "led" | "trails";

  const activeEffect: ActiveEffect = $derived.by(() => {
    if (fireEnabled && charcoalEnabled) return "charcoal";
    if (fireEnabled) return "fire";
    if (ledEnabled) return "led";
    if (trailsVisible) return "trails";
    return "none";
  });

  function selectEffect(effect: ActiveEffect) {
    // Turn everything off first
    if (vm.isFireEffectEnabled()) vm.setFireEffect(false);
    if (vm.isLedEffectEnabled()) vm.setLedEffect(false);
    if (vm.isTrailsVisible()) vm.setTrailStyle("off");
    vm.setFireUseCharcoal(false);

    // Turn on the selected one
    if (effect === "fire") {
      vm.setFireEffect(true);
    } else if (effect === "charcoal") {
      vm.setFireUseCharcoal(true);
      vm.setFireEffect(true);
    } else if (effect === "led") {
      vm.setLedEffect(true);
    } else if (effect === "trails") {
      vm.setTrailStyle("on");
    }
  }

  // ── Effect definitions ──
  const effects: ReadonlyArray<{
    readonly id: ActiveEffect;
    readonly label: string;
    readonly icon: string;
    readonly iconColor?: string;
  }> = [
    { id: "none", label: "None", icon: "fa-ban" },
    { id: "fire", label: "Fire", icon: "fa-fire-flame-curved", iconColor: "#f97316" },
    { id: "charcoal", label: "Charcoal", icon: "fa-fire", iconColor: "#a855f7" },
    { id: "led", label: "LED", icon: "fa-lightbulb", iconColor: "#22c55e" },
    { id: "trails", label: "Trails", icon: "fa-wind", iconColor: "#60a5fa" },
  ];

  // ── Grid options ──
  const gridOptions: ReadonlyArray<{ id: GridMode; label: string }> = [
    { id: "none", label: "Off" },
    { id: "diamond", label: "Diamond" },
    { id: "box", label: "Box" },
  ];

  // ── Display toggles ──
  const displayToggles: ReadonlyArray<{
    key: "stepNumbers" | "beatPosition" | "props" | "wordHeader" | "progressBar" | "tkaGlyph";
    label: string;
  }> = [
    { key: "stepNumbers", label: "Step Numbers" },
    { key: "beatPosition", label: "Beat Position" },
    { key: "props", label: "Props" },
    { key: "wordHeader", label: "Word Header" },
    { key: "progressBar", label: "Progress Bar" },
    { key: "tkaGlyph", label: "TKA Glyph" },
  ];

  function getToggleValue(key: string): boolean {
    switch (key) {
      case "stepNumbers": return stepNumbers;
      case "beatPosition": return beatPosition;
      case "props": return propsVisible;
      case "wordHeader": return wordHeader;
      case "progressBar": return progressBar;
      case "tkaGlyph": return tkaGlyph;
      default: return false;
    }
  }

  // ── Auto-select initial effect when modal opens ──
  $effect(() => {
    if (open && initialCategory) {
      if (initialCategory === "fire" && !fireEnabled) selectEffect("fire");
      else if (initialCategory === "led" && !ledEnabled) selectEffect("led");
    }
  });

  // ── Playback ──
  function startPlayback() {
    lastFrameTime = performance.now();
    function tick(now: number) {
      const dt = (now - lastFrameTime) / 1000;
      lastFrameTime = now;
      const bpm = vm.getBpm();
      const beatsPerSecond = bpm / 60;
      const totalSteps = (sequenceData?.steps?.length ?? 0) + 1;
      if (totalSteps > 0) {
        playbackStep = (playbackStep + beatsPerSecond * dt) % totalSteps;
      }
      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);
  }

  function stopPlayback() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function togglePlayback() {
    isPlaying = !isPlaying;
  }

  $effect(() => {
    if (open && isPlaying) {
      startPlayback();
    } else {
      stopPlayback();
    }
    return () => stopPlayback();
  });

  onDestroy(() => stopPlayback());
</script>

<BaseModal bind:open size="xl" animation="pop" onclose={() => (open = false)}>
  {#snippet header()}
    <div class="settings-header" data-animate="1">
      <h2>
        <i class="fas fa-sliders" aria-hidden="true"></i>
        Canvas Settings
      </h2>
      <button
        class="close-btn"
        onclick={() => (open = false)}
        type="button"
        aria-label="Close settings"
      >
        <i class="fas fa-times" aria-hidden="true"></i>
      </button>
    </div>
  {/snippet}

  <div class="settings-layout">
    <!-- Canvas preview -->
    <div class="preview-section" data-animate="2">
      <div class="preview-canvas-container">
        <AnimatorCanvas
          {sequenceData}
          {blueProp}
          {redProp}
          {letter}
          {stepData}
          {word}
          currentStep={playbackStep}
          {isPlaying}
          focused
          disableContextMenu
        />
      </div>
      <div class="playback-controls">
        <button
          class="play-btn"
          onclick={togglePlayback}
          type="button"
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          <i
            class="fas"
            class:fa-play={!isPlaying}
            class:fa-pause={isPlaying}
            aria-hidden="true"
          ></i>
        </button>
      </div>
    </div>

    <!-- Controls panel -->
    <div class="controls-section">
      <!-- Effect picker -->
      <div class="control-group" data-animate="3">
        <span class="group-label">Effect</span>
        <div class="effect-picker">
          {#each effects as effect}
            <button
              class="effect-btn"
              class:active={activeEffect === effect.id}
              type="button"
              aria-pressed={activeEffect === effect.id}
              onclick={() => selectEffect(effect.id)}
            >
              <i
                class="fas {effect.icon}"
                style={effect.iconColor && activeEffect === effect.id ? `color: ${effect.iconColor}` : ""}
                aria-hidden="true"
              ></i>
              <span>{effect.label}</span>
            </button>
          {/each}
        </div>
      </div>

      <!-- Effect detail controls -->
      {#if activeEffect === "fire"}
        <div class="control-group" data-animate="4">
          <FireCategory />
        </div>
      {:else if activeEffect === "charcoal"}
        <div class="control-group" data-animate="4">
          <CharcoalCategory />
        </div>
      {:else if activeEffect === "led"}
        <div class="control-group" data-animate="4">
          <LedCategory />
        </div>
      {/if}

      <!-- Grid -->
      <div class="control-group" data-animate="5">
        <span class="group-label">Grid</span>
        <div class="preset-row">
          {#each gridOptions as opt}
            <button
              class="preset-btn"
              class:active={gridMode === opt.id}
              type="button"
              aria-pressed={gridMode === opt.id}
              onclick={() => vm.setGridMode(opt.id)}
            >
              {opt.label}
            </button>
          {/each}
        </div>
      </div>

      <!-- Display toggles -->
      <div class="control-group" data-animate="6">
        <span class="group-label">Display</span>
        <div class="toggle-grid">
          {#each displayToggles as toggle}
            <button
              class="toggle-chip"
              class:active={getToggleValue(toggle.key)}
              type="button"
              aria-pressed={getToggleValue(toggle.key)}
              onclick={() => vm.toggleVisibility(toggle.key)}
            >
              {toggle.label}
            </button>
          {/each}
        </div>
      </div>
    </div>
  </div>
</BaseModal>

<style>
  .settings-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px 12px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.06));
  }

  .settings-header h2 {
    margin: 0;
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: var(--theme-text, white);
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .settings-header h2 i {
    color: var(--theme-accent, #8b5cf6);
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: transparent;
    border: none;
    border-radius: 8px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    cursor: pointer;
    transition:
      background var(--duration-fast, 100ms) ease,
      color var(--duration-fast, 100ms) ease;
  }

  .close-btn:hover {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    color: var(--theme-text, white);
  }

  .close-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: -2px;
  }

  /* ── Layout ── */
  .settings-layout {
    display: flex;
    flex-direction: column;
    gap: 24px;
    padding: 20px;
    overflow-y: auto;
  }

  .preview-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .preview-canvas-container {
    width: 100%;
    max-width: 500px;
    aspect-ratio: 1;
  }

  .playback-controls {
    display: flex;
    justify-content: center;
  }

  .play-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 50%;
    color: var(--theme-text, white);
    cursor: pointer;
    transition: all var(--duration-fast, 100ms) ease;
  }

  .play-btn:hover {
    background: color-mix(in srgb, var(--theme-accent) 15%, transparent);
    border-color: var(--theme-accent, #8b5cf6);
  }

  .play-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: 2px;
  }

  /* ── Controls panel ── */
  .controls-section {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .control-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .group-label {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  /* ── Effect picker ── */
  .effect-picker {
    display: flex;
    gap: 6px;
  }

  .effect-btn {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    min-height: var(--min-touch-target, 44px);
    padding: 10px 8px;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 10px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-fast, 100ms) ease;
  }

  .effect-btn i {
    font-size: 16px;
  }

  .effect-btn:hover {
    background: color-mix(in srgb, var(--theme-text) 8%, transparent);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    color: var(--theme-text, white);
  }

  .effect-btn.active {
    background: color-mix(in srgb, var(--theme-accent) 15%, transparent);
    border-color: var(--theme-accent, #8b5cf6);
    color: var(--theme-text, white);
  }

  .effect-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: 2px;
  }

  /* ── Preset buttons (grid options) ── */
  .preset-row {
    display: flex;
    gap: 6px;
  }

  .preset-btn {
    flex: 1;
    min-height: var(--min-touch-target, 44px);
    padding: 8px;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-fast, 100ms) ease;
  }

  .preset-btn:hover {
    background: color-mix(in srgb, var(--theme-text) 8%, transparent);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    color: var(--theme-text, white);
  }

  .preset-btn.active {
    background: color-mix(in srgb, var(--theme-accent) 15%, transparent);
    border-color: var(--theme-accent, #8b5cf6);
    color: var(--theme-text, white);
  }

  .preset-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: 2px;
  }

  /* ── Display toggle chips ── */
  .toggle-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .toggle-chip {
    padding: 6px 12px;
    min-height: 32px;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 16px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-fast, 100ms) ease;
  }

  .toggle-chip:hover {
    background: color-mix(in srgb, var(--theme-text) 8%, transparent);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    color: var(--theme-text, white);
  }

  .toggle-chip.active {
    background: color-mix(in srgb, var(--theme-accent) 15%, transparent);
    border-color: var(--theme-accent, #8b5cf6);
    color: var(--theme-text, white);
  }

  .toggle-chip:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: 2px;
  }

  /* ── Desktop: side-by-side ── */
  @media (min-width: 800px) {
    .settings-layout {
      flex-direction: row;
      align-items: flex-start;
    }

    .preview-section {
      flex: 1 1 50%;
      position: sticky;
      top: 0;
    }

    .preview-canvas-container {
      max-width: 600px;
    }

    .controls-section {
      flex: 1 1 50%;
      min-width: 280px;
    }
  }

  @media (min-width: 1400px) {
    .preview-canvas-container {
      max-width: 700px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .close-btn,
    .play-btn,
    .effect-btn,
    .preset-btn,
    .toggle-chip {
      transition: none;
    }
  }
</style>
