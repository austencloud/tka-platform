<!--
SettingsDrillPanel.svelte — one-decision-at-a-time settings container.

Root is a list of rows, each showing a setting's current value. Choosing a row
gives that one setting the whole panel, with a back arrow. Nothing else is on
screen while the user decides.

Single column at every size, deliberately. A two-pane variant (list rail +
detail, above a container-width seam) was built and removed: it required the
drawer to grow past 840px, and at that width the detail pane ran ~1300px tall
for a three-row form while the drawer sat 2.75x wider than every sibling drawer
in the same slot. Those siblings cap at 400px. This panel caps at ~620px and
fills its column the way they do.

SCROLLER DISCIPLINE — this component owns it, and nothing inside a detail may
declare a scroller of its own. `.layer-body` is the single `overflow-y: auto`
element. The panel this replaced had four nested candidates, and an expanded
section flex-shrank below its content and clipped 415px against its own
`overflow: hidden` instead of letting the scroller scroll. Children are
`flex: 0 0 auto` for that reason.

Motion is a horizontal push. ONE keyed layer, intro only, no `out:` — two
`{#if}` branches each carrying their own out-transition left the outgoing layer
in the DOM long past its duration (seconds, on light content too), which meant
two scrollers and a stale hit-testable list under the detail. An intro-only
keyed block removes the old layer synchronously, so the stage provably holds
exactly one layer.

Deliberately NOT `<Crossfade>`: that primitive keys on `{#key}` and remounts its
children, and detail bodies here are heavy pictograph grids — the carve-out
named in .claude/rules/crossfade-primitive.md.
-->
<script module lang="ts">
  export type SettingsDrillItem = {
    id: string;
    label: string;
    value: string;
    disabled?: boolean;
    disabledReason?: string;
  };
</script>

<script lang="ts">
  import { fly } from "svelte/transition";
  import { quintOut } from "svelte/easing";
  import { DURATION } from "$lib/shared/transitions/transitions";
  import type { Snippet } from "svelte";
  import SettingsDrillRow from "./SettingsDrillRow.svelte";

  let {
    items,
    selected = $bindable(null),
    detail,
    listHeader,
    onSelect,
  }: {
    items: SettingsDrillItem[];
    /** Currently drilled-into item id, or null for the root list. */
    selected?: string | null;
    /** Renders the body for a given item id. */
    detail: Snippet<[string]>;
    /** Pinned above the list — notes, hints. */
    listHeader?: Snippet;
    onSelect?: (id: string | null) => void;
  } = $props();

  const activeItem = $derived(items.find((i) => i.id === selected) ?? null);

  let reducedMotion = $state(
    typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  $effect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e: MediaQueryListEvent) => {
      reducedMotion = e.matches;
    };
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  });

  // Svelte transitions are JS-driven, so a CSS `transition: none` can't stop
  // them — collapse the duration instead.
  const motionMs = $derived(reducedMotion ? 0 : DURATION.normal);

  // Push slides in from the right, pop slides back in from the left.
  const enterX = $derived(activeItem ? 32 : -32);

  function choose(item: SettingsDrillItem) {
    // A locked row explains itself in place; it never navigates to a detail
    // the user can't act on.
    if (item.disabled) return;
    selected = item.id;
    onSelect?.(item.id);
  }

  function goBack() {
    selected = null;
    onSelect?.(null);
  }
</script>

<div class="drill-panel">
  {#key selected ?? "__root__"}
    <div class="stage">
      <div
        class="layer"
        in:fly={{ x: enterX, duration: motionMs, easing: quintOut }}
      >
        {#if !activeItem}
          {#if listHeader}
            <div class="layer-header">{@render listHeader()}</div>
          {/if}
          <div class="layer-body themed-scrollbar">
            <div class="row-list">
              {#each items as item (item.id)}
                <SettingsDrillRow
                  label={item.label}
                  value={item.value}
                  disabled={item.disabled}
                  disabledReason={item.disabledReason}
                  onclick={() => choose(item)}
                />
              {/each}
            </div>
          </div>
        {:else}
          <div class="layer-header detail-title-row">
            <button
              class="back-button"
              type="button"
              onclick={goBack}
              aria-label="Back to all settings"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                aria-hidden="true"
              >
                <path d="M15 6l-6 6 6 6" />
              </svg>
            </button>
            <h4 class="detail-title">{activeItem.label}</h4>
          </div>
          <div class="layer-body themed-scrollbar">
            {@render detail(activeItem.id)}
          </div>
        {/if}
      </div>
    </div>
  {/key}
</div>

<style>
  .drill-panel {
    flex: 1;
    min-height: 0;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .stage {
    position: relative;
    flex: 1;
    min-height: 0;
  }

  .layer {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .layer-header {
    flex-shrink: 0;
  }

  /* The one scroller. */
  .layer-body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
  }

  /* Content-sized: `flex-shrink: 0` stops a child absorbing its own overflow
     and clipping instead of letting the body scroll; `flex-grow: 0` stops a
     child that declares `flex: 1` for some other host (StyleExpandPanel does,
     from its accordion days) stretching and centering itself in a tall pane. */
  .layer-body > :global(*) {
    flex: 0 0 auto;
  }

  /* Opt-in for a wrapper that should take the remaining height — used by the
     pictograph grids so they can size against it. */
  .layer-body > :global(.drill-fill) {
    flex: 1 1 auto;
    min-height: 0;
    max-width: 100%;
  }

  .row-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .detail-title-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding-bottom: 0.625rem;
    margin-bottom: 0.25rem;
    border-bottom: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
  }

  .detail-title {
    margin: 0;
    font-size: var(--font-size-base, 16px);
    font-weight: 700;
    color: white;
  }

  .back-button {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    /* Negative inline start cancels the extra padding, so a full touch target
       doesn't push the title off the row's own alignment. */
    margin-left: -0.625rem;
    padding: 0;
    background: transparent;
    border: none;
    border-radius: 0.5rem;
    color: rgba(255, 255, 255, 0.85);
    cursor: pointer;
    transition: background var(--duration-normal) ease;
  }

  .back-button:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.1));
  }

  .back-button svg {
    width: 1.25rem;
    height: 1.25rem;
  }

  @media (prefers-reduced-motion: reduce) {
    .back-button {
      transition: none;
    }
  }
</style>
