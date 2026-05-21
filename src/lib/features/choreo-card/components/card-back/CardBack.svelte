<!--
  V7 "Brand-forward" - Choreo Cards branding as the hero, flexible content slots.

  Designed for physical printed cards. Fills its parent container and
  scales proportionally using container query units (cqi).

  Layout: full flex column with three rows.
    Header:  Turn glyph | "CHOREO CARDS" branding | Reversal glyph
    Content: Mandala (fixed center), deck designation labels (TKA + VTG)
    Footer:  Start position pictograph (left, shows props for chaining) | (future: duration) | step count

  Level badge and LOOP icons are NOT on the physical card - they live in the
  software's sequence viewer. This keeps the printed card as its own clean
  artifact that doesn't try to mirror the software UI.
-->
<script lang="ts">
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import { onMount } from "svelte";
  import CardBackDecorations from "./CardBackDecorations.svelte";
  import { deriveCardBackData } from "./card-back-data";
  import { getCardBackThemeVisuals } from "./card-back-theme-visuals";
  import { settingsService } from "$lib/shared/settings/state/SettingsState.svelte";
  import StartPositionPictograph from "./StartPositionPictograph.svelte";
  import TurnPatternGlyph from "./TurnPatternGlyph.svelte";
  import ReversalPatternGlyph from "./ReversalPatternGlyph.svelte";
  import SequenceMandala from "$lib/shared/mandala/components/SequenceMandala.svelte";
  import MotionTypePills from "../MotionTypePills.svelte";
  interface Props { sequence: SequenceData; }
  let { sequence }: Props = $props();

  const d = $derived(deriveCardBackData(sequence));

  // Deck designation labels shown below the mandala
  const hasDesignation = $derived(!!d.handPathFamily || !!d.tkaDesignation || !!d.vtgDesignation);

  const theme = $derived(getCardBackThemeVisuals(settingsService.settings.backgroundType));
</script>

<!-- Outer: themed gradient border -->
<div class="border-frame" style="background: {theme.borderGradient};">
  <!-- Inner: full flex column - header, content, footer all flow naturally -->
  <div class="back" style="background: {theme.background};">
    <CardBackDecorations theme={settingsService.settings.backgroundType ?? "cosmic"} />

    <!-- HEADER: turn glyph | branding | reversal glyph -->
    <header class="card-header">
      <div class="header-left">
        <TurnPatternGlyph entries={d.turnGlyphEntries} />
        <span class="corner-sublabel">{d.turnLabel}</span>
      </div>
      <div class="header-center">
        <span class="brand">CHOREO CARDS</span>
        <span class="brand-url">tkaflowarts.com</span>
      </div>
      <div class="header-right">
        <ReversalPatternGlyph sequence={d.reversalSequence} period={d.reversalPeriod} />
        <span class="corner-sublabel">reversals</span>
      </div>
    </header>

    <!-- CENTER CONTENT: mandala always at same center point, text floats below -->
    <div class="content">
      <div class="mandala-zone">
        <div class="mandala-anchor">
          <SequenceMandala
            {sequence}
            mode="card-back"
            style="stroke"
            show="both"
            size={380}
          />
        </div>
      </div>

      {#if hasDesignation}
        <div class="content-text">
          {#if d.handPathFamily}
            <div class="deck-designation pills">
              <MotionTypePills label={d.handPathFamily} fontSize="2.6cqi" />
            </div>
          {:else if d.tkaDesignation}
            <p class="deck-designation">{d.tkaDesignation}</p>
          {/if}
          {#if d.vtgDesignation}
            <p class="deck-designation vtg">{d.vtgDesignation}</p>
          {/if}
        </div>
      {/if}
    </div>

    <!-- FOOTER: starting position (left, for chaining) | (future: duration) | step count -->
    <footer class="card-footer">
      <div class="footer-left">
        {#if sequence.startPosition}
          <StartPositionPictograph pictographData={sequence.startPosition} />
          {#if d.startPositionLabel}
            <span class="corner-sublabel">{d.startPositionLabel}</span>
          {/if}
        {/if}
      </div>
      <div class="footer-center"></div>
      <div class="footer-right">
        <span class="corner-label">{d.stepCount}</span>
        <span class="corner-sublabel">steps</span>
      </div>
    </footer>
  </div>
</div>

<style>
  .border-frame {
    width: 100%;
    height: 100%;
    border-radius: 2.4cqi;
    padding: 2cqi;
    box-sizing: border-box;
    overflow: hidden;
    container-type: inline-size;
  }

  /* ═══════ CARD SHELL ═══════
     Full flex column: header → content → footer.
     No absolute positioning for layout elements. Everything flows. */

  .back {
    position: relative;
    width: 100%;
    height: 100%;
    color: var(--theme-text, #ffffff);
    font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
    overflow: hidden;
    border-radius: 1.6cqi;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    padding: 3.2cqi;
    gap: 1.5cqi;
  }

  /* ═══════ HEADER ═══════ */

  .card-header {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    z-index: 2;
  }

  .header-left {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.4cqi;
  }

  .header-center {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.3cqi;
  }

  .header-right {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.4cqi;
  }

  .brand {
    font-size: 4cqi;
    font-weight: 400;
    letter-spacing: 0.22em;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.85));
  }

  .brand-url {
    font-size: 2.8cqi;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    letter-spacing: 0.04em;
  }

  /* ═══════ CENTER CONTENT ═══════
     Optional slots flow top-to-bottom. The mandala-zone uses flex:1 to
     absorb remaining vertical space. Remove a slot and the rest reflow. */

  .content {
    flex: 1;
    min-height: 0;
    z-index: 1;
    position: relative;
  }

  /* Mandala fills the entire content area and centers itself.
     Its position never changes regardless of what text is below it. */
  .mandala-zone {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    /* Slight upward bias so the visual weight sits above center,
       leaving room for text at the bottom without feeling cramped. */
    padding-bottom: 6cqi;
  }

  .mandala-anchor {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 72cqi;
    max-height: 100%;
    aspect-ratio: 1;
  }

  .mandala-anchor :global(.mandala-container) {
    width: 100% !important;
    height: 100% !important;
  }

  /* Text floats at the bottom of the content area, overlaying
     the mandala zone. Present or absent, mandala stays put. */
  .content-text {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1cqi;
    text-align: center;
  }

  .deck-designation {
    margin: 0;
    font-size: 2.8cqi;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.55));
    line-height: 1.4;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    text-align: center;
  }

  .deck-designation.pills {
    display: flex;
    justify-content: center;
    text-transform: none;
  }

  .deck-designation.vtg {
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.45));
    font-size: 2.5cqi;
  }

  /* ═══════ FOOTER ROW ═══════ */

  .card-footer {
    flex-shrink: 0;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    z-index: 2;
  }

  .footer-left {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.4cqi;
  }

  .footer-center {
    display: flex;
    align-items: center;
    gap: 1.6cqi;
  }

  .footer-right {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .corner-label {
    font-size: 6cqi;
    font-weight: 700;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.75));
    line-height: 1;
  }

  .corner-sublabel {
    font-size: 2cqi;
    font-weight: 500;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.45));
    text-transform: uppercase;
    letter-spacing: 0.08em;
    line-height: 1;
  }


  /* ═══════ CHILD COMPONENT OVERRIDES ═══════ */

  .footer-left :global(.start-pos-picto) {
    width: 12cqi !important;
    height: 12cqi !important;
  }

  .footer-left :global(.start-pos-picto svg) {
    width: 100% !important;
    height: 100% !important;
  }

</style>
