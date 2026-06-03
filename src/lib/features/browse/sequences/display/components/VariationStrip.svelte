<!--
VariationStrip.svelte

Horizontal strip of mini-thumbnails for navigating between sequence variations.
Shown at the top of the detail panel when a sequence has multiple variations.

Features:
- Horizontal scroll for many variations
- Active state with accent border
- Auto-scroll to selected variation
- Touch-friendly tap targets
-->
<script lang="ts">
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import PropAwareThumbnail from "$lib/shared/browse/components/PropAwareThumbnail.svelte";
  import { t } from "$lib/shared/i18n/i18n.svelte";

  const {
    variations = [],
    currentIndex = 0,
    onSelect = () => {},
    bluePropType = undefined,
    redPropType = undefined,
    catDogModeEnabled = false,
    lightMode = false,
  }: {
    variations: SequenceData[];
    currentIndex: number;
    onSelect: (index: number, sequence: SequenceData) => void;
    bluePropType?: PropType;
    redPropType?: PropType;
    catDogModeEnabled?: boolean;
    lightMode?: boolean;
  } = $props();

  let containerRef = $state<HTMLDivElement | null>(null);

  // Auto-scroll to selected thumbnail when index changes
  $effect(() => {
    if (!containerRef || variations.length <= 1) return;

    const selectedThumb = containerRef.querySelector(
      `[data-variation-index="${currentIndex}"]`
    );
    if (selectedThumb) {
      selectedThumb.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  });

  function handleSelect(index: number) {
    const sequence = variations[index];
    if (sequence) {
      onSelect(index, sequence);
    }
  }

  function handleKeydown(event: KeyboardEvent, index: number) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleSelect(index);
    } else if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      handleSelect(index - 1);
    } else if (event.key === "ArrowRight" && index < variations.length - 1) {
      event.preventDefault();
      handleSelect(index + 1);
    }
  }
</script>

{#if variations.length > 1}
  <div class="variation-strip-container" class:light-mode={lightMode}>
    <div class="variation-strip-header">
      <span class="variation-label">{t('browse_variations_of', { word: variations[0]?.word ?? '' })}</span>
      <span class="variation-count">{t('browse_variation_count', { current: String(currentIndex + 1), total: String(variations.length) })}</span>
    </div>

    <div
      bind:this={containerRef}
      class="variation-strip"
      role="tablist"
      aria-label={t('browse_sequence_variations')}
    >
      {#each variations as variation, index (variation.id)}
        <button
          class="variation-thumb"
          class:active={index === currentIndex}
          data-variation-index={index}
          role="tab"
          aria-selected={index === currentIndex}
          aria-label={`${variation.author ?? t('browse_unknown')} - ${variation.word}`}
          tabindex={index === currentIndex ? 0 : -1}
          onclick={() => handleSelect(index)}
          onkeydown={(e) => handleKeydown(e, index)}
        >
          <div class="thumb-image">
            <PropAwareThumbnail
              sequence={variation}
              {bluePropType}
              {redPropType}
              {catDogModeEnabled}
              {lightMode}
            />
          </div>
          <span class="thumb-author">{variation.author ?? "Unknown"}</span>
        </button>
      {/each}
    </div>
  </div>
{/if}

<style>
  .variation-strip-container {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px 16px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .variation-strip-container.light-mode {
    background: rgba(0, 0, 0, 0.04);
    border-color: rgba(0, 0, 0, 0.1);
  }

  .variation-strip-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .variation-label {
    font-size: var(--font-size-sm, 14px);
    font-weight: 500;
    color: var(--theme-text, #ffffff);
  }

  .light-mode .variation-label {
    color: rgba(0, 0, 0, 0.87);
  }

  .variation-count {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
  }

  .light-mode .variation-count {
    color: rgba(0, 0, 0, 0.5);
  }

  .variation-strip {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-accent) var(--scrollbar-track);
    padding: 4px 0;
  }

  .variation-strip::-webkit-scrollbar {
    height: 4px;
  }

  .variation-strip::-webkit-scrollbar-track {
    background: var(--scrollbar-track);
  }

  .variation-strip::-webkit-scrollbar-thumb {
    background: var(--scrollbar-accent);
    border-radius: 2px;
  }

  .variation-thumb {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 4px;
    background: transparent;
    border: 2px solid transparent;
    border-radius: 8px;
    cursor: pointer;
    scroll-snap-align: center;
    transition: all var(--duration-fast) ease;
  }

  .variation-thumb:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  .light-mode .variation-thumb:hover {
    background: rgba(0, 0, 0, 0.05);
  }

  .variation-thumb.active {
    border-color: var(--theme-accent, #6366f1);
    background: rgba(99, 102, 241, 0.1);
  }

  .variation-thumb:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .thumb-image {
    width: 80px;
    height: auto;
    border-radius: 4px;
    overflow: hidden;
  }

  .thumb-author {
    font-size: 10px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    max-width: 80px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-align: center;
  }

  .light-mode .thumb-author {
    color: rgba(0, 0, 0, 0.5);
  }
</style>
