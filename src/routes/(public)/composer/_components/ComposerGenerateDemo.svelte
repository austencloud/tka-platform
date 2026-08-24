<!--
  ComposerGenerateDemo

  The Generate section's interactive demo: a real Generate button wired to the
  real client-side generation engine (generationOrchestrator — the same
  context-free service the mandala loader pool uses). Tap it and a fresh
  rotated LOOP lands in the player, with its mandala breathing next to it.

  Engine + player + mandala chunks are all dynamically imported so the
  prerendered page pays nothing until the section is reached (player/mandala
  mount on idle, seeded with the page's per-visit generated sequence; the
  engine chunk loads on the first button tap). Stages are fixed aspect-ratio
  so nothing shifts.
-->
<script lang="ts">
  import { MediaQuery } from "svelte/reactivity";
  import { activateWhenNear } from "$lib/actions/activate-when-near";
  import LazyMount from "$lib/shared/components/LazyMount.svelte";
  import { simplifyRepeatedWord } from "$lib/shared/foundation/utils/word-simplifier";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import {
    classifyComposerGenerationFailure,
    shouldSyncComposerSequence,
    type ComposerGenerationResult,
  } from "./composer-generation-failure";

  /** The page's per-visit demo sequence seeds the stages; null while it is
      still generating (the fixed-aspect stages hold the footprint). */
  let {
    sequence,
    onGenerated,
  }: {
    sequence: SequenceData | null;
    onGenerated?: (sequence: SequenceData) => void;
  } = $props();

  let current = $state<SequenceData | null>(null);
  let generating = $state(false);
  let result = $state<ComposerGenerationResult>("idle");
  let active = $state(false);
  const reduceMotion = new MediaQuery("(prefers-reduced-motion: reduce)");

  $effect(() => {
    if (shouldSyncComposerSequence(current, sequence)) current = sequence;
  });

  const word = $derived(
    current ? simplifyRepeatedWord(current.word ?? "") : ""
  );

  function activatePreview(node: HTMLElement) {
    return activateWhenNear(node, {
      activate: () => (active = true),
      rootMargin: "360px",
      deferUntilIdle: true,
      idleTimeout: 2200,
      fallbackDelay: 180,
    });
  }

  async function generate() {
    if (generating) return;
    active = true;
    generating = true;
    result = "idle";
    try {
      const [{ generationOrchestrator }, models, circular, grid, prop] =
        await Promise.all([
          import("$lib/shared/create/services/generation-orchestrator"),
          import("$lib/shared/foundation/domain/models/generation/generate-models"),
          import("$lib/shared/foundation/domain/models/generation/circular-models"),
          import("$lib/shared/pictograph/grid/domain/enums/grid-enums"),
          import("$lib/shared/pictograph/prop/domain/enums/prop-type"),
        ]);
      // This button intentionally exposes one prepared recipe, not the full
      // generator: 16 beats, intermediate difficulty, smooth constraints, and
      // a rotated quarter-period LOOP. Each draw may change the whole sequence.
      const seq = await generationOrchestrator.generateSequence({
        mode: models.GenerationMode.CIRCULAR,
        loopType: circular.LOOPType.ROTATED,
        period: circular.Period.QUARTERED,
        length: 16,
        turnIntensity: 3,
        gridMode: grid.GridMode.DIAMOND,
        propType: prop.PropType.STAFF,
        difficulty: models.DifficultyLevel.INTERMEDIATE,
        constraintPreset: "smooth",
      });
      // Plain-ify reactive proxies before handing to the player/mandala.
      current = JSON.parse(JSON.stringify(seq)) as SequenceData;
      onGenerated?.(current);
      result = "success";
    } catch (error) {
      result = classifyComposerGenerationFailure(error);
      if (result === "error") {
        console.error("[composer presentation] generation failed", error);
      }
    } finally {
      generating = false;
    }
  }
</script>

<div class="generate-demo" use:activatePreview>
  <p class="recipe-note">
    Each click draws a fresh 16-beat sequence from the same prepared recipe.
  </p>
  <div class="stages">
    <div class="stage">
      {#key current?.id}
        <LazyMount
          loader={() =>
            import("$lib/features/browse/sequences/display/components/media-viewer/InlineAnimationPlayer.svelte")}
          active={active && !!current}
          props={{
            sequence: current,
            autoPlay: !reduceMotion.current,
            chrome: "minimal",
            fill: true,
            cornerToggle: true,
          }}
        />
      {/key}
    </div>
    <div class="stage">
      {#key current?.id}
        <LazyMount
          loader={() =>
            import("$lib/shared/mandala/components/SequenceMandala.svelte")}
          active={active && !!current}
          props={{
            sequence: current,
            size: 420,
            bluePropType: "staff",
            redPropType: "staff",
            pathShape: "arc",
            strokeWidth: 2.5,
            animate: !reduceMotion.current,
            animateEasing: "breathe",
            animateRotation: 30,
            animatePeriod: 6,
            animateMin: 40,
            animateMax: 250,
          }}
        />
      {/key}
    </div>
  </div>

  <!-- Reserved line; visible once the word is known (no sideways shift). -->
  <div class="caption-row" class:pending={!current}>
    <span class="tka-font caption-word">{word}</span>
    <span class="caption-note">and its mandala</span>
  </div>

  <div class="action-row">
    <button
      type="button"
      class="generate-button"
      onclick={generate}
      disabled={generating}
    >
      <i
        class="fas {generating ? 'fa-circle-notch fa-spin' : 'fa-dice'}"
        aria-hidden="true"
      ></i>
      <span>{generating ? "Generating..." : "Generate a new one"}</span>
    </button>
    <!-- The line is always reserved so either failure state can arrive without
         moving the controls or demonstrations around it. -->
    <span class="retry-note" class:shown={result !== "idle"} aria-live="polite">
      {result === "no-result"
        ? "That recipe found no valid sequence. Draw again."
        : result === "error"
          ? "The generator couldn't run. Try again."
          : result === "success"
            ? "Sequence ready. The examples below now use it."
            : "Sequence ready."}
    </span>
  </div>
</div>

<style>
  /* Spacing to the prose above is owned by the host's duo grid gap. */
  .recipe-note {
    margin: 0 0 0.85rem;
    color: oklch(0.74 0.018 270);
    font-size: var(--font-size-compact, 0.75rem);
    line-height: 1.5;
    text-align: center;
  }

  .stages {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  .stage {
    position: relative;
    aspect-ratio: 1;
    border-radius: 18px;
    overflow: hidden;
    background: oklch(0.16 0.018 270 / 0.45);
    border: 1px solid oklch(0.4 0.04 270 / 0.14);
    display: grid;
    place-items: center;
  }

  .caption-row {
    display: flex;
    align-items: baseline;
    justify-content: center;
    flex-wrap: wrap;
    gap: 0.55rem;
    margin-top: 0.8rem;
    font-size: clamp(0.85rem, 0.8rem + 0.12vw, 1rem);
    color: oklch(0.74 0.018 270);
  }
  .caption-word {
    font-size: clamp(1.05rem, 1rem + 0.15vw, 1.25rem);
    color: oklch(0.88 0.03 270);
  }
  .caption-note {
    font-style: italic;
  }
  .caption-row.pending {
    visibility: hidden;
  }

  .action-row {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    margin-top: 1.3rem;
  }

  .generate-button {
    display: inline-flex;
    align-items: center;
    gap: 0.65rem;
    min-height: 48px;
    padding: 0 1.8rem;
    font-size: clamp(1.02rem, 0.97rem + 0.12vw, 1.18rem);
    font-weight: 650;
    font-family: inherit;
    color: #fff;
    border: none;
    border-radius: 13px;
    background: linear-gradient(135deg, #ec4899, #8b5cf6);
    box-shadow: 0 14px 32px oklch(0.5 0.2 340 / 0.35);
    cursor: pointer;
    transition:
      transform 160ms ease,
      box-shadow 160ms ease,
      opacity 160ms ease;
  }
  .generate-button:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 20px 44px oklch(0.5 0.2 340 / 0.5);
  }
  .generate-button:disabled {
    opacity: 0.7;
    cursor: default;
  }

  .retry-note {
    font-size: clamp(0.82rem, 0.78rem + 0.1vw, 0.95rem);
    color: oklch(0.74 0.018 270);
    font-style: italic;
    visibility: hidden;
  }
  .retry-note.shown {
    visibility: visible;
  }

  @media (max-width: 560px) {
    .stages {
      grid-template-columns: 1fr;
    }
  }

  /* Ultrawide: the pair fills the duo's demo column, so the supporting layout
     opens up. Type is on the base ramps above; this block is layout-only. */
  @media (min-width: 1680px) {
    .stages {
      gap: 1.5rem;
    }
    .caption-row {
      margin-top: 1.1rem;
    }
    .action-row {
      margin-top: 1.7rem;
    }
    .generate-button {
      min-height: 58px;
      padding: 0 2.2rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .generate-button {
      transition: none;
    }
    .generate-button:hover:not(:disabled) {
      transform: none;
    }
  }
</style>
