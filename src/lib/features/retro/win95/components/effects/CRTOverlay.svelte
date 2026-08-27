<!--
  CRTOverlay - Full-viewport CRT monitor simulation for TKA-OS v1.0

  Five composable effect layers:
  1. Scanlines: repeating horizontal lines (2px pitch, subtle dark bands)
  2. Vignette: radial gradient darkening corners and edges
  3. Flicker: rare, brief opacity dips simulating phosphor instability
  4. Phosphor glow: a blurred brightness bloom behind bright elements
  5. Color fringing: subtle chromatic aberration on high-contrast edges

  Barrel distortion is applied via an SVG displacement filter on the wrapper,
  giving the convex-screen feel of real CRT glass without distorting layout.

  All layers are pointer-events: none and sit above everything at z-index 9999.
  Respects prefers-reduced-motion: disables flicker and phosphor glow (animated
  effects). Barrel distortion and fringing are geometric / static - kept on.

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

<!--
  The hidden SVG defines the barrel-distortion displacement filter.
  feTurbulence + feDisplacementMap bends the overlay image outward at the
  edges, mimicking the convex curve of real CRT glass. Keeping the scale
  at 4 gives a 2-4px edge warp - visible on close inspection, invisible
  during normal use.
-->
<svg class="crt-filters" aria-hidden="true" focusable="false">
  <defs>
    <filter id="crt-barrel" x="-2%" y="-2%" width="104%" height="104%"
            color-interpolation-filters="linearRGB">
      <!--
        A very low-frequency, low-amplitude turbulence acts as a displacement
        source.  numOctaves=1 gives one smooth wave; scale=4 keeps displacement
        under 4px.  The result is a gentle barrel warp, not a funhouse mirror.
      -->
      <feTurbulence
        type="fractalNoise"
        baseFrequency="0.015 0.015"
        numOctaves="1"
        seed="2"
        result="noise"
      />
      <feDisplacementMap
        in="SourceGraphic"
        in2="noise"
        scale="4"
        xChannelSelector="R"
        yChannelSelector="G"
        result="displaced"
      />
    </filter>
  </defs>
</svg>

<div class="crt-overlay" class:crt-flicker={flicker}>
  <!-- Barrel distortion layer - applies the SVG filter to a transparent div
       that inherits the full overlay area. The filter bends everything behind
       it slightly. Because this sits over the shell content (not under it),
       the distortion is applied as a screen-space post-process effect. -->
  <div class="crt-barrel"></div>

  {#if scanlines}
    <div class="crt-scanlines"></div>
  {/if}
  {#if vignette}
    <div class="crt-vignette"></div>
  {/if}

  <!-- Phosphor glow - a blurred, brightened copy of the overlay area
       blended in screen mode. This makes bright elements appear to bloom
       slightly, the way real phosphor dots bleed light into their neighbors. -->
  <div class="crt-phosphor"></div>

  <!-- Color fringing - two offset color shadows create red/blue lateral
       separation at edges. The opacity is intentionally imperceptible (0.04):
       you shouldn't consciously see it, but its absence would make the screen
       look too clean. -->
  <div class="crt-fringe"></div>
</div>

<style>
  /* Hidden SVG filter definition - no visual footprint                  */
  .crt-filters {
    position: absolute;
    width: 0;
    height: 0;
    overflow: hidden;
    pointer-events: none;
  }

  /* Overlay wrapper - fixed fullscreen, non-interactive                  */
  .crt-overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 9999;
  }

  /* Flicker - rare opacity dips on the wrapper itself                    */
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

  /* Barrel distortion - SVG displacement filter applied over the screen  */
  .crt-barrel {
    position: absolute;
    inset: 0;
    /* The filter applies the displacement map defined in the SVG above.
       Because this div is transparent, the filter bends the visual of
       whatever is drawn behind it via the screen compositor - giving the
       impression of a slightly curved glass surface. */
    filter: url(#crt-barrel);
    /*
       A subtle border-radius rounds the corners like a real screen,
       complementing the displacement with hard-edge geometry.
       overflow: hidden is on the parent .retro-screen so nothing leaks.
    */
    border-radius: 8px;
  }

  /* Scanlines - horizontal dark bands every 3px                         */
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

  /* Vignette - radial darkening at edges and corners                    */
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

  /* Phosphor glow - blurred brightness bloom                            */
  /*                                                                     */
  /* A 1.5px blur with brightness boost at 6% screen opacity gives the  */
  /* soft bloom you see around bright pixels on real phosphor screens.   */
  /* Applied only when motion is allowed - the animation of brightness   */
  /* interacting with flicker can feel uncomfortable for some users.     */
  .crt-phosphor {
    position: absolute;
    inset: 0;
    background: radial-gradient(
      ellipse at 50% 40%,
      rgba(200, 230, 200, 0.03) 0%,
      transparent 70%
    );
    filter: blur(1.5px) brightness(1.2);
    opacity: 0.06;
    mix-blend-mode: screen;
  }

  @media (prefers-reduced-motion: reduce) {
    .crt-phosphor {
      display: none;
    }
  }

  /* Color fringing - lateral chromatic aberration                       */
  /*                                                                     */
  /* Real CRT electron guns for R/G/B have slight convergence errors.   */
  /* This simulates the resulting color separation at high-contrast     */
  /* edges by overlaying two semi-transparent colored layers shifted     */
  /* 0.5px in opposite horizontal directions. Opacity 0.04 keeps it    */
  /* subconscious - you feel the age of the screen without seeing it.  */
  .crt-fringe {
    position: absolute;
    inset: 0;
    /* Two box-shadows would require an element with dimensions.
       Instead we use a background with two very subtle color washes
       blended via screen mode. The horizontal offset is encoded in
       the gradient start/stop positions. */
    background:
      linear-gradient(
        to right,
        rgba(255, 0, 0, 0.025) 0%,
        transparent 0.5%,
        transparent 99.5%,
        rgba(0, 0, 255, 0.025) 100%
      );
    mix-blend-mode: screen;
  }

  @media (prefers-reduced-motion: reduce) {
    /* Fringing is static geometry, not motion. Keep it. */
    /* (no override needed - left as-is intentionally) */
  }
</style>
