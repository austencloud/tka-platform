<script lang="ts">
  import { onMount } from "svelte";
  import BackgroundHost from "$lib/shared/background/shared/components/BackgroundHost.svelte";
  import { BackgroundType } from "$lib/shared/background/shared/domain/enums/background-enums";
  import { applyThemeForBackground } from "$lib/shared/settings/utils/background-theme-calculator";

  import HeroSection from "../../landing/components/HeroSection.svelte";
  import NotationShowcaseSection from "../../landing/components/NotationShowcaseSection.svelte";
  import WhatIsTKASection from "../../landing/components/WhatIsTKASection.svelte";
  import LandingFooter from "../../landing/components/LandingFooter.svelte";
  import LandingBackgroundPicker from "../../landing/components/LandingBackgroundPicker.svelte";

  const STORAGE_KEY = "tka-landing-theme";
  const DEFAULT_BACKGROUND = BackgroundType.NIGHT_SKY;

  let currentBackground = $state<BackgroundType>(DEFAULT_BACKGROUND);
  let mounted = $state(false);

  onMount(() => {
    // Load saved preference
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && Object.values(BackgroundType).includes(saved as BackgroundType)) {
      currentBackground = saved as BackgroundType;
    }

    // Apply theme immediately
    applyThemeForBackground(currentBackground);
    mounted = true;
  });

  function handleBackgroundChange(type: BackgroundType) {
    currentBackground = type;
    applyThemeForBackground(type);
    localStorage.setItem(STORAGE_KEY, type);
  }
</script>

<svelte:head>
  <title>TKA - The Kinetic Alphabet | A Flow Arts Notation System</title>
</svelte:head>

<div class="landing-page">
  <!-- Background layer -->
  {#if mounted}
    <div class="background-layer">
      <BackgroundHost
        backgroundType={currentBackground}
        quality="medium"
      />
    </div>
  {/if}

  <!-- Content layer -->
  <a href="#main-content" class="skip-link">Skip to main content</a>

  <div class="content-layer">
    <HeroSection />
    <main id="main-content">
      <NotationShowcaseSection />
      <WhatIsTKASection />
    </main>
    <LandingFooter />
  </div>

  <!-- Background picker -->
  <LandingBackgroundPicker
    {currentBackground}
    onSelect={handleBackgroundChange}
  />
</div>

<style>
  .landing-page {
    position: relative;
    min-height: 100vh;
    font-family: system-ui, -apple-system, sans-serif;
    color: var(--theme-text, #ffffff);
    line-height: 1.6;
    overflow-x: hidden;
  }

  .background-layer {
    position: fixed;
    inset: 0;
    z-index: 0;
  }

  .content-layer {
    position: relative;
    z-index: 1;
  }

  .skip-link {
    position: absolute;
    top: -100px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--theme-accent, #6366f1);
    color: white;
    padding: 12px 24px;
    border-radius: 8px;
    text-decoration: none;
    font-weight: 600;
    z-index: 9999;
    transition: top var(--duration-normal) ease;
  }

  .skip-link:focus {
    top: 16px;
    outline: 2px solid white;
    outline-offset: 2px;
  }
</style>
