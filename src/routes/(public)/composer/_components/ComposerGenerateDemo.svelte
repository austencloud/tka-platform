<!--
  ComposerGenerateDemo

  The Generate section's interactive demo: a real Generate button wired to the
  real client-side generation engine (generationOrchestrator — the same
  context-free service the app's own Generate tab uses). Tap it and a fresh
  rotated LOOP cascades into the workspace on the left and plays on the right.

  The two stages show the sequence's two halves — the notation it IS and the
  movement it BECOMES. An earlier version paired the player with a mandala, but
  the player's own trails already draw that figure, so the pair said one thing
  twice.

  The left stage is the REAL StepGrid, and the reveal is the app's own
  generation cascade: setPendingGenerationAnimation is the flag the Generate tab
  raises before a generated sequence reaches the workspace (see
  generate-actions.svelte.ts), and StepGrid consumes it on its first render.
  Remounting on the new sequence id gives each draw that first render, so every
  click cascades exactly as it does in the app.

  Engine, grid, and player chunks are all dynamically imported so the
  prerendered page pays nothing until the section is reached (grid/player mount
  on idle, seeded with the page's per-visit generated sequence; the engine chunk
  loads on the first button tap). Stages are fixed aspect-ratio so nothing
  shifts.
-->
<script lang="ts">
  import { MediaQuery } from "svelte/reactivity";
  import { activateWhenNear } from "$lib/actions/activate-when-near";
  import LazyMount from "$lib/shared/components/LazyMount.svelte";
  import { simplifyRepeatedWord } from "$lib/shared/foundation/utils/word-simplifier";
  import { setPendingGenerationAnimation } from "$lib/features/create/shared/workspace-panel/sequence-display/state/step-grid-display-state.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
  import {
    classifyComposerGenerationFailure,
    shouldSyncComposerSequence,
    type ComposerGenerationResult,
  } from "./composer-generation-failure";

  /** Four columns keeps a 16-step LOOP square inside a square stage. */
  const STEP_COLUMNS = 4;

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

  const stepData = $derived<StepData[]>(
    current ? [...(current.steps ?? [])] : []
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
      // generator: 16 steps, intermediate difficulty, smooth constraints, and
      // a rotated quarter-period LOOP. Each draw may change the whole sequence.
      const seq = await generationOrchestrator.generateSequence({
        mode: models.GenerationMode.CIRCULAR,
        loopType: circular.LOOPType.ROTATED,
        period: circular.Period.QUARTERED,
        length: 16,
        turnIntensity: 1.5,
        gridMode: grid.GridMode.DIAMOND,
        propType: prop.PropType.STAFF,
        difficulty: models.DifficultyLevel.INTERMEDIATE,
        constraintPreset: "smooth",
      });
      // Plain-ify reactive proxies before handing to the grid/player.
      // Raise the app's generation flag first: the remounted StepGrid reads it
      // on its first render and runs the same staggered reveal the Generate tab
      // produces. It clears itself once consumed.
      setPendingGenerationAnimation(true);
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
  <div class="stages">
    <!-- The notation: the real workspace grid, cascading in on each draw.
         fitAllSteps scales the cells to the box instead of sizing them from the
         column count alone, which left a 16-step draw occupying the top third of
         a square stage. No arrivalSequence: it draws a mandala chip into the
         grid, and the player beside it already traces that same figure. -->

    <div class="stage">
      {#key current?.id}
        <LazyMount
          loader={() =>
            import("$lib/features/create/shared/workspace-panel/sequence-display/components/StepGrid.svelte")}
          active={active && !!current}
          props={{
            steps: stepData,
            startPosition: current?.startPosition ?? null,
            manualColumnCount: STEP_COLUMNS,
            activeMode: "generate",
            fitAllSteps: true,
            sequenceWord: current?.word ?? "",
          }}
        />
      {/key}
    </div>
    <!-- The movement: the same steps, playing. -->
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
  </div>

  <!-- Reserved line; visible once the word is known (no sideways shift). -->
  <div class="caption-row" class:pending={!current}>
    <span class="tka-font caption-word">{word}</span>
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
         moving the controls or demonstrations around it. Success says nothing:
         the grid cascading and the player restarting ARE the confirmation, and
         narrating them adds a line of copy that tells the visitor what they can
         already see. -->
    <span
      class="retry-note"
      class:shown={result === "no-result" || result === "error"}
      aria-live="polite"
    >
      {result === "no-result"
        ? "That recipe found no valid sequence. Draw again."
        : result === "error"
          ? "The generator couldn't run. Try again."
          : ""}
    </span>
  </div>
</div>

<style>
  .stages {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  /* Both stages hand their whole square to one component — the grid sizes its
     cells from the box it is given, and the player fills. `stretch` rather than
     `center`: a centered grid child sizes to its content, which for StepGrid is
     zero until it has measured a box it never got. */
  .stage {
    position: relative;
    aspect-ratio: 1;
    border-radius: 18px;
    overflow: hidden;
    background: oklch(0.16 0.018 270 / 0.45);
    border: 1px solid oklch(0.4 0.04 270 / 0.14);
    display: grid;
    place-items: stretch;
  }
  .stage > :global(*) {
    min-width: 0;
    min-height: 0;
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
