<!--
Type1ConceptExperience - Multi-page lesson introducing Type 1 (Dual-Shift) letters
Orchestrator component that manages navigation between 5 lesson pages:
- Page 1: Introduction to Type 1 Letters & Dual-Shift concept
- Page 2: Prospin Letters (A, D, G, J, M, P, S)
- Page 3: Antispin Letters (B, E, H, K, N, Q, T)
- Page 4: Hybrid Letters (C, F, I, L, O, R, U, V)
- Page 5: Quiz

Supports two view modes:
- "step": Traditional step-by-step navigation (one page at a time)
- "scroll": All pages displayed vertically for scrolling (review mode)
-->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import { createType1ConceptState } from "./state/type1-concept-state.svelte";
  import Type1IntroPage from "./pages/Type1IntroPage.svelte";
  import Type1ProspinPage from "./pages/Type1ProspinPage.svelte";
  import Type1AntispinPage from "./pages/Type1AntispinPage.svelte";
  import Type1HybridPage from "./pages/Type1HybridPage.svelte";
  import Type1QuizPage from "./pages/Type1QuizPage.svelte";
  import ExperienceProgressIndicator from "../../ExperienceProgressIndicator.svelte";
  import PageDivider from "../../PageDivider.svelte";
  import type { ExperienceViewMode } from "../../../../domain/types";
  import {
    PROSPIN_LETTERS,
    ANTISPIN_LETTERS,
    HYBRID_LETTERS,
    TYPE1_ALPHABET,
  } from "./domain/type1-letter-data";

  let { onComplete, viewMode = "step" }: { onComplete?: () => void; viewMode?: ExperienceViewMode } = $props();

  const hapticService = getHapticFeedback();

  // Only create interactive state in step mode
  const state = $derived.by(() => viewMode === "step"
    ? createType1ConceptState({
        hapticService,
        getOnComplete: () => onComplete,
      })
    : null);
</script>

{#if viewMode === "scroll"}
  <!-- SCROLL MODE: All pages displayed vertically for review -->
  <div class="type1-experience scroll-mode">
    <!-- Section 1: Introduction -->
    <div class="scroll-section">
      <h2 class="section-title gradient-text">Type 1: Dual-Shift Letters</h2>
      <div class="intro-box">
        <div class="intro-icon">
          <i class="fa-solid fa-arrows-rotate" aria-hidden="true"></i>
        </div>
        <p class="intro-text">
          Type 1 letters are called <strong>"Dual-Shift"</strong> because
          <strong>both hands move</strong> from one grid position to an adjacent position.
        </p>
      </div>
      <div class="alphabet-preview">
        <h3>The Type 1 Alphabet (A-V)</h3>
        <div class="letter-row">
          {#each TYPE1_ALPHABET.split("") as letter}
            <span class="preview-letter">{letter}</span>
          {/each}
        </div>
        <p class="note">22 letters total - the foundation of TKA!</p>
      </div>
    </div>

    <PageDivider pageNumber={2} label="Prospin Letters" />

    <!-- Section 2: Prospin Letters -->
    <div class="scroll-section">
      <h2 class="section-title pro-theme">Pro-Pro Pattern</h2>
      <p class="section-desc">Both hands spin the same direction as motion</p>
      <div class="letter-grid">
        {#each PROSPIN_LETTERS as letterData}
          <div class="letter-card pro">
            <span class="letter-char">{letterData.letter}</span>
            <span class="letter-desc">{letterData.description}</span>
          </div>
        {/each}
      </div>
    </div>

    <PageDivider pageNumber={3} label="Antispin Letters" />

    <!-- Section 3: Antispin Letters -->
    <div class="scroll-section">
      <h2 class="section-title anti-theme">Anti-Anti Pattern</h2>
      <p class="section-desc">Both hands spin opposite to motion</p>
      <div class="letter-grid">
        {#each ANTISPIN_LETTERS as letterData}
          <div class="letter-card anti">
            <span class="letter-char">{letterData.letter}</span>
            <span class="letter-desc">{letterData.description}</span>
          </div>
        {/each}
      </div>
    </div>

    <PageDivider pageNumber={4} label="Hybrid Letters" />

    <!-- Section 4: Hybrid Letters -->
    <div class="scroll-section">
      <h2 class="section-title hybrid-theme">Hybrid Pattern</h2>
      <p class="section-desc">Hands spin in different directions</p>
      <div class="letter-grid">
        {#each HYBRID_LETTERS as letterData}
          <div class="letter-card hybrid">
            <span class="letter-char">{letterData.letter}</span>
            <span class="letter-desc">{letterData.description}</span>
          </div>
        {/each}
      </div>
    </div>

    <PageDivider pageNumber={5} label="Quiz" />

    <!-- Section 5: Quiz summary -->
    <div class="scroll-section quiz-summary">
      <h2 class="section-title">Quiz Review</h2>
      <p class="section-desc">
        The quiz tests your ability to identify Type 1 letters by their motion patterns.
      </p>
      <div class="quiz-hint">
        <i class="fa-solid fa-lightbulb" aria-hidden="true"></i>
        <span>Switch to step mode to retake the quiz</span>
      </div>
    </div>
  </div>
{:else if state}
  <!-- STEP MODE: Original step-by-step navigation -->
  <div class="type1-experience">
    {#if state.currentPage === 1}
      <Type1IntroPage onNext={state.nextPage} />
    {:else if state.currentPage === 2}
      <Type1ProspinPage
        currentLetter={state.currentProspin}
        letterIndex={state.prospinIndex}
        onCycle={state.cycleProspin}
        onSelectLetter={state.selectProspinLetter}
        onNext={state.nextPage}
        onPrevious={state.previousPage}
      />
    {:else if state.currentPage === 3}
      <Type1AntispinPage
        currentLetter={state.currentAntispin}
        letterIndex={state.antispinIndex}
        onCycle={state.cycleAntispin}
        onSelectLetter={state.selectAntispinLetter}
        onNext={state.nextPage}
        onPrevious={state.previousPage}
      />
    {:else if state.currentPage === 4}
      <Type1HybridPage
        currentLetter={state.currentHybrid}
        letterIndex={state.hybridIndex}
        onCycle={state.cycleHybrid}
        onSelectLetter={state.selectHybridLetter}
        onNext={state.nextPage}
        onPrevious={state.previousPage}
      />
    {:else if state.currentPage === 5}
      <Type1QuizPage
        onComplete={state.complete}
        onPrevious={state.previousPage}
      />
    {/if}

    <ExperienceProgressIndicator currentStep={state.currentPage} totalSteps={state.totalPages} />
  </div>
{/if}

<style>
  .type1-experience {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 2rem;
    overflow-y: auto;
    overflow-x: hidden;
  }

  @media (max-width: 600px) {
    .type1-experience {
      padding: 1rem;
    }
  }

  /* ============================================
     Scroll Mode Styles
     ============================================ */
  .scroll-mode {
    padding-top: 4rem; /* Space for header bar */
    gap: 1rem;
  }

  .scroll-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
    padding: 2rem;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 16px;
    max-width: 800px;
    margin: 0 auto;
    width: 100%;
  }

  .section-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--theme-text);
    margin: 0;
    text-align: center;
  }

  .gradient-text {
    background: linear-gradient(135deg, var(--theme-accent, #22d3ee) 0%, var(--theme-accent, #06b6d4) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .pro-theme {
    color: var(--theme-accent, #22d3ee);
  }

  .anti-theme {
    --anti-color: #a855f7;
    color: var(--anti-color);
  }

  .hybrid-theme {
    --anti-color: #a855f7;
    background: linear-gradient(135deg, var(--theme-accent, #22d3ee), var(--anti-color));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .section-desc {
    font-size: 1rem;
    color: var(--theme-text-dim);
    margin: 0;
    text-align: center;
  }

  .intro-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding: 1.5rem;
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--theme-accent, #22d3ee) 10%, transparent) 0%,
      color-mix(in srgb, var(--theme-accent, #22d3ee) 2%, transparent) 100%
    );
    border: 1px solid color-mix(in srgb, var(--theme-accent, #22d3ee) 20%, transparent);
    border-radius: 16px;
    width: 100%;
  }

  .intro-icon {
    width: 64px;
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: color-mix(in srgb, var(--theme-accent, #22d3ee) 20%, transparent);
    border-radius: 50%;
    color: var(--theme-accent, #22d3ee);
    font-size: 1.75rem;
  }

  .intro-text {
    font-size: 1.125rem;
    color: var(--theme-text, rgba(255, 255, 255, 0.85));
    text-align: center;
    margin: 0;
  }

  .alphabet-preview {
    padding: 1.25rem;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    border-radius: 12px;
    text-align: center;
    width: 100%;
  }

  .alphabet-preview h3 {
    font-size: 1.125rem;
    font-weight: 600;
    color: white;
    margin: 0 0 1rem 0;
  }

  .letter-row {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.5rem;
  }

  .preview-letter {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke-strong);
    border-radius: 6px;
    font-weight: 700;
    font-size: 1rem;
    color: white;
  }

  .note {
    font-size: 0.875rem;
    color: var(--theme-text-dim);
    margin-top: 0.75rem;
  }

  .letter-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 0.75rem;
    width: 100%;
  }

  .letter-card {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 1rem;
    border-radius: 12px;
  }

  .letter-card.pro {
    background: color-mix(in srgb, var(--theme-accent, #22d3ee) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--theme-accent, #22d3ee) 25%, transparent);
  }

  .letter-card.anti {
    --anti-color: #a855f7;
    background: color-mix(in srgb, var(--anti-color) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--anti-color) 25%, transparent);
  }

  .letter-card.hybrid {
    --anti-color: #a855f7;
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--theme-accent, #22d3ee) 10%, transparent),
      color-mix(in srgb, var(--anti-color) 10%, transparent)
    );
    border: 1px solid color-mix(in srgb, var(--anti-color) 25%, transparent);
  }

  .letter-char {
    font-size: 1.5rem;
    font-weight: 800;
    color: white;
  }

  .letter-desc {
    font-size: 0.75rem;
    color: var(--theme-text-dim);
  }

  .quiz-summary {
    text-align: center;
  }

  .quiz-hint {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 1rem 1.5rem;
    background: color-mix(in srgb, var(--theme-accent) 15%, transparent);
    border: 1px solid color-mix(in srgb, var(--theme-accent) 30%, transparent);
    border-radius: 12px;
    color: var(--theme-text);
    font-size: 0.9375rem;
  }

  .quiz-hint i {
    color: var(--theme-accent, #22d3ee);
  }

  @media (max-width: 600px) {
    .scroll-mode {
      padding-top: 3.5rem;
    }

    .scroll-section {
      padding: 1.5rem;
    }

    .letter-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
