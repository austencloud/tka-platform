<script lang="ts">
  import { BackgroundType } from "@austencloud/backgrounds";
  import { ANIMATED_BACKGROUNDS } from "$lib/shared/settings/utils/public-page-backgrounds";

  interface Props {
    currentBackground: BackgroundType;
    onSelect: (type: BackgroundType) => void;
  }

  let { currentBackground, onSelect }: Props = $props();

  const backgrounds = ANIMATED_BACKGROUNDS;

  const currentIndex = $derived(
    backgrounds.findIndex((bg) => bg.type === currentBackground)
  );

  const currentIcon = $derived(
    backgrounds[currentIndex]?.icon || "fa-moon"
  );

  const currentLabel = $derived(
    backgrounds[currentIndex]?.label || "Cosmic"
  );

  function cycleBackground() {
    const nextIndex = (currentIndex + 1) % backgrounds.length;
    const nextBackground = backgrounds[nextIndex];
    if (nextBackground) {
      onSelect(nextBackground.type);
    }
  }
</script>

<button
  class="background-toggle"
  onclick={cycleBackground}
  aria-label="Switch background to next theme (currently {currentLabel})"
  title="Try another background"
>
  <i class="fas {currentIcon}" aria-hidden="true"></i>
</button>

<style>
  .background-toggle {
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 1000;
    width: var(--min-touch-target);
    height: var(--min-touch-target);
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
    transition: all var(--duration-normal) ease;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  .background-toggle:hover {
    background: var(--theme-card-bg-hover, rgba(255, 255, 255, 0.1));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.25));
    transform: scale(1.05);
  }

  .background-toggle:active {
    transform: scale(0.95);
  }

  @media (max-width: 480px) {
    .background-toggle {
      bottom: 16px;
      right: 16px;
      width: 44px;
      height: 44px;
      font-size: 16px;
    }
  }
</style>
