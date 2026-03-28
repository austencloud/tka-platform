<script lang="ts">
  /**
   * HowTkaWorksSection
   *
   * Six-card progression that teaches TKA notation by building layers:
   * 1. The grid (empty diamond grid, no hands, no props)
   * 2. Add hands (grid + hand position dots)
   * 3. Add props (staves appear at the hand positions)
   * 4. Add motion (arrows + letter glyph = one full pictograph)
   * 5. String them together (ChoreoCard showing the full sequence)
   * 6. Watch it move (animation placeholder)
   *
   * All six cards derive from the same loaded AABB sequence.
   */
  import { onMount } from "svelte";
  import { container } from "$lib/shared/di";
  import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";
  import ChoreoCard from "$lib/shared/sequence-viewer/components/ChoreoCard.svelte";
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { StepData } from "$lib/features/create/shared/domain/models/StepData";
  import type { StartPositionData } from "$lib/features/create/shared/domain/models/StartPositionData";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
  import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
  import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
  import { startPositionDeriver } from "$lib/shared/pictograph/shared/services/implementations/StartPositionDeriver";

  interface Props {
    propType?: PropType;
  }

  let { propType = PropType.STAFF }: Props = $props();

  let sequence = $state<SequenceData | null>(null);
  let startPos = $state<StartPositionData | null>(null);
  let firstStep = $state<StepData | null>(null);

  // Card 1: empty grid — no hand dots, no props, no arrows
  let emptyGridData = $state<PictographData | null>(null);

  // Card 2: grid + hand position dots (start position, motions stripped)
  let gridOnlyData = $state<PictographData | null>(null);

  // Card 3: start position with props (static motions, no arrows)
  let propsData = $state<PictographData | null>(null);

  // Card 4: first step with full pictograph
  let motionData = $state<PictographData | null>(null);

  let loaded = $state(false);

  /**
   * Force a specific prop type on all motions in a PictographData record.
   */
  function forceProps(motion: MotionData | undefined | null): MotionData | undefined {
    if (!motion) return undefined;
    return { ...motion, propType };
  }

  onMount(async () => {
    try {
      const browseLoader = container.items.browseLoader;
      const full = await browseLoader.loadFullSequenceData(
        "AABB",
        "seq_1773477720946_so6kw28yf"
      );

      if (!full || full.steps.length === 0) {
        console.warn("[HowTkaWorks] AABB sequence not found, section hidden");
        loaded = true;
        return;
      }

      sequence = full;
      firstStep = full.steps[0] ?? null;

      // Derive start position from sequence
      const derived = startPositionDeriver.getOrDeriveStartPosition(full);
      // The deriver can return StepData | StartPositionData — cast to StartPositionData
      // since we only need the pictograph fields (id, startPosition, motions)
      startPos = derived as StartPositionData | null;

      // Card 1: empty grid — null startPosition/endPosition so no hand dots render
      emptyGridData = {
        id: "how-empty-grid",
        letter: undefined,
        startPosition: null,
        endPosition: null,
        motions: {},
      };

      // Card 2: grid + hand position dots only — no props, no arrows
      if (startPos) {
        gridOnlyData = {
          id: "how-grid",
          letter: undefined,
          startPosition: startPos.startPosition,
          endPosition: startPos.endPosition,
          motions: {},
        };
      }

      // Card 3: start position with props visible (static motions = props shown)
      if (startPos) {
        propsData = {
          id: startPos.id ?? "how-props",
          letter: undefined,
          startPosition: startPos.startPosition,
          endPosition: startPos.endPosition,
          motions: {
            blue: forceProps(startPos.motions?.blue),
            red: forceProps(startPos.motions?.red),
          },
        };
      }

      // Card 4: first beat with full pictograph
      if (firstStep) {
        motionData = {
          id: firstStep.id ?? "how-motion",
          letter: (firstStep.letter || undefined) as Letter | undefined,
          startPosition: firstStep.startPosition,
          endPosition: firstStep.endPosition,
          motions: {
            blue: forceProps(firstStep.motions?.blue),
            red: forceProps(firstStep.motions?.red),
          },
        };
      }
    } catch (e) {
      console.error("[HowTkaWorks] Failed to load AABB:", e);
    } finally {
      loaded = true;
    }
  });

  // Step metadata — defined inline per card to avoid array-index TS strictness issues
</script>

{#if loaded && sequence}
  <section class="how-tka-works">
    <h2>How TKA works</h2>

    <!-- Top row: 3 cards -->
    <div class="top-row">
      <!-- Card 1: Empty grid -->
      <div class="step-card">
        <span class="step-badge">1</span>
        <div class="pictograph-frame">
          {#if emptyGridData}
            <PictographContainer
              pictographData={emptyGridData}
              gridMode={GridMode.DIAMOND}
              showTKA={false}
              showReversals={false}
              showPositions={false}
              darkMode={true}
              disableTransitions={true}
            />
          {/if}
        </div>
        <h3>The grid</h3>
        <p>Eight points on a diamond. This is where everything happens.</p>
      </div>

      <!-- Card 2: Grid + hand dots -->
      <div class="step-card">
        <span class="step-badge">2</span>
        <div class="pictograph-frame">
          {#if gridOnlyData}
            <PictographContainer
              pictographData={gridOnlyData}
              gridMode={GridMode.DIAMOND}
              showTKA={false}
              showReversals={false}
              showPositions={true}
              darkMode={true}
              disableTransitions={true}
            />
          {/if}
        </div>
        <h3>Add hands</h3>
        <p>Two hands on the grid. Where they sit is the position.</p>
      </div>

      <!-- Card 3: Props visible -->
      <div class="step-card">
        <span class="step-badge">3</span>
        <div class="pictograph-frame">
          {#if propsData}
            <PictographContainer
              pictographData={propsData}
              gridMode={GridMode.DIAMOND}
              bluePropTypeOverride={propType}
              redPropTypeOverride={propType}
              showTKA={false}
              showReversals={false}
              showPositions={false}
              darkMode={true}
              disableTransitions={true}
            />
          {/if}
        </div>
        <h3>Add props</h3>
        <p>Each hand holds a prop. Staves, fans, clubs — the notation works for all of them.</p>
      </div>
    </div>

    <!-- Bottom row: 3 cards -->
    <div class="bottom-row">
      <!-- Card 4: Full pictograph -->
      <div class="step-card">
        <span class="step-badge">4</span>
        <div class="pictograph-frame">
          {#if motionData}
            <PictographContainer
              pictographData={motionData}
              gridMode={GridMode.DIAMOND}
              bluePropTypeOverride={propType}
              redPropTypeOverride={propType}
              showTKA={true}
              showReversals={false}
              showPositions={false}
              darkMode={true}
              disableTransitions={true}
            />
          {/if}
        </div>
        <h3>Add motion</h3>
        <p>Arrows show where each hand moves. The letter names the pattern.</p>
      </div>

      <!-- Card 5: Full sequence -->
      <div class="step-card wide-card">
        <span class="step-badge">5</span>
        <span class="sequence-word">{sequence.word}</span>
        <div class="sequence-frame">
          <ChoreoCard
            {sequence}
            darkMode={true}
            columnCount={4}
            bluePropType={propType}
            redPropType={propType}
            showDifficultyLevel={false}
            showCreatorName={false}
            showNotes={false}
            showBirthday={false}
            showLoopGlyph={false}
          />
        </div>
        <h3>String them together</h3>
        <p>Each cell is one beat. Read left to right. Four beats spell a word.</p>
      </div>

      <!-- Card 6: Animation placeholder -->
      <div class="step-card">
        <span class="step-badge">6</span>
        <div class="animation-frame">
          <div class="animation-placeholder">
            <div class="play-icon-wrap">
              <i class="fas fa-play" aria-hidden="true"></i>
            </div>
            <span>Tap to play</span>
          </div>
        </div>
        <h3>Watch it move</h3>
        <p>Play the sequence back as an animation to see the full movement.</p>
      </div>
    </div>
  </section>
{/if}

<style>
  .how-tka-works {
    padding: 80px 24px;
    max-width: 1000px;
    margin: 0 auto;
  }

  h2 {
    font-family: "Instrument Serif", Georgia, serif;
    font-size: clamp(1.8rem, 4vw, 2.6rem);
    font-weight: 400;
    color: var(--theme-text, #fff);
    text-align: center;
    margin: 0 0 48px;
    letter-spacing: -0.02em;
  }

  /* Top row: 3 equal cards */
  .top-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
    margin-bottom: 20px;
  }

  /* Bottom row: 3 cards, full width */
  .bottom-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
  }

  /* Individual card */
  .step-card {
    position: relative;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    border-radius: 16px;
    padding: 24px 16px 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    transition: border-color 0.2s ease;
  }

  .step-card:hover {
    border-color: rgba(212, 129, 58, 0.25);
  }

  /* Step number badge */
  .step-badge {
    position: absolute;
    top: -12px;
    left: 50%;
    transform: translateX(-50%);
    width: 24px;
    height: 24px;
    background: #d4813a;
    color: #fff;
    font-size: 12px;
    font-weight: 700;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
    box-shadow: 0 2px 8px rgba(212, 129, 58, 0.4);
  }

  /* Pictograph container for cards 1-3 */
  .pictograph-frame {
    width: 100%;
    max-width: 200px;
    aspect-ratio: 1;
    border-radius: 8px;
    overflow: hidden;
  }

  /* Word label above ChoreoCard in card 4 */
  .sequence-word {
    font-family: var(--font-heading, "Instrument Serif");
    letter-spacing: 0.1em;
    color: var(--text-dim);
    text-align: center;
  }

  /* ChoreoCard frame for card 4 */
  .sequence-frame {
    width: 100%;
    height: clamp(140px, 25vw, 220px);
    border-radius: 8px;
    overflow: hidden;
  }

  /* Animation placeholder for card 5 */
  .animation-frame {
    width: 100%;
    height: clamp(140px, 25vw, 220px);
    border-radius: 8px;
    overflow: hidden;
  }

  .animation-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    background: rgba(0, 0, 0, 0.3);
    border: 1px dashed rgba(212, 129, 58, 0.2);
    border-radius: 8px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    font-size: var(--font-size-sm, 0.875rem);
  }

  .play-icon-wrap {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    border: 2px solid rgba(212, 129, 58, 0.35);
    display: flex;
    align-items: center;
    justify-content: center;
    animation: pulse-ring 2.4s ease-in-out infinite;
  }

  .play-icon-wrap i {
    font-size: 1.1rem;
    color: rgba(212, 129, 58, 0.6);
    margin-left: 3px; /* optical center for play triangle */
  }

  @keyframes pulse-ring {
    0%, 100% {
      border-color: rgba(212, 129, 58, 0.2);
      box-shadow: 0 0 0 0 rgba(212, 129, 58, 0);
    }
    50% {
      border-color: rgba(212, 129, 58, 0.5);
      box-shadow: 0 0 0 8px rgba(212, 129, 58, 0.06);
    }
  }

  /* Card text */
  h3 {
    font-family: "Instrument Serif", Georgia, serif;
    font-size: clamp(0.95rem, 1.8vw, 1.15rem);
    font-weight: 400;
    color: var(--theme-text, #fff);
    margin: 0;
    text-align: center;
  }

  p {
    font-size: var(--font-size-sm, 0.875rem);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    line-height: 1.55;
    margin: 0;
    text-align: center;
  }

  /* Mobile: stack everything */
  @media (max-width: 680px) {
    .how-tka-works {
      padding: 48px 16px;
    }

    h2 {
      margin-bottom: 36px;
    }

    .top-row {
      grid-template-columns: 1fr;
      max-width: 340px;
      margin-left: auto;
      margin-right: auto;
      margin-bottom: 20px;
    }

    .bottom-row {
      grid-template-columns: 1fr;
      max-width: 340px;
      margin-left: auto;
      margin-right: auto;
    }

    .pictograph-frame {
      max-width: 180px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .step-card {
      transition: none;
    }

    .play-icon-wrap {
      animation: none;
    }
  }
</style>
