<!--
  CardBackBrand.svelte — standalone extraction of the .brand-slot markup + styles
  from CardBack.svelte, for offscreen rasterization (P1.4a).

  PARITY: markup and CSS below are lifted VERBATIM from CardBack.svelte
  (.brand-slot / .brand-main / .brand-ornament / .ornament-* / .brand-sub).
  The only structural change: the slot is rendered in normal flow (not
  position:absolute) so it can be rasterized to its own box. All cqi-based
  sizing is unchanged, so it must be mounted inside a container whose
  container-type:inline-size width equals the real card render width (1644px)
  for cqi units to match the live card.
-->
<script lang="ts">
  import type { CardBackThemeVisuals } from "./card-back-theme-visuals";

  interface Props {
    theme: CardBackThemeVisuals;
  }
  let { theme }: Props = $props();

  const brandStyle = $derived(theme.brandStyle ?? "uppercase-sans");
  const ornamentType = $derived(theme.ornamentType ?? "diamond");
  const brandGlow = $derived(theme.brandGlow ?? "drop-shadow(0 0 3cqi rgba(255, 255, 255, 0.1))");
</script>

<div class="brand-slot">
  <span
    class="brand-main"
    class:italic-serif={brandStyle === "italic-serif"}
    class:uppercase-sans={brandStyle === "uppercase-sans"}
    class:small-caps={brandStyle === "small-caps"}
    style="background: {theme.brandGradient}; -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; filter: {brandGlow};"
  >The Kinetic Alphabet</span>
  <div class="brand-ornament">
    {#if ornamentType === "diamond"}
      <span class="ornament-line" style="background: linear-gradient(90deg, transparent, {theme.ornamentLineColor} 20%, {theme.ornamentLineColor} 80%, transparent);"></span>
      <span class="ornament-diamond" style="background: linear-gradient(135deg, {theme.ornamentColor}, {theme.ornamentLineColor}, {theme.ornamentColor});"></span>
      <span class="ornament-line" style="background: linear-gradient(90deg, transparent, {theme.ornamentLineColor} 20%, {theme.ornamentLineColor} 80%, transparent);"></span>
    {:else if ornamentType === "triple-dot"}
      <span class="ornament-line" style="background: linear-gradient(90deg, transparent, {theme.ornamentLineColor} 20%, {theme.ornamentLineColor} 80%, transparent);"></span>
      <span class="ornament-dot" style="background: {theme.ornamentColor};"></span>
      <span class="ornament-dot" style="background: {theme.ornamentColor};"></span>
      <span class="ornament-dot" style="background: {theme.ornamentColor};"></span>
      <span class="ornament-line" style="background: linear-gradient(90deg, transparent, {theme.ornamentLineColor} 20%, {theme.ornamentLineColor} 80%, transparent);"></span>
    {:else if ornamentType === "star"}
      <span class="ornament-line" style="background: linear-gradient(90deg, transparent, {theme.ornamentLineColor} 20%, {theme.ornamentLineColor} 80%, transparent);"></span>
      <span class="ornament-star" style="color: {theme.ornamentColor};">✦</span>
      <span class="ornament-line" style="background: linear-gradient(90deg, transparent, {theme.ornamentLineColor} 20%, {theme.ornamentLineColor} 80%, transparent);"></span>
    {:else if ornamentType === "double-line"}
      <span class="ornament-line double" style="border-color: {theme.ornamentLineColor};"></span>
    {:else if ornamentType === "none"}
      <!-- no ornament -->
    {/if}
  </div>
  <span
    class="brand-sub"
    class:uppercase-sans-sub={brandStyle === "uppercase-sans"}
    class:small-caps-sub={brandStyle === "small-caps"}
    style="background: {theme.brandSubGradient}; -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;"
  >Choreo Cards</span>
</div>

<style>
  /* ═══════ BRAND ═══════ verbatim from CardBack.svelte, sans position:absolute */
  .brand-slot {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.8cqi;
    pointer-events: none;
    font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
  }

  .brand-main {
    font-size: 4.4cqi;
    font-weight: 300;
    letter-spacing: 0.22em;
    font-style: italic;
    font-family: Georgia, "Times New Roman", serif;
    white-space: nowrap;
  }

  .brand-main.italic-serif {
    font-style: italic;
    font-family: Georgia, "Times New Roman", serif;
    font-weight: 300;
    letter-spacing: 0.22em;
  }

  .brand-main.uppercase-sans {
    font-style: normal;
    font-family: Didot, "Bodoni MT", "Playfair Display", Georgia, serif;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    font-size: 4.2cqi;
  }

  .brand-main.small-caps {
    font-style: normal;
    font-family: Georgia, "Times New Roman", serif;
    font-weight: 400;
    letter-spacing: 0.3em;
    font-variant: small-caps;
    font-size: 4cqi;
  }

  .brand-ornament {
    display: flex;
    align-items: center;
    gap: 1.2cqi;
    width: 60%;
    justify-content: center;
  }

  .ornament-line {
    flex: 1;
    max-width: 16cqi;
    height: 0.3cqi;
  }

  .ornament-line.double {
    max-width: 32cqi;
    height: 0;
    border-top: 0.25cqi solid;
    border-bottom: 0.25cqi solid;
    padding-top: 0.5cqi;
    background: none;
  }

  .ornament-diamond {
    width: 2cqi;
    height: 2cqi;
    transform: rotate(45deg);
    flex-shrink: 0;
  }

  .ornament-dot {
    width: 1.2cqi;
    height: 1.2cqi;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .ornament-star {
    font-size: 2.6cqi;
    line-height: 1;
    flex-shrink: 0;
  }

  .brand-sub {
    font-size: 3.2cqi;
    font-weight: 500;
    letter-spacing: 0.4em;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .brand-sub.uppercase-sans-sub {
    font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
    font-weight: 400;
    letter-spacing: 0.35em;
    font-size: 3.2cqi;
  }

  .brand-sub.small-caps-sub {
    font-variant: small-caps;
    letter-spacing: 0.35em;
    text-transform: none;
  }
</style>
