<script lang="ts">
  import { BackgroundType } from "$lib/shared/background/shared/domain/enums/background-enums";

  interface Props {
    currentBackground: BackgroundType;
    onSelect: (type: BackgroundType) => void;
  }

  let { currentBackground, onSelect }: Props = $props();

  let isExpanded = $state(false);

  // Animated backgrounds only (exclude solid/gradient for landing)
  const backgrounds = [
    { type: BackgroundType.SNOWFALL, icon: "fa-snowflake", label: "Snowfall" },
    { type: BackgroundType.NIGHT_SKY, icon: "fa-moon", label: "Night Sky" },
    { type: BackgroundType.DEEP_OCEAN, icon: "fa-water", label: "Deep Ocean" },
    { type: BackgroundType.EMBER_GLOW, icon: "fa-fire", label: "Ember Glow" },
    {
      type: BackgroundType.SAKURA_DRIFT,
      icon: "fa-spa",
      label: "Cherry Blossom",
    },
    {
      type: BackgroundType.FIREFLY_FOREST,
      icon: "fa-tree",
      label: "Firefly Forest",
    },
    { type: BackgroundType.AUTUMN_DRIFT, icon: "fa-leaf", label: "Autumn" },
    { type: BackgroundType.PRIDE, icon: "fa-rainbow", label: "Pride" },
  ];

  const currentIcon = $derived(
    backgrounds.find((bg) => bg.type === currentBackground)?.icon || "fa-moon"
  );

  function handleSelect(type: BackgroundType) {
    onSelect(type);
    isExpanded = false;
  }

  function handleToggle() {
    isExpanded = !isExpanded;
  }

  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest(".background-picker")) {
      isExpanded = false;
    }
  }
</script>

<svelte:window onclick={handleClickOutside} />

<div class="background-picker" class:expanded={isExpanded}>
  <button
    class="toggle-button"
    onclick={handleToggle}
    aria-label="Change background theme"
    aria-expanded={isExpanded}
  >
    <i class="fas {currentIcon}" aria-hidden="true"></i>
  </button>

  {#if isExpanded}
    <div class="picker-panel">
      <div class="picker-grid">
        {#each backgrounds as bg}
          <button
            class="bg-option"
            class:selected={currentBackground === bg.type}
            onclick={() => handleSelect(bg.type)}
            title={bg.label}
            aria-label="Select {bg.label} background"
          >
            <i class="fas {bg.icon}" aria-hidden="true"></i>
          </button>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .background-picker {
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 1000;
  }

  .toggle-button {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    background: var(--theme-card-bg, rgba(0, 0, 0, 0.6));
    backdrop-filter: blur(8px);
    color: var(--theme-text, white);
    font-size: 18px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  .toggle-button:hover {
    background: var(--theme-card-bg-hover, rgba(255, 255, 255, 0.1));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.25));
    transform: scale(1.05);
  }

  .expanded .toggle-button {
    background: var(--theme-accent, #6366f1);
    border-color: var(--theme-accent, #6366f1);
  }

  .picker-panel {
    position: absolute;
    bottom: 60px;
    right: 0;
    background: var(--theme-panel-bg, rgba(10, 10, 15, 0.95));
    backdrop-filter: blur(12px);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: 16px;
    padding: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    animation: slideUp 0.2s ease;
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .picker-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
  }

  .bg-option {
    width: 44px;
    height: 44px;
    border-radius: 10px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.05));
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    font-size: 16px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .bg-option:hover {
    background: var(--theme-card-bg-hover, rgba(255, 255, 255, 0.1));
    color: var(--theme-text, white);
    transform: scale(1.08);
  }

  .bg-option.selected {
    background: var(--theme-accent, #6366f1);
    border-color: var(--theme-accent, #6366f1);
    color: white;
  }

  @media (max-width: 480px) {
    .background-picker {
      bottom: 16px;
      right: 16px;
    }

    .toggle-button {
      width: 44px;
      height: 44px;
      font-size: 16px;
    }

    .bg-option {
      width: 40px;
      height: 40px;
    }
  }
</style>
