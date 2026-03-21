<!--
  V1 "Archive" — Editorial / Museum Catalog

  Think: library index card meets museum placard.
  Thin rules, small-caps labels, structured zones.
  The level is a horizontal scale with the active position marked.
  Refined. Institutional. Scholarly.
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
    <div class="inner-frame"></div>
    <div class="content">
      <!-- Masthead -->
      <div class="masthead">
        <span class="series">Choreo Card</span>
        <span class="system">The Kinetic Alphabet</span>
      </div>

      <hr class="rule" />

      <!-- Catalog entry -->
      <div class="entry">
        <span class="entry-label">Sequence</span>
        <span class="entry-word">{d.word}</span>
        <span class="entry-beats">{d.stepCount} beats</span>
      </div>

      <hr class="rule" />

      <!-- Level scale -->
      <div class="section">
        <span class="section-label">Level</span>
        <div class="scale">
          {#each [1, 2, 3] as n}
            <div class="scale-mark" class:active={d.level.number === n}>
              <span class="scale-n">{n}</span>
              <span class="scale-name">{n === 1 ? "Foundation" : n === 2 ? "Turning" : "Precision"}</span>
            </div>
            {#if n < 3}<div class="scale-line"></div>{/if}
          {/each}
        </div>
      </div>

      <!-- LOOP -->
      {#if d.hasLoop}
        <div class="section">
          <span class="section-label">Loop Pattern</span>
          <div class="loop-row">
            <LOOPIconStrip activeComponents={d.loopComponents} size={14} darkMode={false} />
            <span class="loop-text">
              {d.sliceName ? `${d.sliceName}${d.isRotated ? " Rotation" : ""}` : d.loopLabel ?? "LOOP"}
              {#if d.sliceDetail}<span class="loop-detail"> — {d.sliceDetail}</span>{/if}
            </span>
          </div>
        </div>
      {/if}

      <div class="grow"></div>

      <!-- Notes -->
      <div class="notes">
        <span class="notes-label">Instructions</span>
        <p>Learn each beat. Teach a friend. Scan the QR on the front to save in the app.</p>
      </div>

      <hr class="rule" />

      <div class="colophon">
        <span>tkascribe.com</span>
        <span>Build your own deck</span>
      </div>
    </div>
  </div>
</div>

<style>
  .back {
    --cb-fg: var(--print-text, #2a2a2a);
    --cb-dim: var(--print-text-dim, #666);
    --cb-muted: var(--print-text-muted, #aaa);
    --cb-rule: var(--print-text-muted, #ccc);
    width: 100%; height: 100%;
    background: var(--print-bg, #fff);
    color: var(--cb-fg);
    font-family: Georgia, "Palatino Linotype", "Book Antiqua", serif;
    overflow: hidden;
  }

  .frame { position: relative; width: 100%; height: 100%; }

  .inner-frame {
    position: absolute; inset: 3%;
    border: 1px solid var(--cb-rule);
  }

  .content {
    position: relative; z-index: 1;
    display: flex; flex-direction: column;
    height: 100%; padding: 5% 7%;
    box-sizing: border-box;
  }

  .masthead { text-align: center; margin-bottom: 2%; }

  .series {
    display: block;
    font-size: clamp(11px, 3cqi, 18px);
    font-weight: 400;
    font-style: italic;
    letter-spacing: 0.05em;
    color: var(--cb-fg);
  }

  .system {
    display: block;
    font-size: clamp(6px, 1.6cqi, 10px);
    font-variant: small-caps;
    letter-spacing: 0.15em;
    color: var(--cb-muted);
  }

  .rule {
    border: none;
    border-top: 1px solid var(--cb-rule);
    margin: 2% 0;
  }

  .entry { display: flex; align-items: baseline; gap: 4%; padding: 1% 0; }

  .entry-label {
    font-size: clamp(6px, 1.4cqi, 9px);
    font-variant: small-caps;
    letter-spacing: 0.1em;
    color: var(--cb-muted);
  }

  .entry-word {
    font-size: clamp(11px, 3cqi, 18px);
    font-weight: 700;
    font-family: "Segoe UI", system-ui, sans-serif;
    letter-spacing: 0.04em;
  }

  .entry-beats {
    margin-left: auto;
    font-size: clamp(7px, 1.6cqi, 11px);
    color: var(--cb-dim);
    font-style: italic;
  }

  .section { margin-bottom: 3%; }

  .section-label {
    display: block;
    font-size: clamp(6px, 1.4cqi, 9px);
    font-variant: small-caps;
    letter-spacing: 0.12em;
    color: var(--cb-muted);
    margin-bottom: 2%;
  }

  .scale { display: flex; align-items: center; }

  .scale-mark {
    text-align: center;
    padding: 2% 3%;
    flex: 1;
  }

  .scale-mark.active {
    background: var(--cb-fg);
    color: var(--print-bg, #fff);
    border-radius: 2px;
  }

  .scale-line {
    width: 8%;
    height: 1px;
    background: var(--cb-rule);
    flex-shrink: 0;
  }

  .scale-mark:not(.active) { opacity: 0.3; }

  .scale-n {
    display: block;
    font-size: clamp(12px, 3.5cqi, 22px);
    font-weight: 700;
    font-family: "Segoe UI", system-ui, sans-serif;
    line-height: 1;
  }

  .scale-name {
    display: block;
    font-size: clamp(5px, 1.2cqi, 8px);
    font-variant: small-caps;
    letter-spacing: 0.08em;
    margin-top: 2px;
  }

  .loop-row { display: flex; align-items: center; gap: 6px; }

  .loop-text {
    font-size: clamp(8px, 2cqi, 13px);
    font-style: italic;
  }

  .loop-detail { color: var(--cb-dim); }

  .grow { flex: 1; min-height: 3%; }

  .notes { margin-bottom: 2%; }

  .notes-label {
    display: block;
    font-size: clamp(6px, 1.4cqi, 9px);
    font-variant: small-caps;
    letter-spacing: 0.12em;
    color: var(--cb-muted);
    margin-bottom: 1%;
  }

  .notes p {
    margin: 0;
    font-size: clamp(7px, 1.6cqi, 11px);
    color: var(--cb-dim);
    line-height: 1.5;
  }

  .colophon {
    display: flex;
    justify-content: space-between;
    font-size: clamp(6px, 1.3cqi, 9px);
    color: var(--cb-muted);
    font-style: italic;
  }
</style>
