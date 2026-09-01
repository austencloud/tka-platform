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
    width: min(calc(100% - clamp(24px, 6cqi, 120px)), 1120px);
    min-height: 100%;
    margin: 0 auto;
    padding-block: clamp(28px, 5cqh, 64px);
    box-sizing: border-box;
    display: grid;
    align-content: center;
    gap: clamp(20px, 3cqh, 28px);
  }

  .front-door-header {
    width: 100%;
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
    gap: 10px;
    width: 100%;
  }

  .method-item {
    min-width: 0;
  }

  .method-card {
    position: relative;
    width: 100%;
    min-height: 96px;
    display: grid;
    grid-template-columns: 48px minmax(0, 1fr) 18px;
    align-items: center;
    gap: 18px;
    padding: 16px 20px;
    box-sizing: border-box;
    border: 1px solid
      color-mix(in srgb, var(--method-color) 30%, var(--theme-stroke));
    border-radius: var(--radius-2026-md, 14px);
    background: color-mix(
      in srgb,
      var(--method-color) 11%,
      var(--theme-card-bg)
    );
    color: var(--theme-text);
    text-align: left;
    cursor: pointer;
    transition:
      background-color var(--duration-normal) var(--ease-out),
      border-color var(--duration-normal) var(--ease-out);
  }

  .method-card:hover {
    background: color-mix(
      in srgb,
      var(--method-color) 18%,
      var(--theme-card-bg)
    );
    border-color: color-mix(
      in srgb,
      var(--method-color) 58%,
      var(--theme-stroke-strong)
    );
  }

  .method-card:active {
    background: color-mix(
      in srgb,
      var(--method-color) 22%,
      var(--theme-card-bg)
    );
  }

  .method-card:focus-visible {
    z-index: 1;
    outline: 3px solid
      color-mix(in srgb, var(--method-color) 76%, var(--theme-text));
    outline-offset: 2px;
  }

  .method-icon {
    width: 48px;
    height: 48px;
    display: grid;
    place-items: center;
    border: 1px solid
      color-mix(in srgb, var(--method-color) 42%, var(--theme-stroke));
    border-radius: var(--radius-2026-sm, 10px);
    background: color-mix(
      in srgb,
      var(--method-color) 20%,
      var(--theme-card-bg)
    );
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
    color: color-mix(
      in srgb,
      var(--method-color) 68%,
      var(--theme-text-dim)
    );
    font-size: 0.85rem;
    transition: color var(--duration-normal) var(--ease-out);
  }

  .method-card:hover .open-indicator {
    color: var(--method-color);
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

    .method-index {
      gap: 8px;
    }

    .method-card {
      min-height: 88px;
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

  @media (max-height: 640px) and (min-width: 760px) {
    .front-door-inner {
      width: min(calc(100% - 28px), 1120px);
      gap: 8px;
      padding-block: 6px 8px;
    }

    h1 {
      font-size: var(--font-size-3xl, 1.875rem);
    }

    .method-index {
      gap: 6px;
    }

    .method-card {
      min-height: 64px;
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
