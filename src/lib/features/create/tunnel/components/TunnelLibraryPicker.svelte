<script lang="ts">
  import PanelHeader from "$lib/shared/create/components/PanelHeader.svelte";
  import PanelButton from "$lib/shared/components/panel/PanelButton.svelte";
  import PanelSpinner from "$lib/shared/components/panel/PanelSpinner.svelte";
  import TkaLabel from "$lib/shared/components/TkaLabel.svelte";
  import type { CollectedTunnel } from "$lib/features/tunnel-collection/domain/tunnel-collection-types";
  import { needsTunnelPosterRefresh } from "$lib/features/tunnel-collection/domain/tunnel-artifact-migration";
  import { imageCount } from "$lib/shared/sequence-viewer/tunnel/tunnel-config";

  let {
    items,
    loading = false,
    activeTunnelId = null,
    onSelect,
    onNew,
    onManage,
    onClose,
  }: {
    items: readonly CollectedTunnel[];
    loading?: boolean;
    activeTunnelId?: string | null;
    onSelect: (tunnel: CollectedTunnel) => void;
    onNew: () => void;
    onManage: () => void;
    onClose: () => void;
  } = $props();

  let query = $state("");
  const orderedItems = $derived(
    [...items].sort(
      (a, b) =>
        (b.currentRevisionCreatedAt ?? b.createdAt) -
        (a.currentRevisionCreatedAt ?? a.createdAt)
    )
  );
  const visibleItems = $derived.by(() => {
    const needle = query.trim().toLocaleLowerCase();
    return needle
      ? orderedItems.filter((item) =>
          item.name.toLocaleLowerCase().includes(needle)
        )
      : orderedItems;
  });

  function authoredCount(tunnel: CollectedTunnel): number {
    return tunnel.composition?.performers.length ?? 1;
  }

  function savedLabel(tunnel: CollectedTunnel): string {
    return new Date(
      tunnel.currentRevisionCreatedAt ?? tunnel.createdAt
    ).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
</script>

<section class="tunnel-library" aria-label="Your tunnels">
  <PanelHeader
    title="Your tunnels"
    subtitle={`${items.length} saved`}
    {onClose}
  />

  <div class="library-toolbar">
    <label class="search-field">
      <i class="fas fa-magnifying-glass" aria-hidden="true"></i>
      <span class="sr-only">Search your tunnels</span>
      <input
        type="search"
        bind:value={query}
        placeholder="Search tunnels"
        autocomplete="off"
      />
      {#if query}
        <button
          type="button"
          class="clear-search"
          onclick={() => (query = "")}
          aria-label="Clear tunnel search"
        >
          <i class="fas fa-xmark" aria-hidden="true"></i>
        </button>
      {/if}
    </label>

    <PanelButton
      variant="primary"
      onclick={onNew}
      ariaLabel="Start a new tunnel"
    >
      <i class="fas fa-plus" aria-hidden="true"></i>
      New tunnel
    </PanelButton>
  </div>

  <div class="library-scroll themed-scrollbar">
    {#if loading && items.length === 0}
      <div class="library-state" role="status">
        <PanelSpinner size={12} />
        <strong>Loading your tunnels</strong>
      </div>
    {:else if items.length === 0}
      <div class="library-state">
        <i class="fas fa-fan state-icon" aria-hidden="true"></i>
        <strong>No saved tunnels yet</strong>
        <p>Build one here, open it in the viewer, then save it.</p>
      </div>
    {:else if visibleItems.length === 0}
      <div class="library-state" role="status">
        <i class="fas fa-magnifying-glass state-icon" aria-hidden="true"></i>
        <strong>No matching tunnels</strong>
        <p>Try another name.</p>
      </div>
    {:else}
      <div class="library-grid" aria-label="Saved tunnels">
        {#each visibleItems as tunnel (tunnel.id)}
          {@const active = tunnel.id === activeTunnelId}
          {@const performers = authoredCount(tunnel)}
          {@const instances = imageCount(tunnel.snapshot.tunnel.config)}
          <button
            type="button"
            class="tunnel-card"
            class:active
            onclick={() => onSelect(tunnel)}
            aria-label={`${active ? "Currently editing" : "Edit"} ${tunnel.name}; ${performers} authored performers, ${instances} rendered instances`}
            aria-current={active ? "true" : undefined}
          >
            <span class="poster-frame">
              {#if tunnel.poster}
                <img src={tunnel.poster} alt="" loading="lazy" />
              {:else}
                <i class="fas fa-fan poster-fallback" aria-hidden="true"></i>
              {/if}
              {#if active}
                <span class="active-badge">
                  <i class="fas fa-pen" aria-hidden="true"></i>
                  Editing
                </span>
              {/if}
            </span>

            <span class="tunnel-copy">
              <span class="tunnel-name">
                <TkaLabel text={tunnel.name} darkMode />
              </span>
              <span class="tunnel-meta">
                {performers} authored · {instances} rendered
              </span>
              <span class="saved-date">Saved {savedLabel(tunnel)}</span>
              {#if needsTunnelPosterRefresh(tunnel)}
                <span class="poster-status">
                  <i class="fas fa-arrows-rotate" aria-hidden="true"></i>
                  Saved preview may be outdated
                </span>
              {/if}
            </span>

            <span class="open-cue" aria-hidden="true">
              <i class={`fas ${active ? "fa-check" : "fa-chevron-right"}`}></i>
            </span>
          </button>
        {/each}
      </div>
    {/if}
  </div>

  <footer class="library-footer">
    <PanelButton
      variant="secondary"
      onclick={onManage}
      ariaLabel="Manage tunnels in Browse"
    >
      <i class="fas fa-table-cells-large" aria-hidden="true"></i>
      Manage in Browse
    </PanelButton>
    <p>Rename, publish, connect footage, or delete from Browse.</p>
  </footer>
</section>

<style>
  .tunnel-library {
    container: tunnel-library / inline-size;
    display: grid;
    grid-template-rows: auto auto minmax(0, 1fr) auto;
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
    color: var(--theme-text);
    background: var(--theme-panel-bg);
  }

  .library-toolbar,
  .library-footer {
    display: flex;
    align-items: center;
    gap: var(--settings-spacing-sm, 8px);
    padding: var(--settings-spacing-md, 14px);
    border-bottom: 1px solid var(--theme-stroke);
    background: var(--theme-card-bg);
  }

  .library-toolbar :global(.panel-btn) {
    flex: 0 0 auto;
  }

  .search-field {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    flex: 1 1 auto;
    min-width: 0;
    min-height: var(--min-touch-target, 48px);
    padding-inline: 12px 4px;
    border: 1px solid var(--theme-stroke);
    border-radius: var(--settings-radius-sm, 10px);
    color: var(--theme-text-dim);
    background: var(--theme-panel-bg);
  }

  .search-field:focus-within {
    border-color: var(--theme-accent);
    box-shadow: 0 0 0 2px
      color-mix(in srgb, var(--theme-accent) 22%, transparent);
  }

  .search-field input {
    width: 100%;
    min-width: 0;
    height: 100%;
    padding: 0 10px;
    border: 0;
    outline: 0;
    color: var(--theme-text);
    background: transparent;
    font: inherit;
    font-size: var(--font-size-min, 14px);
  }

  .search-field input::placeholder {
    color: var(--theme-text-dim);
  }

  .clear-search {
    display: grid;
    width: var(--min-touch-target, 44px);
    height: var(--min-touch-target, 44px);
    padding: 0;
    place-items: center;
    border: 0;
    border-radius: var(--settings-radius-sm, 8px);
    color: var(--theme-text-dim);
    background: transparent;
    cursor: pointer;
  }

  .clear-search:hover {
    color: var(--theme-text);
    background: var(--theme-card-hover-bg);
  }

  .clear-search:focus-visible,
  .tunnel-card:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  .library-scroll {
    min-width: 0;
    min-height: 0;
    padding: var(--settings-spacing-md, 14px);
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .library-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--settings-spacing-sm, 8px);
  }

  .tunnel-card {
    display: grid;
    grid-template-columns: 6.25rem minmax(0, 1fr) var(--min-touch-target, 44px);
    align-items: center;
    gap: var(--settings-spacing-md, 14px);
    width: 100%;
    min-width: 0;
    min-height: 7.5rem;
    padding: 10px 8px 10px 10px;
    border: 1px solid var(--theme-stroke);
    border-radius: var(--settings-radius-md, 14px);
    color: inherit;
    background: var(--theme-card-bg);
    text-align: left;
    cursor: pointer;
    transition:
      border-color var(--duration-fast, 150ms) var(--ease-out, ease),
      background var(--duration-fast, 150ms) var(--ease-out, ease),
      transform var(--duration-fast, 150ms) var(--ease-out, ease);
  }

  .tunnel-card:hover {
    border-color: color-mix(
      in srgb,
      var(--theme-accent) 48%,
      var(--theme-stroke)
    );
    background: var(--theme-card-hover-bg);
    transform: translateY(-1px);
  }

  .tunnel-card.active {
    border-color: color-mix(
      in srgb,
      var(--theme-accent) 72%,
      var(--theme-stroke)
    );
    background: color-mix(
      in srgb,
      var(--theme-accent) 9%,
      var(--theme-card-bg)
    );
  }

  .poster-frame {
    position: relative;
    display: grid;
    width: 6.25rem;
    aspect-ratio: 1;
    place-items: center;
    overflow: hidden;
    border: 1px solid var(--theme-stroke);
    border-radius: var(--settings-radius-sm, 10px);
    background: #000;
  }

  .poster-frame img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .poster-fallback {
    color: var(--theme-text-dim);
    font-size: 2rem;
  }

  .active-badge {
    position: absolute;
    right: 5px;
    bottom: 5px;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    min-height: 1.5rem;
    padding: 2px 6px;
    border: 1px solid color-mix(in srgb, var(--theme-accent) 55%, transparent);
    border-radius: 999px;
    color: var(--theme-text);
    background: color-mix(in srgb, var(--theme-panel-bg) 88%, transparent);
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
  }

  .tunnel-copy {
    display: grid;
    gap: 4px;
    min-width: 0;
  }

  .tunnel-name {
    display: block;
    min-width: 0;
    overflow: hidden;
    color: var(--theme-text);
    font-size: var(--font-size-min, 14px);
    font-weight: 750;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tunnel-meta,
  .saved-date,
  .poster-status,
  .library-footer p,
  .library-state p {
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact, 12px);
    line-height: 1.35;
  }

  .poster-status {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    color: var(--theme-accent);
  }

  .open-cue {
    display: grid;
    width: var(--min-touch-target, 44px);
    height: var(--min-touch-target, 44px);
    place-items: center;
    color: var(--theme-text-dim);
  }

  .tunnel-card.active .open-cue {
    color: var(--theme-accent);
  }

  .library-state {
    display: grid;
    align-content: center;
    justify-items: center;
    gap: var(--settings-spacing-sm, 8px);
    min-height: 18rem;
    padding: var(--settings-spacing-xl, 28px);
    color: var(--theme-text-dim);
    text-align: center;
  }

  .library-state strong {
    color: var(--theme-text);
    font-size: var(--font-size-min, 14px);
  }

  .library-state p,
  .library-footer p {
    margin: 0;
  }

  .state-icon {
    font-size: 2rem;
    opacity: 0.75;
  }

  .library-footer {
    align-items: flex-start;
    flex-direction: column;
    border-top: 1px solid var(--theme-stroke);
    border-bottom: 0;
  }

  .library-footer :global(.panel-btn) {
    width: 100%;
  }

  @container tunnel-library (min-width: 46rem) {
    .library-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .tunnel-card {
      grid-template-columns: 5.25rem minmax(0, 1fr) var(
          --min-touch-target,
          44px
        );
    }

    .poster-frame {
      width: 5.25rem;
    }
  }

  @container tunnel-library (max-width: 25rem) {
    .library-toolbar {
      align-items: stretch;
      flex-direction: column;
    }

    .library-toolbar :global(.panel-btn) {
      width: 100%;
    }

    .tunnel-card {
      grid-template-columns: 4.5rem minmax(0, 1fr) var(--min-touch-target, 44px);
      gap: var(--settings-spacing-sm, 8px);
      min-height: 6rem;
      padding-left: 8px;
    }

    .poster-frame {
      width: 4.5rem;
    }

    .active-badge {
      width: 1.6rem;
      padding: 0;
      justify-content: center;
      font-size: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .tunnel-card {
      transition: none;
    }
  }
</style>
