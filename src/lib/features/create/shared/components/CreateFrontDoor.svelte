<script lang="ts">
  import { onMount } from "svelte";
  import type { Section } from "$lib/shared/navigation/domain/types";
  import type { CreateFrontDoorSource } from "$lib/shared/navigation/state/navigation-state.svelte";
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import {
    logCreateFrontDoorViewed,
    logCreateMethodSelected,
  } from "../services/create-entry-analytics";

  const METHOD_ORDER = new Map([
    ["construct", 0],
    ["generate", 1],
    ["fuse", 2],
    ["tunnel", 3],
    ["assemble", 4],
  ]);

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

  const orderedMethods = $derived(
    [...methods].sort(
      (a, b) =>
        (METHOD_ORDER.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
        (METHOD_ORDER.get(b.id) ?? Number.MAX_SAFE_INTEGER)
    )
  );
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
      <h1 id="create-front-door-title">How do you want to create?</h1>
    </header>

    <div
      class="method-grid"
      class:five-methods={hasFiveMethods}
      role="list"
      aria-label="Creation methods"
    >
      {#each orderedMethods as method (method.id)}
        <div class="method-item" role="listitem">
          <button
            type="button"
            class="method-card"
            data-method-id={method.id}
            style:--method-color={method.color ?? "var(--theme-accent)"}
            onclick={(event) => selectMethod(method.id, event.currentTarget)}
          >
            <span class="method-icon" aria-hidden="true">
              {@html method.icon}
            </span>

            <span class="method-copy">
              <span class="method-name">{method.label}</span>
              {#if method.description}
                <span class="method-description">{method.description}</span>
              {/if}
            </span>

            {#if method.id === lastUsedMode}
              <span class="last-used">Last used</span>
            {/if}

            <span class="open-indicator" aria-hidden="true">
              <i class="fas fa-chevron-right"></i>
            </span>
          </button>
        </div>
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
  }

  .front-door-inner {
    width: min(calc(100% - clamp(28px, 5cqi, 112px)), 1280px);
    min-height: 100%;
    margin: 0 auto;
    padding-block: clamp(28px, 5cqh, 64px);
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: clamp(20px, 3cqh, 32px);
  }

  .front-door-header {
    width: 100%;
  }

  h1 {
    margin: 0;
    color: var(--theme-text);
    font-size: clamp(1.75rem, 2.8cqi, 2.5rem);
    font-weight: 720;
    line-height: 1.12;
    letter-spacing: -0.02em;
  }

  .method-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: clamp(12px, 1.4cqi, 18px);
    width: 100%;
  }

  .method-item {
    min-width: 0;
  }

  .method-card {
    position: relative;
    width: 100%;
    min-height: 118px;
    display: grid;
    grid-template-columns: 48px minmax(0, 1fr) 18px;
    align-items: center;
    gap: 16px;
    padding: 20px;
    box-sizing: border-box;
    overflow: hidden;
    border: 1px solid var(--theme-stroke);
    border-radius: 16px;
    background: var(--theme-card-bg);
    color: var(--theme-text);
    text-align: left;
    cursor: pointer;
    transition:
      transform var(--duration-normal) var(--ease-out),
      border-color var(--duration-normal) ease,
      background-color var(--duration-normal) ease;
  }

  .method-card::before {
    content: "";
    position: absolute;
    inset: 0 auto 0 0;
    width: 3px;
    background: var(--method-color);
  }

  .method-card:hover {
    transform: translateY(-2px);
    border-color: color-mix(
      in srgb,
      var(--method-color) 48%,
      var(--theme-stroke)
    );
    background: color-mix(
      in srgb,
      var(--method-color) 5%,
      var(--theme-card-bg)
    );
  }

  .method-card:active {
    transform: translateY(0);
  }

  .method-card:focus-visible {
    outline: 3px solid color-mix(in srgb, var(--method-color) 78%, #fff);
    outline-offset: 3px;
  }

  .method-icon {
    width: 48px;
    height: 48px;
    display: grid;
    place-items: center;
    border-radius: 12px;
    background: color-mix(in srgb, var(--method-color) 12%, transparent);
    color: var(--method-color);
    font-size: 1.05rem;
  }

  .method-copy {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .method-name {
    color: var(--theme-text);
    font-size: 1.3rem;
    font-weight: 720;
    line-height: 1.15;
  }

  .method-description {
    color: var(--theme-text-dim);
    font-size: var(--font-size-min, 14px);
    line-height: 1.42;
    text-wrap: pretty;
  }

  .last-used {
    position: absolute;
    top: 12px;
    right: 12px;
    padding: 4px 8px;
    border: 1px solid color-mix(in srgb, var(--method-color) 30%, transparent);
    border-radius: 999px;
    background: color-mix(
      in srgb,
      var(--method-color) 10%,
      var(--theme-card-bg)
    );
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact, 12px);
    font-weight: 650;
    line-height: 1;
  }

  .open-indicator {
    display: grid;
    place-items: center;
    color: var(--method-color);
    font-size: 0.85rem;
    transition: transform var(--duration-normal) var(--ease-out);
  }

  .method-card:hover .open-indicator {
    transform: translateX(3px);
  }

  @container create-entry (min-width: 720px) {
    .method-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .method-card {
      min-height: 132px;
    }
  }

  @container create-entry (min-width: 1100px) {
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

  @container create-entry (min-width: 1680px) {
    .front-door-inner {
      width: min(calc(100% - clamp(28px, 5cqi, 112px)), 1800px);
    }

    .method-grid:not(.five-methods) {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
  }

  @container create-entry (min-width: 2600px) {
    .front-door-inner {
      width: min(calc(100% - clamp(28px, 5cqi, 112px)), 2200px);
    }
  }

  @container create-entry (max-width: 520px) {
    .front-door-inner {
      width: calc(100% - 24px);
      justify-content: flex-start;
      gap: 18px;
      padding-block: 20px 28px;
    }

    h1 {
      font-size: 1.75rem;
    }

    .method-grid {
      gap: 10px;
    }

    .method-card {
      min-height: 108px;
      grid-template-columns: 40px minmax(0, 1fr) 14px;
      gap: 12px;
      padding: 14px;
      border-radius: 14px;
    }

    .method-icon {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      font-size: 0.95rem;
    }

    .method-name {
      font-size: 1.15rem;
    }

    .last-used {
      top: 9px;
      right: 9px;
    }
  }

  @container create-entry (max-height: 520px) and (min-width: 521px) {
    .front-door-inner {
      justify-content: flex-start;
      gap: 12px;
      padding-block: 12px 18px;
    }

    h1 {
      font-size: 1.65rem;
    }

    .method-grid,
    .method-grid:not(.five-methods) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }

    .method-card {
      min-height: 96px;
      grid-template-columns: 36px minmax(0, 1fr) 14px;
      gap: 11px;
      padding: 12px;
    }

    .method-icon {
      width: 36px;
      height: 36px;
      border-radius: 9px;
    }

    .method-copy {
      gap: 3px;
    }

    .method-name {
      font-size: 1.1rem;
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
