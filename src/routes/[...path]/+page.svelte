<!--
Catch-all route for SPA navigation.

In production (Netlify), static/_redirects handles this via 200.html.
For local development, this route catches any path and renders the main app,
allowing client-side routing to take over.

Note: This file must stay in sync with src/routes/+page.svelte
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { detectSiteMode, type SiteMode } from "../../config/domains";
  import HeroSection from "../landing/components/HeroSection.svelte";
  import WhatIsTKASection from "../landing/components/WhatIsTKASection.svelte";
  import FeaturesSection from "../landing/components/FeaturesSection.svelte";
  import NotationSection from "../landing/components/NotationSection.svelte";
  import LOOPsSection from "../landing/components/LOOPsSection.svelte";
  import PropsSection from "../landing/components/PropsSection.svelte";
  import EducatorsSection from "../landing/components/EducatorsSection.svelte";
  import LandingFooter from "../landing/components/LandingFooter.svelte";
  import MainApplication from "$lib/shared/application/components/MainApplication.svelte";

  let siteMode = $state<SiteMode>("loading");

  onMount(() => {
    siteMode = detectSiteMode(window.location.origin);
  });
</script>

<svelte:head>
  {#if siteMode === "app"}
    <title>TKA Scribe - The Flow Arts Choreography Toolbox</title>
  {:else}
    <title>The Kinetic Alphabet - Digital Sheet Music for Flow Arts</title>
  {/if}
</svelte:head>

{#if siteMode === "loading"}
  <div class="loading-screen">
    <div class="loading-spinner"></div>
  </div>
{:else if siteMode === "app"}
  <MainApplication />
{:else}
  <main class="landing-page">
    <HeroSection />
    <WhatIsTKASection />
    <FeaturesSection />
    <NotationSection />
    <LOOPsSection />
    <PropsSection />
    <EducatorsSection />
    <LandingFooter />
  </main>
{/if}

<style>
  .loading-screen {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100vh;
    background: #0a0a0f;
  }

  .loading-spinner {
    width: 40px;
    height: 40px;
    border: 3px solid rgba(255, 255, 255, 0.1);
    border-top-color: #50c878;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .landing-page {
    min-height: 100vh;
    background: linear-gradient(180deg, #0a0a0f 0%, #1a1a2e 100%);
  }
</style>
