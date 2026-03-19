<!--
  CardBack.svelte - Back face of a printed choreo card

  Renders the reverse side, sized to fill its container (which is forced
  to match the front card's exact pixel dimensions by CardDesigner).
  All font sizes use em/% so content scales with the container.
-->
<script lang="ts">
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { ISequenceToEntryConverter } from "../services/contracts/ISequenceToEntryConverter";
  import { container } from "$lib/shared/di";
  import { loopDetector } from "$lib/features/loop-labeler/services/implementations/LOOPDetector";
  import { onMount } from "svelte";
  import LOOPIconStrip from "$lib/shared/components/LOOPIconStrip.svelte";
  import { LOOPComponent } from "$lib/features/create/generate/shared/domain/models/generate-models";
  import {
    LOOP_TYPE_LABELS,
    ROTATED_LOOP_TYPES,
  } from "$lib/features/create/generate/circular/domain/models/circular-models";
  import type { ComponentId } from "$lib/features/loop-labeler/domain/constants/loop-components";

  interface Props {
    sequence: SequenceData;
  }

  let { sequence }: Props = $props();

  let sequenceToEntryConverter: ISequenceToEntryConverter | null = $state(null);

  onMount(() => {
    sequenceToEntryConverter = container.items.sequenceToEntryConverter;
  });

  function componentIdToLOOPComponent(id: ComponentId): LOOPComponent | null {
    const mapping: Record<string, LOOPComponent> = {
      rotated: LOOPComponent.ROTATED,
      mirrored: LOOPComponent.MIRRORED,
      flipped: LOOPComponent.FLIPPED,
      swapped: LOOPComponent.SWAPPED,
      inverted: LOOPComponent.INVERTED,
      rewound: LOOPComponent.REWOUND,
    };
    return mapping[id] ?? null;
  }

  const loopComponents = $derived.by(() => {
    if (!sequenceToEntryConverter || !sequence.steps?.length) {
      return new Set<LOOPComponent>();
    }
    try {
      const entry = sequenceToEntryConverter.convert(sequence);
      const result = loopDetector.detectLOOP(entry);
      const components = new Set<LOOPComponent>();
      for (const componentId of result.components) {
        const mapped = componentIdToLOOPComponent(componentId);
        if (mapped) components.add(mapped);
      }
      return components;
    } catch {
      return new Set<LOOPComponent>();
    }
  });

  const hasLoop = $derived(loopComponents.size > 0);
  const level = $derived(sequence.level ?? 1);

  const loopTypeLabel = $derived(
    sequence.loopType ? LOOP_TYPE_LABELS[sequence.loopType] ?? "LOOP" : null
  );

  const isRotatedLoop = $derived(
    sequence.loopType ? ROTATED_LOOP_TYPES.has(sequence.loopType) : false
  );

  const sliceLabel = $derived.by(() => {
    const cycle = sequence.orientationCycleCount;
    if (cycle === 4) return "Quartered";
    if (cycle === 2) return "Halved";
    return null;
  });

  const sliceDescription = $derived.by(() => {
    const cycle = sequence.orientationCycleCount;
    if (cycle === 4)
      return "Play 4 times. Each rep rotates 90\u00B0.";
    if (cycle === 2)
      return "Play 2 times. Each rep rotates 180\u00B0.";
    return null;
  });

  const levelDescriptions: Record<number, string> = {
    1: "No rotation",
    2: "Whole turns",
    3: "Half turns",
  };

  const beatCount = $derived(sequence.sequenceLength ?? sequence.steps?.length ?? 0);
  const word = $derived(sequence.word ?? sequence.name ?? "");
</script>

<div class="card-back">
  <!-- Inner border for that printed-card feel -->
  <div class="inner-border"></div>

  <div class="content">
    <!-- Header -->
    <header class="header">
      <h2 class="title">Choreo Card</h2>
      <p class="subtitle">The Kinetic Alphabet</p>
    </header>

    <!-- Sequence identity -->
    <div class="sequence-identity">
      <span class="word">{word}</span>
      <span class="meta">{beatCount} beats</span>
    </div>

    <hr class="rule" />

    <!-- Level system -->
    <div class="section">
      <div class="level-strip">
        {#each [1, 2, 3] as lvl}
          <div class="level" class:active={level === lvl} class:dimmed={level !== lvl}>
            <span class="level-number">{lvl}</span>
            <span class="level-name">{levelDescriptions[lvl]}</span>
          </div>
        {/each}
      </div>
    </div>

    <!-- LOOP info (only if detected) -->
    {#if hasLoop}
      <div class="loop-card">
        <div class="loop-row">
          <LOOPIconStrip activeComponents={loopComponents} size={18} darkMode={false} />
          <span class="loop-name">
            {#if sliceLabel}{sliceLabel}{/if}
            {#if isRotatedLoop} Rotation{/if}
            {#if loopTypeLabel && !sliceLabel}{loopTypeLabel}{/if}
          </span>
        </div>
        {#if sliceDescription}
          <p class="loop-explanation">{sliceDescription}</p>
        {:else}
          <p class="loop-explanation">Loops back to the start each cycle.</p>
        {/if}
      </div>
    {/if}

    <!-- Flexible spacer pushes instructions to bottom -->
    <div class="grow"></div>

    <!-- Instructions -->
    <ol class="steps">
      <li>Learn each beat step by step</li>
      <li>Teach it to a friend</li>
      <li>Scan the QR on the front to open in the app</li>
    </ol>

    <!-- Footer -->
    <footer class="footer">
      <span>tkascribe.com</span>
      <span>Build your own deck</span>
    </footer>
  </div>
</div>

<style>
  .card-back {
    width: 100%;
    height: 100%;
    background: #ffffff;
    border: 1px solid #000;
    position: relative;
    overflow: hidden;
    box-sizing: border-box;
    /* Base font size scales with container width via container queries
       won't work here since container is inline-sized. Instead we
       use a reasonable base and let flex handle vertical distribution. */
    font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
    color: #333;
  }

  .inner-border {
    position: absolute;
    inset: 4px;
    border: 1px solid #ddd;
    pointer-events: none;
  }

  .content {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 5% 6%;
    box-sizing: border-box;
  }

  /* Header */
  .header {
    text-align: center;
    margin-bottom: 3%;
  }

  .title {
    margin: 0;
    font-size: clamp(12px, 3.5cqw, 22px);
    font-weight: 800;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: #1a1a1a;
  }

  .subtitle {
    margin: 2px 0 0;
    font-size: clamp(7px, 1.8cqw, 11px);
    color: #aaa;
    letter-spacing: 0.12em;
  }

  /* Sequence identity band */
  .sequence-identity {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding: 2% 0;
  }

  .word {
    font-size: clamp(11px, 3cqw, 18px);
    font-weight: 700;
    letter-spacing: 0.08em;
    color: #222;
  }

  .meta {
    font-size: clamp(8px, 1.8cqw, 12px);
    color: #999;
  }

  .rule {
    border: none;
    border-top: 1px solid #e0e0e0;
    margin: 0 0 3% 0;
  }

  /* Level strip */
  .section {
    margin-bottom: 3%;
  }

  .level-strip {
    display: flex;
    gap: 3%;
  }

  .level {
    flex: 1;
    text-align: center;
    padding: 3% 2%;
    border: 1px solid #ddd;
    border-radius: 4px;
  }

  .level.active {
    background: #222;
    border-color: #222;
    color: #fff;
  }

  .level.dimmed {
    opacity: 0.3;
  }

  .level-number {
    display: block;
    font-size: clamp(14px, 3.5cqw, 24px);
    font-weight: 700;
    line-height: 1.1;
  }

  .level-name {
    display: block;
    font-size: clamp(6px, 1.5cqw, 10px);
    margin-top: 2px;
    opacity: 0.8;
  }

  /* LOOP card */
  .loop-card {
    background: #f8f8f8;
    border: 1px solid #e8e8e8;
    border-radius: 4px;
    padding: 3% 4%;
    margin-bottom: 3%;
  }

  .loop-row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 4px;
  }

  .loop-name {
    font-size: clamp(9px, 2.2cqw, 14px);
    font-weight: 700;
    color: #333;
  }

  .loop-explanation {
    margin: 0;
    font-size: clamp(7px, 1.6cqw, 11px);
    color: #666;
    line-height: 1.4;
  }

  /* Spacer */
  .grow {
    flex: 1;
    min-height: 4%;
  }

  /* Steps */
  .steps {
    margin: 0 0 3%;
    padding-left: 5%;
    font-size: clamp(7px, 1.6cqw, 11px);
    color: #555;
    line-height: 1.8;
  }

  .steps li::marker {
    color: #333;
    font-weight: 700;
  }

  /* Footer */
  .footer {
    display: flex;
    justify-content: space-between;
    padding-top: 2%;
    border-top: 1px solid #e8e8e8;
    font-size: clamp(6px, 1.4cqw, 9px);
    color: #bbb;
  }
</style>
