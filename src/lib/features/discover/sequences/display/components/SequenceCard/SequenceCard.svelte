<!--
SequenceCard.svelte

Ultra-minimal card component for the Explore grid.
Clicking the card opens the sequence detail viewer.

Uses PropAwareThumbnail for cloud-cached rendering:
- First user to view a prop type renders it locally
- Rendered image is uploaded to Firebase Storage
- All subsequent users get instant loading from cloud

Variation support:
- When a sequence has variations (same word, different authors/props/turns),
  a pill shows "1/3" etc. at the bottom
- Tapping the pill cycles through variations with crossfade
-->
<script lang="ts">
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import PropAwareThumbnail from "../PropAwareThumbnail.svelte";
  import VariationPill from "./VariationPill.svelte";

  const {
    sequence,
    variations = [],
    onPrimaryAction = () => {},
    selected = false,
    bluePropType = undefined,
    redPropType = undefined,
    catDogModeEnabled = false,
    lightMode = false,
    coverUrl: _coverUrl = undefined, // Legacy prop - kept for backwards compatibility
  }: {
    sequence: SequenceData;
    variations?: SequenceData[];
    onPrimaryAction?: (sequence: SequenceData) => void;
    selected?: boolean;
    bluePropType?: PropType;
    redPropType?: PropType;
    catDogModeEnabled?: boolean;
    lightMode?: boolean;
    coverUrl?: string;
  } = $props();

  // Track which variation is currently displayed
  let currentVariationIndex = $state(0);

  // The sequence currently being shown (either the original or a variation)
  // Always fallback to the base sequence to guarantee non-undefined
  const displayedSequence: SequenceData = $derived.by(() => {
    if (variations.length > 1) {
      const variation = variations[currentVariationIndex];
      return variation ?? sequence;
    }
    return sequence;
  });

  // Total count for the pill
  const variationCount = $derived(variations.length > 1 ? variations.length : 0);

  // Cycle to next variation
  function handleCycleVariation() {
    if (variations.length > 1) {
      currentVariationIndex = (currentVariationIndex + 1) % variations.length;
    }
  }

  function handlePrimaryAction() {
    onPrimaryAction(displayedSequence);
  }

  // Reset index when the base sequence changes
  $effect(() => {
    // Depend on sequence.id to detect base sequence change
    const _ = sequence.id;
    currentVariationIndex = 0;
  });
</script>

<button class="sequence-card" class:selected class:light-mode={lightMode} onclick={handlePrimaryAction}>
  <div class="thumbnail-container" class:crossfade={variationCount > 0}>
    <PropAwareThumbnail
      sequence={displayedSequence}
      {bluePropType}
      {redPropType}
      {catDogModeEnabled}
      {lightMode}
      userName={displayedSequence.ownerDisplayName}
    />
  </div>

  <VariationPill
    currentIndex={currentVariationIndex}
    totalCount={variationCount}
    onCycle={handleCycleVariation}
  />
</button>

<style>
  .sequence-card {
    position: relative;
    border-radius: 8px;
    overflow: hidden;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    color: var(--theme-text);
    display: block;
    box-shadow: 0 12px 40px var(--theme-shadow);
    width: 100%; /* Fill grid cell width */
    padding: 0; /* Remove default button padding */
    margin: 0; /* Remove default button margin */

    /* Enable container queries */
    container-type: inline-size;
    container-name: sequence-card;

    /* Make card clickable */
    cursor: pointer;
    /* Target only specific properties for smoother, faster animations */
    transition:
      transform 0.15s cubic-bezier(0.4, 0, 0.2, 1),
      box-shadow 0.15s cubic-bezier(0.4, 0, 0.2, 1),
      border-color 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .sequence-card:hover {
    /* Subtle scale instead of lift - more modern, less aggressive */
    transform: scale(1.02);
    /* Slightly enhanced shadow - much more subtle */
    box-shadow: 0 14px 50px var(--theme-shadow);
    border-color: var(--theme-stroke-strong);
  }

  /* Active state - brief feedback on touch/mobile only */
  @media (hover: none) and (pointer: coarse) {
    .sequence-card:active {
      transform: scale(0.98);
      transition-duration: var(--duration-instant);
    }
  }

  .sequence-card:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  .sequence-card.selected {
    border-color: color-mix(in srgb, var(--semantic-info) 80%, transparent);
    box-shadow: 0 0 0 2px
      color-mix(in srgb, var(--semantic-info) 40%, transparent);
  }

  /* Light mode: use light background to match light-colored pictograph images */
  .sequence-card.light-mode {
    background: #f5f5f7;
    border-color: rgba(0, 0, 0, 0.12);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  }

  .sequence-card.light-mode:hover {
    border-color: rgba(0, 0, 0, 0.2);
    box-shadow: 0 6px 24px rgba(0, 0, 0, 0.12);
  }

  /* Thumbnail container for crossfade animation */
  .thumbnail-container {
    width: 100%;
    height: 100%;
  }

  /* Smooth crossfade when cycling variations */
  .thumbnail-container.crossfade :global(img),
  .thumbnail-container.crossfade :global(.placeholder) {
    transition: opacity var(--duration-normal) ease-out;
  }
</style>
