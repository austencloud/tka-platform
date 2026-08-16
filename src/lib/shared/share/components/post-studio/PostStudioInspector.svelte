<script lang="ts">
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";
  import ScrubbableNumber from "$lib/shared/ui/components/ScrubbableNumber.svelte";
  import type { ExportOptionsStateManager } from "$lib/shared/animation-panel/state/export-options-state.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import { getMediaCompositionContext } from "$lib/shared/media-composition/state/media-composition-context";
  import type { ResolvedAutoLayout } from "$lib/shared/render/services/container-aware-layout";
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import type {
    ClipTransform,
    LayoutRegion,
  } from "$lib/shared/media-composition/domain/media-layout-schema";
  import PostStudioSourceSettings from "./PostStudioSourceSettings.svelte";

  let {
    sequence,
    exportOptions,
    selectedPropType,
    onPropChange,
    resolvedAutoLayout = null,
  }: {
    sequence: SequenceData;
    exportOptions: ExportOptionsStateManager;
    selectedPropType: PropType;
    onPropChange: (propType: PropType) => void;
    resolvedAutoLayout?: ResolvedAutoLayout | null;
  } = $props();

  const composition = getMediaCompositionContext();

  /**
   * "Fit", not "Placement". A slot's content is centred in its half of the
   * frame and stays there — the horizontal, vertical and rotation controls
   * (and the canvas drag that shadowed them) are gone, because off-centre is
   * not a thing this post format wants. What is left is how the source fills
   * the slot it has: crop or letterbox, how far in, how solid.
   */
  type InspectorView = "source" | "fit";
  const VIEW_OPTIONS: Array<{ value: InspectorView; label: string }> = [
    { value: "source", label: "Look" },
    { value: "fit", label: "Fit" },
  ];

  let view = $state<InspectorView>("source");
  const canReset = $derived(view === "fit");
  let previousRole = $state<string | null>(null);
  const selectedBinding = $derived(composition.selectedBinding);
  // Everything the studio draws itself has a Look to edit; only dropped-in
  // media (a video file, an image) has nothing to steer. Naming the modes that
  // DO have settings meant every new source type shipped without its controls
  // until someone remembered to extend this list.
  // Everything the studio draws itself has a Look to edit; the exceptions are
  // dropped-in media (a video file has nothing to steer) and the 3D view, which
  // isn't wired up yet. Listing the modes that DO have settings was the older
  // shape, and it meant every new source type shipped without its controls
  // until someone remembered to extend the list.
  const WITHOUT_SOURCE_SETTINGS = ["external-media", "scene-3d"];
  const hasSourceSettings = $derived(
    Boolean(selectedBinding?.renderMode) &&
      !WITHOUT_SOURCE_SETTINGS.includes(selectedBinding?.renderMode ?? "")
  );

  $effect(() => {
    const role = composition.selectedRole;
    if (role === previousRole) return;
    previousRole = role;
    view = hasSourceSettings ? "source" : "fit";
  });

  const FIT_OPTIONS: Array<{ value: LayoutRegion["fit"]; label: string }> = [
    { value: "cover", label: "Crop" },
    { value: "contain", label: "Fit" },
    { value: "fill", label: "Stretch" },
  ];

  const transform = $derived(composition.selectedTransform);
  const opacity = $derived(composition.selectedOpacity ?? 1);
  const changed = $derived(
    Boolean(transform && (transform.scale !== 1 || opacity !== 1))
  );

  function numberFrom(event: Event): number {
    return Number((event.currentTarget as HTMLInputElement).value);
  }

  function setTransform(key: keyof ClipTransform, value: number): void {
    composition.setSelectedTransform({ [key]: value });
  }
</script>

<section
  class="inspector"
  class:source-open={view === "source" && hasSourceSettings}
  aria-labelledby="post-studio-inspector"
>
  <div class="inspector-heading">
    <div>
      <span class="eyebrow">Selected layer</span>
      <h3 id="post-studio-inspector">
        {selectedBinding?.label ??
          composition.selectedRegion?.label ??
          "Canvas"}
      </h3>
    </div>
    {#if canReset}
      <button
        type="button"
        class="reset-button"
        disabled={!changed}
        aria-label="Reset how the selected layer fills its slot"
        onclick={composition.resetSelectedAppearance}
      >
        <i class="fa-solid fa-arrow-rotate-left" aria-hidden="true"></i>
        Reset
      </button>
    {/if}
  </div>

  {#if composition.selectedRegion && transform}
    {#if hasSourceSettings}
      <div class="switch-row">
        <SegmentedControl
          options={VIEW_OPTIONS}
          value={view}
          onchange={(value) => (view = value)}
          ariaLabel="Choose layer settings or how it fills its slot"
          semantics="tabs"
          size="sm"
          color="accent"
        />
      </div>
    {/if}

    {#if view === "source" && hasSourceSettings}
      <PostStudioSourceSettings
        {sequence}
        {exportOptions}
        {selectedPropType}
        {onPropChange}
        {resolvedAutoLayout}
      />
    {:else}
      {#if composition.selectedSupportsFit}
        <div class="control-group">
          <span class="group-label">Frame fit</span>
          <div class="switch-row wide">
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
        </div>
      {/if}

      <div class="control-group fill-controls">
        <div class="group-heading">
          <span class="group-label">Fill</span>
        </div>

        <div class="slider-row">
          <span>Scale</span>
          <input
            type="range"
            min="50"
            max="200"
            step="1"
            value={Math.round(transform.scale * 100)}
            aria-label="Scale"
            aria-valuetext={`${Math.round(transform.scale * 100)} percent`}
            oninput={(event) => setTransform("scale", numberFrom(event) / 100)}
          />
          <ScrubbableNumber
            label="Scale"
            value={transform.scale * 100}
            min={50}
            max={200}
            step={1}
            unit="%"
            showLabel={false}
            onchange={(value) => setTransform("scale", value / 100)}
          />
        </div>

        <div class="slider-row">
          <span>Opacity</span>
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={Math.round(opacity * 100)}
            aria-label="Opacity"
            aria-valuetext={`${Math.round(opacity * 100)} percent`}
            oninput={(event) =>
              composition.setSelectedOpacity(numberFrom(event) / 100)}
          />
          <ScrubbableNumber
            label="Opacity"
            value={opacity * 100}
            min={0}
            max={100}
            step={1}
            unit="%"
            showLabel={false}
            onchange={(value) => composition.setSelectedOpacity(value / 100)}
          />
        </div>
      </div>
    {/if}
  {:else}
    <div class="inspector-empty">
      <i class="fa-solid fa-arrow-pointer" aria-hidden="true"></i>
      <p>Select a slot on the canvas to edit what is in it.</p>
    </div>
  {/if}
</section>

<style>
  .inspector {
    display: grid;
    min-height: 0;
    align-content: start;
    gap: var(--studio-panel-gap, var(--spacing-lg));
  }

  .inspector.source-open {
    grid-template-rows: auto auto minmax(0, 1fr);
    height: 100%;
    align-content: stretch;
  }

  /* SegmentedControl is width:100% by design, so a full-width parent stretches
     two short words across the whole rail — 359px per tab at 1920, 507px at
     4K. The switch is a control, not a progress bar: size it from the control
     height so it steps with the studio's own 105rem / 180rem tiers. */
  .switch-row {
    width: min(100%, calc(var(--studio-control-height, 2.75rem) * 8));
  }

  .switch-row.wide {
    width: min(100%, calc(var(--studio-control-height, 2.75rem) * 11));
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
    font-size: var(--studio-meta-size, var(--font-size-compact));
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
    font-size: var(--studio-section-title-size, 1.15rem);
  }

  .reset-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-sm);
    min-height: var(--studio-control-height, 2.75rem);
    padding: 0.5rem 0.7rem;
    border: 1px solid var(--theme-stroke);
    border-radius: var(--radius-2026-sm);
    background: var(--theme-card-bg);
    color: var(--theme-text);
    font: inherit;
    font-size: var(--studio-meta-size, var(--font-size-compact));
    cursor: pointer;
  }

  .reset-button:disabled {
    opacity: 0.42;
    cursor: not-allowed;
  }

  .reset-button:focus-visible,
  input:focus-visible {
    outline: 3px solid var(--theme-accent);
    outline-offset: 2px;
  }

  .control-group {
    display: grid;
    gap: 0.75rem;
  }

  .fill-controls {
    padding-top: var(--spacing-md);
    border-top: 1px solid var(--theme-stroke);
  }

  .slider-row {
    display: grid;
    grid-template-columns: 5.25rem minmax(5rem, 1fr) 5rem;
    align-items: center;
    gap: 0.75rem;
    min-height: var(--studio-control-height, 2.75rem);
    color: var(--theme-text-dim);
    font-size: var(--studio-body-size, var(--font-size-min));
  }

  .slider-row input {
    width: 100%;
    height: var(--studio-control-height, 2.75rem);
    margin: 0;
    accent-color: var(--theme-accent);
    cursor: ew-resize;
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
      grid-template-columns: 4.5rem minmax(4rem, 1fr) 5rem;
      gap: var(--spacing-sm);
    }
  }
</style>
