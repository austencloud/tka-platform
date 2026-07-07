<script lang="ts">
  import type { Component } from "svelte";
  import { buildReaderNav } from "../_data/guide-reader-nav";

  let {
    built,
    activeIndex,
    onSelect,
  }: {
    built: Record<string, Component>;
    activeIndex: number;
    onSelect: (index: number) => void;
  } = $props();

  const rows = $derived(buildReaderNav(built));
</script>

<nav class="reader-nav" aria-label="Guide pages">
  {#each rows as row}
    {#if row.kind === "group"}
      <div class="grp">{row.title}</div>
    {:else if row.kind === "front"}
      <button
        class="row front"
        class:active={activeIndex === row.index}
        onclick={() => onSelect(row.index)}
      >
        {row.title}
      </button>
    {:else}
      <button
        class="row page"
        class:sub={row.level === 1}
        class:active={activeIndex === row.index}
        class:soon={!row.built}
        onclick={() => onSelect(row.index)}
      >
        <span class="t">{row.title}</span>
        {#if !row.built}<span class="tag">soon</span>{/if}
      </button>
    {/if}
  {/each}
</nav>

<style>
  .reader-nav {
    display: flex;
    flex-direction: column;
    padding: 0.75rem 0.5rem;
    gap: 2px;
    overflow-y: auto;
    height: 100%;
    box-sizing: border-box;
  }
  .grp {
    font: 700 0.72rem/1 system-ui, sans-serif;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #9a93ad;
    padding: 0.9rem 0.75rem 0.35rem;
  }
  .row {
    all: unset;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    min-height: 40px;
    padding: 0.35rem 0.75rem;
    border-radius: 6px;
    cursor: pointer;
    color: #2a2440;
    font: 500 0.9rem/1.2 system-ui, sans-serif;
  }
  .row:hover {
    background: rgba(120, 90, 200, 0.08);
  }
  .row.active {
    background: rgba(120, 90, 200, 0.16);
    color: #4a2f8a;
    font-weight: 700;
  }
  .row.front {
    font-style: italic;
    color: #4a4460;
  }
  .row.sub {
    padding-left: 1.35rem;
    font-size: 0.85rem;
  }
  .row.soon {
    color: #a49db4;
  }
  .row .t {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .tag {
    flex: 0 0 auto;
    font: 600 0.62rem/1 system-ui, sans-serif;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #b0366a;
    background: rgba(200, 60, 120, 0.1);
    padding: 2px 6px;
    border-radius: 999px;
  }
</style>
