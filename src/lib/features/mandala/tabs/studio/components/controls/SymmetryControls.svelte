<script lang="ts">
  import { t } from "$lib/shared/i18n/i18n.svelte";
  import { mandalaState } from "../../state/mandala-state.svelte";
  import { SYMMETRY_FOLDS } from "../../domain/enums/mandala-enums";
  import type {
    SymmetryFold,
    MirrorAxis,
  } from "../../domain/enums/mandala-enums";

  interface Props {
    onFoldChange?: (foldCount: SymmetryFold) => void;
    onMirrorToggle?: () => void;
    onMirrorAxisChange?: (axis: MirrorAxis) => void;
  }

  let { onFoldChange, onMirrorToggle, onMirrorAxisChange }: Props = $props();

  const config = $derived(mandalaState.config);

  // Calculate the multiplier for how many copies each element creates
  const copyMultiplier = $derived.by(() => {
    const mirrorMultiplier =
      config.enableMirror && config.mirrorAxis === "both"
        ? 4
        : config.enableMirror && config.mirrorAxis !== "none"
          ? 2
          : 1;
    return config.foldCount * mirrorMultiplier;
  });

  // Mirror axis options
  const MIRROR_AXES = $derived<{ id: MirrorAxis; label: string }[]>([
    { id: "none", label: t('mandala_mirror_none') },
    { id: "vertical", label: t('mandala_mirror_vertical') },
    { id: "horizontal", label: t('mandala_mirror_horizontal') },
    { id: "both", label: t('mandala_mirror_both') },
  ]);

  function handleFoldChange(fold: SymmetryFold) {
    mandalaState.setFoldCount(fold);
    onFoldChange?.(fold);
  }

  function handleMirrorToggle() {
    mandalaState.setEnableMirror(!config.enableMirror);
    onMirrorToggle?.();
  }

  function handleMirrorAxisChange(axis: MirrorAxis) {
    mandalaState.setMirrorAxis(axis);
    if (axis !== "none") {
      mandalaState.setEnableMirror(true);
    }
    onMirrorAxisChange?.(axis);
  }

  function handleGridDotsToggle() {
    mandalaState.setShowGridDots(!config.showGridDots);
  }
</script>

<div class="symmetry-controls">
  <!-- Fold count selector -->
  <div class="control-section">
    <div class="section-label">{t('mandala_symmetry_folds')}</div>
    <div class="fold-chips">
      {#each SYMMETRY_FOLDS as fold (fold)}
        <button
          class="fold-chip"
          class:active={config.foldCount === fold}
          onclick={() => handleFoldChange(fold)}
        >
          {fold}
        </button>
      {/each}
    </div>
  </div>

  <!-- Mirror controls -->
  <div class="control-section">
    <div class="section-label">{t('mandala_mirror_reflection')}</div>
    <div class="mirror-axes">
      {#each MIRROR_AXES as axis (axis.id)}
        <button
          class="mirror-chip"
          class:active={(config.enableMirror &&
            config.mirrorAxis === axis.id) ||
            (!config.enableMirror && axis.id === "none")}
          onclick={() => handleMirrorAxisChange(axis.id)}
        >
          {axis.label}
        </button>
      {/each}
    </div>
  </div>

  <!-- Visual info -->
  <div class="control-section">
    <div class="symmetry-info">
      <span class="info-value">{t('mandala_n_fold', { count: String(config.foldCount) })}</span>
      <span class="info-detail">
        {#if config.enableMirror && config.mirrorAxis !== "none"}
          {t('mandala_plus_mirror', { axis: config.mirrorAxis })}
        {:else}
          {t('mandala_rotational_only')}
        {/if}
      </span>
    </div>
    <div class="element-count">
      {t('mandala_copy_count', { count: String(copyMultiplier) })}
    </div>
  </div>

  <!-- Grid dots toggle -->
  <div class="control-section">
    <button
      class="toggle-button"
      class:active={config.showGridDots}
      onclick={handleGridDotsToggle}
    >
      <span class="toggle-icon">{config.showGridDots ? "●" : "○"}</span>
      <span class="toggle-label">{t('mandala_show_grid_dots')}</span>
    </button>
  </div>
</div>

<style>
  .symmetry-controls {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-radius: var(--settings-radius-md, 8px);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .control-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .section-label {
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    color: var(--theme-text, white);
  }

  .fold-chips {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .fold-chip {
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    font-weight: 600;
    border: 2px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    background: transparent;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    border-radius: 50%;
    cursor: pointer;
    transition: all var(--duration-fast) ease;
  }

  .fold-chip:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.3));
    color: var(--theme-text, white);
    transform: scale(1.05);
  }

  .fold-chip.active {
    background: var(--theme-accent, #4a9eff);
    border-color: var(--theme-accent, #4a9eff);
    color: white;
    transform: scale(1.1);
  }

  .mirror-axes {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .mirror-chip {
    min-height: var(--min-touch-target);
    padding: 12px 16px;
    font-size: var(--font-size-min, 14px);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    background: transparent;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    border-radius: 6px;
    cursor: pointer;
    transition: all var(--duration-fast) ease;
  }

  .mirror-chip:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.25));
    color: var(--theme-text, white);
  }

  .mirror-chip.active {
    background: var(--theme-accent, #4a9eff);
    border-color: var(--theme-accent, #4a9eff);
    color: white;
  }

  .symmetry-info {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  .info-value {
    font-size: 18px;
    font-weight: 600;
    color: var(--theme-accent, #4a9eff);
  }

  .info-detail {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
  }

  .element-count {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
    font-style: italic;
  }

  .toggle-button {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: var(--min-touch-target);
    padding: 12px 16px;
    background: rgba(0, 0, 0, 0.2);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    cursor: pointer;
    transition: all var(--duration-fast) ease;
  }

  .toggle-button:hover {
    background: rgba(255, 255, 255, 0.05);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .toggle-button.active {
    background: rgba(74, 158, 255, 0.15);
    border-color: var(--theme-accent, #4a9eff);
  }

  .toggle-icon {
    font-size: 16px;
    color: var(--theme-accent, #4a9eff);
  }

  .toggle-label {
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text, white);
  }
</style>
