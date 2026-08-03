<!--
SettingsDrillPanel.svelte — one-decision-at-a-time settings container.

Root is a list of rows, each showing a setting's current value. Choosing a row
gives that one setting the whole panel, with a back arrow. Nothing else is on
screen while the user decides.

Past `wideAt` of its OWN width the panel becomes two-pane: list rail left,
detail right, no back arrow. The seam is the panel's inline size, not the
viewport — this thing lives inside a drawer whose width tracks the generate
panel, so a viewport media query would fire at the wrong moments. It is read
with `bind:clientWidth` rather than an `@container` query because the two modes
need genuinely different DOM (in one-column mode the list must be absent, not
merely hidden, so it can push/pop and can't be tabbed into), and CSS cannot
change what renders.

SCROLLER DISCIPLINE — this component owns it, and nothing inside a detail may
declare a scroller of its own. The detail body is the single `overflow-y: auto`
element on the detail side; the list rail is the single one on the list side.
The panel this replaced had four nested candidates, and an expanded section
flex-shrank below its content and clipped 415px against its own
`overflow: hidden` instead of letting the scroller scroll. Every child here is
`flex-shrink: 0` for that reason.

Motion is a horizontal push/pop, layers absolutely stacked so nothing reflows
mid-transition. Deliberately NOT `<Crossfade>`: that keys on `{#key}` and
remounts its children, and detail bodies here are heavy pictograph grids — the
carve-out named in .claude/rules/crossfade-primitive.md.
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
  import { fly, fade } from "svelte/transition";
  import { quintOut } from "svelte/easing";
  import { DURATION } from "$lib/shared/transitions/transitions";
  import { untrack, type Snippet } from "svelte";
  import SettingsDrillRow from "./SettingsDrillRow.svelte";

  let {
    items,
    selected = $bindable(null),
    detail,
    listHeader,
    emptyDetail,
    wideAt = 840,
    onSelect,
    onWide,
  }: {
    items: SettingsDrillItem[];
    /** Currently drilled-into item id, or null for the root list. */
    selected?: string | null;
    /** Renders the body for a given item id. */
    detail: Snippet<[string]>;
    /** Pinned above the list — panel title, reset, notes. */
    listHeader?: Snippet;
    /** Two-pane placeholder shown when nothing is selected. */
    emptyDetail?: Snippet;
    /** Panel inline size at or above which the layout goes two-pane. */
    wideAt?: number;
    onSelect?: (id: string | null) => void;
    /** Fires when the layout crosses the seam. Lets the caller seed a
        selection so two-pane never opens with an empty detail pane. */
    onWide?: (wide: boolean) => void;
  } = $props();

  let panelWidth = $state(0);
  const isWide = $derived(panelWidth >= wideAt);

  // Report mode changes out. Untracked callback so a caller that sets state in
  // response can't feed back into this effect.
  let lastWide: boolean | null = null;
  $effect(() => {
    const wide = isWide;
    if (wide === lastWide) return;
    lastWide = wide;
    untrack(() => onWide?.(wide));
  });

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

{#snippet rowList()}
  <div class="row-list">
    {#each items as item (item.id)}
      <SettingsDrillRow
        label={item.label}
        value={item.value}
        selected={isWide && item.id === selected}
        disabled={item.disabled}
        disabledReason={item.disabledReason}
        onclick={() => choose(item)}
      />
    {/each}
  </div>
{/snippet}

<div class="drill-panel" class:two-pane={isWide} bind:clientWidth={panelWidth}>
  {#if isWide}
    <div class="list-rail">
      {#if listHeader}
        <div class="rail-header">{@render listHeader()}</div>
      {/if}
      <div class="rail-scroll themed-scrollbar">
        {@render rowList()}
      </div>
    </div>

    <div class="detail-pane">
      {#if activeItem}
        <div class="detail-title-row">
          <h4 class="detail-title">{activeItem.label}</h4>
        </div>
        <!-- Keyed so switching settings replaces the body rather than diffing
             two unrelated trees into each other. -->
        {#key activeItem.id}
          <div
            class="detail-body themed-scrollbar"
            in:fade={{ duration: motionMs }}
          >
            {@render detail(activeItem.id)}
          </div>
        {/key}
      {:else}
        <div class="detail-empty">
          {#if emptyDetail}
            {@render emptyDetail()}
          {:else}
            <p>Pick a setting to change it.</p>
          {/if}
        </div>
      {/if}
    </div>
  {:else}
    <!-- ONE keyed layer, intro only, no `out:`. Two `{#if}` branches each with
         their own out-transition left the outgoing layer in the DOM long after
         its duration — sometimes seconds, on light content too — which meant
         two scrollers and a stale hit-testable list under the detail. An
         intro-only keyed block removes the old layer synchronously, so the
         stage provably holds exactly one layer at all times. -->
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
              {@render rowList()}
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
  {/if}
</div>

<style>
  .drill-panel {
    flex: 1;
    min-height: 0;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  /* ─── One-column: root list and detail push/pop through one stage ─── */

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

  /* The one scroller on this side. Children are never allowed to shrink below
     their content, which is what let the old accordion clip instead of scroll. */
  .layer-body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
  }

  /* Content-sized and top-aligned. `flex-shrink: 0` keeps a child from
     absorbing its own overflow and clipping instead of letting the body
     scroll; `flex-grow: 0` keeps a child that declares `flex: 1` for some
     other host (StyleExpandPanel does, from its accordion days) from
     stretching to a tall detail pane and centering itself in it. */
  .layer-body > :global(*) {
    flex: 0 0 auto;
  }

  /* ─── Two-pane ─── */

  .drill-panel.two-pane {
    flex-direction: row;
    gap: 1rem;
    align-items: stretch;
  }

  /* Fluid, not a fixed 22rem: at a 1039px panel a hard rail left the Style
     summary ellipsised while the detail pane had room to spare. */
  .list-rail {
    flex: 0 0 clamp(20rem, 36%, 30rem);
    min-width: 0;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .rail-header {
    flex-shrink: 0;
  }

  .rail-scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .detail-pane {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    min-height: 0;
    padding-left: 1rem;
    border-left: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
  }

  .detail-body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
  }

  .detail-body > :global(*) {
    flex: 0 0 auto;
    /* A three-row form has no business spanning 1000px just because the pane
       is that wide — it stranded the Blue/Red labels a third of a screen from
       their own controls. The pictograph grid still gets 48rem, which is
       larger than it ever had. */
    max-width: min(100%, 48rem);
  }

  .detail-empty {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-sm, 14px);
  }

  /* ─── Shared bits ─── */

  .row-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .detail-title-row {
    flex-shrink: 0;
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
    /* Visually a compact glyph; the touch floor comes from the negative inline
       margin cancelling the extra padding, so the row keeps its own height. */
    width: var(--min-touch-target);
    height: var(--min-touch-target);
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
