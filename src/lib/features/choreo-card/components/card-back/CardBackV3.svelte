<!--
  V3 "Field" — Educational / Flash Card

  Think: well-designed study card. Rounded containers,
  clear sections, friendly typography. The level is shown
  as a progress indicator. Information is scannable.
  Approachable. Warm. Inviting to beginners.
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
  <div class="content">
    <!-- Header pill -->
    <div class="header-pill">
      <span class="pill-brand">Choreo Card</span>
      <span class="pill-dot">·</span>
      <span class="pill-system">The Kinetic Alphabet</span>
    </div>

    <!-- Sequence info card -->
    <div class="info-card">
      <div class="info-top">
        <span class="info-word">{d.word}</span>
        <span class="info-badge">{d.beats}</span>
      </div>

      <!-- Level progress -->
      <div class="level-track">
        {#each [1, 2, 3] as n}
          <div class="level-step" class:active={d.level.number === n} class:past={n < d.level.number}>
            <span class="level-dot">{n}</span>
            <span class="level-label">
              {n === 1 ? "Foundation" : n === 2 ? "Turning" : "Precision"}
            </span>
          </div>
          {#if n < 3}
            <div class="level-connector" class:filled={n < d.level.number}></div>
          {/if}
        {/each}
      </div>
    </div>

    <!-- LOOP card -->
    {#if d.hasLoop}
      <div class="loop-card">
        <div class="loop-top">
          <LOOPIconStrip activeComponents={d.loopComponents} size={18} darkMode={false} />
          <span class="loop-name">
            {d.sliceName ? `${d.sliceName}${d.isRotated ? " Rotation" : ""}` : d.loopLabel ?? "LOOP"}
          </span>
        </div>
        {#if d.sliceDetail}
          <span class="loop-sub">{d.sliceDetail}</span>
        {:else}
          <span class="loop-sub">Loops back each cycle</span>
        {/if}
      </div>
    {/if}

    <div class="grow"></div>

    <!-- How to use -->
    <div class="how-to">
      <span class="how-title">How to use this card</span>
      <div class="steps">
        <div class="step">
          <span class="step-icon">🎯</span>
          <span>Learn each beat</span>
        </div>
        <div class="step">
          <span class="step-icon">🤝</span>
          <span>Teach a friend</span>
        </div>
        <div class="step">
          <span class="step-icon">📱</span>
          <span>Scan the front QR</span>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="foot">
      <span class="foot-url">tkascribe.com</span>
      <span class="foot-cta">Build your own deck</span>
    </div>
  </div>
</div>

<style>
  .back {
    --cb-fg: var(--print-text, #2d2d2d);
    --cb-dim: var(--print-text-dim, #666);
    --cb-muted: var(--print-text-muted, #aaa);
    --cb-surface: color-mix(in srgb, var(--print-text, #2d2d2d) 4%, var(--print-bg, #fff));
    --cb-border: color-mix(in srgb, var(--print-text, #2d2d2d) 10%, var(--print-bg, #fff));
    width: 100%; height: 100%;
    background: var(--print-bg, #fff);
    color: var(--cb-fg);
    font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
    overflow: hidden;
    border: 1px solid var(--print-border, #000);
  }

  .content {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 5% 6%;
    box-sizing: border-box;
    gap: 3%;
  }

  /* Header pill */
  .header-pill {
    align-self: center;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 1.5% 4%;
    background: var(--cb-surface);
    border-radius: 100px;
    border: 1px solid var(--cb-border);
  }

  .pill-brand {
    font-size: clamp(8px, 2cqi, 13px);
    font-weight: 700;
    letter-spacing: 0.04em;
  }

  .pill-dot { color: var(--cb-muted); font-size: clamp(8px, 2cqi, 13px); }

  .pill-system {
    font-size: clamp(7px, 1.6cqi, 11px);
    color: var(--cb-dim);
  }

  /* Info card */
  .info-card {
    background: var(--cb-surface);
    border: 1px solid var(--cb-border);
    border-radius: clamp(4px, 1.5cqi, 10px);
    padding: 4%;
  }

  .info-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 4%;
  }

  .info-word {
    font-size: clamp(12px, 3.5cqi, 22px);
    font-weight: 700;
    letter-spacing: 0.03em;
  }

  .info-badge {
    font-size: clamp(8px, 2cqi, 13px);
    font-weight: 600;
    padding: 1% 3%;
    background: var(--cb-fg);
    color: var(--print-bg, #fff);
    border-radius: 100px;
  }

  .info-badge::after { content: " beats"; font-weight: 400; opacity: 0.7; }

  /* Level progress track */
  .level-track { display: flex; align-items: center; }

  .level-step {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    flex: 0 0 auto;
  }

  .level-dot {
    width: clamp(20px, 5cqi, 32px);
    height: clamp(20px, 5cqi, 32px);
    border-radius: 50%;
    border: 2px solid var(--cb-border);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: clamp(9px, 2.2cqi, 14px);
    font-weight: 700;
    color: var(--cb-muted);
    background: var(--print-bg, #fff);
  }

  .level-step.active .level-dot {
    background: var(--cb-fg);
    border-color: var(--cb-fg);
    color: var(--print-bg, #fff);
  }

  .level-step.past .level-dot {
    background: var(--cb-fg);
    border-color: var(--cb-fg);
    color: var(--print-bg, #fff);
    opacity: 0.4;
  }

  .level-label {
    font-size: clamp(5px, 1.3cqi, 8px);
    color: var(--cb-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .level-step.active .level-label { color: var(--cb-fg); font-weight: 600; }

  .level-connector {
    flex: 1;
    height: 2px;
    background: var(--cb-border);
    margin: 0 2%;
    align-self: flex-start;
    margin-top: clamp(10px, 2.5cqi, 16px);
  }

  .level-connector.filled { background: var(--cb-fg); opacity: 0.3; }

  /* Loop card */
  .loop-card {
    background: var(--cb-surface);
    border: 1px solid var(--cb-border);
    border-radius: clamp(4px, 1.5cqi, 10px);
    padding: 3% 4%;
  }

  .loop-top { display: flex; align-items: center; gap: 6px; }

  .loop-name {
    font-size: clamp(9px, 2.2cqi, 14px);
    font-weight: 600;
  }

  .loop-sub {
    display: block;
    font-size: clamp(7px, 1.5cqi, 10px);
    color: var(--cb-dim);
    margin-top: 2px;
  }

  .grow { flex: 1; min-height: 2%; }

  /* How to use */
  .how-to { margin-bottom: 2%; }

  .how-title {
    display: block;
    font-size: clamp(7px, 1.6cqi, 10px);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--cb-dim);
    margin-bottom: 2%;
  }

  .steps { display: flex; gap: 4%; }

  .step {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    font-size: clamp(7px, 1.5cqi, 10px);
    color: var(--cb-dim);
    text-align: center;
  }

  .step-icon { font-size: clamp(12px, 3cqi, 20px); }

  .foot {
    display: flex;
    justify-content: space-between;
    font-size: clamp(6px, 1.3cqi, 9px);
    color: var(--cb-muted);
    padding-top: 2%;
    border-top: 1px solid var(--cb-border);
  }
</style>
