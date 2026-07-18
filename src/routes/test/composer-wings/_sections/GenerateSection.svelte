<!--
  GenerateSection (test-page marketing demo)

  A stripped-down Generate experience for the composer-wings test page: the four
  REAL parameter cards (Length / Level / Turn intensity / Grid) in a 2x2 grid,
  wired to local runes state, plus a Generate button that runs the REAL
  client-side generation engine (generationOrchestrator — the same context-free
  service the composer's live demo and the mandala loader pool use) and plays the
  result in the REAL InlineAnimationPlayer.

  Not shipping code — it skips the generate module's config store, LOOP-param
  provider, and auth/tier plumbing and drives the cards from four plain $state
  fields. The heavy engine chunk is dynamically imported on the first tap; the
  player mounts on idle via LazyMount. Stages/cells are fixed-size so nothing
  shifts. Browser-only: the cards lean on app singletons (settingsService,
  authState, i18n) so the whole interactive block is gated behind `browser`, with
  a same-geometry skeleton reserving its footprint during SSR.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { browser } from "$app/environment";

  import LazyMount from "$lib/shared/components/LazyMount.svelte";
  import { simplifyRepeatedWord } from "$lib/shared/foundation/utils/word-simplifier";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

  // Enums are lightweight and already in the eager graph via the cards below —
  // only the engine (generationOrchestrator) is deferred to the first tap.
  import {
    DifficultyLevel,
    GenerationMode,
  } from "$lib/shared/foundation/domain/models/generation/generate-models";
  import { LOOPType, Period } from "$lib/shared/foundation/domain/models/generation/circular-models";
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";

  // The four real parameter cards.
  import LengthCard from "$lib/features/create/generate/components/cards/LengthCard.svelte";
  import LevelCard from "$lib/features/create/generate/components/cards/LevelCard.svelte";
  import TurnIntensityCard from "$lib/features/create/generate/components/cards/TurnIntensityCard.svelte";
  import GridModeCard from "$lib/features/create/generate/components/cards/GridModeCard.svelte";

  // ── Parameter state ───────────────────────────────────────────────────────
  // length starts at 8 (valid at every access tier — the guest cap is 8) so the
  // LengthCard's tier-clamp effect never fires and snaps the value mid-demo.
  let length = $state(8);
  let level = $state<DifficultyLevel>(DifficultyLevel.INTERMEDIATE);
  let turnIntensity = $state(3);
  let gridMode = $state<GridMode>(GridMode.DIAMOND);

  // Allowed turn-intensity values per level (mirrors LOOPParameterProvider). The
  // real provider returns [] for BEGINNER; here we substitute [0] so the card
  // stays a working stepper ("≤0", no turns) instead of a dead control.
  function allowedTurnsFor(lvl: DifficultyLevel): number[] {
    switch (lvl) {
      case DifficultyLevel.BEGINNER:
        return [0];
      case DifficultyLevel.INTERMEDIATE:
        return [1, 2, 3];
      case DifficultyLevel.ADVANCED:
        return [0.5, 1, 1.5, 2, 2.5, 3];
      default:
        return [1, 2, 3];
    }
  }
  const allowedTurnValues = $derived(allowedTurnsFor(level));

  // ── Change handlers (bound to the cards) ──────────────────────────────────
  function handleLengthChange(v: number) {
    length = v;
  }

  function handleLevelChange(v: DifficultyLevel) {
    level = v;
    // Clamp turn intensity into the new level's allowed set — the same nearest-
    // value coercion CardBasedSettingsContainer applies (e.g. 0.5 is valid at
    // level 3 but not level 2).
    const allowed = allowedTurnsFor(v);
    if (allowed.length > 0 && !allowed.includes(turnIntensity)) {
      turnIntensity = allowed.reduce((best, x) =>
        Math.abs(x - turnIntensity) < Math.abs(best - turnIntensity) ? x : best
      );
    }
  }

  function handleTurnIntensityChange(v: number) {
    turnIntensity = v;
  }

  function handleGridModeChange(v: GridMode) {
    gridMode = v;
  }

  // ── Generation + playback ─────────────────────────────────────────────────
  let current = $state<SequenceData | null>(null);
  let generating = $state(false);
  let failedOnce = $state(false);
  let active = $state(false); // gates the LazyMount player (idle-activated)

  const word = $derived(current ? simplifyRepeatedWord(current.word ?? "") : "");

  async function generate() {
    if (generating) return;
    generating = true;
    try {
      // Engine chunk loads on first tap; the small enums are already imported.
      const { generationOrchestrator } = await import(
        "$lib/shared/create/services/generation-orchestrator"
      );
      const seq = await generationOrchestrator.generateSequence({
        mode: GenerationMode.CIRCULAR,
        loopType: LOOPType.ROTATED,
        period: Period.QUARTERED,
        length,
        turnIntensity,
        gridMode,
        propType: PropType.STAFF,
        difficulty: level, // 1=BEGINNER, 2=INTERMEDIATE, 3=ADVANCED
        constraintPreset: "smooth",
      });
      // Plain-ify reactive proxies before handing to the player.
      current = JSON.parse(JSON.stringify(seq)) as SequenceData;
      failedOnce = false;
    } catch {
      // Beam search found no path — rare; invite another tap instead of erroring.
      failedOnce = true;
    } finally {
      generating = false;
    }
  }

  onMount(() => {
    // Activate the player and seed a starter sequence on idle so the stage is
    // never empty, without blocking first paint.
    const go = () => {
      active = true;
      generate();
    };
    if (typeof requestIdleCallback !== "undefined") {
      requestIdleCallback(go, { timeout: 3000 });
    } else {
      setTimeout(go, 400);
    }
  });
</script>

<section class="generate-section">
  <header class="intro">
    <h2 class="title">Generate</h2>
    <p class="lede">Set four parameters, tap Generate, watch a fresh rotated LOOP play back.</p>
  </header>

  {#if browser}
    <div class="demo-grid">
      <div class="controls">
        <div class="card-grid">
          <div class="card-cell">
            <LengthCard
              currentLength={length}
              currentMode={GenerationMode.CIRCULAR}
              loopEnabled={true}
              onLengthChange={handleLengthChange}
            />
          </div>
          <div class="card-cell">
            <LevelCard currentLevel={level} onLevelChange={handleLevelChange} />
          </div>
          <div class="card-cell">
            <TurnIntensityCard
              currentIntensity={turnIntensity}
              allowedValues={allowedTurnValues}
              onIntensityChange={handleTurnIntensityChange}
            />
          </div>
          <div class="card-cell">
            <GridModeCard currentMode={gridMode} onModeChange={handleGridModeChange} />
          </div>
        </div>

        <div class="action-row">
          <button
            type="button"
            class="generate-button"
            onclick={generate}
            disabled={generating}
          >
            <i class="fas {generating ? 'fa-circle-notch fa-spin' : 'fa-dice'}" aria-hidden="true"></i>
            <span>{generating ? "Generating..." : "Generate"}</span>
          </button>
          <!-- Line is always reserved; only visibility toggles, so the rare empty
               draw doesn't nudge the section (no-layout-shift). -->
          <span class="retry-note" class:shown={failedOnce} aria-live="polite">
            That draw came up empty. Hit it again.
          </span>
        </div>
      </div>

      <div class="player-col">
        <div class="stage">
          {#key current?.id}
            <LazyMount
              loader={() =>
                import(
                  "$lib/features/browse/sequences/display/components/media-viewer/InlineAnimationPlayer.svelte"
                )}
              active={active && !!current}
              props={{ sequence: current, autoPlay: true, chrome: "minimal", fill: true }}
            />
          {/key}
        </div>
        <!-- Reserved caption; visible once the word is known (no sideways shift). -->
        <div class="caption-row" class:pending={!current}>
          <span class="tka-font caption-word">{word}</span>
          <span class="caption-note">generated live</span>
        </div>
      </div>
    </div>
  {:else}
    <!-- SSR skeleton: same geometry as the interactive block so hydration causes
         zero layout shift. -->
    <div class="demo-grid" aria-hidden="true">
      <div class="controls">
        <div class="card-grid">
          <div class="card-cell skeleton"></div>
          <div class="card-cell skeleton"></div>
          <div class="card-cell skeleton"></div>
          <div class="card-cell skeleton"></div>
        </div>
        <div class="action-row">
          <div class="generate-button skeleton-button"></div>
          <span class="retry-note">&nbsp;</span>
        </div>
      </div>
      <div class="player-col">
        <div class="stage skeleton"></div>
        <div class="caption-row pending">&nbsp;</div>
      </div>
    </div>
  {/if}
</section>

<style>
  .generate-section {
    display: flex;
    flex-direction: column;
    gap: 1.4rem;
    width: 100%;
    max-width: 1040px;
    margin-inline: auto;
    color: oklch(0.9 0.02 270);
  }

  .intro {
    text-align: center;
  }
  .title {
    font-size: clamp(1.5rem, 1.3rem + 0.9vw, 2.2rem);
    font-weight: 750;
    margin: 0;
  }
  .lede {
    margin: 0.4rem 0 0;
    font-size: clamp(0.95rem, 0.9rem + 0.2vw, 1.1rem);
    color: oklch(0.68 0.02 270);
  }

  .demo-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 1.5rem;
    align-items: start;
  }

  .controls {
    display: flex;
    flex-direction: column;
    gap: 1.1rem;
    min-width: 0;
  }

  /* 2x2 grid of real cards. Cells carry an explicit height so the cards'
     container-type:size boxes never collapse (container-query zero-size trap). */
  .card-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }
  .card-cell {
    height: 132px;
    min-width: 0;
    min-height: 0;
  }

  .player-col {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .stage {
    position: relative;
    aspect-ratio: 1;
    width: 100%;
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
    color: oklch(0.6 0.02 270);
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
    color: oklch(0.65 0.02 270);
    font-style: italic;
    visibility: hidden;
  }
  .retry-note.shown {
    visibility: visible;
  }

  /* SSR skeleton fills — never seen after hydration. */
  .skeleton {
    background: oklch(0.2 0.02 270 / 0.5);
    border-radius: 16px;
  }
  .skeleton-button {
    width: 12rem;
    box-shadow: none;
    opacity: 0.5;
  }

  @media (max-width: 720px) {
    .demo-grid {
      grid-template-columns: 1fr;
    }
    .player-col {
      order: -1; /* player above controls on narrow screens */
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
