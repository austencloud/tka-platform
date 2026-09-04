<!--
  Hand Motions continues the shared Grid → Hand Positions lesson stage. The
  artifact changes from one-hand path families to the six two-hand
  timing/direction relationships without replacing the surrounding layout.
-->
<script lang="ts">
  import { TND_ELEMENTS } from "$lib/features/choreo-card/domain/tnd-element";
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import Crossfade from "$lib/shared/components/Crossfade.svelte";
  import type { ExperienceViewMode } from "../../../domain/types";
  import { getExperiencePersistence } from "../../../state/experience-persistence.svelte";
  import LessonStageControls from "../LessonStageControls.svelte";
  import LessonStageFrame from "../LessonStageFrame.svelte";
  import LessonStageHeading from "../LessonStageHeading.svelte";
  import HandMotionPlayer from "../foundations/HandMotionPlayer.svelte";
  import {
    ALPHA_BETA_MODES,
    GAMMA_MODES,
    HAND_PATH_STEPS,
    type TimingDirectionMode,
  } from "../foundations/pictograph-foundation-content";

  let {
    onComplete,
    onBack,
    viewMode = "step",
  } = $props<{
    onComplete?: () => void;
    onBack?: () => void;
    viewMode?: ExperienceViewMode;
  }>();

  const allModes: readonly TimingDirectionMode[] = [
    ...ALPHA_BETA_MODES,
    ...GAMMA_MODES,
  ];
  const modeByFamily = new Map(
    allModes.map((mode) => [mode.element.familyId, mode])
  );

  function requireMode(familyId: string): TimingDirectionMode {
    const mode = modeByFamily.get(familyId);
    if (!mode) throw new Error(`Missing hand-motion lesson mode ${familyId}`);
    return mode;
  }

  // TND_ELEMENTS owns the product's canonical order: the three same-direction
  // relationships, then the three opposite-direction relationships.
  const ELEMENTAL_MODES = TND_ELEMENTS.map((element) =>
    requireMode(element.familyId)
  );
  const bridgeIndex = HAND_PATH_STEPS.length;
  const elementalStart = bridgeIndex + 1;
  const recapIndex = elementalStart + ELEMENTAL_MODES.length;
  const totalStages = recapIndex + 1;

  const haptic = getHapticFeedback();
  const persistence = getExperiencePersistence("hand-motions-intro");
  const saved = persistence.load();
  let stepIndex = $state(
    Math.min(recapIndex, Math.max(0, (saved.step || 1) - 1))
  );

  const activeMotion = $derived(
    stepIndex < HAND_PATH_STEPS.length ? HAND_PATH_STEPS[stepIndex] : undefined
  );
  const activeMode = $derived(ELEMENTAL_MODES[stepIndex - elementalStart]);
  const isBridge = $derived(stepIndex === bridgeIndex);
  const isRecap = $derived(stepIndex === recapIndex);
  const headingTitle = $derived(
    activeMotion?.name ??
      (activeMode
        ? capitalize(activeMode.element.element)
        : isBridge
          ? "Timing + Direction"
          : "Hand Motions + Elements")
  );
  const headingEyebrow = $derived(
    activeMotion
      ? `Hand motion ${stepIndex + 1} of ${HAND_PATH_STEPS.length}`
      : activeMode
        ? "Timing + direction"
        : isBridge
          ? "Two hands"
          : "Review"
  );
  const headingDescription = $derived(
    activeMotion?.guideCaption ??
      (activeMode
        ? `${activeMode.timing} timing, ${activeMode.direction.toLowerCase()} direction.`
        : isBridge
          ? "Timing compares the hands: together, split, or quarter. Direction compares their travel: same or opposite."
          : "Choose any motion or element to review it.")
  );

  function capitalize(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  function goToStep(next: number): void {
    const clamped = Math.min(recapIndex, Math.max(0, next));
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

  function handlePrimaryAction(): void {
    if (isRecap) {
      complete();
      return;
    }
    goToStep(stepIndex + 1);
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (viewMode !== "step") return;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      handlePrimaryAction();
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
  class="motions-experience"
  onkeydown={handleKeydown}
  tabindex="0"
  role="application"
  aria-label="Hand motions lesson, use arrow keys to navigate"
>
  <LessonStageFrame artifactLayout={activeMotion ? "square" : "wide"}>
    {#snippet heading()}
      <LessonStageHeading
        key={stepIndex}
        title={headingTitle}
        eyebrow={headingEyebrow}
      >
        <p>{headingDescription}</p>
      </LessonStageHeading>
    {/snippet}

    {#snippet artifact()}
      <Crossfade key={stepIndex} fill>
        {#if activeMotion}
          <div class="artifact-state motion-state">
            <div class="player-frame">
              <HandMotionPlayer
                sequence={activeMotion.sequence}
                ariaLabel={`${activeMotion.name}: ${activeMotion.guideCaption}`}
              />
            </div>
            <div class="hand-key" aria-label="Left hand is blue">
              <span aria-hidden="true"></span>
              <strong>Left hand</strong>
            </div>
          </div>
        {:else if isBridge}
          <div class="artifact-state bridge-state">
            <section class="comparison-axis" aria-labelledby="timing-axis">
              <h2 id="timing-axis">Timing</h2>
              <div class="axis-values">
                <strong>Together</strong>
                <strong>Split</strong>
                <strong>Quarter</strong>
              </div>
            </section>
            <section class="comparison-axis" aria-labelledby="direction-axis">
              <h2 id="direction-axis">Direction</h2>
              <div class="axis-values">
                <strong>Same</strong>
                <strong>Opposite</strong>
              </div>
            </section>
          </div>
        {:else if activeMode}
          <div
            class="artifact-state element-state"
            style:--element-accent={activeMode.element.accentColor}
          >
            <div class="element-player">
              <HandMotionPlayer
                sequence={activeMode.sequence}
                ariaLabel={`${capitalize(activeMode.element.element)}: ${activeMode.timing} timing and ${activeMode.direction.toLowerCase()} direction`}
              />
            </div>
            <aside class="element-properties">
              <img src={activeMode.element.iconPath} alt="" />
              <dl>
                <div>
                  <dt>Timing</dt>
                  <dd>{activeMode.timing}</dd>
                </div>
                <div>
                  <dt>Direction</dt>
                  <dd>{activeMode.direction}</dd>
                </div>
              </dl>
            </aside>
          </div>
        {:else}
          <div class="artifact-state recap-state">
            <div class="recap-content">
              <section
                class="recap-section"
                aria-labelledby="motion-recap-title"
              >
                <h2 id="motion-recap-title">Three hand motions</h2>
                <div class="motion-recap">
                  {#each HAND_PATH_STEPS as motion, index (motion.id)}
                    <button type="button" onclick={() => goToStep(index)}>
                      <strong>{motion.name}</strong>
                      <span>{motion.guideCaption}</span>
                    </button>
                  {/each}
                </div>
              </section>

              <section
                class="recap-section"
                aria-labelledby="element-recap-title"
              >
                <h2 id="element-recap-title">Six elements</h2>
                <div class="element-recap">
                  {#each ELEMENTAL_MODES as mode, index (mode.id)}
                    <button
                      type="button"
                      style:--element-accent={mode.element.accentColor}
                      onclick={() => goToStep(elementalStart + index)}
                    >
                      <img src={mode.element.iconPath} alt="" />
                      <strong>{capitalize(mode.element.element)}</strong>
                      <span>{mode.timing} · {mode.direction}</span>
                    </button>
                  {/each}
                </div>
              </section>

              <section class="attribution" aria-labelledby="attribution-title">
                <h2 id="attribution-title">Where the model comes from</h2>
                <p>
                  Vulcan Tech Gospel codified and widely distributed Split-Same,
                  Together-Same, Split-Opposite, and Together-Opposite as
                  timing-and-direction categories.
                </p>
                <p>
                  The four elemental names are community-developed extensions of
                  those categories. Their original creator is not yet
                  documented.
                </p>
                <p>
                  The Kinetic Alphabet adds Sun and Moon for Quarter-Same and
                  Quarter-Opposite.
                </p>
              </section>
            </div>
          </div>
        {/if}
      </Crossfade>
    {/snippet}

    {#snippet controls()}
      <LessonStageControls
        label={isRecap ? "Finish lesson" : "Next"}
        currentStep={stepIndex + 1}
        totalSteps={totalStages}
        onAction={handlePrimaryAction}
        onPrevious={handleBack}
        previousDisabled={stepIndex === 0}
        actionIcon={isRecap ? "check" : "arrow"}
      />
    {/snippet}
  </LessonStageFrame>
</div>

<style>
  .motions-experience {
    width: 100%;
    height: 100%;
    min-height: 0;
    overflow: hidden;
    color: var(--theme-text);
    outline: none;
  }

  .artifact-state {
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
  }

  .motion-state {
    position: relative;
    display: grid;
    place-items: center;
  }

  .player-frame {
    width: 100%;
    height: 100%;
    min-height: 0;
  }

  .hand-key {
    position: absolute;
    right: 0.75rem;
    bottom: 0.75rem;
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    min-height: 2.25rem;
    padding: 0.45rem 0.65rem;
    border: 1px solid var(--theme-stroke);
    border-radius: 999px;
    background: var(--theme-panel-bg);
    color: var(--theme-text-dim);
    font-size: var(--font-size-min, 0.875rem);
  }

  .hand-key span {
    width: 0.8rem;
    aspect-ratio: 1;
    border-radius: 50%;
    background: var(--prop-blue, #3d44b8);
  }

  .hand-key strong {
    color: var(--theme-text);
  }

  .bridge-state {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-content: center;
    gap: clamp(0.75rem, 2cqw, 1.5rem);
  }

  .comparison-axis {
    display: grid;
    align-content: center;
    gap: 1rem;
    min-height: min(100%, 18rem);
    padding: clamp(1rem, 3cqw, 2rem);
    border: 1px solid var(--theme-stroke);
    border-radius: var(--radius-lg, 0.75rem);
    background: var(--theme-card-bg);
    text-align: center;
  }

  .comparison-axis h2,
  .recap-section h2,
  .attribution h2 {
    margin: 0;
    color: var(--theme-text);
    font-size: clamp(1rem, 2cqw, 1.35rem);
  }

  .axis-values {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.5rem;
  }

  .comparison-axis:last-child .axis-values {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .axis-values strong {
    min-height: var(--min-touch-target, 44px);
    display: grid;
    place-items: center;
    padding: 0.65rem;
    border-radius: var(--radius-md, 0.5rem);
    background: var(--theme-panel-bg);
    color: var(--theme-text);
  }

  .element-state {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(12rem, 16rem);
    align-items: stretch;
    gap: clamp(0.75rem, 2cqw, 1.5rem);
  }

  .element-player {
    min-width: 0;
    min-height: 0;
  }

  .element-properties {
    display: grid;
    align-content: center;
    justify-items: center;
    gap: 1rem;
    min-width: 0;
    padding: clamp(0.75rem, 2cqw, 1.5rem);
    border: 1px solid var(--theme-stroke);
    border-radius: var(--radius-lg, 0.75rem);
    background: color-mix(
      in srgb,
      var(--element-accent) 10%,
      var(--theme-card-bg)
    );
  }

  .element-properties img {
    width: clamp(3rem, 8cqw, 5rem);
    height: clamp(3rem, 8cqw, 5rem);
    object-fit: contain;
  }

  .element-properties dl {
    width: 100%;
    display: grid;
    gap: 0.65rem;
    margin: 0;
  }

  .element-properties dl > div {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: baseline;
    gap: 0.75rem;
    padding-block: 0.55rem;
    border-bottom: 1px solid var(--theme-stroke);
  }

  .element-properties dl > div:last-child {
    border-bottom: 0;
  }

  dt {
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  dd {
    margin: 0;
    color: var(--theme-text);
    font-weight: 800;
  }

  .recap-state {
    overflow-y: auto;
    scrollbar-gutter: stable;
  }

  .recap-content {
    /* The shared wide artifact is already the responsive width owner. Filling
       it keeps the recap from becoming a prose-column-sized island on 4K while
       leaving ordinary desktop and phone geometry unchanged. */
    width: 100%;
    min-height: 100%;
    display: grid;
    align-content: center;
    gap: 1rem;
    margin-inline: auto;
    padding: 0.25rem;
  }

  .recap-section {
    display: grid;
    gap: 0.55rem;
  }

  .motion-recap,
  .element-recap {
    display: grid;
    gap: 0.55rem;
  }

  .motion-recap {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .element-recap {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .motion-recap button,
  .element-recap button {
    min-height: var(--min-touch-target, 44px);
    border: 1px solid var(--theme-stroke);
    border-radius: var(--radius-md, 0.5rem);
    background: var(--theme-card-bg);
    color: var(--theme-text);
    font: inherit;
    cursor: pointer;
  }

  .motion-recap button {
    display: grid;
    gap: 0.15rem;
    padding: 0.65rem;
  }

  .element-recap button {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 0.1rem 0.55rem;
    padding: 0.55rem 0.65rem;
    background: color-mix(
      in srgb,
      var(--element-accent) 9%,
      var(--theme-card-bg)
    );
    text-align: left;
  }

  .motion-recap button:hover,
  .element-recap button:hover {
    border-color: var(--theme-stroke-strong);
    background: var(--theme-card-hover-bg);
  }

  .motion-recap button:focus-visible,
  .element-recap button:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  .motion-recap span,
  .element-recap span {
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact, 0.75rem);
  }

  .element-recap img {
    grid-row: 1 / 3;
    width: 1.65rem;
    height: 1.65rem;
    object-fit: contain;
  }

  .attribution {
    display: grid;
    gap: 0.4rem;
    padding-top: 0.25rem;
    text-align: center;
  }

  .attribution p {
    margin: 0;
    color: var(--theme-text-dim);
    font-size: var(--font-size-min, 0.875rem);
    line-height: 1.45;
  }

  @media (max-width: 700px) {
    .element-state {
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: minmax(0, 1fr) auto;
      gap: 0.5rem;
    }

    .element-properties {
      grid-template-columns: auto minmax(0, 1fr);
      gap: 0.75rem;
      padding: 0.65rem 0.75rem;
    }

    .element-properties img {
      width: 2.75rem;
      height: 2.75rem;
    }

    .element-properties dl {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.5rem;
    }

    .element-properties dl > div {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 0.1rem;
      padding: 0;
      border-bottom: 0;
    }

    .bridge-state {
      gap: 0.5rem;
    }

    .comparison-axis {
      gap: 0.5rem;
      padding: 0.65rem;
    }

    .axis-values {
      grid-template-columns: minmax(0, 1fr);
    }

    .comparison-axis:last-child .axis-values {
      grid-template-columns: minmax(0, 1fr);
    }

    .axis-values strong {
      padding: 0.35rem;
    }

    .element-recap {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 440px) {
    .motion-recap {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  @media (max-height: 520px) and (min-width: 701px) {
    .element-state {
      grid-template-columns: minmax(0, 1fr) minmax(11rem, 14rem);
    }

    .element-properties {
      grid-template-columns: auto minmax(0, 1fr);
      gap: 0.65rem;
      padding: 0.65rem;
    }

    .element-properties img {
      width: 2.75rem;
      height: 2.75rem;
    }

    .element-properties dl {
      gap: 0.25rem;
    }

    .element-properties dl > div {
      padding-block: 0.25rem;
    }
  }
</style>
