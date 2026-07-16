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
  import { doc, getDoc } from "firebase/firestore";
  import { getFirestoreInstance } from "$lib/shared/auth/firebase";
  import { getPublicSequencesPath } from "$lib/shared/library/data/firestore-paths";
  import { hydrate } from "$lib/shared/foundation/services/sequence-hydrator";
  import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";
  import ChoreoCard from "$lib/shared/sequence-viewer/components/ChoreoCard.svelte";
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
  import type { StartPositionData } from "$lib/shared/foundation/domain/models/start-position-data";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
  import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
  import { Letter } from "$lib/shared/foundation/domain/models/letter";
  import { startPositionDeriver } from "$lib/shared/pictograph/shared/services/start-position-deriver";
  import type { PublicSequenceIndex } from "$lib/shared/foundation/domain/models/public-sequence-index";
  import { LOOPType } from "$lib/shared/foundation/domain/models/generation/circular-models";
  import HowTkaAnimationCard from "./HowTkaAnimationCard.svelte";

  interface Props {
    propType?: PropType;
  }

  let { propType = PropType.STAFF }: Props = $props();

  let sequence = $state<SequenceData | null>(null);
  let startPos = $state<StartPositionData | null>(null);
  let firstStep = $state<StepData | null>(null);

  // Card 1: empty grid - no hand dots, no props, no arrows
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

  const LANDING_SEQUENCE_ID = "3b7882d6-a87d-4b57-bbfe-8eacb9e39f04";

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
      } as PictographData;
    }
  }

  onMount(async () => {
    try {
      // Read directly from publicSequences (readable by anyone, no auth required)
      // instead of users/{owner}/sequences/{id} which requires authentication.
      const firestore = await getFirestoreInstance();
      const docRef = doc(firestore, getPublicSequencesPath(), LANDING_SEQUENCE_ID);
      const snap = await getDoc(docRef);

      if (!snap.exists()) {
        console.warn("[HowTkaWorks] Landing sequence not found in publicSequences");
        loaded = true;
        return;
      }

      const data = snap.data() as PublicSequenceIndex;

      // Hydrate compositional fields into full steps
      const seq: SequenceData = {
        id: snap.id,
        name: data.name,
        word: data.word,
        steps: [],
        thumbnails: [...data.thumbnails],
        sequenceLength: data.sequenceLength,
        level: data.level,
        isFavorite: false,
        isCircular: !!data.loopType,
        loopType: (data.loopType as LOOPType) ?? null,
        tags: [...data.tags],
        metadata: {},
        ownerId: data.ownerId,
        blueSoloProp: data.blueSoloProp,
        redSoloProp: data.redSoloProp,
        stepPairings: data.stepPairings,
        bluePathHash: data.bluePathHash,
        redPathHash: data.redPathHash,
        blueSoloHash: data.blueSoloHash,
        redSoloHash: data.redSoloHash,
      };

      if (data.blueSoloProp && data.redSoloProp && data.stepPairings) {
        const hydrated = hydrate(seq);
        if (hydrated.steps && hydrated.steps.length > 0) {
          setupFromSequence({ ...hydrated, sequenceLength: hydrated.steps.length });
          return;
        }
      }

      console.warn("[HowTkaWorks] Landing sequence has no compositional data to hydrate");
    } catch (e) {
      console.error("[HowTkaWorks] Failed to load AABB:", e);
    } finally {
      loaded = true;
    }
  });

  // Step metadata - defined inline per card to avoid array-index TS strictness issues
</script>

<section class="how-tka-works">
  {#if loaded && sequence}
    <!-- All six cards in one row: grid → hands → props → motion → sequence → animation -->
    <div class="cards-row">
      <!-- Card 1: Empty grid -->
      <div class="step-card">
        <span class="step-badge">1</span>
        <div class="pictograph-frame">
          {#if emptyGridData}
            <PictographContainer
              pictographData={emptyGridData}
              gridMode={GridMode.DIAMOND}
              showGrid={true}
              showTKA={false}
              showReversals={false}
              showPositions={false}
              showHandPoints={false}
              showBlueMotion={false}
              showRedMotion={false}
              darkMode={true}
              disableTransitions={true}
            />
          {/if}
        </div>
        <h3>The grid</h3>
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
              showGrid={true}
              showTKA={true}
              showReversals={false}
              showPositions={false}
              showHandPoints={true}
              darkMode={true}
              disableTransitions={true}
            />
          {/if}
        </div>
        <h3>Add hands</h3>
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
              showGrid={true}
              showTKA={true}
              showReversals={false}
              showPositions={false}
              showHandPoints={true}
              darkMode={true}
              disableTransitions={true}
            />
          {/if}
        </div>
        <h3>Add props</h3>
      </div>

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
              showGrid={true}
              showTKA={true}
              showReversals={false}
              showPositions={true}
              showHandPoints={true}
              showBlueMotion={true}
              showRedMotion={true}
              darkMode={true}
              disableTransitions={true}
            />
          {/if}
        </div>
        <h3>Add motion</h3>
      </div>

      <!-- Card 5: Full sequence -->
      <div class="step-card">
        <span class="step-badge">5</span>
        <div class="sequence-frame">
          <ChoreoCard
            {sequence}
            darkMode={true}
            columnCount={2}
            bluePropType={propType}
            redPropType={propType}
            startPositionLayoutOverride="column"
            showMandala={true}
            showCreatorName={false}
            showNotes={false}
            showBirthday={false}
          />
        </div>
        <h3>String them together</h3>
      </div>

      <!-- Card 6: Live animation -->
      <div class="step-card">
        <span class="step-badge">6</span>
        <div class="animation-frame">
          <HowTkaAnimationCard {sequence} {propType} />
        </div>
        <h3>Watch it move</h3>
      </div>
    </div>

    <!--
      HIDDEN: Cards 7 & 8 - waiting on content.

      AI agent: remind Austen that he needs to get the footage for AABB
      (a video of someone performing the AABB sequence, and one of teaching it).

      Card 7: "Perform it" (fa-fire icon)
      Card 8: "Teach it to a friend" (fa-people-arrows icon)

      Uncomment the block below when footage is ready.
    -->
    <!-- <div class="third-row">
      <div class="step-card icon-card">
        <span class="step-badge">7</span>
        <div class="icon-frame">
          <i class="fas fa-fire" aria-hidden="true"></i>
        </div>
        <h3>Perform it</h3>
      </div>

      <div class="step-card icon-card">
        <span class="step-badge">8</span>
        <div class="icon-frame">
          <i class="fas fa-people-arrows" aria-hidden="true"></i>
        </div>
        <h3>Teach it to a friend</h3>
      </div>
    </div> -->
  {:else}
    <!-- Skeleton: same single-row layout, pulsing placeholders -->
    <div class="cards-row">
      {#each [1, 2, 3, 4, 5, 6] as n}
        <div class="step-card skeleton">
          <span class="step-badge">{n}</span>
          <div class="skeleton-pictograph"></div>
          <div class="skeleton-title"></div>
        </div>
      {/each}
    </div>
    <!-- skeleton for cards 7-8 (hidden until footage is ready) -->
    <!-- <div class="third-row">
      {#each [7, 8] as n}
        <div class="step-card skeleton icon-card">
          <span class="step-badge">{n}</span>
          <div class="skeleton-pictograph"></div>
          <div class="skeleton-title"></div>
        </div>
      {/each}
    </div> -->
  {/if}
</section>

<style>
  .how-tka-works {
    padding: 80px 24px;
    max-width: 1400px;
    margin: 0 auto;
  }

  /* One row of six equal cards - the progression reads left to right */
  .cards-row {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 16px;
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

  /* Card text — pinned to the bottom so all six labels align on one baseline
     regardless of each card's media height (the ChoreoCard in card 5 is taller
     than the square pictograph frames). margin-top:auto absorbs the slack. */
  h3 {
    font-family: var(--landing-heading-font, "Instrument Serif", Georgia, serif);
    font-size: clamp(0.95rem, 1.8vw, 1.15rem);
    font-weight: 400;
    color: var(--theme-text, #fff);
    margin: 0;
    margin-top: auto;
    text-align: center;
  }

  /* 4K / ultrawide: scale the six-card row up so it holds its own next to the
     scaled hero. Same single-row progression, roomier cards, bigger media. */
  @media (min-width: 2200px) {
    .how-tka-works {
      max-width: 1960px;
      padding: 112px 24px;
    }

    .cards-row {
      gap: 24px;
    }

    .step-card {
      padding: 32px 20px 26px;
      border-radius: 20px;
      gap: 16px;
    }

    .pictograph-frame,
    .animation-frame,
    .skeleton .skeleton-pictograph {
      max-width: 280px;
    }

    .sequence-frame {
      height: clamp(200px, 12vw, 300px);
    }

    h3 {
      font-size: 1.35rem;
    }
  }

  /* Tablet: 3 across, 2 rows. The progression wraps onto a second row instead
     of scrolling sideways — every step stays on screen. */
  @media (max-width: 1100px) {
    .cards-row {
      grid-template-columns: repeat(3, 1fr);
      gap: 14px;
    }
  }

  /* Phone: 2 across, 3 rows. All six steps fit the viewport — no left/right
     scroll. Reads top-to-bottom: grid → hands → props → motion → sequence →
     animation. */
  @media (max-width: 640px) {
    .how-tka-works {
      padding: 48px 16px;
    }

    .cards-row {
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
    }

    .step-card {
      padding: 20px 12px 16px;
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

  @media (prefers-reduced-motion: reduce) {
    .step-card {
      transition: none;
    }

    .skeleton {
      animation: none;
    }
  }
</style>
