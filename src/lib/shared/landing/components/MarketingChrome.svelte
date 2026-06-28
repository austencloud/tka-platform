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
  import { onMount, untrack } from "svelte";
  import { page } from "$app/state";
  import { fade } from "svelte/transition";
  import {
    suppressBackground,
    releaseBackground,
  } from "$lib/shared/background/shared/state/background-suppression.svelte";
  import BackgroundHost from "$lib/shared/background/shared/components/BackgroundHost.svelte";
  import ShopMorphLayer from "$lib/features/store/transitions/ShopMorphLayer.svelte";
  import { BackgroundType } from "@austencloud/backgrounds";
  import { applyThemeForBackground } from "$lib/shared/settings/utils/background-theme-calculator";
  import SiteHeader from "./SiteHeader.svelte";

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

  // Zero-jank shop: while on /shop, suppress the live WebGL cosmos. Its per-frame
  // canvas readback is the ONE thing that makes the view-transition morph hitch on
  // the opening frame (~99ms). The static night-sky gradient plus the
  // compositor-only .shop-ambient drift below stand in for it — guaranteed-smooth
  // on every device — and the cosmos returns the instant you leave the shop. Same
  // suppress/release lever the museum uses for its fullscreen scenes.
  $effect(() => {
    if (!ownsViewTransition) return;
    // untrack: suppressBackground/releaseBackground both READ the shared keys array
    // (the .includes guard) and WRITE it. Called bare inside an $effect, that
    // read+write of the same $state is a self-dependency -> effect_update_depth_exceeded
    // (infinite suppress<->release loop). This effect must react ONLY to
    // ownsViewTransition, so the mutations run untracked.
    untrack(() => suppressBackground("shop"));
    return () => untrack(() => releaseBackground("shop"));
  });
</script>

<div class="mkt-shell">
  <div class="mkt-fallback" aria-hidden="true"></div>
  <div class="mkt-bg">
    <BackgroundHost backgroundType={BG} />
  </div>

  {#if ownsViewTransition}
    <!-- Compositor-only ambient backdrop for the shop: two soft gradient blobs
         that drift via transform on the GPU thread. Replaces the suppressed WebGL
         cosmos with a living, zero-jank "future-tech" wash that costs nothing to
         snapshot during the morph. -->
    <div class="shop-ambient" aria-hidden="true"></div>
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

  /* Shop ambient: GPU-composited drifting nebula. The blobs are soft radial
     gradients painted once into their own layer (will-change: transform), then
     only translated — no per-frame paint, no layout, nothing to read back during a
     view-transition snapshot. Overscanned (inset: -20%) so the drift never reveals
     an edge. */
  .shop-ambient {
    position: fixed;
    inset: -20%;
    z-index: 0;
    pointer-events: none;
    overflow: hidden;
  }
  .shop-ambient::before,
  .shop-ambient::after {
    content: "";
    position: absolute;
    width: 70vmax;
    height: 70vmax;
    border-radius: 50%;
    will-change: transform;
  }
  .shop-ambient::before {
    top: -12%;
    left: -8%;
    background: radial-gradient(
      circle,
      rgba(99, 102, 241, 0.22) 0%,
      transparent 62%
    );
    animation: shop-drift-a 34s ease-in-out infinite alternate;
  }
  .shop-ambient::after {
    bottom: -12%;
    right: -8%;
    background: radial-gradient(
      circle,
      rgba(168, 85, 247, 0.18) 0%,
      transparent 62%
    );
    animation: shop-drift-b 44s ease-in-out infinite alternate;
  }
  @keyframes shop-drift-a {
    from {
      transform: translate3d(0, 0, 0);
    }
    to {
      transform: translate3d(7vw, 6vh, 0);
    }
  }
  @keyframes shop-drift-b {
    from {
      transform: translate3d(0, 0, 0);
    }
    to {
      transform: translate3d(-6vw, -5vh, 0);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .shop-ambient::before,
    .shop-ambient::after {
      animation: none;
    }
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
