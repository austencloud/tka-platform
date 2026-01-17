<script lang="ts">
  /**
   * ModeGrid - Responsive Bento grid for animation mode cards
   *
   * Displays all available animation modes in a responsive grid with staggered animations
   */

  import { onMount } from "svelte";
  import { fly } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import ModeCard from "./ModeCard.svelte";
  import type { ComposeMode } from "$lib/features/compose/shared/state/compose-module-state.svelte";
  import { DURATION, STAGGER, SLIDE } from "$lib/shared/transitions/transitions";

  interface Props {
    onModeSelect: (mode: ComposeMode) => void;
  }

  let { onModeSelect }: Props = $props();

  // Animation visibility state
  let isVisible = $state(false);

  // Mode definitions with metadata
  const modes = [
    {
      id: "single" as ComposeMode,
      title: "Single",
      description: "Full-screen single sequence",
      slotCount: 1,
      gradient: "linear-gradient(135deg, #ec4899 0%, #db2777 100%)", // Pink
    },
    {
      id: "mirror" as ComposeMode,
      title: "Mirror",
      description: "Side-by-side mirrored copy",
      slotCount: 1,
      gradient:
        "linear-gradient(135deg, var(--theme-accent-strong) 0%, #7c3aed 100%)", // Purple
    },
    {
      id: "tunnel" as ComposeMode,
      title: "Tunnel",
      description: "Two sequences overlaid",
      slotCount: 2,
      gradient:
        "linear-gradient(135deg, var(--theme-accent) 0%, var(--theme-accent-strong) 100%)", // Blue
    },
    {
      id: "grid" as ComposeMode,
      title: "Grid",
      description: "Multiple in grid layout",
      slotCount: 4,
      gradient:
        "linear-gradient(135deg, var(--semantic-warning) 0%, #d97706 100%)", // Orange
    },
  ];

  onMount(() => {
    setTimeout(() => {
      isVisible = true;
    }, 30);
  });
</script>

<div class="mode-grid-container">
  {#if isVisible}
    <h2
      class="section-title"
      transition:fly={{
        y: -SLIDE.sm,
        duration: DURATION.normal,
        easing: cubicOut,
      }}
    >
      Choose Animation Mode
    </h2>

    <div class="mode-grid">
      {#each modes as mode, i (mode.id)}
        <div
          transition:fly={{
            y: SLIDE.md,
            duration: DURATION.normal,
            delay: i * STAGGER.normal,
            easing: cubicOut,
          }}
        >
          <ModeCard
            mode={mode.id}
            title={mode.title}
            description={mode.description}
            slotCount={mode.slotCount}
            gradient={mode.gradient}
            onclick={() => onModeSelect(mode.id)}
          />
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .mode-grid-container {
    container-type: inline-size;
    container-name: mode-grid-container;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: clamp(1rem, 4cqi, 3rem);
  }

  .section-title {
    margin: 0;
    margin-bottom: clamp(1.25rem, 5cqi, 2.5rem);
    font-size: clamp(1.5rem, 4cqi, 2.25rem);
    font-weight: 700;
    color: rgba(255, 255, 255, 0.95);
    letter-spacing: -0.02em;
    text-align: center;
  }

  /* 2×2 Grid optimized for 4 mode cards */
  .mode-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: clamp(0.75rem, 3cqi, 1.5rem);
    width: 100%;
    max-width: min(90cqi, 800px);
  }

  /* Grid children must fill their cells */
  .mode-grid > div {
    display: contents;
  }

  /* Ultra-wide: 4 columns for single row */
  @container mode-grid-container (min-width: 1200px) {
    .mode-grid {
      grid-template-columns: repeat(4, 1fr);
      max-width: min(95cqi, 1200px);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .mode-grid-container {
      transition: none;
    }
  }
</style>
