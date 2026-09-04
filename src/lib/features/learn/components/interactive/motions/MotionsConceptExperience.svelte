<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import PanelButton from "$lib/shared/components/panel/PanelButton.svelte";
  import type { ExperienceViewMode } from "../../../domain/types";
  import { getExperiencePersistence } from "../../../state/experience-persistence.svelte";
  import ExperienceProgressIndicator from "../ExperienceProgressIndicator.svelte";
  import HandMotionPlayer from "../foundations/HandMotionPlayer.svelte";
  import { HAND_PATH_STEPS } from "../foundations/pictograph-foundation-content";

  let {
    onComplete,
    onBack,
    viewMode = "step",
  } = $props<{
    onComplete?: () => void;
    onBack?: () => void;
    viewMode?: ExperienceViewMode;
  }>();

  const haptic = getHapticFeedback();
  const persistence = getExperiencePersistence("hand-motions-intro");
  const summaryIndex = HAND_PATH_STEPS.length;
  const saved = persistence.load();
  let stepIndex = $state(
    Math.min(summaryIndex, Math.max(0, (saved.step || 1) - 1))
  );
  const activeMotion = $derived(HAND_PATH_STEPS[stepIndex] ?? null);

  function goToStep(next: number): void {
    const clamped = Math.min(summaryIndex, Math.max(0, next));
    if (clamped === stepIndex) return;
    stepIndex = clamped;
    persistence.saveStep(stepIndex + 1);
    haptic?.trigger("selection");
  }

  function complete(): void {
    persistence.reset();
    haptic?.trigger("success");
    onComplete?.();
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (viewMode !== "step") return;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      goToStep(stepIndex + 1);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      handleBack();
    }
  }

  export function handleBack(): void {
    if (stepIndex > 0) {
      goToStep(stepIndex - 1);
      return;
    }
    onBack?.();
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
<div
  class="experience"
  onkeydown={handleKeydown}
  tabindex="0"
  role="application"
  aria-label="Hand motions lesson, use arrow keys to navigate"
>
  <main class="lesson-shell">
    {#if activeMotion}
      <section class="motion-step" aria-labelledby="motion-title">
        <div class="instruction-rail">
          <p class="eyebrow">Hand motion {stepIndex + 1} of 3</p>
          <h1 id="motion-title">{activeMotion.name}</h1>
          <p class="guide-caption">{activeMotion.guideCaption}</p>
          <div class="motion-key" aria-label="Blue hand">
            <span class="hand-dot" aria-hidden="true"></span>
            <span>Blue hand</span>
          </div>
        </div>

        <div class="artifact-stage">
          <HandMotionPlayer
            sequence={activeMotion.sequence}
            ariaLabel={`${activeMotion.name}: ${activeMotion.guideCaption}`}
          />
        </div>
      </section>
    {:else}
      <section class="summary" aria-labelledby="motion-summary-title">
        <p class="eyebrow">Hand motions</p>
        <h1 id="motion-summary-title">Three paths</h1>
        <p class="guide-copy">
          There are three fundamental hand motions in the Alphabet.<br />
          The arrow shows the direction of motion.<br />
          The hand shows the end position.
        </p>
        <div class="motion-recap">
          {#each HAND_PATH_STEPS as motion, index (motion.id)}
            <button type="button" onclick={() => goToStep(index)}>
              <strong>{motion.name}</strong>
              <span>{motion.guideCaption}</span>
            </button>
          {/each}
        </div>
      </section>
    {/if}

    <footer class="lesson-actions">
      <PanelButton
        variant="secondary"
        onclick={handleBack}
        disabled={stepIndex === 0}
      >
        <i class="fa-solid fa-arrow-left" aria-hidden="true"></i>
        <span>Previous</span>
      </PanelButton>
      <ExperienceProgressIndicator
        currentStep={stepIndex + 1}
        totalSteps={summaryIndex + 1}
      />
      {#if stepIndex === summaryIndex}
        <PanelButton variant="primary" onclick={complete}>
          <span>Finish lesson</span>
          <i class="fa-solid fa-check" aria-hidden="true"></i>
        </PanelButton>
      {:else}
        <PanelButton variant="primary" onclick={() => goToStep(stepIndex + 1)}>
          <span>Next</span>
          <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
        </PanelButton>
      {/if}
    </footer>
  </main>
</div>

<style>
  .experience {
    container: hand-motions / inline-size;
    width: 100%;
    height: 100%;
    overflow-y: auto;
    color: var(--theme-text);
    outline: none;
    scrollbar-gutter: stable;
  }
  .lesson-shell {
    display: grid;
    grid-template-rows: minmax(0, 1fr) auto;
    gap: 1rem;
    width: min(100%, 100rem);
    min-height: 100%;
    margin-inline: auto;
    padding: clamp(4.5rem, 5cqw, 5.5rem) clamp(0.75rem, 2.5cqw, 2.5rem)
      clamp(0.75rem, 1.5cqw, 1.5rem);
  }
  .motion-step {
    display: grid;
    grid-template-columns: minmax(15rem, 22rem) minmax(0, 1fr);
    align-items: center;
    gap: clamp(1rem, 2.2cqw, 2.5rem);
    min-height: 0;
  }
  .instruction-rail {
    display: grid;
    align-content: center;
    gap: 1rem;
    padding: clamp(1rem, 1.6cqw, 1.6rem);
    border: 1px solid var(--theme-stroke);
    border-radius: var(--radius-lg, 0.75rem);
    background: var(--theme-panel-bg);
  }
  .eyebrow {
    margin: 0;
    color: var(--theme-accent);
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
  h1 {
    margin: 0 !important;
    font-size: clamp(1.8rem, 3cqw, 3.2rem);
    line-height: 1.05;
  }
  .guide-caption,
  .guide-copy {
    margin: 0;
    color: var(--theme-text-dim);
    font-size: var(--font-size-base, 1rem);
    line-height: 1.55;
  }
  .motion-key {
    display: inline-flex;
    align-items: center;
    gap: 0.55rem;
    color: var(--theme-text-dim);
    font-size: var(--font-size-sm, 0.875rem);
    font-weight: 700;
  }
  .hand-dot {
    width: 0.85rem;
    height: 0.85rem;
    border-radius: 50%;
    background: var(--prop-blue, #3d44b8);
  }
  .artifact-stage {
    min-width: 0;
    height: clamp(24rem, 68dvh, 48rem);
    min-height: 0;
  }
  .summary {
    display: grid;
    align-content: center;
    justify-items: center;
    gap: 1rem;
    width: min(100%, 58rem);
    margin-inline: auto;
    text-align: center;
  }
  .motion-recap {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.75rem;
    width: 100%;
  }
  .motion-recap button {
    display: grid;
    gap: 0.35rem;
    min-height: 6rem;
    padding: 0.9rem;
    border: 1px solid var(--theme-stroke);
    border-radius: var(--radius-lg, 0.75rem);
    background: var(--theme-card-bg);
    color: var(--theme-text);
    font: inherit;
    cursor: pointer;
  }
  .motion-recap button:hover,
  .motion-recap button:focus-visible {
    border-color: var(--theme-stroke-strong);
    background: var(--theme-card-hover-bg);
  }
  .motion-recap button:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }
  .motion-recap span {
    color: var(--theme-text-dim);
    font-size: var(--font-size-sm, 0.875rem);
  }
  .lesson-actions {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 0.75rem;
  }
  .lesson-actions > :global(:first-child) {
    justify-self: start;
  }
  .lesson-actions > :global(:last-child) {
    justify-self: end;
  }
  @container hand-motions (max-width: 760px) {
    .lesson-shell {
      gap: 0.65rem;
      padding-top: 3.9rem;
    }
    .motion-step {
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: auto minmax(0, 1fr);
      gap: 0.65rem;
    }
    .instruction-rail {
      gap: 0.4rem;
      padding: 0.65rem 0.75rem;
    }
    .artifact-stage {
      height: min(42dvh, 19rem);
      min-height: 0;
    }
    .lesson-actions {
      grid-template-columns: 1fr 1fr;
    }
    .lesson-actions :global(.progress-indicator) {
      grid-column: 1 / -1;
      grid-row: 2;
      justify-self: center;
    }
    .lesson-actions :global(.panel-btn) {
      width: 100%;
    }
  }
  @container hand-motions (max-width: 520px) {
    .motion-recap {
      grid-template-columns: minmax(0, 1fr);
    }
    .motion-recap button {
      min-height: 4.5rem;
    }
  }
  @container hand-motions (min-width: 1680px) {
    .lesson-shell {
      width: min(100%, 132rem);
    }
    .motion-step {
      grid-template-columns: minmax(18rem, 28rem) minmax(0, 1fr);
    }
  }
  @container hand-motions (min-width: 2600px) {
    .lesson-shell {
      width: min(100%, 190rem);
    }
    .motion-step {
      grid-template-columns: minmax(24rem, 34rem) minmax(0, 1fr);
    }
    .artifact-stage {
      height: clamp(36rem, 58dvh, 64rem);
    }
  }
  @media (max-height: 620px) and (min-width: 761px) {
    .lesson-shell {
      padding-top: 4rem;
    }
    .motion-step {
      grid-template-columns: minmax(13rem, 19rem) minmax(0, 1fr);
    }
    .instruction-rail {
      gap: 0.55rem;
      padding: 0.75rem;
    }
    .artifact-stage {
      height: min(55dvh, 14rem);
      min-height: 0;
    }
  }
</style>
