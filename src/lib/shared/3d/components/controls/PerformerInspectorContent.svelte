<script lang="ts">
  import { getViewer3DContext } from "../../context/viewer-3d-context";
  import type { ViewerControlSink } from "$lib/shared/sequence-viewer/domain/viewer-control-analytics";
  import PerformerHubDetail from "./PerformerHubDetail.svelte";
  import PerformerSpine from "./PerformerSpine.svelte";
  import type {
    PerformerEditSink,
    PerformerHubTab,
  } from "./performer-hub-types";

  interface Props {
    compact?: boolean;
    onSettingChange?: ViewerControlSink;
    /** Forwarded to the detail panel — see PerformerHubDetail's Props. */
    onPerformerEdit?: PerformerEditSink;
  }

  let { compact = false, onSettingChange, onPerformerEdit }: Props = $props();

  const viewer = getViewer3DContext();
  const isAllMode = $derived(viewer.selectedPerformerIndex === null);
  let activeCategory = $state<PerformerHubTab | null>(null);
  let desktopCategory = $state<PerformerHubTab>("prop");

  const categories: {
    id: PerformerHubTab;
    label: string;
    description: string;
    icon: string;
  }[] = [
    {
      id: "avatar",
      label: "Avatar",
      description: "Appearance and performer identity",
      icon: "fa-user",
    },
    {
      id: "sequence",
      label: "Sequence",
      description: "Choose what this performer plays",
      icon: "fa-film",
    },
    {
      id: "prop",
      label: "Prop",
      description: "Prop family, variant, and scale",
      icon: "fa-shapes",
    },
    {
      id: "planes",
      label: "Planes",
      description: "Hand planes and guide visibility",
      icon: "fa-layer-group",
    },
    {
      id: "effort",
      label: "Effort",
      description: "Movement character and energy",
      icon: "fa-gauge-high",
    },
    {
      id: "effects",
      label: "Effects",
      description: "Trails, fire, LEDs, and looks",
      icon: "fa-wand-sparkles",
    },
  ];

  const visibleCategories = $derived(
    isAllMode
      ? categories.filter((category) => category.id !== "sequence")
      : categories
  );

  $effect(() => {
    if (isAllMode && activeCategory === "sequence") activeCategory = null;
    if (isAllMode && desktopCategory === "sequence") desktopCategory = "prop";
  });

  function handleDesktopCategoryKeydown(event: KeyboardEvent): void {
    if (
      !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
    ) {
      return;
    }

    event.preventDefault();
    const currentIndex = visibleCategories.findIndex(
      (category) => category.id === desktopCategory
    );
    const direction = ["ArrowRight", "ArrowDown"].includes(event.key) ? 1 : -1;
    const nextIndex =
      (currentIndex + direction + visibleCategories.length) %
      visibleCategories.length;
    desktopCategory = visibleCategories[nextIndex].id;

    requestAnimationFrame(() => {
      document.getElementById(`hub-tab-${desktopCategory}`)?.focus();
    });
  }
</script>

<div class="performer-inspector" class:compact>
  <div class="scope-row">
    <PerformerSpine hasInteracted={true} {onSettingChange} />
  </div>

  {#if compact}
    {#if activeCategory}
      <div class="drilldown-header">
        <button
          type="button"
          class="back-button"
          onclick={() => (activeCategory = null)}
        >
          <i class="fas fa-chevron-left" aria-hidden="true"></i>
          <span>Performers</span>
        </button>
        <strong
          >{categories.find((item) => item.id === activeCategory)
            ?.label}</strong
        >
      </div>
      <div class="detail-wrap compact-detail">
        <PerformerHubDetail
          activeTab={activeCategory}
          showTabBar={false}
          {onSettingChange}
          {onPerformerEdit}
        />
      </div>
    {:else}
      <div class="category-list" aria-label="Performer control categories">
        {#each visibleCategories as category}
          <button
            type="button"
            class="category-button"
            onclick={() => (activeCategory = category.id)}
          >
            <span class="category-icon" aria-hidden="true">
              <i class="fas {category.icon}"></i>
            </span>
            <span class="category-copy">
              <strong>{category.label}</strong>
              <small>{category.description}</small>
            </span>
            <i class="fas fa-chevron-right category-chevron" aria-hidden="true"
            ></i>
          </button>
        {/each}
      </div>
    {/if}
  {:else}
    <div class="desktop-editor">
      <div
        class="desktop-category-nav"
        role="tablist"
        tabindex="-1"
        aria-label="Performer control categories"
        onkeydown={handleDesktopCategoryKeydown}
      >
        {#each visibleCategories as category}
          <button
            id="hub-tab-{category.id}"
            type="button"
            class="desktop-category-button"
            class:active={desktopCategory === category.id}
            role="tab"
            aria-selected={desktopCategory === category.id}
            aria-controls="hub-panel-{category.id}"
            tabindex={desktopCategory === category.id ? 0 : -1}
            onclick={() => (desktopCategory = category.id)}
          >
            <span class="desktop-category-icon" aria-hidden="true">
              <i class="fas {category.icon}"></i>
            </span>
            <span class="desktop-category-copy">
              <strong>{category.label}</strong>
              <small>{category.description}</small>
            </span>
          </button>
        {/each}
      </div>

      <div class="detail-wrap desktop-detail">
        <PerformerHubDetail
          activeTab={desktopCategory}
          showTabBar={false}
          {onSettingChange}
          {onPerformerEdit}
        />
      </div>
    </div>
  {/if}
</div>

<style>
  .performer-inspector {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    gap: 0.75rem;
    container-type: inline-size;
  }

  .performer-inspector.compact {
    height: 100%;
  }

  .scope-row {
    flex: none;
    overflow-x: auto;
    scrollbar-width: thin;
    padding: 0.125rem 0.125rem 0.375rem;
  }

  .scope-row :global(.performer-spine) {
    flex-direction: row;
    justify-content: flex-start;
    width: max-content;
  }

  .scope-row :global(.separator) {
    width: 1px;
    height: 2rem;
  }

  .detail-wrap {
    display: flex;
    flex: 0 1 auto;
    min-width: 0;
    min-height: 0;
    overflow: visible;
    border: 1px solid var(--theme-stroke);
    border-radius: 0.875rem;
    background: var(--theme-card-bg);
  }

  .detail-wrap :global(.hub-detail) {
    width: 100%;
    height: auto;
  }

  .desktop-editor {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 0.75rem;
  }

  .desktop-category-nav {
    display: grid;
    grid-auto-columns: minmax(7rem, 1fr);
    grid-auto-flow: column;
    gap: 0.5rem;
    overflow-x: auto;
    padding: 0.125rem 0.125rem 0.375rem;
    scrollbar-width: thin;
  }

  .desktop-category-button {
    display: grid;
    min-height: 3.25rem;
    grid-template-columns: 2rem minmax(0, 1fr);
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.625rem;
    border: 1px solid var(--theme-stroke);
    border-radius: 0.75rem;
    background: var(--theme-card-bg);
    color: var(--theme-text-dim);
    cursor: pointer;
    text-align: left;
  }

  .desktop-category-button:hover,
  .desktop-category-button:focus-visible {
    border-color: var(--theme-stroke-strong);
    background: var(--theme-card-hover-bg);
    color: var(--theme-text);
  }

  .desktop-category-button.active {
    border-color: color-mix(in srgb, var(--theme-accent) 58%, transparent);
    background: color-mix(
      in srgb,
      var(--theme-accent) 15%,
      var(--theme-card-bg)
    );
    color: color-mix(in srgb, var(--theme-accent) 72%, #fff);
  }

  .desktop-category-button:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  .desktop-category-icon {
    display: grid;
    width: 2rem;
    height: 2rem;
    place-items: center;
    border-radius: 0.625rem;
    background: color-mix(in srgb, currentColor 12%, transparent);
  }

  .desktop-category-copy {
    display: grid;
    min-width: 0;
    gap: 0.125rem;
  }

  .desktop-category-copy strong {
    overflow: hidden;
    font-size: var(--font-size-min, 0.875rem);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .desktop-category-copy small {
    display: none;
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact, 0.75rem);
    line-height: 1.35;
  }

  .compact .detail-wrap {
    flex: 1;
    overflow: hidden;
  }

  .compact .detail-wrap :global(.hub-detail) {
    height: 100%;
  }

  .drilldown-header {
    display: flex;
    align-items: center;
    min-height: 2.75rem;
    gap: 0.75rem;
  }

  .drilldown-header strong {
    color: var(--theme-text);
    font-size: var(--font-size-min, 0.875rem);
  }

  .back-button,
  .category-button {
    min-height: 2.75rem;
    border: 1px solid var(--theme-stroke);
    background: var(--theme-card-bg);
    color: var(--theme-text);
    cursor: pointer;
  }

  .back-button {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    border-radius: 0.75rem;
    font-size: var(--font-size-min, 0.875rem);
    font-weight: 700;
  }

  .category-list {
    display: grid;
    gap: 0.5rem;
  }

  .category-button {
    display: grid;
    grid-template-columns: 2.75rem minmax(0, 1fr) 1rem;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    padding: 0.625rem 0.75rem;
    border-radius: 0.875rem;
    text-align: left;
  }

  .category-button:hover,
  .category-button:focus-visible,
  .back-button:hover,
  .back-button:focus-visible {
    border-color: var(--theme-stroke-strong);
    background: var(--theme-card-hover-bg);
  }

  .category-button:focus-visible,
  .back-button:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  .category-icon {
    display: grid;
    place-items: center;
    width: 2.75rem;
    height: 2.75rem;
    border-radius: 0.75rem;
    background: color-mix(in srgb, var(--theme-accent) 14%, transparent);
    color: var(--theme-accent);
  }

  .category-copy {
    display: grid;
    gap: 0.125rem;
    min-width: 0;
  }

  .category-copy strong {
    font-size: var(--font-size-min, 0.875rem);
  }

  .category-copy small {
    overflow: hidden;
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact, 0.75rem);
    line-height: 1.35;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .category-chevron {
    color: var(--theme-text-dim);
    font-size: 0.75rem;
  }

  .compact-detail {
    min-height: 20rem;
  }

  @container (min-width: 46rem) {
    .desktop-editor {
      display: grid;
      grid-template-columns: minmax(11rem, 13rem) minmax(0, 1fr);
      align-items: start;
    }

    .desktop-category-nav {
      position: sticky;
      top: 0;
      grid-auto-columns: auto;
      grid-auto-flow: row;
      overflow-x: visible;
      padding-bottom: 0.125rem;
    }

    .desktop-category-button {
      min-height: 4rem;
      grid-template-columns: 2.5rem minmax(0, 1fr);
      gap: 0.625rem;
      padding: 0.625rem;
    }

    .desktop-category-icon {
      width: 2.5rem;
      height: 2.5rem;
    }

    .desktop-category-copy small {
      display: block;
    }
  }

  @media (max-height: 34rem) {
    .compact-detail {
      min-height: 13rem;
    }
  }
</style>
