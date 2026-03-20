<!--
  V5 "Deck" — Theme-aware printed card back with corner badges

  Designed for physical 2.5" × 3.5" playing cards. Renders at a fixed
  500×700px and gets scaled via CSS transform in CardDesigner.

  Four corners for quick sorting when fanning cards:
    Top-left:     Level badge
    Top-right:    LOOP icons
    Bottom-left:  Step count
    Bottom-right: Starting position (α, β, γ)

  Center: word, LOOP explanation, branding, URL.
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

  // Greek letter for starting position group
  const POSITION_GLYPHS: Record<string, string> = {
    alpha: "α", beta: "β", gamma: "γ",
    zeta: "ζ", eta: "η", tau: "τ", terra: "⊕",
  };

  const startGlyph = $derived(
    d.startPositionGroup ? POSITION_GLYPHS[d.startPositionGroup] ?? null : null
  );

  // Pronunciation guide: spell out Greek letters for readers unfamiliar with them
  const LETTER_NAMES: Record<string, string> = {
    "Σ": "Sigma", "Δ": "Delta", "Θ": "Theta", "Ω": "Omega",
    "Φ": "Phi", "Ψ": "Psi", "Λ": "Lambda",
    "Σ-": "Sigma-", "Δ-": "Delta-", "Θ-": "Theta-", "Ω-": "Omega-",
    "Φ-": "Phi-", "Ψ-": "Psi-", "Λ-": "Lambda-",
    "α": "alpha", "β": "beta", "γ": "gamma",
    "ζ": "zeta", "η": "eta", "τ": "tau", "τ-": "tau-",
    "μ": "mu", "ν": "nu", "⊕": "terra",
  };

  /** True if the word contains any non-Latin letter that needs a pronunciation hint */
  const hasGreekLetters = $derived(
    d.word.split("").some((ch) => ch in LETTER_NAMES || (ch + "-") in LETTER_NAMES)
  );

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
</script>

<!-- Outer: themed gradient border -->
<div class="border-frame" style="background: {theme.borderGradient};">
  <!-- Inner: themed background with decorative elements -->
  <div class="back" style="background: {theme.background};">
    <CardBackDecorations theme={settingsService.settings.backgroundType} />

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
        <LOOPIconStrip activeComponents={d.loopComponents} size={18} darkMode={false} />
      </div>
    {/if}

    <!-- Bottom-left: Step count -->
    <div class="corner bottom-left">
      <span class="corner-label">{d.stepCount}</span>
      <span class="corner-sublabel">steps</span>
    </div>

    <!-- Bottom-right: Starting position -->
    {#if startGlyph}
      <div class="corner bottom-right">
        <span class="corner-glyph">{startGlyph}</span>
      </div>
    {/if}

    <!-- CENTER CONTENT -->
    <div class="content">

      <!-- Branding -->
      <div class="brand">Choreo Card</div>
      <div class="brand-sub">The Kinetic Alphabet</div>

      <!-- Word -->
      <div class="word">{d.word}</div>
      {#if hasGreekLetters}
        <div class="pronunciation">{pronunciation}</div>
      {/if}

      <div class="spacer"></div>

      <!-- LOOP explanation (if applicable) -->
      {#if d.hasLoop}
        <p class="loop-explanation">{loopExplanationText}</p>
      {/if}

      <div class="spacer"></div>

      <!-- Footer -->
      <div class="footer">TKAflowarts.com</div>

    </div>
  </div>
</div>

<style>
  .border-frame {
    width: 100%;
    height: 100%;
    border-radius: 12px;
    padding: 4px;
    box-sizing: border-box;
    overflow: hidden;
  }

  .back {
    position: relative;
    width: 100%;
    height: 100%;
    color: #ffffff;
    font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
    overflow: hidden;
    border-radius: 8px;
    box-sizing: border-box;
  }

  /* ═══════ CORNER BADGES ═══════ */

  .corner {
    position: absolute;
    z-index: 2;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .top-left { top: 16px; left: 16px; }
  .top-right { top: 16px; right: 16px; }
  .bottom-left { bottom: 16px; left: 16px; flex-direction: column; }
  .bottom-right { bottom: 16px; right: 16px; }

  .corner-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: 1.5px solid rgba(0, 0, 0, 0.3);
    font-family: Cambria, serif;
    font-size: 22px;
    font-weight: bold;
    padding-bottom: 1px;
  }

  .corner-label {
    font-size: 22px;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.6);
    line-height: 1;
  }

  .corner-sublabel {
    font-size: 10px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.35);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .corner-glyph {
    font-size: 28px;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.6);
    font-family: Cambria, serif;
  }

  /* ═══════ CENTER CONTENT ═══════ */

  .content {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    height: 100%;
    padding: 60px 40px 50px;
    box-sizing: border-box;
  }

  .brand {
    font-size: 22px;
    font-weight: 700;
    letter-spacing: 0.06em;
  }

  .brand-sub {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.45);
    letter-spacing: 0.08em;
    margin-bottom: 24px;
  }

  .word {
    font-size: 52px;
    font-weight: 800;
    letter-spacing: 0.05em;
    line-height: 1;
  }

  .pronunciation {
    font-size: 13px;
    font-style: italic;
    color: rgba(255, 255, 255, 0.4);
    margin-top: 6px;
    letter-spacing: 0.02em;
  }

  .spacer { flex: 1; }

  .loop-explanation {
    margin: 0;
    font-size: 15px;
    color: rgba(255, 255, 255, 0.5);
    line-height: 1.6;
    max-width: 380px;
  }

  .footer {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.35);
    letter-spacing: 0.06em;
  }
</style>
