<script lang="ts">
  import { onMount } from "svelte";
  import type { Section } from "$lib/shared/navigation/domain/types";
  import type { CreateFrontDoorSource } from "$lib/shared/navigation/state/navigation-state.svelte";
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import CreateMethodDiagram from "./CreateMethodDiagram.svelte";
  import {
    getCreateMethodPresentation,
    orderCreateMethods,
  } from "../domain/create-method-presentations";
  import {
    logCreateFrontDoorViewed,
    logCreateMethodSelected,
  } from "../services/create-entry-analytics";

  let {
    methods,
    active,
    source,
    lastUsedMode = null,
    onSelect,
  }: {
    methods: Section[];
    active: boolean;
    source: CreateFrontDoorSource;
    lastUsedMode?: string | null;
    onSelect: (methodId: string) => void;
  } = $props();

  const orderedMethods = $derived(orderCreateMethods(methods));
  const hasFiveMethods = $derived(orderedMethods.length === 5);
  let wasActive = false;
  let haptics: ReturnType<typeof getHapticFeedback> | null = null;

  onMount(() => {
    try {
      haptics = getHapticFeedback();
    } catch {
      // A browser without haptics still gets the complete button interaction.
    }
  });

  $effect(() => {
    if (active && !wasActive) {
      logCreateFrontDoorViewed({
        source,
        methodCount: orderedMethods.length,
      });
    }
    wasActive = active;
  });

  function selectMethod(methodId: string, trigger: HTMLButtonElement): void {
    haptics?.trigger("selection");
    logCreateMethodSelected({
      method: methodId,
      source,
      isLastUsed: methodId === lastUsedMode,
    });
    trigger.blur();
    onSelect(methodId);
  }
</script>

<section class="front-door" aria-labelledby="create-front-door-title">
  <div class="front-door-inner">
    <header class="front-door-header">
      <p class="eyebrow">Create</p>
      <h1 id="create-front-door-title">What do you want to create?</h1>
      <p class="introduction">
        Pick the kind of starting point you want. You can switch methods at any
        time.
      </p>
    </header>

    <div
      class="method-grid"
      class:five-methods={hasFiveMethods}
      role="list"
      aria-label="Creation methods"
    >
      {#each orderedMethods as method (method.id)}
        {@const presentation = getCreateMethodPresentation(method.id)}
        {#if presentation}
          <div class="method-item" role="listitem">
            <button
              type="button"
              class="method-card"
              data-method-id={method.id}
              style:--method-color={method.color ?? "var(--theme-accent)"}
              style:--method-gradient={method.gradient ?? method.color}
              onclick={(event) => selectMethod(method.id, event.currentTarget)}
            >
              <div class="method-visual">
                <CreateMethodDiagram kind={presentation.diagram} />
              </div>

              <div class="method-copy">
                <div class="method-heading-row">
                  <span class="method-icon" aria-hidden="true">
                    {@html method.icon}
                  </span>
                  <span class="method-intent">{presentation.intent}</span>
                  {#if method.id === lastUsedMode}
                    <span class="last-used">Last used</span>
                  {/if}
                </div>
                <h2>{method.label}</h2>
                <p>{method.description}</p>
              </div>

              <span class="open-indicator" aria-hidden="true">
                <i class="fas fa-arrow-right"></i>
              </span>
            </button>
          </div>
        {/if}
      {/each}
    </div>
  </div>
</section>

<style>
  .front-door {
    width: 100%;
    height: 100%;
    overflow: auto;
    container: create-entry / size;
    background:
      radial-gradient(
        circle at 50% -16%,
        color-mix(in srgb, var(--theme-accent) 13%, transparent),
        transparent 43%
      ),
      transparent;
  }

  .front-door-inner {
    width: min(calc(100% - clamp(28px, 5cqi, 112px)), 1760px);
    min-height: 100%;
    margin: 0 auto;
    padding: clamp(28px, 5cqh, 72px) 0 clamp(30px, 6cqh, 88px);
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: clamp(22px, 3.2cqh, 42px);
  }

  .front-door-header {
    width: min(100%, 780px);
    margin-inline: auto;
    text-align: center;
  }

  .eyebrow {
    margin: 0 0 6px;
    color: var(--theme-accent);
    font-size: var(--font-size-min, 14px);
    font-weight: 750;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  h1 {
    margin: 0;
    font-family: "Playfair Display", Georgia, serif;
    font-size: clamp(2rem, 4.2cqi, 4.4rem);
    font-weight: 600;
    line-height: 1.05;
    letter-spacing: -0.025em;
    color: var(--theme-text);
    text-wrap: balance;
  }

  .introduction {
    margin: clamp(10px, 1.5cqh, 18px) auto 0;
    max-width: 590px;
    color: var(--theme-text-dim);
    font-size: clamp(var(--font-size-min, 14px), 1.25cqi, 1.08rem);
    line-height: 1.5;
    text-wrap: balance;
  }

  .method-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: clamp(14px, 1.8cqi, 26px);
    width: 100%;
  }

  .method-item {
    min-width: 0;
  }

  .method-card {
    position: relative;
    width: 100%;
    min-height: clamp(178px, 25cqh, 260px);
    display: grid;
    grid-template-columns: minmax(150px, 0.8fr) minmax(0, 1.2fr);
    align-items: stretch;
    gap: clamp(14px, 1.8cqi, 24px);
    padding: clamp(14px, 1.65cqi, 24px);
    box-sizing: border-box;
    overflow: hidden;
    border: 1px solid
      color-mix(in srgb, var(--method-color) 28%, var(--theme-stroke));
    border-radius: clamp(18px, 1.6cqi, 26px);
    background: linear-gradient(
      145deg,
      color-mix(in srgb, var(--method-color) 7%, var(--theme-card-bg)) 0%,
      color-mix(in srgb, var(--theme-card-bg) 95%, transparent) 72%
    );
    box-shadow:
      0 16px 40px rgba(0, 0, 0, 0.14),
      inset 0 1px 0 color-mix(in srgb, #fff 5%, transparent);
    color: var(--theme-text);
    text-align: left;
    cursor: pointer;
    isolation: isolate;
    transition:
      transform var(--duration-normal) var(--ease-out),
      border-color var(--duration-normal) ease,
      box-shadow var(--duration-normal) ease,
      background-color var(--duration-normal) ease;
  }

  .method-card::before {
    content: "";
    position: absolute;
    inset: 0 auto 0 0;
    width: 4px;
    background: var(--method-gradient);
    opacity: 0.86;
  }

  .method-card:hover {
    transform: translateY(-4px);
    border-color: color-mix(
      in srgb,
      var(--method-color) 62%,
      var(--theme-stroke)
    );
    box-shadow:
      0 22px 50px rgba(0, 0, 0, 0.2),
      0 0 28px color-mix(in srgb, var(--method-color) 9%, transparent);
  }

  .method-card:active {
    transform: translateY(-1px) scale(0.995);
  }

  .method-card:focus-visible {
    outline: 3px solid color-mix(in srgb, var(--method-color) 78%, #fff);
    outline-offset: 3px;
  }

  .method-visual {
    min-width: 0;
    min-height: 0;
  }

  .method-copy {
    min-width: 0;
    align-self: center;
    padding-right: clamp(28px, 3cqi, 42px);
  }

  .method-heading-row {
    min-height: 24px;
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 7px;
  }

  .method-icon {
    flex: 0 0 auto;
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    color: var(--method-color);
    font-size: 0.9rem;
  }

  .method-intent {
    min-width: 0;
    overflow: hidden;
    color: color-mix(in srgb, var(--method-color) 78%, var(--theme-text));
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
    line-height: 1.2;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .last-used {
    flex: 0 0 auto;
    margin-left: auto;
    padding: 4px 8px;
    border: 1px solid color-mix(in srgb, var(--method-color) 35%, transparent);
    border-radius: 999px;
    background: color-mix(in srgb, var(--method-color) 11%, transparent);
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact, 12px);
    font-weight: 650;
    line-height: 1;
  }

  h2 {
    margin: 0;
    color: var(--theme-text);
    font-size: clamp(1.35rem, 2.2cqi, 2rem);
    font-weight: 740;
    line-height: 1.12;
  }

  .method-copy p {
    margin: 8px 0 0;
    color: var(--theme-text-dim);
    font-size: var(--font-size-min, 14px);
    line-height: 1.46;
    text-wrap: pretty;
  }

  .open-indicator {
    position: absolute;
    right: clamp(14px, 1.5cqi, 22px);
    bottom: clamp(14px, 1.5cqi, 22px);
    width: 34px;
    height: 34px;
    display: grid;
    place-items: center;
    border: 1px solid color-mix(in srgb, var(--method-color) 38%, transparent);
    border-radius: 50%;
    background: color-mix(in srgb, var(--method-color) 10%, transparent);
    color: var(--method-color);
    transition: transform var(--duration-normal) var(--ease-out);
  }

  .method-card:hover .open-indicator {
    transform: translateX(3px);
  }

  @container create-entry (min-width: 1680px) {
    .front-door-inner {
      width: min(calc(100% - clamp(28px, 5cqi, 112px)), 2200px);
      max-width: none;
    }

    .method-grid:not(.five-methods) {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }

    .method-grid:not(.five-methods) .method-card {
      min-height: clamp(310px, 42cqh, 500px);
      grid-template-columns: 1fr;
      grid-template-rows: minmax(130px, 1fr) auto;
    }

    .method-grid.five-methods {
      grid-template-columns: repeat(6, minmax(0, 1fr));
    }

    .method-grid.five-methods .method-item {
      grid-column: span 2;
    }

    .method-grid.five-methods .method-item:nth-child(4) {
      grid-column: 2 / span 2;
    }

    .method-grid.five-methods .method-item:nth-child(5) {
      grid-column: 4 / span 2;
    }
  }

  @container create-entry (max-width: 720px) {
    .front-door-inner {
      width: min(calc(100% - 24px), 620px);
      justify-content: flex-start;
      gap: 18px;
      padding-block: 20px 28px;
    }

    .front-door-header {
      text-align: left;
    }

    h1 {
      font-size: clamp(1.75rem, 9cqi, 2.65rem);
    }

    .introduction {
      margin-left: 0;
      text-wrap: pretty;
    }

    .method-grid {
      grid-template-columns: 1fr;
      gap: 12px;
    }

    .method-card {
      min-height: 126px;
      grid-template-columns: clamp(86px, 27cqi, 112px) minmax(0, 1fr);
      gap: 12px;
      padding: 12px;
      border-radius: 18px;
    }

    .method-copy {
      padding-right: 28px;
    }

    .method-heading-row {
      margin-bottom: 3px;
    }

    .method-icon {
      display: none;
    }

    .method-intent {
      font-size: var(--font-size-compact, 12px);
    }

    .last-used {
      position: absolute;
      top: 18px;
      left: 28px;
      margin-left: 0;
    }

    h2 {
      font-size: 1.28rem;
    }

    .method-copy p {
      margin-top: 4px;
      display: -webkit-box;
      overflow: hidden;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
    }

    .open-indicator {
      right: 10px;
      bottom: 10px;
      width: 30px;
      height: 30px;
    }

    .method-grid.five-methods .method-item:last-child {
      width: 100%;
    }
  }

  @container create-entry (min-width: 721px) and (max-width: 1000px) {
    .method-heading-row {
      min-height: 34px;
      align-items: flex-start;
    }

    .method-intent {
      overflow: visible;
      text-overflow: clip;
      white-space: normal;
      text-wrap: balance;
    }

    .last-used {
      position: absolute;
      top: 14px;
      right: 14px;
    }
  }

  @container create-entry (max-height: 520px) and (min-width: 721px) {
    .front-door-inner {
      width: min(calc(100% - 36px), 1320px);
      justify-content: flex-start;
      gap: 14px;
      padding-block: 14px 18px;
    }

    .eyebrow {
      display: none;
    }

    h1 {
      font-size: clamp(1.7rem, 3.4cqh, 2.25rem);
    }

    .introduction {
      margin-top: 5px;
      line-height: 1.3;
    }

    .method-grid,
    .method-grid:not(.five-methods) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }

    .method-card,
    .method-grid:not(.five-methods) .method-card {
      min-height: 112px;
      grid-template-columns: 128px minmax(0, 1fr);
      grid-template-rows: 1fr;
      padding: 10px;
      gap: 12px;
      border-radius: 16px;
    }

    .method-heading-row {
      margin-bottom: 2px;
    }

    .method-copy p {
      margin-top: 3px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .method-grid.five-methods .method-item {
      grid-column: auto;
    }

    .method-grid.five-methods .method-item:last-child {
      grid-column: 1 / -1;
      width: calc(50% - 5px);
      justify-self: center;
    }
  }

  @media (min-width: 2600px) {
    .front-door-inner {
      width: min(calc(100% - clamp(28px, 5cqi, 112px)), 2700px);
      max-width: none;
    }

    .method-card {
      border-width: 2px;
    }

    .method-grid:not(.five-methods) .method-card {
      min-height: clamp(580px, 36cqh, 760px);
    }

    .method-copy p,
    .method-intent,
    .eyebrow {
      font-size: 1.05rem;
    }

    .last-used {
      font-size: 0.9rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .method-card,
    .open-indicator {
      transition: none;
    }

    .method-card:hover,
    .method-card:active,
    .method-card:hover .open-indicator {
      transform: none;
    }
  }
</style>
