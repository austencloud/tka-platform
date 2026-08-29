<script lang="ts">
  import { tick } from "svelte";

  import Crossfade from "$lib/shared/components/Crossfade.svelte";
  import PanelButton from "$lib/shared/components/panel/PanelButton.svelte";
  import BaseModal from "$lib/shared/foundation/ui/modal/BaseModal.svelte";
  import { SceneEnvironmentId } from "$lib/shared/3d/environments/domain/scene-environment";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";

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
  let activeHeading = $state<HTMLHeadingElement | null>(null);

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

  async function focusActiveHeading(): Promise<void> {
    await tick();
    activeHeading?.focus({ preventScroll: true });
  }

  function beginGuided(): void {
    currentStep = "material";
    guided = true;
    onStartEmptyStage();
    void focusActiveHeading();
  }

  function returnToExample(): void {
    guided = false;
    onReturnToExample();
    void focusActiveHeading();
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
    if (next) {
      currentStep = next;
      void focusActiveHeading();
    }
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

<BaseModal
  open={!dismissed}
  closeOnBackdrop={false}
  closeOnEscape={false}
  size="fit"
  animation="pop"
  class="stage-starter-modal"
  labelledBy="stage-starter-title"
>
  <span id="stage-starter-title" class="visually-hidden">Set up 3D Studio</span>
  <Crossfade key={guided ? "guided" : "entry"} animateHeight>
    {#if !guided}
      <div class="starter-surface entry-surface">
        <div class="eyebrow">
          <i class="fas fa-wand-sparkles" aria-hidden="true"></i>
          3D Studio
        </div>
        <h1 bind:this={activeHeading} tabindex="-1">
          Begin with motion or an empty stage.
        </h1>
        <p>
          The performance behind this card is an example. Keep it, or clear the
          stage and choose each part yourself.
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
        <div class="guide-nav">
          <PanelButton disabled={applying} onclick={back}>
            <i class="fas fa-arrow-left" aria-hidden="true"></i>
            Back
          </PanelButton>
        </div>

        <div class="guide-body">
          <Crossfade key={currentStep} animateHeight>
            <section class="step-content" aria-live="polite">
              {#if currentStep === "material"}
                <h2 bind:this={activeHeading} tabindex="-1">
                  Choose a sequence
                </h2>
                <p>Use your library, or let Studio choose for you.</p>
                <div class="choice-grid two" aria-label="Choose a sequence">
                  <button
                    type="button"
                    class="choice-card material-choice"
                    class:chosen={startingMaterial === "recommended"}
                    aria-pressed={startingMaterial === "recommended"}
                    onclick={() => selectStartingMaterial("recommended")}
                  >
                    <i class="fas fa-wand-magic-sparkles" aria-hidden="true"
                    ></i>
                    <span class="choice-copy">
                      <strong>Pick one for me</strong>
                      <span>Studio picks a clear starter sequence.</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    class="choice-card material-choice"
                    class:chosen={startingMaterial === "choose-sequence"}
                    aria-pressed={startingMaterial === "choose-sequence"}
                    onclick={() => selectStartingMaterial("choose-sequence")}
                  >
                    <i class="fas fa-folder-open" aria-hidden="true"></i>
                    <span class="choice-copy">
                      <strong>Pick one</strong>
                      <span>Choose something from your library.</span>
                    </span>
                  </button>
                </div>
              {:else if currentStep === "cast"}
                <h2 bind:this={activeHeading} tabindex="-1">
                  Who is on stage?
                </h2>
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
                <h2 bind:this={activeHeading} tabindex="-1">
                  How should they begin?
                </h2>
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
                <h2 bind:this={activeHeading} tabindex="-1">
                  What are they holding?
                </h2>
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
                <h2 bind:this={activeHeading} tabindex="-1">
                  Where are they performing?
                </h2>
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

        {#if currentStep !== "material"}
          <footer>
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
          </footer>
        {/if}
      </div>
    {/if}
  </Crossfade>
</BaseModal>

<style>
  :global(dialog.stage-starter-modal[data-size="fit"]) {
    width: min(36rem, calc(100vw - 2rem));
  }

  .starter-surface {
    --font-size-sm: 1rem;
    --min-touch-target: 3rem;

    display: grid;
    min-width: 0;
    gap: 1.25rem;
    padding: clamp(1.25rem, 3cqi, 2rem);
    background: linear-gradient(
      145deg,
      color-mix(in srgb, var(--theme-accent) 8%, transparent),
      transparent 42%
    );
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    clip-path: inset(50%);
    white-space: nowrap;
  }

  .eyebrow {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--theme-accent);
    font-size: 0.875rem;
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
    font-size: clamp(1.75rem, 4cqi, 2.25rem);
    line-height: 1.12;
    letter-spacing: -0.025em;
  }

  h2 {
    font-size: clamp(1.25rem, 3cqi, 1.5rem);
    line-height: 1.3;
  }

  p {
    max-width: 56ch;
    color: var(--theme-text);
    font-size: 1rem;
    line-height: 1.6;
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
    font-size: 0.9375rem;
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
    font-size: 1rem;
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
    font-size: 0.9375rem;
    line-height: 1.5;
  }

  .guide-body {
    min-width: 0;
  }

  .guide-nav {
    display: flex;
    justify-content: flex-start;
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
    min-height: 7.25rem;
    gap: 0.625rem;
    padding: 1rem;
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
    justify-items: start;
    min-height: 9rem;
    text-align: left;
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
    display: grid;
    width: 2.75rem;
    height: 2.75rem;
    border: 1px solid color-mix(in srgb, var(--theme-accent) 30%, transparent);
    border-radius: 0.875rem;
    background: color-mix(in srgb, var(--theme-accent) 13%, transparent);
    color: var(--theme-accent);
    font-size: 1.125rem;
    place-items: center;
  }

  .choice-card strong {
    font-size: 1rem;
    line-height: 1.35;
  }

  .choice-card span {
    color: var(--theme-text);
    font-size: 0.9375rem;
    line-height: 1.5;
  }

  .choice-copy {
    display: grid;
    gap: 0.25rem;
  }

  footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.75rem;
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
