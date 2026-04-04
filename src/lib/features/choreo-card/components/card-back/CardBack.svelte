<!--
  V5 "Deck" — Theme-aware printed card back with corner badges

  Designed for physical 2.5" x 3.5" playing cards. Fills its parent
  container and scales proportionally using container query units (cqi).
  All dimensions are relative to the container's inline size, so the
  card looks correct at any rendered size.

  Four corners for quick sorting when fanning cards:
    Top-left:     Level badge
    Top-right:    LOOP icons
    Bottom-left:  Step count
    Bottom-right: Starting position (alpha, beta, gamma)

  Center: word, mandala (for LOOP sequences), LOOP explanation, branding, URL.
-->
<script lang="ts">
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { ISequenceToEntryConverter } from "../../services/contracts/ISequenceToEntryConverter";
  import type { ILOOPExplainer } from "../../services/contracts/ILOOPExplainer";
  import { container as di } from "$lib/shared/di";
  import { onMount } from "svelte";
  import LOOPIconStrip from "$lib/shared/components/LOOPIconStrip.svelte";
  import CardBackDecorations from "./CardBackDecorations.svelte";
  import { deriveCardBackData } from "./card-back-data";
  import { getCardBackThemeVisuals } from "./card-back-theme-visuals";
  import { settingsService } from "$lib/shared/settings/state/SettingsState.svelte";
  import StartPositionMiniGrid from "./StartPositionMiniGrid.svelte";
  import SequenceMandala from "$lib/shared/mandala/components/SequenceMandala.svelte";

  interface Props { sequence: SequenceData; }
  let { sequence }: Props = $props();

  let converter: ISequenceToEntryConverter | null = $state(null);
  let explainer: ILOOPExplainer | null = $state(null);
  onMount(() => {
    converter = di.items.sequenceToEntryConverter;
    explainer = di.items.loopExplainer;
  });

  const d = $derived(deriveCardBackData(sequence, converter, explainer));

  const loopExplanationText = $derived(
    d.loopExplanation?.summary ?? (d.hasLoop ? "Loops back each cycle." : "")
  );

  const theme = $derived(getCardBackThemeVisuals(settingsService.settings.backgroundType));

  // Pronunciation guide: spell out Greek letters and dash suffixes
  const LETTER_NAMES: Record<string, string> = {
    "Σ": "Sigma", "Δ": "Delta", "Θ": "Theta", "Ω": "Omega",
    "Φ": "Phi", "Ψ": "Psi", "Λ": "Lambda",
    "Σ-": "Sigma Dash", "Δ-": "Delta Dash", "Θ-": "Theta Dash", "Ω-": "Omega Dash",
    "Φ-": "Phi Dash", "Ψ-": "Psi Dash", "Λ-": "Lambda Dash",
    "α": "alpha", "β": "beta", "γ": "gamma",
    "ζ": "zeta", "η": "eta", "τ": "tau", "τ-": "Tau Dash",
    "μ": "mu", "ν": "nu", "⊕": "terra",
    // Latin dash variants
    "W-": "W Dash", "X-": "X Dash", "Y-": "Y Dash", "Z-": "Z Dash",
  };

  // Letters that trigger the pronunciation hint (Greek + dash suffixes)
  const NEEDS_HINT = new Set([
    ...Object.keys(LETTER_NAMES),
    "-", // dash suffix on any letter signals TKA-specific naming
  ]);

  /** True if the word contains any character that needs a pronunciation hint */
  const hasGreekLetters = $derived.by(() => {
    const word = d.word;
    for (let i = 0; i < word.length; i++) {
      const ch = word[i]!;
      if (ch in LETTER_NAMES) return true;
      if (i + 1 < word.length && word[i + 1] === "-" && (ch + "-") in LETTER_NAMES) return true;
    }
    return false;
  });

  /**
   * Build a pronunciation string: "B · Delta- · W · Phi"
   * Only shown when the word contains Greek letters.
   */
  const pronunciation = $derived.by(() => {
    if (!hasGreekLetters) return "";
    const parts: string[] = [];
    const word = d.word;
    let i = 0;
    while (i < word.length) {
      // Check for dash-suffix variants first (e.g. "Σ-")
      if (i + 1 < word.length && word[i + 1] === "-") {
        const twoChar = word[i] + "-";
        if (LETTER_NAMES[twoChar]) {
          parts.push(LETTER_NAMES[twoChar]!);
          i += 2;
          continue;
        }
      }
      const ch = word[i]!;
      if (LETTER_NAMES[ch]) {
        parts.push(LETTER_NAMES[ch]!);
      } else {
        parts.push(ch);
      }
      i++;
    }
    return parts.join(" · ");
  });

  // ── Auto-shrink word to fit on one line ──────────────────────────
  // Wide characters (Θ, Ω, Φ, W, M) count as ~1.3 units, narrow ones
  // (-, I, l) as ~0.5, everything else as 1. At 10.4cqi, roughly 9
  // width-units fit inside the .content padding. Scale down for longer words.
  const WIDE = new Set(["Θ", "Ω", "Φ", "W", "M", "Σ", "Δ", "Λ", "Ψ"]);
  const NARROW = new Set(["-", "I", "l", "i", "·"]);

  const wordFontCqi = $derived.by(() => {
    const word = d.word;
    if (!word) return 10.4;

    let widthUnits = 0;
    for (const ch of word) {
      if (WIDE.has(ch)) widthUnits += 1.3;
      else if (NARROW.has(ch)) widthUnits += 0.5;
      else widthUnits += 1;
    }

    const maxUnits = 12;
    if (widthUnits <= maxUnits) return 10.4;
    return Math.max(10.4 * (maxUnits / widthUnits), 3);
  });
</script>

<!-- Outer: themed gradient border -->
<div class="border-frame" style="background: {theme.borderGradient};">
  <!-- Inner: themed background with decorative elements -->
  <div class="back" style="background: {theme.background};">
    <CardBackDecorations theme={settingsService.settings.backgroundType ?? "nightSky"} />

    <!-- CORNER BADGES — visible when fanning cards -->

    <!-- Top-left: Level -->
    <div class="corner top-left">
      <span
        class="corner-badge level-badge"
        style="background: {d.level.gradient}; color: {d.level.textColor};"
      >
        {d.level.number}
      </span>
    </div>

    <!-- Top-right: LOOP icons -->
    {#if d.hasLoop}
      <div class="corner top-right">
        <LOOPIconStrip activeComponents={d.loopComponents} size={26} darkMode={false} />
      </div>
    {/if}

    <!-- Bottom-left: Step count -->
    <div class="corner bottom-left">
      <span class="corner-label">{d.stepCount}</span>
      <span class="corner-sublabel">steps</span>
    </div>

    <!-- Bottom-right: Starting position mini-grid -->
    <div class="corner bottom-right">
      <StartPositionMiniGrid
        info={d.startPosition ?? { group: null, blueLocation: null, redLocation: null, gridMode: "box" }}
        size={40}
      />
    </div>

    <!-- Branding: pinned to top center, between corner badges -->
    <div class="top-brand">
      <span class="brand">CHOREO CARDS</span>
    </div>

    <!-- CENTER CONTENT — mandala pinned to true center -->
    <div class="content">
      <div class="word" style="font-size: {wordFontCqi}cqi;">{d.word}</div>
      {#if hasGreekLetters}
        <div class="pronunciation">{pronunciation}</div>
      {/if}

      <div class="mandala-anchor">
        <SequenceMandala
          {sequence}
          mode="card-back"
          style="stroke"
          show="both"
          size={380}
        />
      </div>

      {#if d.vtgRatio}
        <div class="ratio-label">{d.vtgRatio}</div>
      {/if}

      {#if d.hasLoop}
        <p class="loop-explanation">{loopExplanationText}</p>
      {/if}
    </div>

    <!-- URL: pinned to bottom center -->
    <div class="bottom-url">tkaflowarts.com</div>
  </div>
</div>

<style>
  .border-frame {
    width: 100%;
    height: 100%;
    border-radius: 2.4cqi;
    padding: 0.8cqi;
    box-sizing: border-box;
    overflow: hidden;
    container-type: inline-size;
  }

  .back {
    position: relative;
    width: 100%;
    height: 100%;
    color: #ffffff;
    font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
    overflow: hidden;
    border-radius: 1.6cqi;
    box-sizing: border-box;
  }

  /* ═══════ CORNER BADGES ═══════ */

  .corner {
    position: absolute;
    z-index: 2;
    display: flex;
    align-items: center;
    gap: 0.8cqi;
  }

  .top-left { top: 3.2cqi; left: 3.2cqi; }
  .top-right { top: 3.2cqi; right: 3.2cqi; }
  .bottom-left { bottom: 3.2cqi; left: 3.2cqi; flex-direction: column; }
  .bottom-right { bottom: 3.2cqi; right: 3.2cqi; }

  .corner-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 8cqi;
    height: 8cqi;
    border-radius: 50%;
    border: 1.5px solid rgba(0, 0, 0, 0.3);
    font-family: Cambria, serif;
    font-size: 4.8cqi;
    font-weight: bold;
    padding-bottom: 0.2cqi;
  }

  .corner-label {
    font-size: 6cqi;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.65);
    line-height: 1;
  }

  .corner-sublabel {
    font-size: 2.2cqi;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.4);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  /* ═══════ BRANDING (top center) ═══════ */

  .top-brand {
    position: absolute;
    z-index: 2;
    top: 3.6cqi;
    left: 0;
    right: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1.2cqi;
  }

  .brand {
    font-size: 2.8cqi;
    font-weight: 300;
    letter-spacing: 0.2em;
    color: rgba(255, 255, 255, 0.6);
  }

  /* ═══════ URL (bottom center) ═══════ */

  .bottom-url {
    position: absolute;
    z-index: 2;
    bottom: 3.6cqi;
    left: 0;
    right: 0;
    text-align: center;
    font-size: 2.4cqi;
    color: rgba(255, 255, 255, 0.3);
    letter-spacing: 0.06em;
  }

  /* ═══════ CENTER CONTENT ═══════ */

  .content {
    position: absolute;
    inset: 0;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 0 4cqi;
    box-sizing: border-box;
  }

  .word {
    position: absolute;
    top: 14%;
    font-family: Georgia, serif;
    font-size: 10.4cqi;
    font-weight: 600;
    letter-spacing: 0.05em;
    line-height: 1;
    white-space: nowrap;
  }

  .pronunciation {
    position: absolute;
    top: calc(14% + 12cqi);
    font-size: 2.6cqi;
    font-style: italic;
    color: rgba(255, 255, 255, 0.4);
    letter-spacing: 0.02em;
  }

  .mandala-anchor {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 72cqi;
    max-height: 72cqi;
  }

  .mandala-anchor :global(.mandala-container) {
    width: 100% !important;
    height: 100% !important;
  }

  .ratio-label {
    position: absolute;
    top: calc(50% + 22cqi);
    font-size: 4cqi;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.85);
    letter-spacing: 0.04em;
  }

  .loop-explanation {
    position: absolute;
    top: calc(50% + 28cqi);
    margin: 0;
    font-size: 2.6cqi;
    color: rgba(255, 255, 255, 0.5);
    line-height: 1.6;
    max-width: 76cqi;
  }

  /* ═══════ CHILD COMPONENT OVERRIDES ═══════ */

  /* LOOPIconStrip uses inline font-size in px — override to scale with card */
  .top-right :global(.loop-icon-strip i) {
    font-size: 5.2cqi !important;
  }

  .top-right :global(.loop-icon-strip) {
    gap: 0.8cqi !important;
  }

  /* StartPositionMiniGrid SVG — override inline width/height to scale */
  .bottom-right :global(svg) {
    width: 8cqi !important;
    height: 8cqi !important;
  }

</style>
