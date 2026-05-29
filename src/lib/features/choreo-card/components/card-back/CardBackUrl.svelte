<!--
  CardBackUrl.svelte — standalone extraction of the .url-slot markup + styles
  from CardBack.svelte, for offscreen rasterization (P1.4a).

  PARITY: markup and CSS below are lifted VERBATIM from CardBack.svelte
  (.url-slot / .url-ornament / .url-line / .url-diamond / .brand-url / .brand-year).
  The only structural change: the slot is rendered in normal flow (not
  position:absolute) so it can be rasterized to its own box, and the
  --card-text-muted CSS var is set from theme.textMutedColor (the live card
  sets it on the .back ancestor). All cqi sizing is unchanged — mount inside a
  container-type:inline-size width = real card render width (1644px).
-->
<script lang="ts">
  import type { CardBackThemeVisuals } from "./card-back-theme-visuals";

  interface Props {
    theme: CardBackThemeVisuals;
  }
  let { theme }: Props = $props();

  const textMutedColor = $derived(theme.textMutedColor ?? "rgba(255,255,255,0.75)");
  const year = new Date().getFullYear();
</script>

<div class="url-slot" style="--card-text-muted: {textMutedColor};">
  <div class="url-ornament">
    <span class="url-line" style="background: linear-gradient(90deg, transparent, {theme.ornamentLineColor} 30%, {theme.ornamentLineColor} 70%, transparent);"></span>
    <span class="url-diamond" style="background: linear-gradient(135deg, {theme.ornamentColor}, {theme.ornamentLineColor}, {theme.ornamentColor});"></span>
    <span class="url-line" style="background: linear-gradient(90deg, transparent, {theme.ornamentLineColor} 30%, {theme.ornamentLineColor} 70%, transparent);"></span>
  </div>
  <span class="brand-url">tkaflowarts.com</span>
  <span class="brand-year">© {year}</span>
</div>

<style>
  /* ═══════ URL ═══════ verbatim from CardBack.svelte, sans position:absolute */
  .url-slot {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.6cqi;
    pointer-events: none;
    font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
  }

  .url-ornament {
    display: flex;
    align-items: center;
    gap: 0.8cqi;
    width: 36%;
    justify-content: center;
  }

  .url-line {
    flex: 1;
    max-width: 10cqi;
    height: 0.5cqi;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .url-diamond {
    width: 1.6cqi;
    height: 1.6cqi;
    transform: rotate(45deg);
    flex-shrink: 0;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .brand-url {
    font-size: 3cqi;
    color: var(--card-text-muted, rgba(255, 255, 255, 0.7));
    letter-spacing: 0.12em;
    font-weight: 400;
  }

  .brand-year {
    font-size: 2.2cqi;
    color: var(--card-text-muted, rgba(255, 255, 255, 0.7));
    letter-spacing: 0.1em;
    font-weight: 300;
  }
</style>
