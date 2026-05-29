<!--
  CardBackStepCount.svelte — standalone extraction of the .corner-label step
  count from CardBack.svelte's `.bottom-right` corner, for offscreen
  rasterization (P1.4b).

  PARITY: markup (`<span class="corner-label">{count}</span>`) and the
  `.corner-label` CSS below are lifted VERBATIM from CardBack.svelte. cqi-based
  sizing is unchanged, so the component must be mounted inside a container whose
  container-type:inline-size width equals the real card render width (1644px)
  for cqi units to match the live card.

  `--card-text-muted` is normally inherited from `.back` (set from the active
  theme). Here it's surfaced as a prop so the standalone crop renders the same
  muted color the live card uses.
-->
<script lang="ts">
  interface Props {
    count: number | string;
    /** Theme's muted text color; mirrors `.back`'s `--card-text-muted`. */
    textMutedColor?: string;
  }
  let { count, textMutedColor = "rgba(255, 255, 255, 0.75)" }: Props = $props();
</script>

<div class="step-count-slot" style="--card-text-muted: {textMutedColor};">
  <span class="corner-label">{count}</span>
</div>

<style>
  /* Mirrors CardBack.svelte `.back` font + `.corner` flex so the glyph paints
     identically inside its own crop box. */
  .step-count-slot {
    /* Fill the rasterize box so justify-content:flex-end right-aligns the number
       to the box's right edge (matching CardBack.svelte's `.corner.bottom-right
       { right: 3.2cqi }`). Without an explicit width the slot shrinks to the
       glyph and the alignment is a no-op → the number lands off-position. */
    width: 100%;
    height: 100%;
    display: flex;
    align-items: flex-end;
    justify-content: flex-end;
    color: var(--card-text, #ffffff);
    font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
  }

  /* ═══════ verbatim from CardBack.svelte .corner-label ═══════ */
  .corner-label {
    font-size: 9cqi;
    font-weight: 700;
    color: var(--card-text-muted, rgba(255, 255, 255, 0.9));
    line-height: 1;
    filter: drop-shadow(0 0.5cqi 1cqi rgba(0, 0, 0, 0.08));
  }
</style>
