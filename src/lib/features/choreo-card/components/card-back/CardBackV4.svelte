<!--
  V4 "Mint" — Minimal / Luxury Collectible

  Think: premium business card meets haute couture.
  Extreme whitespace. Typography does everything.
  No boxes, no containers, no rounded corners.
  The content breathes. Every element earns its pixel.
  Quiet confidence. Less is more. Way more.
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
  <div class="frame">
    <div class="content">
      <!-- Brand: tiny, top-center, barely there -->
      <div class="brand">
        <span class="brand-name">choreo card</span>
      </div>

      <!-- The level number dominates the upper third -->
      <div class="level-hero">
        <span class="level-n">{d.level.number}</span>
      </div>

      <div class="level-meta">
        <span class="level-name">{d.level.name}</span>
      </div>

      <!-- Thin rule -->
      <div class="divider"></div>

      <!-- Word and beats: elegant baseline alignment -->
      <div class="identity-row">
        <span class="word">{d.word}</span>
        <span class="beats">{d.stepCount}</span>
      </div>

      <!-- LOOP: just the icons, minimal text -->
      {#if d.hasLoop}
        <div class="loop-line">
          <LOOPIconStrip activeComponents={d.loopComponents} size={14} darkMode={false} />
          {#if d.sliceName}
            <span class="loop-text">{d.sliceName}</span>
          {/if}
        </div>
      {/if}

      <div class="grow"></div>

      <!-- Instructions: one line, understated -->
      <p class="instruct">
        Learn. Teach. Scan the QR.
      </p>

      <!-- Footer -->
      <div class="foot">
        <span>tkascribe.com</span>
      </div>
    </div>
  </div>
</div>

<style>
  .back {
    --cb-fg: var(--print-text, #222);
    --cb-dim: var(--print-text-dim, #888);
    --cb-muted: var(--print-text-muted, #bbb);
    --cb-rule: color-mix(in srgb, var(--print-text, #222) 8%, var(--print-bg, #fff));
    width: 100%; height: 100%;
    background: var(--print-bg, #fff);
    color: var(--cb-fg);
    font-family: Georgia, "Palatino Linotype", serif;
    overflow: hidden;
    border: 1px solid var(--print-border, #000);
  }

  .frame {
    width: 100%; height: 100%;
    box-sizing: border-box;
  }

  .content {
    display: flex;
    flex-direction: column;
    align-items: center;
    height: 100%;
    padding: 8% 10%;
    box-sizing: border-box;
  }

  .brand { margin-bottom: 5%; }

  .brand-name {
    font-size: clamp(7px, 1.8cqi, 11px);
    font-weight: 400;
    letter-spacing: 0.25em;
    text-transform: lowercase;
    color: var(--cb-muted);
  }

  /* Hero level number */
  .level-hero {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .level-n {
    font-size: clamp(48px, 18cqi, 100px);
    font-weight: 400;
    line-height: 0.8;
    color: var(--cb-fg);
    font-family: Georgia, "Palatino Linotype", serif;
  }

  .level-meta {
    margin-top: 2%;
    margin-bottom: 5%;
  }

  .level-name {
    font-size: clamp(8px, 2cqi, 13px);
    font-weight: 400;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: var(--cb-dim);
  }

  .divider {
    width: 15%;
    height: 1px;
    background: var(--cb-rule);
    margin-bottom: 5%;
  }

  .identity-row {
    display: flex;
    align-items: baseline;
    gap: 8%;
    margin-bottom: 3%;
  }

  .word {
    font-size: clamp(11px, 3cqi, 18px);
    font-weight: 400;
    letter-spacing: 0.08em;
    font-family: "Segoe UI", system-ui, sans-serif;
  }

  .beats {
    font-size: clamp(8px, 1.8cqi, 12px);
    color: var(--cb-muted);
  }

  .beats::after {
    content: " beats";
  }

  .loop-line {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 2%;
  }

  .loop-text {
    font-size: clamp(8px, 1.8cqi, 12px);
    color: var(--cb-dim);
    font-style: italic;
  }

  .grow { flex: 1; }

  .instruct {
    margin: 0 0 4%;
    font-size: clamp(7px, 1.6cqi, 11px);
    color: var(--cb-muted);
    letter-spacing: 0.04em;
    text-align: center;
  }

  .foot {
    font-size: clamp(6px, 1.3cqi, 9px);
    color: var(--cb-muted);
    letter-spacing: 0.1em;
  }
</style>
