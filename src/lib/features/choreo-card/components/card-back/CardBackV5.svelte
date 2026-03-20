<!--
  V5 "Deck" — Theme-aware printed card back

  Designed for physical 2.5" × 3.5" playing cards. Renders at a fixed
  500×700px and gets scaled via CSS transform in CardDesigner.

  Three sections:
  1. Level — what level, what it means
  2. LOOP — what's happening (when applicable)
  3. Instructions — what to do with this card
-->
<script lang="ts">
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { ISequenceToEntryConverter } from "../../services/contracts/ISequenceToEntryConverter";
  import type { ILOOPExplainer } from "../../services/contracts/ILOOPExplainer";
  import { container as di } from "$lib/shared/di";
  import { onMount } from "svelte";
  import LOOPIconStrip from "$lib/shared/components/LOOPIconStrip.svelte";
  import { deriveCardBackData } from "./card-back-data";

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
</script>

<div class="back">
  <div class="content">

    <!-- Branding -->
    <div class="brand">Choreo Card</div>
    <div class="brand-sub">The Kinetic Alphabet</div>

    <!-- Word -->
    <div class="word">{d.word}</div>
    <div class="beats">{d.beats} beats</div>

    <div class="divider"></div>

    <!-- Level -->
    <div class="level-section">
      <div class="level-badge-row">
        <span
          class="level-circle"
          style="background: {d.level.gradient}; color: {d.level.textColor};"
        >
          {d.level.number}
        </span>
        <span class="level-name">Level {d.level.number}: {d.level.name}</span>
      </div>
      <p class="level-explanation">{d.level.detail}. {d.level.reason}.</p>
    </div>

    <!-- LOOP (if applicable) -->
    {#if d.hasLoop}
      <div class="divider"></div>
      <div class="loop-section">
        <div class="loop-header">
          <span class="loop-title">LOOP</span>
          <LOOPIconStrip activeComponents={d.loopComponents} size={22} darkMode={false} />
        </div>
        <p class="loop-explanation">{loopExplanationText}</p>
      </div>
    {/if}

    <div class="spacer"></div>

    <!-- Instructions -->
    <div class="instructions">
      <p class="instruction-title">How to use this card</p>
      <p class="instruction-text">
        Learn each beat from the front. Practice until smooth. Scan the QR code to open it in the app.
      </p>
    </div>

    <div class="divider"></div>

    <!-- Footer -->
    <div class="footer">TKAflowarts.com</div>

  </div>
</div>

<style>
  .back {
    width: 100%;
    height: 100%;
    background: var(--theme-panel-bg, #fff);
    color: var(--theme-text, #1a1a1a);
    font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
    overflow: hidden;
    /* Rainbow gradient border */
    border: 3px solid transparent;
    border-radius: 12px;
    background:
      linear-gradient(var(--theme-panel-bg, #18181b), var(--theme-panel-bg, #18181b)) padding-box,
      linear-gradient(135deg, #ff0000, #ff8000, #ffff00, #00ff00, #0080ff, #8000ff, #ff0080, #ff0000) border-box;
    box-sizing: border-box;
  }

  .content {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 36px 32px;
    box-sizing: border-box;
  }

  /* Branding */
  .brand {
    text-align: center;
    font-size: 22px;
    font-weight: 700;
    letter-spacing: 0.06em;
  }

  .brand-sub {
    text-align: center;
    font-size: 13px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    letter-spacing: 0.08em;
    margin-bottom: 20px;
  }

  /* Word */
  .word {
    text-align: center;
    font-size: 48px;
    font-weight: 800;
    letter-spacing: 0.05em;
    line-height: 1;
  }

  .beats {
    text-align: center;
    font-size: 16px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    margin-top: 4px;
    margin-bottom: 16px;
  }

  .divider {
    height: 1px;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
    margin: 8px 0;
  }

  /* Level */
  .level-section {
    padding: 12px 0;
  }

  .level-badge-row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 8px;
  }

  .level-circle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: 2px solid black;
    font-family: Cambria, serif;
    font-size: 24px;
    font-weight: bold;
    flex-shrink: 0;
    padding-bottom: 1px;
  }

  .level-name {
    font-size: 20px;
    font-weight: 700;
  }

  .level-explanation {
    margin: 0;
    font-size: 15px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    line-height: 1.5;
  }

  /* Loop */
  .loop-section {
    padding: 12px 0;
  }

  .loop-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 8px;
  }

  .loop-title {
    font-size: 18px;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: var(--theme-accent, #6366f1);
  }

  .loop-explanation {
    margin: 0;
    font-size: 15px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    line-height: 1.5;
  }

  .spacer { flex: 1; }

  /* Instructions */
  .instructions {
    padding: 12px 0;
  }

  .instruction-title {
    margin: 0 0 6px;
    font-size: 16px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .instruction-text {
    margin: 0;
    font-size: 15px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    line-height: 1.5;
  }

  /* Footer */
  .footer {
    text-align: center;
    padding-top: 8px;
    font-size: 14px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.35));
    letter-spacing: 0.06em;
  }
</style>
