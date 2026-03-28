<script lang="ts">
  /**
   * HowTkaWorksSection
   *
   * Five-card progression that teaches TKA notation by building layers:
   * 1. Hand positions on the grid (just the grid, position glyph)
   * 2. Add props (staves appear at the hand positions)
   * 3. Add motion (arrows + letter glyph = one full pictograph)
   * 4. String them together (ChoreoCard showing the full sequence)
   * 5. Watch it move (animation placeholder)
   *
   * All five cards derive from the same loaded AABB sequence.
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

  // Card 1: grid only — start position with motions stripped out
  let gridOnlyData = $state<PictographData | null>(null);

  // Card 2: start position with props (static motions, no arrows)
  let propsData = $state<PictographData | null>(null);

  // Card 3: first step with full pictograph
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

      // Card 1: grid + position glyph only — no props, no arrows
      if (startPos) {
        gridOnlyData = {
          id: "how-grid",
          letter: undefined,
          startPosition: startPos.startPosition,
          endPosition: startPos.endPosition,
          motions: {},
        };
      }

      // Card 2: start position with props visible (static motions = props shown)
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

      // Card 3: first beat with full pictograph
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
      <!-- Card 1: Grid only -->
      <div class="step-card">
        <span class="step-badge">1</span>
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
        <h3>Hand positions</h3>
        <p>Two hands on a grid. Each dot is a place your hand can be.</p>
      </div>

      <!-- Card 2: Props visible -->
      <div class="step-card">
        <span class="step-badge">2</span>
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
        <p>Put staves (or fans, clubs, anything) in the hands. The prop orientation is recorded.</p>
      </div>

      <!-- Card 3: Full pictograph -->
      <div class="step-card">
        <span class="step-badge">3</span>
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
    </div>

    <!-- Bottom row: 2 cards centered -->
    <div class="bottom-row">
      <!-- Card 4: Full sequence -->
      <div class="step-card wide-card">
        <span class="step-badge">4</span>
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

      <!-- Card 5: Animation placeholder -->
      <div class="step-card wide-card">
        <span class="step-badge">5</span>
        <div class="animation-frame">
          <div class="animation-placeholder">
            <i class="fas fa-play-circle" aria-hidden="true"></i>
            <span>Animation plays here</span>
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

  /* Bottom row: 2 cards centered */
  .bottom-row {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 20px;
    max-width: 680px;
    margin: 0 auto;
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
    gap: 10px;
    background: rgba(0, 0, 0, 0.3);
    border: 1px dashed rgba(255, 255, 255, 0.12);
    border-radius: 8px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.35));
    font-size: var(--font-size-sm, 0.875rem);
  }

  .animation-placeholder i {
    font-size: 2rem;
    opacity: 0.5;
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
    }

    .pictograph-frame {
      max-width: 180px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .step-card {
      transition: none;
    }
  }
</style>
