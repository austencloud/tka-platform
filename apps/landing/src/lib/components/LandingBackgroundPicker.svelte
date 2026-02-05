<!--
  LandingBackgroundPicker.svelte (Landing - standalone)

  Fixed-position button that cycles through animated backgrounds.
  Uses inline background list instead of importing from scribe.
-->
<script lang="ts">
  import { BackgroundType } from "@austencloud/backgrounds";
  import { ANIMATED_BACKGROUNDS } from "$lib/public-page-backgrounds";

  interface Props {
    currentBackground: BackgroundType;
    onSelect: (type: BackgroundType) => void;
  }

  let { currentBackground, onSelect }: Props = $props();

  const backgrounds = ANIMATED_BACKGROUNDS;

  const currentIndex = $derived(
    backgrounds.findIndex((bg) => bg.type === currentBackground)
  );

  const currentLabel = $derived(
    backgrounds[currentIndex]?.label || "Night Sky"
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
  &#x1F3A8;
</button>

<style>
  .background-toggle {
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 1000;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.15);
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(8px);
    color: white;
    font-size: 20px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  .background-toggle:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.25);
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
      font-size: 18px;
    }
  }
</style>
