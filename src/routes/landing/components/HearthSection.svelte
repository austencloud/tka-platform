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
  import { container } from "$lib/shared/di";
  import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { StepData } from "$lib/features/create/shared/domain/models/StepData";
  import type { Letter } from "$lib/shared/foundation/domain/models/Letter";

  let heroStep = $state<StepData | null>(null);
  let loaded = $state(false);

  interface Props {
    onSequenceLoaded?: (seq: SequenceData) => void;
  }

  let { onSequenceLoaded }: Props = $props();

  onMount(async () => {
    try {
      const browseLoader = container.items.browseLoader;
      const full = await browseLoader.loadFullSequenceData("AABB");

      if (full && full.steps.length > 0) {
        heroStep = full.steps[0] ?? null;
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
      {#if heroStep}
        <div class="pictograph-inner" class:visible={heroStep}>
          <PictographContainer
            pictographData={{
              id: heroStep.id ?? "hero-a",
              letter: (heroStep.letter || undefined) as Letter | undefined,
              startPosition: heroStep.startPosition,
              endPosition: heroStep.endPosition,
              motions: heroStep.motions ?? {},
            }}
            gridMode={GridMode.DIAMOND}
          />
        </div>
      {/if}
    </div>
    <span class="pictograph-caption">
      The letter A. One beat of movement, written down.
    </span>
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
    font-family: "Instrument Serif", Georgia, serif;
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
