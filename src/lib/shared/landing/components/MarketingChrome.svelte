<script lang="ts">
  /**
   * MarketingChrome — persistent cosmic chrome for the marketing pages
   * (landing, /about, /roots, /support). Mounted ONCE by the root layout for
   * marketing routes, it survives client-side navigation among them, so the
   * COSMIC BackgroundHost and SiteHeader never unmount — no flash of the body's
   * saved-theme gradient between pages. Only the page content (the children
   * slot) transitions, keyed on pathname.
   *
   * Replaces the per-page CosmicPageShell / inline background each marketing
   * page used to mount for itself.
   */
  import type { Snippet } from "svelte";
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import { fade } from "svelte/transition";
  import BackgroundHost from "$lib/shared/background/shared/components/BackgroundHost.svelte";
  import { BackgroundType } from "@austencloud/backgrounds";
  import { applyThemeForBackground } from "$lib/shared/settings/utils/background-theme-calculator";
  import SiteHeader from "./SiteHeader.svelte";

  let { children }: { children: Snippet } = $props();

  const BG = BackgroundType.COSMIC;

  onMount(() => {
    applyThemeForBackground(BG);
  });

  const path = $derived(page.url.pathname);
</script>

<div class="mkt-shell">
  <div class="mkt-fallback" aria-hidden="true"></div>
  <div class="mkt-bg">
    <BackgroundHost backgroundType={BG} />
  </div>

  <div class="mkt-layer">
    <SiteHeader />

    <div class="mkt-stage">
      {#key path}
        <div class="mkt-content" in:fade|global={{ duration: 200 }}>
          {@render children()}
        </div>
      {/key}
    </div>
  </div>
</div>

<style>
  .mkt-shell {
    position: relative;
    min-height: 100vh;
    overflow-x: hidden;
    color: var(--theme-text, #ffffff);
  }

  .mkt-bg {
    position: fixed;
    inset: 0;
    z-index: 0;
  }

  .mkt-fallback {
    position: fixed;
    inset: 0;
    z-index: -2;
    background:
      radial-gradient(120% 80% at 78% 12%, rgba(70, 60, 140, 0.35) 0%, transparent 55%),
      radial-gradient(130% 100% at 50% -10%, #181b3d 0%, #0c0e20 48%, #06070f 100%);
  }

  .mkt-layer {
    position: relative;
    z-index: 1;
  }

  /* Both the outgoing and incoming keyed content share a single grid cell so
     they crossfade in place instead of stacking and shoving page height. */
  .mkt-stage {
    display: grid;
    grid-template-columns: 1fr;
  }
  .mkt-content {
    grid-area: 1 / 1;
    min-width: 0;
  }
</style>
