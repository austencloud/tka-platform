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

    <div class="method-index" role="list" aria-label="Creation methods">
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
              <span class="method-heading">
                <span class="method-name">{method.label}</span>
                {#if method.id === lastUsedMode}
                  <span class="last-used">Last used</span>
                {/if}
              </span>
              {#if method.description}
                <span class="method-description">{method.description}</span>
              {/if}
            </span>

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
    width: min(calc(100% - clamp(32px, 5cqi, 96px)), 1560px);
    min-height: 100%;
    margin: 0 auto;
    padding-block: clamp(28px, 5cqh, 64px);
    box-sizing: border-box;
    display: grid;
    align-content: center;
    gap: clamp(24px, 4cqh, 40px);
  }

  .front-door-header {
    max-width: 540px;
  }

  h1 {
    margin: 0;
    color: var(--theme-text);
    font-size: calc(var(--font-size-3xl, 1.875rem) * 1.2);
    font-weight: 720;
    line-height: 1.08;
    letter-spacing: -0.025em;
    text-wrap: balance;
  }

  .method-index {
    display: grid;
    grid-template-columns: 1fr;
    width: 100%;
    overflow: hidden;
    border: 1px solid var(--theme-stroke);
    border-radius: var(--radius-2026-lg, 18px);
    background: var(--theme-panel-bg);
    box-shadow: var(--theme-panel-shadow, 0 10px 30px rgba(0, 0, 0, 0.18));
  }

  .method-item {
    min-width: 0;
  }

  .method-item:not(:last-child) {
    border-bottom: 1px solid var(--theme-stroke);
  }

  .method-card {
    position: relative;
    width: 100%;
    min-height: 102px;
    display: grid;
    grid-template-columns: 48px minmax(0, 1fr) 18px;
    align-items: center;
    gap: 18px;
    padding: 18px 20px;
    box-sizing: border-box;
    border: 0;
    border-radius: 0;
    background: transparent;
    color: var(--theme-text);
    text-align: left;
    cursor: pointer;
    transition:
      background-color var(--duration-normal) var(--ease-out),
      color var(--duration-normal) var(--ease-out);
  }

  .method-card:hover {
    background: color-mix(
      in srgb,
      var(--method-color) 8%,
      var(--theme-card-bg)
    );
  }

  .method-card:focus-visible {
    z-index: 1;
    outline: none;
    box-shadow: inset 0 0 0 3px
      color-mix(in srgb, var(--method-color) 72%, var(--theme-text));
  }

  .method-icon {
    width: 48px;
    height: 48px;
    display: grid;
    place-items: center;
    border: 1px solid
      color-mix(in srgb, var(--method-color) 20%, var(--theme-stroke));
    border-radius: var(--radius-2026-sm, 10px);
    background: color-mix(in srgb, var(--method-color) 12%, transparent);
    color: var(--method-color);
    font-size: var(--font-size-lg, 1.125rem);
  }

  .method-copy {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .method-heading {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4px 12px;
  }

  .method-name {
    color: var(--theme-text);
    font-size: var(--font-size-xl, 1.25rem);
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
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
    line-height: 1.2;
    white-space: nowrap;
  }

  .open-indicator {
    display: grid;
    place-items: center;
    color: var(--theme-text-dim);
    font-size: 0.85rem;
    transition: color var(--duration-normal) var(--ease-out);
  }

  .method-card:hover .open-indicator {
    color: var(--method-color);
  }

  @container create-entry (min-width: 960px) {
    .front-door-inner {
      grid-template-columns: minmax(280px, 0.62fr) minmax(620px, 1.38fr);
      align-items: center;
      gap: clamp(48px, 6cqi, 104px);
    }
  }

  @container create-entry (min-width: 1680px) {
    .front-door-inner {
      width: min(calc(100% - clamp(48px, 5cqi, 120px)), 1900px);
      grid-template-columns: minmax(340px, 0.55fr) minmax(840px, 1.45fr);
    }
  }

  @container create-entry (min-width: 2600px) {
    .front-door-inner {
      width: min(calc(100% - clamp(64px, 5cqi, 160px)), 2300px);
    }
  }

  @container create-entry (max-width: 520px) {
    .front-door-inner {
      width: calc(100% - 20px);
      align-content: start;
      gap: 16px;
      padding-block: 20px 28px;
    }

    h1 {
      font-size: var(--font-size-3xl, 1.875rem);
    }

    .method-card {
      min-height: 92px;
      grid-template-columns: 40px minmax(0, 1fr) 14px;
      gap: 12px;
      padding: 12px 14px;
    }

    .method-icon {
      width: 40px;
      height: 40px;
      font-size: var(--font-size-base, 1rem);
    }

    .method-name {
      font-size: var(--font-size-lg, 1.125rem);
    }
  }

  @media (max-height: 520px) and (min-width: 760px) {
    .front-door-inner {
      width: calc(100% - 28px);
      grid-template-columns: minmax(210px, 0.62fr) minmax(0, 1.38fr);
      align-items: center;
      gap: 24px;
      padding-block: 12px 18px;
    }

    h1 {
      font-size: var(--font-size-3xl, 1.875rem);
    }

    .method-card {
      min-height: 68px;
      grid-template-columns: 36px minmax(0, 1fr) 14px;
      gap: 10px;
      padding: 8px 12px;
    }

    .method-icon {
      width: 36px;
      height: 36px;
      font-size: var(--font-size-base, 1rem);
    }

    .method-copy {
      gap: 2px;
    }

    .method-name {
      font-size: var(--font-size-lg, 1.125rem);
    }

    .method-description {
      line-height: 1.25;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .method-card,
    .open-indicator {
      transition: none;
    }
  }
</style>
