<!--
  Post Studio's transport row.

  It is the shared `UnifiedTimeline` — the same bar the 2D animation canvas and
  the 3D viewer dock under their own frames — reading the composition clock
  through `createCompositionPlaybackAdapter`. The studio used to hand-roll its
  own play button, tempo control, time readout and scrubber styling; two bars
  meant two things to maintain and they had already drifted apart.

  Only what is genuinely Post Studio's rides in the trailing slot: whether the
  animation is aligned to a real timing map, and the toggle for the clip lanes.
-->
<script lang="ts">
  import { getMediaCompositionContext } from "$lib/shared/media-composition/state/media-composition-context";
  import { createCompositionPlaybackAdapter } from "$lib/shared/media-composition/state/composition-playback-adapter";
  import UnifiedTimeline from "$lib/shared/timeline/UnifiedTimeline.svelte";

  let {
    advanced = false,
    performanceAlignmentDetail = null,
    showAdvancedToggle = true,
    onMapPerformance,
    onToggleAdvanced,
  }: {
    advanced?: boolean;
    performanceAlignmentDetail?: string | null;
    /** The clip-lane editor is unreachable on the compact layout, which reaches
     *  it through the bottom nav instead. */
    showAdvancedToggle?: boolean;
    onMapPerformance?: () => void;
    onToggleAdvanced?: () => void;
  } = $props();

  const composition = getMediaCompositionContext();
  const playback = createCompositionPlaybackAdapter(composition);

  const alignmentLabel = $derived.by(() => {
    if (performanceAlignmentDetail) {
      if (performanceAlignmentDetail.startsWith("Unmapped")) {
        return "Even timing estimate";
      }
      if (performanceAlignmentDetail.includes("needs repair")) {
        return "Timing map needs repair";
      }
      return performanceAlignmentDetail;
    }
    const source = composition.sequenceTimeMap?.source;
    if (!source) return null;
    // "Even timing" said nothing. A tempo grid is what you get when there is no
    // performance to align to, which is the default for an animation-and-card
    // post — so the label was permanently on and permanently uninformative.
    // The alignment chip now appears only when alignment is a real fact.
    if (source === "tempo-grid") return null;
    if (source === "audio-detected") return "Audio aligned";
    if (source === "motion-detected") return "Motion aligned";
    if (source === "hybrid") return "Audio + motion aligned";
    return "Beat aligned";
  });

  const alignmentNeedsMapping = $derived(
    Boolean(
      performanceAlignmentDetail?.startsWith("Unmapped") ||
        performanceAlignmentDetail?.includes("needs repair")
    )
  );
</script>

<UnifiedTimeline {playback}>
  {#snippet trailing()}
    {#if alignmentLabel}
      <span
        class="alignment"
        title={alignmentNeedsMapping
          ? "A starting grid. Drag the timing handles to match the performance."
          : "The performance, animation, and card use the same beat map."}
      >
        <i class="fa-solid fa-wave-square" aria-hidden="true"></i>
        {alignmentLabel}
      </span>
    {/if}
    {#if alignmentNeedsMapping && onMapPerformance}
      <button type="button" class="map-timing" onclick={onMapPerformance}>
        Map performance
      </button>
    {/if}
    {#if showAdvancedToggle && onToggleAdvanced}
      <button
        type="button"
        class="advanced-toggle"
        class:active={advanced}
        aria-expanded={advanced}
        onclick={onToggleAdvanced}
      >
        <i class="fa-solid fa-sliders" aria-hidden="true"></i>
        {advanced ? "Hide timeline" : "Advanced timing"}
      </button>
    {/if}
  {/snippet}
</UnifiedTimeline>

<style>
  .alignment {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.25rem 0.45rem;
    border: 1px solid var(--theme-stroke);
    border-radius: 999px;
    background: var(--theme-card-bg);
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.66));
    font-size: var(--studio-meta-size, var(--font-size-compact, 0.75rem));
    line-height: 1;
    white-space: nowrap;
  }

  .map-timing {
    min-height: var(--min-touch-target, 44px);
    padding: 0.35rem 0.65rem;
    border: 1px solid var(--theme-accent);
    border-radius: var(--radius-2026-full);
    background: color-mix(in srgb, var(--theme-accent) 12%, transparent);
    color: var(--theme-text);
    font: inherit;
    font-size: var(--studio-meta-size, var(--font-size-compact));
    font-weight: 700;
    white-space: nowrap;
    cursor: pointer;
  }

  .advanced-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-sm);
    /* Sized for the longer of its two labels so flipping between "Advanced
       timing" and "Hide timeline" does not resize the bar's trailing group. */
    min-width: 10rem;
    min-height: var(--min-touch-target, 44px);
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--theme-stroke);
    border-radius: var(--radius-2026-sm);
    background: var(--theme-card-bg);
    color: var(--theme-text);
    font: inherit;
    font-size: var(--studio-meta-size, var(--font-size-compact));
    font-weight: 700;
    white-space: nowrap;
    cursor: pointer;
  }

  .advanced-toggle.active {
    border-color: var(--theme-accent);
    color: var(--theme-accent);
  }

  .map-timing:focus-visible,
  .advanced-toggle:focus-visible {
    outline: 3px solid var(--theme-accent, #8b7cff);
    outline-offset: 2px;
  }
</style>
