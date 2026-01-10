<!-- PropTypePicker.svelte - Full-screen modal picker for prop types -->
<script lang="ts">
  import { PropType } from "../../../../pictograph/prop/domain/enums/PropType";
  import PropTypeButton from "./PropTypeButton.svelte";
  import { getBasePropType } from "./PropTypeRegistry";

  type HandColor = "blue" | "red";

  let {
    isOpen = false,
    catDogMode = false,
    currentHand = null as HandColor | null,
    selectedBluePropType,
    selectedRedPropType,
    propTypes,
    onSelect,
    onClose,
    shouldRotate,
    onImageLoad,
  }: {
    isOpen: boolean;
    catDogMode: boolean;
    currentHand: HandColor | null;
    selectedBluePropType: PropType;
    selectedRedPropType: PropType;
    propTypes: PropType[];
    onSelect: (propType: PropType, hand?: HandColor) => void;
    onClose: () => void;
    shouldRotate: (propType: PropType) => boolean;
    onImageLoad: (propType: PropType, width: number, height: number) => void;
  } = $props();

  function getTitle(): string {
    if (!catDogMode) return "Select Prop";
    if (currentHand === "blue") return "Select Blue Prop (Left Hand)";
    return "Select Red Prop (Right Hand)";
  }

  function handleSelect(propType: PropType) {
    onSelect(propType, currentHand || undefined);
    onClose();
  }
</script>

{#if isOpen}
  <div
    class="picker-overlay"
    onclick={onClose}
    onkeydown={(e) => e.key === "Escape" && onClose()}
    role="button"
    tabindex="0"
    aria-label="Close prop picker"
  >
    <div
      class="picker-panel"
      role="dialog"
      aria-modal="true"
      aria-label="Select prop type"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
      tabindex="-1"
    >
      <!-- Header -->
      <div class="picker-header">
        <h2>{getTitle()}</h2>
        <button
          class="close-button"
          onclick={onClose}
          aria-label="Close picker"
        >
          <i class="fas fa-times" aria-hidden="true"></i>
        </button>
      </div>

      <!-- Grid -->
      <div class="picker-grid">
        {#each propTypes as propType}
          {@const blueBase = getBasePropType(selectedBluePropType)}
          {@const redBase = getBasePropType(selectedRedPropType)}
          {@const blueMatches = blueBase === propType}
          {@const redMatches = redBase === propType}
          <PropTypeButton
            {propType}
            selected={!catDogMode && (blueMatches || redMatches)}
            selectedBlue={catDogMode && currentHand === "blue" && blueMatches}
            selectedRed={catDogMode && currentHand === "red" && redMatches}
            shouldRotate={shouldRotate(propType)}
            color={currentHand || "blue"}
            onSelect={handleSelect}
            {onImageLoad}
          />
        {/each}
      </div>
    </div>
  </div>
{/if}

<style>
  .picker-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    z-index: 1000;
    display: flex;
    align-items: flex-end;
    animation: fade-in 0.2s ease-out;
  }

  @keyframes fade-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .picker-panel {
    width: 100%;
    max-height: 90vh;
    background: var(--theme-panel-bg);
    border-radius: 16px 16px 0 0;
    display: flex;
    flex-direction: column;
    animation: slide-up 0.3s cubic-bezier(0.36, 0.66, 0.04, 1);
    min-height: 0; /* Critical for flex children to respect overflow */
  }

  @keyframes slide-up {
    from {
      transform: translateY(100%);
    }
    to {
      transform: translateY(0);
    }
  }

  /* Desktop: Center the picker */
  @media (min-width: 768px) {
    .picker-overlay {
      align-items: center;
      justify-content: center;
      padding: 40px;
    }

    .picker-panel {
      max-width: 800px;
      max-height: 80vh;
      border-radius: 16px;
      animation: scale-in 0.3s cubic-bezier(0.36, 0.66, 0.04, 1);
    }

    @keyframes scale-in {
      from {
        transform: scale(0.9);
        opacity: 0;
      }
      to {
        transform: scale(1);
        opacity: 1;
      }
    }
  }

  .picker-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px;
    border-bottom: 0.33px solid var(--theme-stroke);
    flex-shrink: 0;
  }

  .picker-header h2 {
    margin: 0;
    font-size: var(--font-size-xl);
    font-weight: 700;
    color: var(--theme-text, white);
    letter-spacing: -0.45px;
    font-family:
      -apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif;
  }

  .close-button {
    min-width: var(--min-touch-target);
    min-height: var(--min-touch-target);
    border-radius: 50%;
    background: var(--theme-card-bg);
    border: none;
    color: var(--theme-text, white);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s;
    font-size: var(--font-size-base);
  }

  .close-button:active {
    transform: scale(0.95);
    background: var(--theme-card-hover-bg);
  }

  .picker-grid {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 20px;
    padding-bottom: 32px; /* Extra space at bottom for scroll comfort */
    display: grid;
    grid-template-columns: repeat(2, 1fr); /* 2 columns on mobile portrait */
    gap: 16px;
    align-content: start;
    min-height: 0; /* Allow flex child to shrink and overflow */
    /* Smooth scrolling */
    scroll-behavior: smooth;
    -webkit-overflow-scrolling: touch; /* iOS momentum scrolling */
    /* Scrollbar styling */
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
  }

  /* 3 columns for landscape mobile and larger */
  @media (min-width: 480px) {
    .picker-grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  /* 4 columns for desktop */
  @media (min-width: 768px) {
    .picker-grid {
      grid-template-columns: repeat(4, 1fr);
    }
  }

  /* WebKit scrollbar styling */
  .picker-grid::-webkit-scrollbar {
    width: 8px;
  }

  .picker-grid::-webkit-scrollbar-track {
    background: var(--scrollbar-track, transparent);
  }

  .picker-grid::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb);
    border-radius: 4px;
  }

  .picker-grid::-webkit-scrollbar-thumb:hover {
    background: var(--scrollbar-thumb-hover);
  }

  @media (prefers-reduced-motion: reduce) {
    .picker-overlay,
    .picker-panel,
    .close-button {
      animation: none;
      transition: none;
    }

    .picker-grid {
      scroll-behavior: auto; /* Disable smooth scrolling for reduced motion */
    }
  }
</style>
