<!--
  AssembleIdlePanel.svelte - Guidance panel shown when the builder is idle.

  Desktop: sits to the left of the grid in a side-by-side layout.
  Mobile: compact card above the grid.
  Disappears once the user taps their first grid point.
-->
<script lang="ts">
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import SegmentedControl from "$lib/shared/3d/components/controls/SegmentedControl.svelte";
  import type { AssembleState } from "../state/assemble-state.svelte";

  let { builderState }: { builderState: AssembleState } = $props();

  const GRID_MODES: { value: GridMode; label: string; desc: string }[] = [
    { value: GridMode.DIAMOND, label: "Diamond", desc: "N / E / S / W" },
    { value: GridMode.BOX, label: "Box", desc: "NE / SE / SW / NW" },
    { value: GridMode.SKEWED, label: "Merged", desc: "All 8 points" },
  ];

  const activeModeDesc = $derived(
    GRID_MODES.find((m) => m.value === builderState.gridMode)?.desc ?? ""
  );
</script>

<aside class="idle-panel" aria-label="Build setup">
  <div class="panel-content">
    <div class="heading-area">
      <div class="icon-circle" aria-hidden="true">
        <i class="fas fa-hand-pointer"></i>
      </div>
      <h2 class="panel-title">Build a Sequence</h2>
    </div>

    <div class="steps-guide">
      <div class="guide-step">
        <span class="step-number">1</span>
        <span class="step-text">Tap a grid point to place your first prop</span>
      </div>
      <div class="guide-step">
        <span class="step-number">2</span>
        <span class="step-text">Tap another point to create a motion</span>
      </div>
      <div class="guide-step">
        <span class="step-number">3</span>
        <span class="step-text">Build blue hand first, then switch to red</span>
      </div>
    </div>

    <div class="divider"></div>

    <div class="mode-section">
      <div class="mode-select">
        <SegmentedControl
          options={GRID_MODES}
          value={builderState.gridMode}
          onchange={(mode) => builderState.setGridMode(mode)}
          size="sm"
          color="accent"
        />
        <span class="mode-desc">{activeModeDesc}</span>
      </div>

      <button
        class="center-chip"
        class:active={builderState.showCenter}
        role="switch"
        aria-checked={builderState.showCenter}
        aria-label="Include center point"
        onclick={() => builderState.setShowCenter(!builderState.showCenter)}
      >
        <span class="chip-label">+ Center</span>
        <span class="chip-desc">Adds a 9th point</span>
      </button>

      <button
        class="center-chip"
        class:active={builderState.keyboardMode}
        role="switch"
        aria-checked={builderState.keyboardMode}
        aria-label="Keyboard mode (use numpad)"
        onclick={() => builderState.toggleKeyboardMode()}
      >
        <span class="chip-label"><i class="fas fa-keyboard" aria-hidden="true"></i> Keyboard</span>
        <span class="chip-desc">Build with numpad</span>
      </button>
    </div>
  </div>
</aside>

<style>
  .idle-panel {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    padding: 32px 24px;
  }

  .panel-content {
    display: flex;
    flex-direction: column;
    gap: 20px;
    width: 100%;
    max-width: 320px;
  }

  .heading-area {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    text-align: center;
  }

  .icon-circle {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 15%, transparent);
    border: 1.5px solid color-mix(in srgb, var(--theme-accent, #6366f1) 25%, transparent);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--font-size-lg, 18px);
    color: var(--theme-accent, #6366f1);
  }

  .panel-title {
    margin: 0;
    font-size: var(--font-size-lg, 18px);
    font-weight: 600;
    color: var(--theme-text, #fff);
  }

  /* ── Step guide ── */
  .steps-guide {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .guide-step {
    display: flex;
    align-items: flex-start;
    gap: 10px;
  }

  .step-number {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    flex-shrink: 0;
  }

  .step-text {
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    line-height: 1.4;
  }

  .divider {
    height: 1px;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.08));
  }

  /* ── Grid mode selector + toggles ── */
  .mode-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .mode-select {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .mode-desc {
    /* Reserve a fixed line height so swapping descriptions (which vary in
       width) never reflows the toggles below it. */
    min-height: 1.2em;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.45));
    text-align: center;
    font-variant-numeric: tabular-nums;
  }

  .center-chip {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 18px;
    border-radius: 12px;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text, #fff);
    cursor: pointer;
    min-height: 52px;
    text-align: left;
    transition: border-color 0.15s ease, background 0.15s ease;
  }

  .center-chip:hover {
    background: var(--theme-card-bg-hover, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
  }

  .center-chip.active {
    border-color: var(--theme-accent, #6366f1);
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 10%, transparent);
  }

  .center-chip:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .chip-label {
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
  }

  .chip-desc {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.45));
  }

  /* ── Mobile ── */
  @media (max-width: 768px) {
    .idle-panel {
      padding: 16px;
      flex: 0 0 auto;
    }

    .heading-area {
      flex-direction: row;
      text-align: left;
      gap: 10px;
    }

    .icon-circle {
      width: 40px;
      height: 40px;
      font-size: var(--font-size-min, 14px);
    }

    .panel-title {
      font-size: var(--font-size-base, 16px);
    }

    .steps-guide {
      gap: 6px;
    }

    .step-text {
      font-size: var(--font-size-compact, 12px);
    }

    .center-chip {
      padding: 10px 14px;
      min-height: 44px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .center-chip {
      transition: none;
    }
  }
</style>
