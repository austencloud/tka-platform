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
   * 6. Watch it move (live animation canvas)
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
  import { Letter } from "$lib/shared/foundation/domain/models/Letter";
  import { startPositionDeriver } from "$lib/shared/pictograph/shared/services/implementations/StartPositionDeriver";
  import HowTkaAnimationCard from "./HowTkaAnimationCard.svelte";

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

  const LANDING_SEQUENCE_ID = "seq_1774721810120_yigllpcr6";
  const LANDING_SEQUENCE_OWNER = "PBp3GSBO6igCKPwJyLZNmVEmamI3";

  function setupFromSequence(full: SequenceData) {
    sequence = full;
    firstStep = full.steps[0] ?? null;

    const derived = startPositionDeriver.getOrDeriveStartPosition(full);
    startPos = derived as StartPositionData | null;

    // Card 1: empty grid
    emptyGridData = {
      id: "how-empty-grid",
      letter: undefined,
      startPosition: null,
      endPosition: null,
      motions: {},
    };

    // Card 2: hands (PropType.HAND) + alpha glyph
    if (startPos) {
      gridOnlyData = {
        id: "how-hands",
        letter: Letter.ALPHA,
        startPosition: startPos.startPosition,
        endPosition: startPos.endPosition,
        motions: {
          blue: startPos.motions?.blue ? { ...startPos.motions.blue, propType: PropType.HAND } : undefined,
          red: startPos.motions?.red ? { ...startPos.motions.red, propType: PropType.HAND } : undefined,
        },
      };
    }

    // Card 3: props + alpha glyph + "Start" label
    if (startPos) {
      propsData = {
        id: startPos.id ?? "how-props",
        letter: Letter.ALPHA,
        stepNumber: 0,
        startPosition: startPos.startPosition,
        endPosition: startPos.endPosition,
        motions: {
          blue: forceProps(startPos.motions?.blue),
          red: forceProps(startPos.motions?.red),
        },
      } as PictographData;
    }

    // Card 4: first beat + beat "1" + positions
    if (firstStep) {
      motionData = {
        id: firstStep.id ?? "how-motion",
        letter: (firstStep.letter || undefined) as Letter | undefined,
        stepNumber: 1,
        startPosition: firstStep.startPosition,
        endPosition: firstStep.endPosition,
        motions: {
          blue: forceProps(firstStep.motions?.blue),
          red: forceProps(firstStep.motions?.red),
        },
      };
    }
  }

  onMount(async () => {
    try {
      // Load the specific AABB sequence directly from Firestore, then use
      // browseLoader's mapping by injecting the sourceRef into its cache.
      const browseLoader = container.items.browseLoader as any;
      const sourceRef = `users/${LANDING_SEQUENCE_OWNER}/sequences/${LANDING_SEQUENCE_ID}`;

      // Inject the direct path so browseLoader can find and map it
      if (browseLoader.sourceRefCache) {
        browseLoader.sourceRefCache.set(`id:${LANDING_SEQUENCE_ID}`, sourceRef);
      }

      const full = await browseLoader.loadFullSequenceData("AABB", LANDING_SEQUENCE_ID);

      if (!full || !full.steps || full.steps.length === 0) {
        console.warn("[HowTkaWorks] Landing sequence not found or empty");
        loaded = true;
        return;
      }

      setupFromSequence(full);
    } catch (e) {
      console.error("[HowTkaWorks] Failed to load AABB:", e);
    } finally {
      loaded = true;
    }
  });

  // Step metadata — defined inline per card to avoid array-index TS strictness issues
</script>

<section class="how-tka-works">
  <h2>How TKA works</h2>

  {#if loaded && sequence}
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

      <!-- Card 2: Grid + hands (PropType.HAND) -->
      <div class="step-card">
        <span class="step-badge">2</span>
        <div class="pictograph-frame">
          {#if gridOnlyData}
            <PictographContainer
              pictographData={gridOnlyData}
              gridMode={GridMode.DIAMOND}
              bluePropTypeOverride={PropType.HAND}
              redPropTypeOverride={PropType.HAND}
              showTKA={true}
              showReversals={false}
              showPositions={false}
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
              showTKA={true}
              showReversals={false}
              showPositions={false}
              darkMode={true}
              disableTransitions={true}
            />
          {/if}
        </div>
        <h3>Add props</h3>
        <p>Each hand holds a prop. Staves, fans, clubs. The notation works for all of them.</p>
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
              showPositions={true}
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
        <div class="sequence-frame">
          <ChoreoCard
            {sequence}
            darkMode={true}
            columnCount={2}
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

      <!-- Card 6: Live animation -->
      <div class="step-card">
        <span class="step-badge">6</span>
        <div class="animation-frame">
          <HowTkaAnimationCard {sequence} {propType} />
        </div>
        <h3>Watch it move</h3>
        <p>The sequence plays back as a looping animation.</p>
      </div>
    </div>
  {:else}
    <!-- Skeleton: same 3+3 grid layout, pulsing placeholders -->
    <div class="top-row">
      {#each [1, 2, 3] as n}
        <div class="step-card skeleton">
          <span class="step-badge">{n}</span>
          <div class="skeleton-pictograph"></div>
          <div class="skeleton-title"></div>
          <div class="skeleton-text"></div>
        </div>
      {/each}
    </div>
    <div class="bottom-row">
      {#each [4, 5, 6] as n}
        <div class="step-card skeleton">
          <span class="step-badge">{n}</span>
          <div class="skeleton-pictograph"></div>
          <div class="skeleton-title"></div>
          <div class="skeleton-text"></div>
        </div>
      {/each}
    </div>
  {/if}
</section>

<style>
  .how-tka-works {
    padding: 80px 24px;
    max-width: 1000px;
    margin: 0 auto;
  }

  h2 {
    font-family: var(--landing-heading-font, "Instrument Serif", Georgia, serif);
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

  /* ChoreoCard frame for card 5 */
  .sequence-frame {
    width: 100%;
    height: clamp(140px, 25vw, 220px);
    border-radius: 8px;
    overflow: hidden;
  }

  /* Animation canvas for card 6 */
  .animation-frame {
    width: 100%;
    max-width: 200px;
    aspect-ratio: 1;
    border-radius: 8px;
    overflow: hidden;
  }

  /* Card text */
  h3 {
    font-family: var(--landing-heading-font, "Instrument Serif", Georgia, serif);
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

  /* ── Skeleton loading states ─────────────────────────────────────────────── */
  @keyframes skeleton-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .skeleton {
    animation: skeleton-pulse 1.8s ease-in-out infinite;
    /* Prevent hover border-color change on skeleton cards */
    pointer-events: none;
  }

  .skeleton .skeleton-pictograph {
    width: 100%;
    max-width: 200px;
    aspect-ratio: 1;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.03);
    margin: 0 auto;
  }

  .skeleton .skeleton-title {
    width: 60%;
    height: 20px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.05);
    margin: 0 auto;
  }

  .skeleton .skeleton-text {
    width: 80%;
    height: 14px;
    border-radius: 3px;
    background: rgba(255, 255, 255, 0.03);
    margin: 0 auto;
  }

  @media (prefers-reduced-motion: reduce) {
    .step-card {
      transition: none;
    }

    .skeleton {
      animation: none;
    }
  }
</style>
