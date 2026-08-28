<script lang="ts">
  import Crossfade from "$lib/shared/components/Crossfade.svelte";
  import PanelButton from "$lib/shared/components/panel/PanelButton.svelte";
  import { SceneEnvironmentId } from "$lib/shared/3d/environments/domain/scene-environment";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import { flyFade } from "$lib/shared/transitions/motion";
  import { DURATION } from "$lib/shared/transitions/transitions";

  import type { FormationPresetId } from "../domain/stage-types";
  import {
    RECOMMENDED_STUDIO_STARTER,
    type StudioStarter,
  } from "../domain/studio-project";

  type GuideStep = "material" | "cast" | "formation" | "prop" | "world";

  interface Props {
    word: string | null;
    showDirector: boolean;
    directorHref: string;
    onApply: (starter: StudioStarter) => Promise<void> | void;
    onChooseSequence: () => void;
    onOpenChoreography: () => void;
    onVisibilityChange: (visible: boolean) => void;
    onStartEmptyStage: () => void;
    onReturnToExample: () => void;
  }

  let {
    word,
    showDirector,
    directorHref,
    onApply,
    onChooseSequence,
    onOpenChoreography,
    onVisibilityChange,
    onStartEmptyStage,
    onReturnToExample,
  }: Props = $props();

  const STORAGE_KEY = "tka-stage-starter-dismissed";
  const castOptions = [
    {
      count: 1 as const,
      label: "Solo",
      description: "One performer",
      icon: "fa-person",
    },
    {
      count: 2 as const,
      label: "Duo",
      description: "Two performers",
      icon: "fa-user-group",
    },
    {
      count: 4 as const,
      label: "Ensemble",
      description: "Four performers",
      icon: "fa-people-group",
    },
  ];
  const duoFormations: Array<{
    id: FormationPresetId;
    label: string;
    icon: string;
  }> = [
    { id: "side-by-side", label: "Side by side", icon: "fa-arrows-left-right" },
    {
      id: "facing-each-other",
      label: "Face to face",
      icon: "fa-people-arrows",
    },
    { id: "back-to-back", label: "Back to back", icon: "fa-arrows-up-down" },
  ];
  const ensembleFormations: Array<{
    id: FormationPresetId;
    label: string;
    icon: string;
  }> = [
    { id: "line", label: "Line", icon: "fa-grip-lines" },
    { id: "v-shape", label: "V shape", icon: "fa-chevron-down" },
    { id: "circle", label: "Circle", icon: "fa-circle-notch" },
  ];
  const propOptions = [
    { id: PropType.STAFF, label: "Staff", icon: "fa-grip-lines-vertical" },
    { id: PropType.POI, label: "Poi", icon: "fa-circle-nodes" },
    { id: PropType.FAN, label: "Fans", icon: "fa-fan" },
  ] as const;
  const sceneOptions = [
    { id: SceneEnvironmentId.EMBER, label: "Ember", icon: "fa-fire" },
    { id: SceneEnvironmentId.COSMIC, label: "Cosmic", icon: "fa-moon" },
    { id: SceneEnvironmentId.FOREST, label: "Forest", icon: "fa-tree" },
    { id: SceneEnvironmentId.VOID, label: "Void", icon: "fa-circle" },
  ] as const;

  function storedDismissal(): boolean {
    try {
      return localStorage?.getItem(STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  }

  let dismissed = $state(storedDismissal());
  let guided = $state(false);
  let currentStep = $state<GuideStep>("material");
  let applying = $state(false);
  let startingMaterial = $state<StudioStarter["startingMaterial"] | null>(null);
  let performerCount = $state<StudioStarter["performerCount"] | null>(null);
  let formation = $state<StudioStarter["formation"] | null>(null);
  let environmentId = $state<StudioStarter["environmentId"] | null>(null);
  let prop = $state<StudioStarter["prop"] | null>(null);

  const guideSteps = $derived<GuideStep[]>(
    performerCount === 1
      ? ["material", "cast", "prop", "world"]
      : ["material", "cast", "formation", "prop", "world"]
  );
  const currentStepIndex = $derived(guideSteps.indexOf(currentStep));
  const formationOptions = $derived(
    performerCount === 2
      ? duoFormations
      : performerCount === 4
        ? ensembleFormations
        : []
  );
  const canContinue = $derived(
    currentStep === "material"
      ? startingMaterial !== null
      : currentStep === "cast"
        ? performerCount !== null
        : currentStep === "formation"
          ? formation !== null
          : currentStep === "prop"
            ? prop !== null
            : environmentId !== null
  );

  $effect(() => {
    onVisibilityChange(!dismissed);
  });

  function dismiss(): void {
    dismissed = true;
    try {
      localStorage?.setItem(STORAGE_KEY, "1");
    } catch {
      // The current project remains usable when storage is unavailable.
    }
  }

  function beginGuided(): void {
    currentStep = "material";
    guided = true;
    onStartEmptyStage();
  }

  function returnToExample(): void {
    guided = false;
    onReturnToExample();
  }

  function selectCast(count: StudioStarter["performerCount"]): void {
    performerCount = count;
    if (count === 1) {
      formation = "solo";
      return;
    }

    const valid = count === 2 ? duoFormations : ensembleFormations;
    if (!formation || !valid.some((option) => option.id === formation)) {
      formation = null;
    }
  }

  function selectStartingMaterial(
    material: StudioStarter["startingMaterial"]
  ): void {
    startingMaterial = material;
    moveStep(1);
  }

  function moveStep(direction: -1 | 1): void {
    const next = guideSteps[currentStepIndex + direction];
    if (next) currentStep = next;
  }

  function back(): void {
    if (currentStepIndex > 0) moveStep(-1);
    else returnToExample();
  }

  async function applyRecommended(): Promise<void> {
    if (applying) return;
    applying = true;
    try {
      await onApply(RECOMMENDED_STUDIO_STARTER);
      dismiss();
    } finally {
      applying = false;
    }
  }

  async function applyGuided(): Promise<void> {
    if (
      applying ||
      !startingMaterial ||
      !performerCount ||
      !formation ||
      !environmentId ||
      !prop
    ) {
      return;
    }

    applying = true;
    try {
      await onApply({
        startingMaterial,
        performerCount,
        formation,
        environmentId,
        prop,
      });
      dismiss();
      if (startingMaterial === "choose-sequence") onChooseSequence();
    } finally {
      applying = false;
    }
  }
</script>

{#if !dismissed}
  <aside
    class="starter"
    aria-label="Set up 3D Studio"
    transition:flyFade={{ duration: DURATION.normal, x: -12, y: 0 }}
  >
    <Crossfade key={guided ? "guided" : "entry"} animateHeight>
      {#if !guided}
        <div class="starter-surface entry-surface">
          <div class="eyebrow">
            <i class="fas fa-wand-sparkles" aria-hidden="true"></i>
            3D Studio
          </div>
          <h1>Begin with motion or an empty stage.</h1>
          <p>
            The performance behind this card is an example. Keep it, or clear
            the stage and choose each part yourself.
          </p>
          {#if word}
            <div class="example-label">
              <span>Example sequence</span>
              <strong>{word}</strong>
            </div>
          {/if}
          <div class="actions">
            <PanelButton
              variant="primary"
              fullWidth
              disabled={applying}
              ariaBusy={applying}
              onclick={() => void applyRecommended()}
            >
              <i
                class="fas {applying ? 'fa-circle-notch fa-spin' : 'fa-play'}"
                aria-hidden="true"
              ></i>
              Start with a recommended scene
            </PanelButton>
            <PanelButton
              variant="secondary"
              fullWidth
              disabled={applying}
              onclick={beginGuided}
            >
              <i class="fas fa-eraser" aria-hidden="true"></i>
              Build from an empty stage
            </PanelButton>
          </div>

          <div class="advanced" aria-label="Other ways to begin">
            <button
              type="button"
              onclick={() => {
                dismiss();
                onOpenChoreography();
              }}>Keep this example and choreograph it</button
            >
            <button
              type="button"
              onclick={() => {
                dismiss();
                onChooseSequence();
              }}>Open a sequence from your library</button
            >
            {#if showDirector}
              <a href={directorHref}
                >Director preview &amp; JSON
                <span
                  >Expert workspace. It does not load this unsaved Stage project
                  yet.</span
                ></a
              >
            {/if}
          </div>
        </div>
      {:else}
        <div class="starter-surface guide-surface">
          <div class="guide-body">
            <Crossfade key={currentStep} animateHeight>
              <section class="step-content" aria-live="polite">
                {#if currentStep === "material"}
                  <div class="choice-grid two" aria-label="Choose a sequence">
                    <button
                      type="button"
                      class="choice-card material-choice"
                      class:chosen={startingMaterial === "recommended"}
                      aria-pressed={startingMaterial === "recommended"}
                      onclick={() => selectStartingMaterial("recommended")}
                    >
                      <strong>Pick one for me</strong>
                    </button>
                    <button
                      type="button"
                      class="choice-card material-choice"
                      class:chosen={startingMaterial === "choose-sequence"}
                      aria-pressed={startingMaterial === "choose-sequence"}
                      onclick={() => selectStartingMaterial("choose-sequence")}
                    >
                      <strong>Pick one</strong>
                    </button>
                  </div>
                {:else if currentStep === "cast"}
                  <h2>Who is on stage?</h2>
                  <div class="choice-grid three">
                    {#each castOptions as option (option.count)}
                      <button
                        type="button"
                        class="choice-card compact"
                        class:chosen={performerCount === option.count}
                        aria-pressed={performerCount === option.count}
                        onclick={() => selectCast(option.count)}
                      >
                        <i class="fas {option.icon}" aria-hidden="true"></i>
                        <strong>{option.label}</strong>
                        <span>{option.description}</span>
                      </button>
                    {/each}
                  </div>
                {:else if currentStep === "formation"}
                  <h2>How should they begin?</h2>
                  <div class="choice-grid three">
                    {#each formationOptions as option (option.id)}
                      <button
                        type="button"
                        class="choice-card compact"
                        class:chosen={formation === option.id}
                        aria-pressed={formation === option.id}
                        onclick={() => (formation = option.id)}
                      >
                        <i class="fas {option.icon}" aria-hidden="true"></i>
                        <strong>{option.label}</strong>
                      </button>
                    {/each}
                  </div>
                {:else if currentStep === "prop"}
                  <h2>What are they holding?</h2>
                  <div class="choice-grid three">
                    {#each propOptions as option (option.id)}
                      <button
                        type="button"
                        class="choice-card compact"
                        class:chosen={prop === option.id}
                        aria-pressed={prop === option.id}
                        onclick={() => (prop = option.id)}
                      >
                        <i class="fas {option.icon}" aria-hidden="true"></i>
                        <strong>{option.label}</strong>
                      </button>
                    {/each}
                  </div>
                {:else}
                  <h2>Where are they performing?</h2>
                  <div class="choice-grid worlds">
                    {#each sceneOptions as option (option.id)}
                      <button
                        type="button"
                        class="choice-card compact"
                        class:chosen={environmentId === option.id}
                        aria-pressed={environmentId === option.id}
                        onclick={() => (environmentId = option.id)}
                      >
                        <i class="fas {option.icon}" aria-hidden="true"></i>
                        <strong>{option.label}</strong>
                      </button>
                    {/each}
                  </div>
                {/if}
              </section>
            </Crossfade>
          </div>

          <footer>
            <PanelButton disabled={applying} onclick={back}>Back</PanelButton>
            {#if currentStep !== "material"}
              {#if currentStepIndex < guideSteps.length - 1}
                <PanelButton
                  variant="primary"
                  disabled={!canContinue || applying}
                  onclick={() => moveStep(1)}>Next</PanelButton
                >
              {:else}
                <PanelButton
                  variant="primary"
                  disabled={!canContinue || applying}
                  ariaBusy={applying}
                  onclick={() => void applyGuided()}
                >
                  <i
                    class="fas {applying
                      ? 'fa-circle-notch fa-spin'
                      : 'fa-wand-magic-sparkles'}"
                    aria-hidden="true"
                  ></i>
                  Bring them on stage
                </PanelButton>
              {/if}
            {/if}
          </footer>
        </div>
      {/if}
    </Crossfade>
  </aside>
{/if}

<style>
  .starter {
    position: absolute;
    top: 4.5rem;
    left: clamp(0.75rem, 2.5cqi, 3rem);
    z-index: 24;
    width: min(32rem, calc(100% - 7rem));
    max-height: calc(100% - 9.25rem);
    overflow-x: hidden;
    overflow-y: auto;
    border: 1px solid var(--theme-stroke-strong, rgba(255, 255, 255, 0.14));
    border-radius: 1rem;
    background: var(--theme-panel-bg, #0c0e16);
    box-shadow: var(--theme-panel-shadow, 0 1rem 3rem rgba(0, 0, 0, 0.52));
    color: var(--theme-text, #fff);
  }

  .starter-surface {
    display: grid;
    min-width: 0;
    gap: 1rem;
    padding: clamp(1rem, 2.5cqi, 1.5rem);
  }

  .eyebrow {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--theme-accent);
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  h1,
  h2,
  p {
    margin: 0;
  }

  h1 {
    font-size: clamp(1.35rem, 2.2cqi, 2rem);
    line-height: 1.08;
    letter-spacing: -0.025em;
  }

  h2 {
    font-size: 1.1rem;
    line-height: 1.25;
  }

  p {
    color: var(--theme-text-dim);
    font-size: var(--font-size-min, 0.875rem);
    line-height: 1.5;
  }

  .example-label {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    min-height: var(--min-touch-target, 44px);
    padding: 0.625rem 0.75rem;
    border: 1px solid var(--theme-stroke);
    border-radius: 0.75rem;
    background: var(--theme-card-bg);
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact, 0.75rem);
  }

  .example-label strong {
    max-width: 58%;
    overflow: hidden;
    color: var(--theme-text);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .actions {
    display: grid;
    gap: 0.625rem;
  }

  .advanced {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.25rem 0.75rem;
    padding-top: 0.625rem;
    border-top: 1px solid var(--theme-stroke);
  }

  .advanced button,
  .advanced a {
    min-height: var(--min-touch-target, 44px);
    border: 0;
    background: transparent;
    color: var(--theme-text-dim);
    font: inherit;
    font-size: var(--font-size-min, 0.875rem);
    text-align: left;
    cursor: pointer;
  }

  .advanced button:hover,
  .advanced button:focus-visible,
  .advanced a:hover,
  .advanced a:focus-visible {
    color: var(--theme-text);
    text-decoration: underline;
  }

  .advanced a {
    display: grid;
    grid-column: 1 / -1;
    align-content: center;
    text-decoration: none;
  }

  .advanced a span {
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact, 0.75rem);
  }

  .guide-body {
    min-width: 0;
  }

  .step-content {
    display: grid;
    min-width: 0;
    gap: 0.75rem;
  }

  .choice-grid {
    display: grid;
    gap: 0.5rem;
  }

  .choice-grid.two,
  .choice-grid.worlds {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .choice-grid.three {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .choice-card {
    display: grid;
    align-content: center;
    justify-items: start;
    min-width: 0;
    min-height: 6.75rem;
    gap: 0.375rem;
    padding: 0.75rem;
    border: 1px solid var(--theme-stroke);
    border-radius: 0.75rem;
    background: var(--theme-card-bg);
    color: var(--theme-text);
    font: inherit;
    text-align: left;
    cursor: pointer;
    transition:
      background-color var(--duration-normal, 200ms) ease,
      border-color var(--duration-normal, 200ms) ease,
      transform var(--duration-fast, 150ms) ease,
      box-shadow var(--duration-normal, 200ms) ease;
  }

  .choice-card.compact {
    justify-items: center;
    min-height: 5.75rem;
    text-align: center;
  }

  .choice-card.material-choice {
    justify-items: center;
    min-height: 4.75rem;
    text-align: center;
  }

  .choice-card:hover,
  .choice-card:focus-visible {
    border-color: var(--theme-stroke-strong);
    background: var(--theme-card-hover-bg);
    transform: translateY(-2px);
  }

  .choice-card:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  .choice-card.chosen {
    border-color: var(--theme-accent);
    background: color-mix(
      in srgb,
      var(--theme-accent) 18%,
      var(--theme-card-bg)
    );
    box-shadow: 0 0.5rem 1.5rem
      color-mix(in srgb, var(--theme-accent) 14%, transparent);
  }

  .choice-card i {
    color: var(--theme-accent);
    font-size: 1rem;
  }

  .choice-card strong {
    font-size: var(--font-size-min, 0.875rem);
    line-height: 1.2;
  }

  .choice-card span {
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact, 0.75rem);
    line-height: 1.35;
  }

  footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  @container (min-width: 48rem) and (min-height: 34rem) {
    .starter {
      top: 10rem;
      max-height: calc(100% - 11rem);
    }
  }

  @container (max-height: 32rem) {
    .starter {
      top: 1rem;
      max-height: calc(100% - 2rem);
    }
  }

  @container (max-width: 36rem) {
    .starter {
      right: 0.75rem;
      left: 0.75rem;
      width: auto;
    }
  }

  @container (max-width: 28rem) {
    .choice-grid.three {
      grid-template-columns: 1fr;
    }

    .advanced {
      grid-template-columns: 1fr;
    }

    .advanced a {
      grid-column: auto;
    }
  }

  @container (max-width: 22rem) {
    .choice-grid.two,
    .choice-grid.worlds {
      grid-template-columns: 1fr;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .choice-card {
      transition: none;
    }
  }
</style>
