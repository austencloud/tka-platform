<script lang="ts">
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";
  import { getMediaCompositionContext } from "$lib/shared/media-composition/state/media-composition-context";
  import type {
    ClipTransform,
    LayoutRegion,
  } from "$lib/shared/media-composition/domain/media-layout-schema";

  const composition = getMediaCompositionContext();

  const FIT_OPTIONS: Array<{ value: LayoutRegion["fit"]; label: string }> = [
    { value: "cover", label: "Crop" },
    { value: "contain", label: "Fit" },
    { value: "fill", label: "Stretch" },
  ];

  const transform = $derived(composition.selectedTransform);
  const opacity = $derived(composition.selectedOpacity ?? 1);
  const changed = $derived(
    Boolean(
      transform &&
      (transform.scale !== 1 ||
        transform.rotationDegrees !== 0 ||
        transform.translateX !== 0 ||
        transform.translateY !== 0 ||
        opacity !== 1)
    )
  );

  function numberFrom(event: Event): number {
    return Number((event.currentTarget as HTMLInputElement).value);
  }

  function setTransform(key: keyof ClipTransform, value: number): void {
    composition.setSelectedTransform({ [key]: value });
  }
</script>

<section class="inspector" aria-labelledby="post-studio-inspector">
  <div class="inspector-heading">
    <div>
      <span class="eyebrow">Selected area</span>
      <h3 id="post-studio-inspector">
        {composition.selectedRegion?.label ?? "Canvas"}
      </h3>
    </div>
    <button
      type="button"
      class="reset-button"
      disabled={!changed}
      aria-label="Reset selected area placement"
      onclick={composition.resetSelectedAppearance}
    >
      <i class="fa-solid fa-arrow-rotate-left" aria-hidden="true"></i>
      Reset
    </button>
  </div>

  {#if composition.selectedRegion && transform}
    <div class="control-group">
      <span class="group-label">Frame fit</span>
      <SegmentedControl
        options={FIT_OPTIONS}
        value={composition.selectedRegion.fit}
        onchange={composition.setSelectedFit}
        ariaLabel="How the source fits the selected area"
        semantics="radiogroup"
        size="sm"
        color="accent"
      />
    </div>

    <div class="control-group placement-controls">
      <div class="group-heading">
        <span class="group-label">Placement</span>
        <span class="drag-hint">
          <i class="fa-solid fa-up-down-left-right" aria-hidden="true"></i>
          Drag on canvas
        </span>
      </div>

      <label class="slider-row">
        <span>Scale</span>
        <input
          type="range"
          min="50"
          max="200"
          step="1"
          value={Math.round(transform.scale * 100)}
          aria-valuetext={`${Math.round(transform.scale * 100)} percent`}
          oninput={(event) => setTransform("scale", numberFrom(event) / 100)}
        />
        <output>{Math.round(transform.scale * 100)}%</output>
      </label>

      <label class="slider-row">
        <span>Horizontal</span>
        <input
          type="range"
          min="-100"
          max="100"
          step="1"
          value={Math.round(transform.translateX * 100)}
          aria-valuetext={`${Math.round(transform.translateX * 100)} percent`}
          oninput={(event) =>
            setTransform("translateX", numberFrom(event) / 100)}
        />
        <output>{Math.round(transform.translateX * 100)}%</output>
      </label>

      <label class="slider-row">
        <span>Vertical</span>
        <input
          type="range"
          min="-100"
          max="100"
          step="1"
          value={Math.round(transform.translateY * 100)}
          aria-valuetext={`${Math.round(transform.translateY * 100)} percent`}
          oninput={(event) =>
            setTransform("translateY", numberFrom(event) / 100)}
        />
        <output>{Math.round(transform.translateY * 100)}%</output>
      </label>

      <label class="slider-row">
        <span>Rotation</span>
        <input
          type="range"
          min="-180"
          max="180"
          step="1"
          value={Math.round(transform.rotationDegrees)}
          aria-valuetext={`${Math.round(transform.rotationDegrees)} degrees`}
          oninput={(event) =>
            setTransform("rotationDegrees", numberFrom(event))}
        />
        <output>{Math.round(transform.rotationDegrees)}°</output>
      </label>

      <label class="slider-row">
        <span>Opacity</span>
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          value={Math.round(opacity * 100)}
          aria-valuetext={`${Math.round(opacity * 100)} percent`}
          oninput={(event) =>
            composition.setSelectedOpacity(numberFrom(event) / 100)}
        />
        <output>{Math.round(opacity * 100)}%</output>
      </label>
    </div>

    <button
      type="button"
      class:active={composition.safeZonesVisible}
      class="guide-toggle"
      aria-pressed={composition.safeZonesVisible}
      onclick={composition.toggleSafeZones}
    >
      <i class="fa-solid fa-border-all" aria-hidden="true"></i>
      <span>
        <strong>Instagram safe area</strong>
        <small>Show where interface controls cover the post.</small>
      </span>
    </button>
  {:else}
    <div class="inspector-empty">
      <i class="fa-solid fa-arrow-pointer" aria-hidden="true"></i>
      <p>Select an area on the canvas to edit its placement.</p>
    </div>
  {/if}
</section>

<style>
  .inspector {
    display: grid;
    gap: var(--spacing-lg);
  }

  .inspector-heading,
  .group-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-md);
  }

  .eyebrow,
  .group-label {
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact);
    font-weight: 650;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .eyebrow {
    display: block;
    margin-bottom: var(--spacing-xs);
  }

  h3 {
    margin: 0;
    color: var(--theme-text);
    font-size: 1.15rem;
  }

  .reset-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-sm);
    min-height: 2.75rem;
    padding: 0.5rem 0.7rem;
    border: 1px solid var(--theme-stroke);
    border-radius: var(--radius-2026-sm);
    background: var(--theme-card-bg);
    color: var(--theme-text);
    font: inherit;
    font-size: var(--font-size-compact);
    cursor: pointer;
  }

  .reset-button:disabled {
    opacity: 0.42;
    cursor: not-allowed;
  }

  .reset-button:focus-visible,
  .guide-toggle:focus-visible,
  input:focus-visible {
    outline: 3px solid var(--theme-accent);
    outline-offset: 2px;
  }

  .control-group {
    display: grid;
    gap: 0.75rem;
  }

  .placement-controls {
    padding-top: var(--spacing-md);
    border-top: 1px solid var(--theme-stroke);
  }

  .drag-hint {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-xs);
    color: var(--theme-accent);
    font-size: var(--font-size-compact);
  }

  .slider-row {
    display: grid;
    grid-template-columns: 5.25rem minmax(5rem, 1fr) 3.25rem;
    align-items: center;
    gap: 0.75rem;
    min-height: 2.75rem;
    color: var(--theme-text-dim);
    font-size: var(--font-size-min);
  }

  .slider-row output {
    color: var(--theme-text);
    font-variant-numeric: tabular-nums;
    text-align: right;
  }

  .slider-row input {
    width: 100%;
    height: 2.75rem;
    margin: 0;
    accent-color: var(--theme-accent);
    cursor: ew-resize;
  }

  .guide-toggle {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 0.75rem;
    min-height: 4rem;
    padding: 0.625rem 0.75rem;
    border: 1px solid var(--theme-stroke);
    border-radius: var(--radius-2026-sm);
    background: var(--theme-card-bg);
    color: var(--theme-text);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .guide-toggle > i {
    color: var(--theme-text-dim);
  }

  .guide-toggle > span {
    display: grid;
    gap: 0.15rem;
  }

  .guide-toggle strong {
    font-size: var(--font-size-min);
  }

  .guide-toggle small {
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact);
    line-height: 1.35;
  }

  .guide-toggle.active {
    border-color: color-mix(
      in srgb,
      var(--semantic-warning) 52%,
      var(--theme-stroke)
    );
  }

  .guide-toggle.active > i {
    color: var(--semantic-warning);
  }

  .inspector-empty {
    display: grid;
    justify-items: center;
    gap: var(--spacing-md);
    padding: var(--spacing-xl) var(--spacing-md);
    color: var(--theme-text-dim);
    text-align: center;
  }

  .inspector-empty i {
    font-size: 1.5rem;
  }

  .inspector-empty p {
    margin: 0;
    font-size: var(--font-size-min);
    line-height: 1.45;
  }

  @container post-studio (max-width: 30rem) {
    .slider-row {
      grid-template-columns: 4.5rem minmax(4rem, 1fr) 3rem;
      gap: var(--spacing-sm);
    }
  }
</style>
