<!--
  CardBack.svelte - Back face of a printed choreo card

  Renders the reverse side with:
  - Choreo Card branding
  - Level system (1-3) with active level highlighted
  - LOOP type info with real icons and quartered/halved distinction
  - Quick usage instructions
  - CTA footer
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
    if (cycle === 4) return "Play 4 times. Each rep rotates the pattern 90\u00B0, then it resets.";
    if (cycle === 2) return "Play 2 times. Each rep rotates the pattern 180\u00B0, then it resets.";
    return null;
  });

  const levelDescriptions: Record<number, string> = {
    1: "No rotation",
    2: "Whole turns",
    3: "Half turns",
  };
</script>

<div class="card-back">
  <!-- Branding -->
  <div class="branding">
    <div class="branding-title">Choreo Card</div>
    <div class="branding-sub">The Kinetic Alphabet</div>
  </div>

  <div class="divider"></div>

  <!-- Level system -->
  <div class="section-label">Difficulty</div>
  <div class="level-row">
    {#each [1, 2, 3] as lvl}
      <div class="level-card" class:active={level === lvl} class:inactive={level !== lvl}>
        <div class="level-num">{lvl}</div>
        <div class="level-desc">{levelDescriptions[lvl]}</div>
      </div>
    {/each}
  </div>

  <!-- LOOP section -->
  {#if hasLoop}
    <div class="section-label">Loop</div>
    <div class="loop-section">
      <div class="loop-header">
        <LOOPIconStrip activeComponents={loopComponents} size={16} darkMode={false} />
        {#if loopTypeLabel}
          <span class="loop-type-name">{loopTypeLabel}</span>
        {/if}
      </div>

      {#if sliceLabel && sliceDescription}
        <div class="loop-badge">
          {sliceLabel}{#if isRotatedLoop} Rotation{/if}
        </div>
        <div class="loop-desc">{sliceDescription}</div>
      {/if}

      {#if !sliceLabel}
        <div class="loop-desc">
          This sequence can be looped continuously, returning to its starting position each cycle.
        </div>
      {/if}
    </div>
  {/if}

  <div class="spacer"></div>

  <!-- Instructions -->
  <div class="section-label">Get Started</div>
  <div class="instructions">
    <div class="step"><span class="step-num">1.</span> Learn each beat step by step</div>
    <div class="step"><span class="step-num">2.</span> Teach it to a friend</div>
    <div class="step"><span class="step-num">3.</span> Scan the front QR to save it in the app</div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <span class="footer-text">tkascribe.com</span>
    <span class="footer-text">Create your own. Your name on every card.</span>
  </div>
</div>

<style>
  .card-back {
    width: 100%;
    height: 100%;
    background: #ffffff;
    border: 1px solid #000000;
    color: #333333;
    font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
    display: flex;
    flex-direction: column;
    padding: 16px 14px;
    box-sizing: border-box;
    overflow: hidden;
  }

  .branding {
    text-align: center;
    margin-bottom: 8px;
  }

  .branding-title {
    font-size: 14px;
    font-weight: 800;
    letter-spacing: 2.5px;
    text-transform: uppercase;
    color: #222;
  }

  .branding-sub {
    font-size: 8px;
    color: #999;
    letter-spacing: 1.5px;
    margin-top: 1px;
  }

  .divider {
    height: 1px;
    background: #e0e0e0;
    margin-bottom: 10px;
  }

  .section-label {
    font-size: 7px;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    color: #999;
    margin-bottom: 5px;
    font-weight: 600;
  }

  /* Level cards */
  .level-row {
    display: flex;
    gap: 4px;
    margin-bottom: 12px;
  }

  .level-card {
    flex: 1;
    border: 1px solid #ddd;
    border-radius: 4px;
    padding: 5px 4px;
    text-align: center;
  }

  .level-card.active {
    border-color: #333;
    background: #333;
    color: #fff;
  }

  .level-card.inactive {
    opacity: 0.35;
    background: #f8f8f8;
  }

  .level-num {
    font-size: 16px;
    font-weight: 700;
    line-height: 1;
  }

  .level-desc {
    font-size: 6.5px;
    margin-top: 2px;
    line-height: 1.3;
  }

  .level-card.active .level-desc {
    color: rgba(255, 255, 255, 0.8);
  }

  .level-card.inactive .level-desc {
    color: #999;
  }

  /* LOOP section */
  .loop-section {
    border: 1px solid #e0e0e0;
    border-radius: 4px;
    padding: 8px;
    margin-bottom: 12px;
  }

  .loop-header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 4px;
  }

  .loop-type-name {
    font-size: 10px;
    font-weight: 700;
    color: #333;
  }

  .loop-badge {
    display: inline-block;
    font-size: 7px;
    font-weight: 600;
    padding: 1px 6px;
    border-radius: 3px;
    background: rgba(54, 195, 255, 0.12);
    color: #1a8ab8;
    margin-bottom: 4px;
    letter-spacing: 0.3px;
  }

  .loop-desc {
    font-size: 7.5px;
    color: #666;
    line-height: 1.4;
  }

  .spacer {
    flex: 1;
  }

  /* Instructions */
  .instructions {
    font-size: 8px;
    color: #666;
    line-height: 1.7;
    margin-bottom: 10px;
  }

  .step {
    margin-bottom: 2px;
  }

  .step-num {
    font-weight: 700;
    color: #333;
  }

  /* Footer */
  .footer {
    padding-top: 8px;
    border-top: 1px solid #e8e8e8;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .footer-text {
    font-size: 7px;
    color: #999;
  }
</style>
