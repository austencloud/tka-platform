<script lang="ts">
  /**
   * HearthSection
   *
   * The landing page hero. Title on the left, hero pictograph on the right.
   * One composed scene — not separate stacked sections.
   * The pictograph is the visual anchor, the title provides context.
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

  // Expose loaded sequence for the card section below
  let sequence = $state<SequenceData | null>(null);

  interface Props {
    onSequenceLoaded?: (seq: SequenceData) => void;
  }

  let { onSequenceLoaded }: Props = $props();

  onMount(async () => {
    try {
      const browseLoader = container.items.browseLoader;
      const full = await browseLoader.loadFullSequenceData("AABB");

      if (full && full.steps.length > 0) {
        sequence = full;
        // First step is letter A (alpha1 → alpha3)
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
  <div class="hearth-layout">
    <!-- Left: Title and subtitle -->
    <div class="text-column animate-in" style="--delay: 0.1s">
      <h1>The Kinetic<br />Alphabet</h1>
      <p class="subtitle">
        A notation system for flow arts. Positions become symbols, transitions
        become letters, sequences become words.
      </p>
      <p class="hint">
        <span class="chevron">↓</span>
        Scroll to explore
      </p>
    </div>

    <!-- Right: Hero pictograph -->
    <div class="pictograph-column">
      <div class="pictograph-showcase" class:visible={heroStep}>
        {#if heroStep}
          <div class="pictograph-frame">
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
          <div class="pictograph-label">
            <span class="label-letter">A</span>
            <span class="label-desc">One beat of movement, written down</span>
          </div>
        {:else if loaded}
          <!-- Placeholder if AABB not found -->
          <div class="pictograph-frame placeholder">
            <div class="placeholder-glyph">A</div>
          </div>
        {/if}
      </div>
    </div>
  </div>
</section>

<style>
  .hearth {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 clamp(24px, 5vw, 80px);
  }

  .hearth-layout {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: clamp(40px, 6vw, 100px);
    max-width: 1100px;
    width: 100%;
  }

  /* --- Left column: text --- */
  .text-column {
    flex: 1;
    max-width: 480px;
  }

  h1 {
    font-family: "Instrument Serif", Georgia, serif;
    font-size: clamp(2.8rem, 6vw, 4.5rem);
    font-weight: 400;
    line-height: 1.05;
    margin-bottom: 24px;
    color: var(--theme-text, #fff);
    letter-spacing: -0.02em;
  }

  .subtitle {
    font-size: clamp(0.9rem, 1.5vw, 1.05rem);
    line-height: 1.8;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.55));
    margin: 0 0 40px;
    max-width: 380px;
  }

  .hint {
    font-size: var(--font-size-compact, 12px);
    text-transform: uppercase;
    letter-spacing: 0.15em;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.3));
    margin: 0;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .chevron {
    animation: float-down 2s ease-in-out infinite;
    display: inline-block;
  }

  @keyframes float-down {
    0%, 100% { transform: translateY(0); opacity: 0.4; }
    50% { transform: translateY(4px); opacity: 0.8; }
  }

  /* Entrance animation */
  .animate-in {
    opacity: 0;
    transform: translateY(20px);
    animation: reveal 0.8s ease forwards;
    animation-delay: var(--delay, 0s);
  }

  @keyframes reveal {
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* --- Right column: pictograph --- */
  .pictograph-column {
    flex: 0 0 auto;
  }

  .pictograph-showcase {
    opacity: 0;
    transform: translateY(12px);
    transition: opacity 0.8s ease, transform 0.8s ease;
  }

  .pictograph-showcase.visible {
    opacity: 1;
    transform: translateY(0);
  }

  .pictograph-frame {
    width: clamp(220px, 25vw, 340px);
    aspect-ratio: 1;
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    border-radius: 20px;
    padding: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 24px 80px rgba(0, 0, 0, 0.4),
                0 0 0 1px rgba(255, 255, 255, 0.04);
    animation: subtle-glow 4s ease-in-out infinite;
  }

  @keyframes subtle-glow {
    0%, 100% {
      box-shadow: 0 24px 80px rgba(0, 0, 0, 0.4),
                  0 0 0 1px rgba(255, 255, 255, 0.04);
    }
    50% {
      box-shadow: 0 24px 80px rgba(0, 0, 0, 0.4),
                  0 0 0 1px rgba(255, 255, 255, 0.04),
                  0 0 40px rgba(99, 102, 241, 0.08);
    }
  }

  .pictograph-label {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    margin-top: 20px;
    text-align: center;
  }

  .label-letter {
    font-family: "Instrument Serif", Georgia, serif;
    font-size: 1.5rem;
    color: var(--theme-text, #fff);
  }

  .label-desc {
    font-size: var(--font-size-compact, 12px);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
  }

  /* Placeholder fallback */
  .placeholder {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.3));
  }

  .placeholder-glyph {
    font-family: "Instrument Serif", Georgia, serif;
    font-size: 5rem;
    opacity: 0.2;
  }

  /* --- Tablet: tighten up --- */
  @media (max-width: 900px) {
    .hearth {
      padding: 100px 24px 60px;
      min-height: auto;
    }

    .hearth-layout {
      flex-direction: column;
      gap: 48px;
      text-align: center;
    }

    .text-column {
      max-width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .subtitle {
      max-width: 420px;
    }

    .pictograph-frame {
      width: min(280px, 60vw);
    }

    .hint {
      display: none;
    }
  }

  /* --- Mobile --- */
  @media (max-width: 480px) {
    .hearth {
      padding: 80px 20px 40px;
    }

    .pictograph-frame {
      width: min(240px, 70vw);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .pictograph-showcase {
      opacity: 1;
      transform: none;
      transition: none;
    }

    .animate-in {
      opacity: 1;
      transform: none;
      animation: none;
    }

    .pictograph-frame {
      animation: none;
    }

    .chevron {
      animation: none;
    }
  }
</style>
