<!--
  Landing Page - tkaflowarts.com

  Standalone landing page for The Kinetic Alphabet.
  SSR + prerendered for SEO. Zero imports from scribe app.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { BackgroundType } from "@austencloud/backgrounds";
  import { applyThemeForBackground } from "$lib/theme-calculator";

  import BackgroundHost from "$lib/components/BackgroundHost.svelte";
  import HeroSection from "$lib/components/HeroSection.svelte";
  import WhatIsTKASection from "$lib/components/WhatIsTKASection.svelte";
  import FeaturesSection from "$lib/components/FeaturesSection.svelte";
  import LandingFooter from "$lib/components/LandingFooter.svelte";
  import LandingBackgroundPicker from "$lib/components/LandingBackgroundPicker.svelte";

  const STORAGE_KEY = "tka-landing-theme";
  const DEFAULT_BACKGROUND = BackgroundType.NIGHT_SKY;

  let currentBackground = $state<BackgroundType>(DEFAULT_BACKGROUND);
  let mounted = $state(false);

  onMount(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && Object.values(BackgroundType).includes(saved as BackgroundType)) {
      currentBackground = saved as BackgroundType;
    }

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
  <meta name="description" content="Create, record, and share flow arts choreography with The Kinetic Alphabet. A visual notation system for poi, staff, fans, and more." />
  <meta property="og:title" content="TKA - The Kinetic Alphabet" />
  <meta property="og:description" content="Create, record, and share flow arts choreography with a visual notation system." />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://tkaflowarts.com" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="TKA - The Kinetic Alphabet" />
  <meta name="twitter:description" content="A visual notation system for flow arts choreography." />
  <link rel="canonical" href="https://tkaflowarts.com" />
</svelte:head>

<div class="landing-page">
  {#if mounted}
    <div class="background-layer">
      <BackgroundHost backgroundType={currentBackground} />
    </div>
  {/if}

  <a href="#main-content" class="skip-link">Skip to main content</a>

  <div class="content-layer">
    <HeroSection />
    <main id="main-content">
      <WhatIsTKASection />
      <FeaturesSection />
    </main>
    <LandingFooter />
  </div>

  <LandingBackgroundPicker
    {currentBackground}
    onSelect={handleBackgroundChange}
  />
</div>

<style>
  .landing-page {
    position: relative;
    min-height: 100vh;
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
    background: #6366f1;
    color: white;
    padding: 12px 24px;
    border-radius: 8px;
    text-decoration: none;
    font-weight: 600;
    z-index: 9999;
    transition: top 0.2s ease;
  }

  .skip-link:focus {
    top: 16px;
    outline: 2px solid white;
    outline-offset: 2px;
  }
</style>
