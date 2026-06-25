<script lang="ts">
  /**
   * CosmicPageShell — the public-page chrome: COSMIC BackgroundHost behind a
   * transparent content layer, with SiteHeader. Factored out of /support so the
   * public reading pages (/about, /roots) render over the same animated cosmic
   * background instead of a flat theme gradient, without each repeating the
   * background + theme boilerplate.
   *
   * BackgroundHost is rendered unconditionally (SSR-safe, browser-gated inside)
   * so the cosmic doesn't drop out on HMR; a z-index:-2 deep-space fallback sits
   * behind it for the moments WebGL isn't painting (slow load, WebGL off,
   * reduced motion).
   */
  import type { Snippet } from "svelte";
  import { onMount } from "svelte";
  import BackgroundHost from "$lib/shared/background/shared/components/BackgroundHost.svelte";
  import { BackgroundType } from "@austencloud/backgrounds";
  import { applyThemeForBackground } from "$lib/shared/settings/utils/background-theme-calculator";
  import SiteHeader from "./SiteHeader.svelte";

  let { children }: { children: Snippet } = $props();

  const BG = BackgroundType.COSMIC;

  onMount(() => {
    applyThemeForBackground(BG);
  });
</script>

<div class="cosmic-page">
  <div class="space-fallback" aria-hidden="true"></div>

  <div class="background-layer">
    <BackgroundHost backgroundType={BG} />
  </div>

  <div class="content-layer">
    <SiteHeader />
    {@render children()}
  </div>
</div>

<style>
  .cosmic-page {
    position: relative;
    min-height: 100vh;
    overflow-x: hidden;
    color: var(--theme-text, #ffffff);
  }

  .background-layer {
    position: fixed;
    inset: 0;
    z-index: 0;
  }

  .space-fallback {
    position: fixed;
    inset: 0;
    z-index: -2;
    background:
      radial-gradient(120% 80% at 78% 12%, rgba(70, 60, 140, 0.35) 0%, transparent 55%),
      radial-gradient(130% 100% at 50% -10%, #181b3d 0%, #0c0e20 48%, #06070f 100%);
  }

  .content-layer {
    position: relative;
    z-index: 1;
  }
</style>
