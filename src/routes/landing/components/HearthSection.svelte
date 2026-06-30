<script lang="ts">
  /**
   * HearthSection
   *
   * The landing page hero. One composed viewport:
   * - Title centered at top
   * - Large pictograph as the commanding centerpiece
   * - Next section peeks in at the bottom edge
   *
   * Designed as a composition, not assembled from parts.
   */
  import { onMount } from "svelte";
  import { getBrowseLoader } from "$lib/shared/browse/get-browse-loader";
  import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
  import type { Letter } from "$lib/shared/foundation/domain/models/letter";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";

  let heroStep = $state<StepData | null>(null);
  let heroPictographData = $state<PictographData | null>(null);
  let loaded = $state(false);

  import { RANDOM_PROPS } from "../landing-content";

  interface Props {
    onSequenceLoaded?: (seq: SequenceData) => void;
    propType?: PropType;
    onPropTypeChange?: (propType: PropType) => void;
  }

  let { onSequenceLoaded, propType = PropType.STAFF, onPropTypeChange }: Props = $props();

  function cycleProp() {
    let next = propType;
    while (next === propType && RANDOM_PROPS.length > 1) {
      next = RANDOM_PROPS[Math.floor(Math.random() * RANDOM_PROPS.length)]!;
    }
    onPropTypeChange?.(next);
  }

  onMount(async () => {
    try {
      const browseLoader = getBrowseLoader();
      // Load the specific curated AABB sequence (alpha1→3→5→3→1, pro+anti)
      const full = await browseLoader.loadFullSequenceData(
        "AABB",
        "seq_1773477720946_so6kw28yf"
      );

      if (full && full.steps.length > 0) {
        heroStep = full.steps[0] ?? null;

        // Build pictograph data with staves forced - the canonical TKA prop
        if (heroStep) {
          const forceStaff = (motion: any) =>
            motion ? { ...motion, propType: PropType.STAFF } : undefined;

          heroPictographData = {
            id: heroStep.id ?? "hero-a",
            letter: (heroStep.letter || undefined) as Letter | undefined,
            startPosition: heroStep.startPosition,
            endPosition: heroStep.endPosition,
            motions: {
              blue: forceStaff(heroStep.motions?.blue),
              red: forceStaff(heroStep.motions?.red),
            },
          };
        }

        onSequenceLoaded?.(full);
      }
    } catch (e) {
      console.error("[HearthSection] Failed to load AABB:", e);
    } finally {
      loaded = true;
    }
  });
</script>

<section class="hearth">
  <!-- Title block -->
  <div class="title-block fade-up" style="--delay: 0.15s">
    <h1>The Kinetic Alphabet</h1>
    <p class="subtitle">
      A notation system for flow arts.
    </p>
  </div>

  <!-- The pictograph: the centerpiece. Frame is always visible for stable layout. -->
  <div class="pictograph-stage fade-up" style="--delay: 0.4s">
    <div class="pictograph-frame">
      {#if heroPictographData}
        <div class="pictograph-inner" class:visible={heroPictographData}>
          <PictographContainer
            pictographData={heroPictographData}
            gridMode={GridMode.DIAMOND}
            bluePropTypeOverride={propType}
            redPropTypeOverride={propType}
          />
        </div>
      {/if}
    </div>
    <span class="pictograph-caption">
      The letter A. One step of movement, written down.
    </span>
    <button class="change-prop-btn" onclick={cycleProp}>
      <i class="fas fa-sync-alt" aria-hidden="true"></i>
      Change prop
    </button>
  </div>

  <!-- Scroll hint at the very bottom, pulling you down -->
  <div class="scroll-cue fade-up" style="--delay: 1.2s">
    <span class="cue-line"></span>
    <span class="cue-text">Scroll</span>
  </div>
</section>

<style>
  .hearth {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 80px 24px 0;
    gap: 0;
    position: relative;
  }

  /* --- Entrance animation --- */
  .fade-up {
    opacity: 0;
    transform: translateY(18px);
    animation: fade-up 0.7s ease forwards;
    animation-delay: var(--delay, 0s);
  }

  @keyframes fade-up {
    to { opacity: 1; transform: translateY(0); }
  }

  /* --- Title --- */
  .title-block {
    text-align: center;
    margin-bottom: clamp(28px, 4vh, 48px);
  }

  h1 {
    font-family: var(--landing-heading-font, "Instrument Serif", Georgia, serif);
    font-size: clamp(2.6rem, 7vw, 5rem);
    font-weight: 400;
    line-height: 1.05;
    color: var(--theme-text, #fff);
    letter-spacing: -0.02em;
    margin: 0 0 12px;
  }

  .subtitle {
    font-size: clamp(0.9rem, 1.8vw, 1.1rem);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    margin: 0;
    letter-spacing: 0.01em;
  }

  /* --- Pictograph centerpiece --- */
  .pictograph-stage {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
  }

  .pictograph-inner {
    width: 100%;
    height: 100%;
    opacity: 0;
    transition: opacity 0.6s ease;
  }

  .pictograph-inner.visible {
    opacity: 1;
  }

  .pictograph-frame {
    width: clamp(280px, 35vw, 400px);
    aspect-ratio: 1;
    background: rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 24px;
    padding: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow:
      0 32px 100px rgba(0, 0, 0, 0.5),
      0 0 0 1px rgba(255, 255, 255, 0.03),
      0 0 60px rgba(99, 102, 241, 0.06);
    animation: breathe 5s ease-in-out infinite;
  }

  @keyframes breathe {
    0%, 100% {
      box-shadow:
        0 32px 100px rgba(0, 0, 0, 0.5),
        0 0 0 1px rgba(255, 255, 255, 0.03),
        0 0 60px rgba(99, 102, 241, 0.04);
    }
    50% {
      box-shadow:
        0 32px 100px rgba(0, 0, 0, 0.5),
        0 0 0 1px rgba(255, 255, 255, 0.06),
        0 0 80px rgba(99, 102, 241, 0.1);
    }
  }

  .pictograph-caption {
    font-size: var(--font-size-sm, 0.875rem);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    text-align: center;
    letter-spacing: 0.01em;
  }

  /* --- Change prop button --- */
  .change-prop-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 20px;
    background: rgba(255, 255, 255, 0.04);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-compact, 12px);
    cursor: pointer;
    transition: border-color 0.2s ease, color 0.2s ease;
    margin-top: 4px;
  }

  .change-prop-btn:hover {
    border-color: var(--theme-accent, #6366f1);
    color: var(--theme-text, #fff);
  }

  .change-prop-btn i {
    font-size: 10px;
  }

  /* --- Scroll cue at bottom --- */
  .scroll-cue {
    position: absolute;
    bottom: 32px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .cue-line {
    width: 1px;
    height: 32px;
    background: linear-gradient(
      to bottom,
      transparent,
      rgba(255, 255, 255, 0.25)
    );
    animation: pulse-line 2.5s ease-in-out infinite;
  }

  @keyframes pulse-line {
    0%, 100% { opacity: 0.3; height: 32px; }
    50% { opacity: 0.7; height: 40px; }
  }

  .cue-text {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.2em;
    color: rgba(255, 255, 255, 0.25);
  }

  /* --- Responsive --- */
  @media (max-width: 768px) {
    .hearth {
      padding: 60px 20px 0;
    }

    .pictograph-frame {
      width: min(300px, 70vw);
      border-radius: 20px;
      padding: 16px;
    }
  }

  @media (max-width: 480px) {
    .hearth {
      padding: 48px 16px 0;
      min-height: 100svh;
    }

    .pictograph-frame {
      width: min(260px, 75vw);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .fade-up {
      opacity: 1;
      transform: none;
      animation: none;
    }

    .pictograph-stage {
      opacity: 1;
      transform: none;
      transition: none;
    }

    .pictograph-frame {
      animation: none;
    }

    .cue-line {
      animation: none;
      opacity: 0.4;
    }
  }
</style>
