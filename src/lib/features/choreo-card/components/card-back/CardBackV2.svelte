<!--
  V2 "Signal" — Bold / Trading Card

  Think: sports card stats panel. The level number is HUGE.
  Bold sans-serif. High contrast. Geometric blocks.
  Dense information, punchy layout. The card screams its identity.
-->
<script lang="ts">
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { ISequenceToEntryConverter } from "../../services/contracts/ISequenceToEntryConverter";
  import { container as di } from "$lib/shared/di";
  import { onMount } from "svelte";
  import LOOPIconStrip from "$lib/shared/components/LOOPIconStrip.svelte";
  import { deriveCardBackData } from "./card-back-data";

  interface Props { sequence: SequenceData; }
  let { sequence }: Props = $props();

  let converter: ISequenceToEntryConverter | null = $state(null);
  onMount(() => { converter = di.items.sequenceToEntryConverter; });

  const d = $derived(deriveCardBackData(sequence, converter));
</script>

<div class="back" style="container-type: inline-size;">
  <!-- Outer border -->
  <div class="border-outer">
    <div class="border-inner">

      <!-- Top band: branding -->
      <div class="band">
        <span class="brand">CHOREO CARD</span>
        <span class="tka">TKA</span>
      </div>

      <!-- Hero: giant level number -->
      <div class="hero">
        <span class="level-big">{d.level.number}</span>
        <div class="hero-meta">
          <span class="level-name">{d.level.name}</span>
          <span class="level-detail">{d.level.detail}</span>
        </div>
      </div>

      <!-- Word bar -->
      <div class="word-bar">
        <span class="word">{d.word}</span>
        <span class="beats">{d.stepCount}</span>
      </div>

      <!-- Stats row -->
      <div class="stats">
        <div class="stat">
          <span class="stat-label">Level</span>
          <div class="stat-pips">
            {#each [1, 2, 3] as n}
              <span class="pip" class:filled={n <= d.level.number}></span>
            {/each}
          </div>
        </div>

        {#if d.hasLoop}
          <div class="stat loop-stat">
            <span class="stat-label">Loop</span>
            <div class="stat-icons">
              <LOOPIconStrip activeComponents={d.loopComponents} size={16} darkMode={false} />
            </div>
          </div>

          {#if d.sliceName}
            <div class="stat">
              <span class="stat-label">Cycle</span>
              <span class="stat-value">{d.sliceName}</span>
            </div>
          {/if}
        {/if}
      </div>

      <div class="grow"></div>

      <!-- Action strip -->
      <div class="action-strip">
        <span class="action-num">1</span> Learn it
        <span class="action-sep">·</span>
        <span class="action-num">2</span> Teach it
        <span class="action-sep">·</span>
        <span class="action-num">3</span> Scan the QR
      </div>

      <!-- Footer -->
      <div class="foot">
        <span>tkascribe.com</span>
        <span>YOUR DECK. YOUR NAME.</span>
      </div>
    </div>
  </div>
</div>

<style>
  .back {
    --cb-fg: var(--print-text, #1a1a1a);
    --cb-dim: var(--print-text-dim, #555);
    --cb-muted: var(--print-text-muted, #999);
    --cb-accent: #111;
    width: 100%; height: 100%;
    background: var(--print-bg, #fff);
    color: var(--cb-fg);
    font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
    overflow: hidden;
  }

  .border-outer {
    width: 100%; height: 100%;
    border: 2px solid var(--cb-accent);
    box-sizing: border-box;
  }

  .border-inner {
    width: 100%; height: 100%;
    border: 1px solid color-mix(in srgb, var(--cb-accent) 20%, var(--print-bg, #fff));
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    padding: 3%;
  }

  /* Top band */
  .band {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 2%;
  }

  .brand {
    font-size: clamp(8px, 2.2cqi, 14px);
    font-weight: 900;
    letter-spacing: 0.2em;
  }

  .tka {
    font-size: clamp(7px, 1.8cqi, 12px);
    font-weight: 300;
    letter-spacing: 0.3em;
    color: var(--cb-muted);
  }

  /* Hero level */
  .hero {
    display: flex;
    align-items: center;
    gap: 4%;
    margin-bottom: 3%;
  }

  .level-big {
    font-size: clamp(36px, 14cqi, 80px);
    font-weight: 900;
    line-height: 0.85;
    color: var(--cb-accent);
  }

  .hero-meta { display: flex; flex-direction: column; }

  .level-name {
    font-size: clamp(10px, 3cqi, 18px);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .level-detail {
    font-size: clamp(7px, 1.8cqi, 12px);
    color: var(--cb-dim);
  }

  /* Word bar */
  .word-bar {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding: 2% 3%;
    background: var(--cb-accent);
    color: var(--print-bg, #fff);
    margin-bottom: 3%;
  }

  .word {
    font-size: clamp(10px, 3cqi, 18px);
    font-weight: 700;
    letter-spacing: 0.06em;
  }

  .beats {
    font-size: clamp(8px, 2cqi, 14px);
    font-weight: 300;
    opacity: 0.7;
  }

  .beats::after { content: " beats"; }

  /* Stats */
  .stats {
    display: flex;
    gap: 4%;
    margin-bottom: 3%;
  }

  .stat { flex: 1; }

  .stat-label {
    display: block;
    font-size: clamp(6px, 1.3cqi, 8px);
    text-transform: uppercase;
    letter-spacing: 0.15em;
    color: var(--cb-muted);
    margin-bottom: 3px;
  }

  .stat-pips { display: flex; gap: 3px; }

  .pip {
    width: clamp(8px, 2.5cqi, 16px);
    height: clamp(8px, 2.5cqi, 16px);
    border: 1.5px solid var(--cb-accent);
    border-radius: 1px;
  }

  .pip.filled { background: var(--cb-accent); }

  .stat-value {
    font-size: clamp(9px, 2.2cqi, 14px);
    font-weight: 700;
  }

  .grow { flex: 1; min-height: 2%; }

  /* Action strip */
  .action-strip {
    font-size: clamp(7px, 1.6cqi, 11px);
    color: var(--cb-dim);
    text-align: center;
    padding: 2% 0;
    border-top: 1px solid color-mix(in srgb, var(--cb-accent) 15%, var(--print-bg, #fff));
    margin-bottom: 2%;
  }

  .action-num { font-weight: 900; color: var(--cb-fg); }
  .action-sep { margin: 0 2px; color: var(--cb-muted); }

  .foot {
    display: flex;
    justify-content: space-between;
    font-size: clamp(6px, 1.3cqi, 9px);
    color: var(--cb-muted);
    letter-spacing: 0.05em;
  }
</style>
