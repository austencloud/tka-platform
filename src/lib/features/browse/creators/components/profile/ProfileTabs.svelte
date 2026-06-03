<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import { onMount } from "svelte";
  import { fade, fly } from "svelte/transition";
  import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";
  import PanelTabs from "$lib/shared/components/panel/PanelTabs.svelte";
  import PanelState from "$lib/shared/components/panel/PanelState.svelte";
  import type { LibrarySequence } from "$lib/shared/library/domain/models/library-sequence";
  import PropAwareThumbnail from "$lib/shared/browse/components/PropAwareThumbnail.svelte";
  import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";

  let {
    userSequences = [],
    onSequenceClick,
  }: {
    userSequences?: readonly LibrarySequence[];
    onSequenceClick: (sequence: LibrarySequence) => void;
  } = $props();

  let hapticService: HapticFeedback | undefined;

  let reducedMotion = $state(
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  $effect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e: MediaQueryListEvent) => { reducedMotion = e.matches; };
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  });

  const visibilityManager = getAnimationVisibilityManager();
  let lightMode = $state(!visibilityManager.isDarkMode());

  function handleVisibilityChange() {
    lightMode = !visibilityManager.isDarkMode();
  }

  onMount(() => {
    hapticService = getHapticFeedback();
  });

  $effect(() => {
    visibilityManager.registerObserver(handleVisibilityChange);
    return () => visibilityManager.unregisterObserver(handleVisibilityChange);
  });

  let activeTab = $state("all");

  const tabs = $derived(() => {
    const result: { value: string; label: string; icon: string }[] = [
      { value: "all", label: `All (${userSequences.length})`, icon: "fa-th" },
    ];

    if (userSequences.length > 0) {
      result.push({
        value: "sequences",
        label: `Sequences (${userSequences.length})`,
        icon: "fa-list",
      });
    }

    return result;
  });

  const filteredSequences = $derived(() => {
    if (activeTab === "all" || activeTab === "sequences") {
      return userSequences;
    }
    return [];
  });

  function getDisplayName(sequence: LibrarySequence): string {
    if (sequence.word) return sequence.word;

    if (sequence.name) {
      const cleaned = sequence.name
        .replace(/^Circular\s+/i, "")
        .replace(/\s+Sequence$/i, "");
      if (cleaned && !/^Sequence\s+/i.test(cleaned)) return cleaned;
    }

    if (sequence.steps && sequence.steps.length > 0) {
      return `${sequence.steps.length} beats`;
    }

    return "Untitled";
  }

  function handleSequenceClick(sequence: LibrarySequence) {
    hapticService?.trigger("selection");
    onSequenceClick(sequence);
  }
</script>

<div class="tabs-wrapper" transition:fly={{ y: reducedMotion ? 0 : 20, duration: reducedMotion ? 0 : 300, delay: reducedMotion ? 0 : 200 }}>
  {#if tabs().length > 1}
    <PanelTabs
      tabs={tabs()}
      {activeTab}
      onchange={(tab: string) => (activeTab = tab)}
    />
  {/if}
</div>

<div class="gallery-content">
  {#if filteredSequences().length === 0}
    <PanelState
      type="empty"
      icon="fa-list"
      title="No Sequences"
      message="This creator hasn't published any sequences yet."
    />
  {:else}
    <div class="gallery-grid">
      {#each filteredSequences() as sequence (sequence.id)}
        <button
          class="gallery-card"
          onclick={() => handleSequenceClick(sequence)}
          transition:fade={{ duration: reducedMotion ? 0 : 200 }}
          aria-label="View sequence {getDisplayName(sequence)}"
        >
          <div class="card-thumbnail">
            <PropAwareThumbnail {sequence} {lightMode} />
          </div>

          {#if sequence.starCount > 0}
            <div class="star-pill">
              <span class="star-icon">&#9733;</span>
              <span class="star-count">{sequence.starCount}</span>
            </div>
          {/if}
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .tabs-wrapper {
    container-type: inline-size;
    container-name: tabs-wrapper;
    display: flex;
    justify-content: center;
    margin-bottom: 16px;
  }

  .gallery-content {
    container-type: inline-size;
    container-name: gallery;
    min-height: 300px;
    width: 100%;
  }

  .gallery-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 350px));
    justify-content: center;
    gap: 12px;
  }

  .gallery-card {
    position: relative;
    display: flex;
    flex-direction: column;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 12px;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    overflow: hidden;
    padding: 0;
    text-align: left;
  }

  .gallery-card:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
    transform: translateY(-2px);
    box-shadow: var(--shadow-glass-hover, 0 4px 12px rgba(0,0,0,0.3));
  }

  .card-thumbnail {
    width: 100%;
    container-type: inline-size;
    container-name: sequence-card;
  }

  .star-pill {
    position: absolute;
    bottom: 8px;
    right: 8px;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    background: rgba(0, 0, 0, 0.65);
    backdrop-filter: blur(8px);
    border-radius: 6px;
    opacity: 0;
    transform: translateY(4px);
    transition: all var(--duration-normal) ease;
    pointer-events: none;
  }

  .gallery-card:hover .star-pill {
    opacity: 1;
    transform: translateY(0);
  }

  .star-icon {
    font-size: 0.7rem;
    color: #f59e0b;
  }

  .star-count {
    font-size: var(--font-size-xs, 11px);
    font-weight: 600;
    color: rgba(255, 255, 255, 0.85);
  }

  @container gallery (max-width: 640px) {
    .gallery-grid {
      grid-template-columns: repeat(auto-fit, minmax(150px, 250px));
      gap: 8px;
    }

    .star-pill {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @container gallery (min-width: 2000px) {
    .gallery-grid {
      grid-template-columns: repeat(auto-fit, minmax(300px, 400px));
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .gallery-card {
      transition: none;
    }

    .gallery-card:hover {
      transform: none;
    }

    .star-pill {
      opacity: 1;
      transform: none;
      transition: none;
    }
  }

  @media (hover: none) {
    .star-pill {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
