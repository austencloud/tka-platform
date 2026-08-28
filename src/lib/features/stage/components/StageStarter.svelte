<script lang="ts">
  import PanelButton from "$lib/shared/components/panel/PanelButton.svelte";
  import { SceneEnvironmentId } from "$lib/shared/3d/environments/domain/scene-environment";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";

  import {
    RECOMMENDED_STUDIO_STARTER,
    type StudioStarter,
  } from "../domain/studio-project";

  interface Props {
    word: string | null;
    showDirector: boolean;
    directorHref: string;
    onApply: (starter: StudioStarter) => void;
    onChooseSequence: () => void;
    onOpenChoreography: () => void;
    onVisibilityChange: (visible: boolean) => void;
  }

  let {
    word,
    showDirector,
    directorHref,
    onApply,
    onChooseSequence,
    onOpenChoreography,
    onVisibilityChange,
  }: Props = $props();

  const STORAGE_KEY = "tka-stage-starter-dismissed";
  const castOptions = [
    { count: 1 as const, label: "Solo", formation: "solo" as const },
    {
      count: 2 as const,
      label: "Duo",
      formation: "facing-each-other" as const,
    },
    { count: 4 as const, label: "Ensemble", formation: "v-shape" as const },
  ];
  const sceneOptions = [
    { id: SceneEnvironmentId.EMBER, label: "Ember", icon: "fa-fire" },
    { id: SceneEnvironmentId.COSMIC, label: "Cosmic", icon: "fa-moon" },
    { id: SceneEnvironmentId.FOREST, label: "Forest", icon: "fa-tree" },
  ] as const;
  const propOptions = [
    { id: PropType.STAFF, label: "Staff" },
    { id: PropType.POI, label: "Poi" },
    { id: PropType.FAN, label: "Fans" },
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
  let startingMaterial =
    $state<StudioStarter["startingMaterial"]>("recommended");
  let performerCount = $state<StudioStarter["performerCount"]>(4);
  let formation = $state<StudioStarter["formation"]>("v-shape");
  let environmentId = $state<StudioStarter["environmentId"]>(
    SceneEnvironmentId.EMBER
  );
  let prop = $state<StudioStarter["prop"]>(PropType.STAFF);

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

  function selectCast(option: (typeof castOptions)[number]): void {
    performerCount = option.count;
    formation = option.formation;
  }

  function applyRecommended(): void {
    dismiss();
    onApply(RECOMMENDED_STUDIO_STARTER);
  }

  function applyGuided(): void {
    const starter: StudioStarter = {
      startingMaterial,
      performerCount,
      formation,
      environmentId,
      prop,
    };
    dismiss();
    onApply(starter);
    if (startingMaterial === "choose-sequence") onChooseSequence();
  }
</script>

{#if !dismissed}
  <aside class="starter" aria-labelledby="studio-starter-title">
    {#if !guided}
      <div class="eyebrow">
        <i class="fas fa-wand-sparkles" aria-hidden="true"></i> 3D Studio
      </div>
      <h1 id="studio-starter-title">Put something in motion.</h1>
      <p>
        {#if word}
          Your current sequence is ready when you are.
        {:else}
          Start with a real cast, prop, and world. The deeper tools stay one tap
          away.
        {/if}
      </p>
      <div class="actions">
        <PanelButton variant="primary" fullWidth onclick={applyRecommended}>
          <i class="fas fa-play" aria-hidden="true"></i>
          Start a recommended scene
        </PanelButton>
        <PanelButton
          variant="secondary"
          fullWidth
          onclick={() => (guided = true)}
        >
          <i class="fas fa-sliders" aria-hidden="true"></i>
          Start a scene
        </PanelButton>
      </div>
    {:else}
      <header>
        <div>
          <div class="eyebrow">Guided start</div>
          <h1 id="studio-starter-title">Make it yours</h1>
        </div>
        <button class="back" type="button" onclick={() => (guided = false)}
          >Back</button
        >
      </header>

      <fieldset>
        <legend>Starting material</legend>
        <div class="choice-row">
          <button
            type="button"
            class:chosen={startingMaterial === "recommended"}
            aria-pressed={startingMaterial === "recommended"}
            onclick={() => (startingMaterial = "recommended")}
            >Recommended flow</button
          >
          <button
            type="button"
            class:chosen={startingMaterial === "choose-sequence"}
            aria-pressed={startingMaterial === "choose-sequence"}
            onclick={() => (startingMaterial = "choose-sequence")}
            >Pick a sequence</button
          >
        </div>
      </fieldset>

      <fieldset>
        <legend>Who is on stage?</legend>
        <div class="choice-row">
          {#each castOptions as option (option.count)}
            <button
              type="button"
              class:chosen={performerCount === option.count}
              aria-pressed={performerCount === option.count}
              onclick={() => selectCast(option)}>{option.label}</button
            >
          {/each}
        </div>
        {#if performerCount > 1}
          <p class="hint">
            Opening formation: {formation.replaceAll("-", " ")}
          </p>
        {/if}
      </fieldset>

      <fieldset>
        <legend>Prop</legend>
        <div class="choice-row">
          {#each propOptions as option (option.id)}
            <button
              type="button"
              class:chosen={prop === option.id}
              aria-pressed={prop === option.id}
              onclick={() => (prop = option.id)}>{option.label}</button
            >
          {/each}
        </div>
      </fieldset>

      <fieldset>
        <legend>World</legend>
        <div class="choice-row scenes">
          {#each sceneOptions as option (option.id)}
            <button
              type="button"
              class:chosen={environmentId === option.id}
              aria-pressed={environmentId === option.id}
              onclick={() => (environmentId = option.id)}
              ><i class="fas {option.icon}" aria-hidden="true"></i>
              {option.label}</button
            >
          {/each}
        </div>
      </fieldset>

      <PanelButton variant="primary" fullWidth onclick={applyGuided}>
        Create this scene
      </PanelButton>
    {/if}

    <div class="advanced" aria-label="Continue editing or open expert tools">
      <button
        type="button"
        onclick={() => {
          dismiss();
          onOpenChoreography();
        }}>Choreograph the performance</button
      >
      <button
        type="button"
        onclick={() => {
          dismiss();
          onChooseSequence();
        }}>Choose a sequence</button
      >
      {#if showDirector}
        <a href={directorHref}
          >Director preview &amp; JSON
          <span
            >Preview only — it does not load this unsaved Stage project yet.</span
          ></a
        >
      {/if}
    </div>
  </aside>
{/if}

<style>
  .starter {
    position: absolute;
    top: 4.5rem;
    left: clamp(0.75rem, 2.5cqi, 3rem);
    z-index: 24;
    display: grid;
    width: min(31rem, calc(100% - 7rem));
    max-height: calc(100% - 9.25rem);
    overflow-y: auto;
    gap: 1rem;
    padding: clamp(1rem, 2.5cqi, 1.5rem);
    border: 1px solid var(--theme-stroke-strong, rgba(255, 255, 255, 0.14));
    border-radius: 1rem;
    background: var(--theme-panel-bg, #0c0e16);
    box-shadow: var(--theme-panel-shadow, 0 1rem 3rem rgba(0, 0, 0, 0.52));
    color: var(--theme-text, #fff);
  }
  .eyebrow {
    color: var(--theme-accent);
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  h1 {
    margin: 0;
    font-size: clamp(1.35rem, 2.2cqi, 2rem);
    line-height: 1.08;
    letter-spacing: -0.025em;
  }
  p {
    margin: 0;
    color: var(--theme-text-dim);
    line-height: 1.45;
  }
  .actions {
    display: grid;
    gap: 0.625rem;
  }
  header {
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: 1rem;
  }
  .back,
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
  .back {
    padding: 0 0.5rem;
    color: var(--theme-text);
  }
  fieldset {
    display: grid;
    min-width: 0;
    gap: 0.5rem;
    margin: 0;
    padding: 0;
    border: 0;
  }
  legend {
    padding: 0;
    color: var(--theme-text);
    font-size: var(--font-size-min, 0.875rem);
    font-weight: 650;
  }
  .choice-row {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.5rem;
  }
  .choice-row button {
    min-height: var(--min-touch-target, 44px);
    padding: 0.5rem;
    border: 1px solid var(--theme-stroke);
    border-radius: 0.75rem;
    background: var(--theme-card-bg);
    color: var(--theme-text);
    font: inherit;
    font-size: var(--font-size-compact, 0.8125rem);
    cursor: pointer;
  }
  .choice-row button:hover,
  .choice-row button:focus-visible {
    border-color: var(--theme-stroke-strong);
    background: var(--theme-card-hover-bg);
  }
  .choice-row button.chosen {
    border-color: var(--theme-accent);
    background: color-mix(
      in srgb,
      var(--theme-accent) 18%,
      var(--theme-card-bg)
    );
    color: var(--theme-text);
  }
  .hint {
    font-size: var(--font-size-compact, 0.8125rem);
    text-transform: capitalize;
  }
  .advanced {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.25rem 0.75rem;
    padding-top: 0.625rem;
    border-top: 1px solid var(--theme-stroke);
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
    font-size: 0.75rem;
  }
  @container (min-width: 48rem) and (min-height: 34rem) {
    .starter {
      top: 10rem;
      max-height: calc(100% - 11rem);
    }
  }
  @container (max-width: 36rem) {
    .starter {
      right: 0.75rem;
      left: 0.75rem;
      width: auto;
    }
  }
  @container (max-width: 24rem) {
    .choice-row {
      grid-template-columns: 1fr;
    }
    .advanced {
      grid-template-columns: 1fr;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .choice-row button {
      transition: none;
    }
  }
</style>
