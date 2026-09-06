<script lang="ts">
  import {
    ARCHIVE_ENTRIES,
    archiveLane,
    type ArchiveEntry,
  } from "./_lib/archive-ledger";
  let {
    activeEntryId,
    onselect,
  }: { activeEntryId: string; onselect: (entry: ArchiveEntry) => void } =
    $props();
</script>

<nav
  aria-label="History entries in chronological order"
  class="chronological-index"
>
  <ol>
    {#each ARCHIVE_ENTRIES as entry (entry.id)}
      <li>
        <a
          href={`#archive-record-${entry.id}`}
          aria-current={entry.id === activeEntryId ? "true" : undefined}
          onclick={(event) => {
            if (
              event.ctrlKey ||
              event.metaKey ||
              event.shiftKey ||
              event.altKey
            )
              return;
            event.preventDefault();
            onselect(entry);
          }}
        >
          <span class="entry-date">{entry.dateLabel}</span>
          <strong>{entry.title}</strong>
          <span class="entry-category">{archiveLane(entry.lane).label}</span>
        </a>
      </li>
    {/each}
  </ol>
</nav>

<style>
  ol {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 0.2rem;
  }
  a {
    display: grid;
    gap: 0.2rem;
    padding: 0.75rem 0.85rem;
    border-radius: var(--radius-2026-md, 14px);
    color: var(--theme-text);
    text-decoration: none;
    border: 1px solid transparent;
  }
  a:hover {
    background: var(--theme-hover-bg, oklch(1 0 0 / 0.04));
  }
  a[aria-current="true"] {
    background: color-mix(
      in oklch,
      var(--theme-accent) 10%,
      var(--theme-card-bg)
    );
    border-color: color-mix(
      in oklch,
      var(--theme-accent) 40%,
      var(--theme-stroke)
    );
  }
  a:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }
  strong {
    font-size: 0.9375rem;
    line-height: 1.35;
    font-weight: 600;
    overflow-wrap: anywhere;
  }
  .entry-date {
    font-size: var(--font-size-compact, 0.75rem);
    font-variant-numeric: tabular-nums;
    color: var(--theme-text-dim);
  }
  .entry-category {
    font-size: var(--font-size-compact, 0.75rem);
    color: var(--theme-text-dim);
    line-height: 1.4;
  }
</style>
