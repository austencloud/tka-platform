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
  import GuidesSection from "../landing/components/GuidesSection.svelte";
  import FeaturesSection from "../landing/components/FeaturesSection.svelte";
  import NotationSection from "../landing/components/NotationSection.svelte";
  import LOOPsSection from "../landing/components/LOOPsSection.svelte";
  import PropsSection from "../landing/components/PropsSection.svelte";
  import EducatorsSection from "../landing/components/EducatorsSection.svelte";
  import LandingFooter from "../landing/components/LandingFooter.svelte";
  import MainApplication from "$lib/shared/application/components/MainApplication.svelte";
  import LoadingGate from "$lib/shared/components/loading/LoadingGate.svelte";

  let siteMode = $state<SiteMode>("loading");

  onMount(() => {
    siteMode = detectSiteMode(window.location.origin);
  });
</script>

<svelte:head>
  {#if siteMode === "app"}
    <title>TKA Composer - A flow arts choreography Toolbox</title>
  {:else}
    <title>The Kinetic Alphabet - A Flow Arts Choreography Toolbox</title>
  {/if}
</svelte:head>

{#if siteMode === "loading"}
  <div class="loading-screen">
    <LoadingGate variant="card" message="Loading..." />
  </div>
{:else if siteMode === "app"}
  <MainApplication />
{:else}
  <main class="landing-page">
    <HeroSection />
    <GuidesSection />
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


  .landing-page {
    min-height: 100vh;
    background: linear-gradient(180deg, #0a0a0f 0%, #1a1a2e 100%);
  }

</style>
