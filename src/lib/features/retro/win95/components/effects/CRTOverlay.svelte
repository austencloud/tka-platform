<!--
  CRTOverlay — Full-viewport CRT monitor simulation for TKA-OS v1.0

  Three composable effect layers, each independently togglable:
  1. Scanlines: repeating horizontal lines (2px pitch, subtle dark bands)
  2. Vignette: radial gradient darkening corners and edges
  3. Flicker: rare, brief opacity dips simulating phosphor instability

  All layers are pointer-events: none and sit above everything at z-index 9999.
  Respects prefers-reduced-motion by disabling the flicker animation.

  Domain: Retro Desktop Effects
-->
<script lang="ts">
  let {
    scanlines = true,
    vignette = true,
    flicker = true,
  }: {
    scanlines?: boolean;
    vignette?: boolean;
    flicker?: boolean;
  } = $props();
</script>

<div class="crt-overlay" class:crt-flicker={flicker}>
  {#if scanlines}
    <div class="crt-scanlines"></div>
  {/if}
  {#if vignette}
    <div class="crt-vignette"></div>
  {/if}
</div>

<style>
  /* ------------------------------------------------------------------ */
  /* Overlay wrapper — fixed fullscreen, non-interactive                  */
  /* ------------------------------------------------------------------ */
  .crt-overlay {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 9999;
  }

  /* ------------------------------------------------------------------ */
  /* Flicker — rare opacity dips on the wrapper itself                    */
  /* ------------------------------------------------------------------ */
  .crt-flicker {
    animation: crt-flicker-cycle 8s infinite;
  }

  @keyframes crt-flicker-cycle {
    0%,
    100% {
      opacity: 1;
    }
    /* Brief 50ms dip around the 40% mark */
    39.3% {
      opacity: 1;
    }
    39.9% {
      opacity: 0.97;
    }
    40.5% {
      opacity: 1;
    }
    /* Second dip near 85% for irregularity */
    84.4% {
      opacity: 1;
    }
    85% {
      opacity: 0.98;
    }
    85.6% {
      opacity: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .crt-flicker {
      animation: none;
    }
  }

  /* ------------------------------------------------------------------ */
  /* Scanlines — horizontal dark bands every 3px                         */
  /* ------------------------------------------------------------------ */
  .crt-scanlines {
    position: absolute;
    inset: 0;
    background: repeating-linear-gradient(
      to bottom,
      transparent 0px,
      transparent 1px,
      rgba(0, 0, 0, 0.04) 1px,
      rgba(0, 0, 0, 0.04) 3px
    );
  }

  /* ------------------------------------------------------------------ */
  /* Vignette — radial darkening at edges and corners                    */
  /* ------------------------------------------------------------------ */
  .crt-vignette {
    position: absolute;
    inset: 0;
    background: radial-gradient(
      ellipse at center,
      transparent 50%,
      rgba(0, 0, 0, 0.15) 75%,
      rgba(0, 0, 0, 0.35) 100%
    );
  }
</style>
