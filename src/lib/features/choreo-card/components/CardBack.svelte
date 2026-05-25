<!--
  CardBack.svelte - Back face of a printed choreo card

  Fills its parent container (same dimensions as the front card).
  Uses --print-* tokens for all colors. Font sizes scale via clamp()
  relative to container inline size so content adapts to any card
  proportion (wide 4-step cards vs. tall 16-step cards).
-->
<script lang="ts">
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import LOOPIconStrip from "$lib/shared/components/LOOPIconStrip.svelte";
  import TKAWordGlyph from "$lib/shared/choreo-card/components/TKAWordGlyph.svelte";
  import { resolveLoopDisplay } from "$lib/features/loop-labeler/services/loop-display-resolver";
  import {
    LOOP_TYPE_LABELS,
    ROTATED_LOOP_TYPES,
  } from "$lib/shared/foundation/domain/models/generation/circular-models";
  import { calculateDifficultyLevel } from "$lib/shared/browse/services/sequence-difficulty-calculator";

  interface Props {
    sequence: SequenceData;
  }

  let { sequence }: Props = $props();

  const loopDisplay = $derived.by(() => resolveLoopDisplay(sequence));
  const loopComponents = $derived(loopDisplay.components);
  const rotationPeriod = $derived(loopDisplay.rotationPeriod);
  const inversionPeriod = $derived(loopDisplay.inversionPeriod);
  const loopPeriod = $derived(loopDisplay.period);

  const hasLoop = $derived(loopComponents.size > 0);
  const level = $derived.by(() => {
    const steps = sequence.steps ?? [];
    return steps.length > 0 ? calculateDifficultyLevel([...steps]) : (sequence.level ?? 1);
  });
  const word = $derived(sequence.word ?? sequence.name ?? "");
  const beats = $derived(sequence.sequenceLength ?? sequence.steps?.length ?? 0);

  const loopLabel = $derived(
    sequence.loopType ? LOOP_TYPE_LABELS[sequence.loopType] ?? null : null
  );

  const isRotated = $derived(
    sequence.loopType ? ROTATED_LOOP_TYPES.has(sequence.loopType) : false
  );

  const cycle = $derived(sequence.orientationCycleCount);

  const sliceName = $derived.by(() => {
    if (cycle === 4) return "Quartered";
    if (cycle === 2) return "Halved";
    return null;
  });

  const levelMeta: Record<number, { name: string; detail: string }> = {
    1: { name: "Base Motions", detail: "" },
    2: { name: "Whole Turns", detail: "" },
    3: { name: "Half Turns, Floats", detail: "" },
  };
</script>

<div class="back" style="container-type: inline-size;">
  <!-- Outer border -->
  <div class="frame">
    <!-- Inner decorative border -->
    <div class="inner-rule"></div>

    <div class="content">
      <!-- ── Top: Branding ── -->
      <header class="brand">
        <span class="brand-mark">Choreo Card</span>
        <span class="brand-system">The Kinetic Alphabet</span>
      </header>

      <!-- ── Sequence identity ── -->
      <div class="identity">
        <TKAWordGlyph {word} height={24} />
        <span class="beats">{beats} beats</span>
      </div>

      <hr class="sep" />

      <!-- ── Level indicator ── -->
      <div class="levels">
        {#each [1, 2, 3] as n}
          {@const meta = levelMeta[n] ?? { name: "", detail: "" }}
          <div class="lvl" class:current={level === n} class:other={level !== n}>
            <span class="lvl-n">{n}</span>
            <span class="lvl-name">{meta.name}</span>
            {#if level === n}
              <span class="lvl-detail">{meta.detail}</span>
            {/if}
          </div>
        {/each}
      </div>

      <!-- ── LOOP info ── -->
      {#if hasLoop}
        <div class="loop">
          <div class="loop-head">
            <LOOPIconStrip activeComponents={loopComponents} {rotationPeriod} {inversionPeriod} period={loopPeriod} size={16} darkMode={false} />
            <span class="loop-label">
              {#if sliceName}{sliceName}{/if}
              {#if isRotated} Rotation{/if}
              {#if loopLabel && !sliceName}{loopLabel}{/if}
            </span>
          </div>
          <p class="loop-detail">
            {#if cycle === 4}
              4 reps, 90° each. Full cycle resets.
            {:else if cycle === 2}
              2 reps, 180° each. Full cycle resets.
            {:else}
              Loops to start each cycle.
            {/if}
          </p>
        </div>
      {/if}

      <!-- ── Spacer ── -->
      <div class="grow"></div>

      <!-- ── Usage ── -->
      <ol class="usage">
        <li>Learn each step one by one</li>
        <li>Teach it to a friend</li>
        <li>Scan the QR on the front to open in the app</li>
      </ol>

      <!-- ── Footer ── -->
      <footer class="foot">
        <span>tkaflowarts.com</span>
        <span>Build your own deck</span>
      </footer>
    </div>
  </div>
</div>

<style>
  /* Print-mode tokens inherited from parent canvas or defined here as fallbacks */
  .back {
    --cb-bg: var(--print-bg, #ffffff);
    --cb-fg: var(--print-text, #333333);
    --cb-dim: var(--print-text-dim, #666666);
    --cb-muted: var(--print-text-muted, #999999);
    --cb-rule: var(--print-border, #000000);
    --cb-rule-light: color-mix(in srgb, var(--cb-rule) 15%, var(--cb-bg));

    width: 100%;
    height: 100%;
    background: var(--cb-bg);
    color: var(--cb-fg);
    font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
    overflow: hidden;
  }

  .frame {
    position: relative;
    width: 100%;
    height: 100%;
    box-sizing: border-box;
  }

  .inner-rule {
    position: absolute;
    inset: 3%;
    border: 1px solid var(--cb-rule-light);
    pointer-events: none;
  }

  .content {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 6% 7%;
    box-sizing: border-box;
  }

  /* ── Brand ── */
  .brand {
    text-align: center;
    margin-bottom: 2%;
  }

  .brand-mark {
    display: block;
    font-size: clamp(13px, 4cqi, 24px);
    font-weight: 800;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--cb-fg);
  }

  .brand-system {
    display: block;
    font-size: clamp(7px, 2cqi, 12px);
    letter-spacing: 0.1em;
    color: var(--cb-muted);
    margin-top: 1px;
  }

  /* ── Identity ── */
  .identity {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding: 2% 0;
  }

  .beats {
    font-size: clamp(8px, 2cqi, 13px);
    color: var(--cb-muted);
  }

  .sep {
    border: none;
    border-top: 1px solid var(--cb-rule-light);
    margin: 0 0 3%;
  }

  /* ── Level strip ── */
  .levels {
    display: flex;
    gap: 3%;
    margin-bottom: 3%;
  }

  .lvl {
    flex: 1;
    text-align: center;
    padding: 3% 2%;
    border: 1px solid var(--cb-rule-light);
    border-radius: 3px;
  }

  .lvl.current {
    background: var(--cb-fg);
    border-color: var(--cb-fg);
    color: var(--cb-bg);
  }

  .lvl.other {
    opacity: 0.25;
  }

  .lvl-n {
    display: block;
    font-size: clamp(14px, 4cqi, 26px);
    font-weight: 700;
    line-height: 1.1;
  }

  .lvl-name {
    display: block;
    font-size: clamp(6px, 1.6cqi, 10px);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-top: 2px;
  }

  .lvl-detail {
    display: block;
    font-size: clamp(6px, 1.4cqi, 9px);
    opacity: 0.7;
    margin-top: 1px;
  }

  /* ── LOOP ── */
  .loop {
    padding: 3% 4%;
    border-radius: 3px;
    border: 1px solid var(--cb-rule-light);
    margin-bottom: 3%;
  }

  .loop-head {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .loop-label {
    font-size: clamp(9px, 2.4cqi, 15px);
    font-weight: 700;
    color: var(--cb-fg);
  }

  .loop-detail {
    margin: 3px 0 0;
    font-size: clamp(7px, 1.6cqi, 11px);
    color: var(--cb-dim);
    line-height: 1.4;
  }

  /* ── Spacer ── */
  .grow {
    flex: 1;
    min-height: 3%;
  }

  /* ── Usage ── */
  .usage {
    margin: 0 0 3%;
    padding-left: 5%;
    font-size: clamp(7px, 1.7cqi, 12px);
    color: var(--cb-dim);
    line-height: 1.7;
  }

  .usage li::marker {
    color: var(--cb-fg);
    font-weight: 700;
  }

  /* ── Footer ── */
  .foot {
    display: flex;
    justify-content: space-between;
    padding-top: 2%;
    border-top: 1px solid var(--cb-rule-light);
    font-size: clamp(6px, 1.4cqi, 10px);
    color: var(--cb-muted);
  }
</style>
