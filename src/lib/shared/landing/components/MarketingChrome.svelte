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
  import ShopMorphLayer from "$lib/features/store/transitions/ShopMorphLayer.svelte";
  import { BackgroundType } from "@austencloud/backgrounds";
  import { applyThemeForBackground } from "$lib/shared/settings/utils/background-theme-calculator";
  import SiteHeader from "./SiteHeader.svelte";
  import SiteFooter from "./SiteFooter.svelte";

  let { children }: { children: Snippet } = $props();

  const BG = BackgroundType.COSMIC;

  onMount(() => {
    applyThemeForBackground(BG);
  });

  const path = $derived(page.url.pathname);

  // /shop owns its own transition via the View Transitions API (the product cover
  // morph). Running the keyed Svelte fade there too means two animation engines
  // animate the same DOM in the same window — flicker, double-fade, the cover
  // ghosting mid-morph. So shop renders straight (no {#key}/fade) and lets the VT
  // be the sole authority; the marketing pages (no morph participant) keep the
  // crossfade between them.
  const ownsViewTransition = $derived(path.startsWith("/shop"));

  // /shop keeps the live cosmos (Austen wants the space background there). The
  // view-transition cover morph may hitch ~1 frame on open from the cosmos canvas
  // readback; acceptable trade for the real backdrop over a static gradient.
</script>

<svelte:head>
  <!-- Inter is the marketing/editorial typeface (public-editorial.css asks for
       it). Loaded here so every page wrapped in this chrome gets the same
       typography by construction. -->
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
  <link
    href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,300..800&display=swap"
    rel="stylesheet"
  />
</svelte:head>

<div class="mkt-shell">
  <div class="mkt-fallback" aria-hidden="true"></div>
  <div class="mkt-bg">
    <BackgroundHost backgroundType={BG} />
  </div>

  {#if ownsViewTransition}
    <!-- Shared-element morph overlay (Motion spring-FLIP). Persists across the
         grid<->detail route swap so the ghost can bridge it. -->
    <ShopMorphLayer />
  {/if}

  <div class="mkt-layer">
    <SiteHeader />

    <div class="mkt-stage">
      {#if ownsViewTransition}
        <div class="mkt-content">
          {@render children()}
        </div>
      {:else}
        {#key path}
          <div class="mkt-content" in:fade|global={{ duration: 200 }}>
            {@render children()}
          </div>
        {/key}
      {/if}
    </div>

    <!-- Persistent chrome like the header: outside the keyed crossfade, so it
         never re-fades between pages; below the growing stage, so it pins to
         the viewport bottom on short pages (sticky-footer flex column). -->
    <SiteFooter />
  </div>
</div>

<style>
  .mkt-shell {
    position: relative;
    min-height: 100vh;
    /* clip, not hidden: `overflow-x: hidden` computes overflow-y to `auto`,
       which makes this shell a (never-scrolling) scroll container and silently
       disables position:sticky for every descendant on every marketing page.
       `clip` clips decorative horizontal overflow identically without creating
       a scroll container, so sticky elements track the real window scroll. */
    overflow-x: clip;
    color: var(--theme-text, #ffffff);
    /* Two-tier display type, both self-hosted app-wide (app.html):
       --page-title-font  → the brand's Fraunces wonky italic, for each page's
         top-level h1/title (matches the landing hero wordmark). Set italic +
         the wonk variation-settings at the title site (see .page-title).
       --landing-heading-font → Playfair Display 500, for section-level headings
         (h2s) under a page title. Keeps a clear h1 vs h2 hierarchy.
       One token each, so neither face can drift per-page. */
    --page-title-font: "Fraunces", Georgia, serif;
    --landing-heading-font: "Playfair Display", Georgia, serif;
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
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    min-height: 100dvh;
  }

  /* Both the outgoing and incoming keyed content share a single grid cell so
     they crossfade in place instead of stacking and shoving page height.
     flex: 1 makes the stage absorb spare height so the footer sits at the
     viewport bottom even on short pages (e.g. /shop/success). */
  .mkt-stage {
    display: grid;
    grid-template-columns: 1fr;
    flex: 1;
  }
  .mkt-content {
    grid-area: 1 / 1;
    min-width: 0;
  }
</style>
