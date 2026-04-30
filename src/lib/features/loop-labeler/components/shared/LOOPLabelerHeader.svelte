<script lang="ts">
  /**
   * LOOP Labeler Header
   *
   * Header with stats, filter chips, search, and import/export controls.
   * Uses shared design tokens from app.css.
   */
  import { onDestroy } from "svelte";
  import type { SequenceEntry } from "../../domain/models/sequence-models";
  import FontAwesomeIcon from "$lib/shared/foundation/ui/FontAwesomeIcon.svelte";
  import TKAWordGlyph from "$lib/features/choreo-card/components/TKAWordGlyph.svelte";

  type FilterMode = "all" | "needsVerification" | "verified";
  type SyncStatus = "idle" | "syncing" | "synced" | "error";

  interface Stats {
    total: number;
    needsVerification: number;
    verified: number;
  }

  interface Props {
    stats: Stats;
    filterMode: FilterMode;
    onFilterChange: (mode: FilterMode) => void;
    onExportToggle: () => void;
    onExportLabels: () => void;
    onImportFile: (file: File) => void;
    onSyncLocalStorage: () => void;
    showExport: boolean;
    syncStatus: SyncStatus;
    sequences: SequenceEntry[];
    onJumpToSequence: (sequenceId: string) => void;
    onOpenBrowser: () => void;
  }

  let {
    stats,
    filterMode,
    onFilterChange,
    onExportToggle,
    onExportLabels,
    onImportFile,
    onSyncLocalStorage,
    showExport,
    syncStatus,
    sequences,
    onJumpToSequence,
    onOpenBrowser,
  }: Props = $props();

  // Search state
  let searchQuery = $state("");
  let showSuggestions = $state(false);
  let blurTimer: ReturnType<typeof setTimeout> | null = null;

  onDestroy(() => {
    if (blurTimer) clearTimeout(blurTimer);
  });

  // Filter sequences by search query
  const filteredSuggestions = $derived(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return sequences
      .filter((s) => s.word.toLowerCase().includes(query))
      .slice(0, 8);
  });

  function handleSearchInput(e: Event) {
    searchQuery = (e.target as HTMLInputElement).value;
    showSuggestions = true;
  }

  function handleSelectSuggestion(seq: SequenceEntry) {
    onJumpToSequence(seq.id);
    searchQuery = "";
    showSuggestions = false;
  }

  function handleSearchKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      showSuggestions = false;
      searchQuery = "";
    } else if (e.key === "Enter" && filteredSuggestions().length > 0) {
      handleSelectSuggestion(filteredSuggestions()[0]!);
    }
  }

  function handleSearchBlur() {
    if (blurTimer) clearTimeout(blurTimer);
    blurTimer = setTimeout(() => {
      showSuggestions = false;
      blurTimer = null;
    }, 150);
  }

  function handleImportFile(e: Event) {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file) {
      onImportFile(file);
    }
  }
</script>

<header class="header">
  <h1 class="header-title">LOOP Type Labeler</h1>
  <div class="stats">
    <div class="stats-group">
      <span class="stat">{stats.verified} verified</span>
      <span class="stat">{stats.needsVerification} need verification</span>
      <span class="stat">{stats.total} total circular</span>
    </div>
    <span class="stats-divider"></span>
    <span
      class="sync-status"
      class:syncing={syncStatus === "syncing"}
      class:error={syncStatus === "error"}
      aria-live="polite"
      aria-atomic="true"
    >
      {#if syncStatus === "syncing"}
        <FontAwesomeIcon icon="spinner" size="0.85em" /> Syncing...
      {:else if syncStatus === "error"}
        <FontAwesomeIcon icon="exclamation-triangle" size="0.85em" /> Sync error
      {:else}
        <FontAwesomeIcon icon="check" size="0.85em" /> Firebase
      {/if}
    </span>
  </div>
</header>

<div class="controls-bar">
  <!-- Search and Browse -->
  <div class="nav-controls">
    <div class="search-container">
      <FontAwesomeIcon icon="search" size="0.9em" />
      <input
        type="text"
        class="search-input"
        placeholder="Search sequences..."
        aria-label="Search sequences"
        value={searchQuery}
        oninput={handleSearchInput}
        onkeydown={handleSearchKeydown}
        onfocus={() => (showSuggestions = true)}
        onblur={handleSearchBlur}
      />
      {#if showSuggestions && filteredSuggestions().length > 0}
        <div class="search-suggestions">
          {#each filteredSuggestions() as seq}
            <button
              class="suggestion-item"
              onmousedown={() => handleSelectSuggestion(seq)}
            >
              <span class="suggestion-word"><TKAWordGlyph word={seq.word} height={13} darkMode /></span>
              <span class="suggestion-length">{seq.sequenceLength} steps</span>
            </button>
          {/each}
        </div>
      {/if}
    </div>

    <button
      class="browse-btn"
      onclick={onOpenBrowser}
      title="Browse all sequences"
    >
      <FontAwesomeIcon icon="list" size="1em" />
      Browse
    </button>
  </div>

  <div class="io-controls">
    <button class="btn-secondary" onclick={onExportToggle}>
      Import/Export
    </button>
  </div>
</div>

{#if showExport}
  <div class="export-panel">
    <button class="btn-primary" onclick={onExportLabels}>
      <FontAwesomeIcon icon="download" size="0.9em" />
      Export Labels JSON
    </button>
    <label class="btn-secondary">
      <FontAwesomeIcon icon="upload" size="0.9em" />
      Import Labels
      <input
        type="file"
        accept=".json"
        onchange={handleImportFile}
        aria-label="Import labels JSON file"
        class="sr-only"
      />
    </label>
    <button class="btn-sync" onclick={onSyncLocalStorage}>
      <FontAwesomeIcon icon="cloud-arrow-up" size="0.9em" />
      Sync localStorage → Firebase
    </button>
  </div>
{/if}

<style>
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-lg);
    padding: var(--spacing-lg) var(--spacing-lg) var(--spacing-lg)
      var(--spacing-lg);
    border-bottom: 1px solid var(--theme-stroke, var(--theme-stroke));
  }

  .header-title {
    margin: 0;
    font-size: var(--font-size-xl);
    font-weight: 700;
  }

  .stats {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
  }

  .stats-group {
    display: flex;
    gap: var(--spacing-sm);
  }

  .stats-divider {
    width: 1px;
    height: 20px;
    background: var(--theme-stroke);
  }

  .stat {
    background: var(--surface-color);
    padding: var(--spacing-xs) var(--spacing-md);
    border-radius: 6px;
    font-size: var(--font-size-sm);
    color: var(--muted-foreground);
    white-space: nowrap;
  }

  .sync-status {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    padding: var(--spacing-xs) var(--spacing-md);
    border-radius: 6px;
    font-size: var(--font-size-xs);
    background: color-mix(in srgb, var(--semantic-success) 20%, transparent);
    color: var(--semantic-success);
  }

  .sync-status.syncing {
    background: color-mix(in srgb, var(--semantic-warning) 20%, transparent);
    color: var(--semantic-warning);
    animation: pulse 1s infinite;
  }

  .sync-status.error {
    background: color-mix(in srgb, var(--semantic-error) 20%, transparent);
    color: var(--semantic-error);
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.6;
    }
  }

  .controls-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-lg);
    padding: 0 var(--spacing-lg);
    gap: var(--spacing-md);
    flex-wrap: wrap;
  }

  .io-controls {
    display: flex;
    gap: var(--spacing-sm);
  }

  .btn-secondary {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--surface-color);
    border: 1px solid var(--theme-stroke, var(--theme-stroke));
    border-radius: 8px;
    color: var(--foreground);
    cursor: pointer;
    font-size: var(--font-size-sm);
    transition: var(--transition-fast);
    min-height: var(--min-touch-target);
  }

  .btn-secondary:hover {
    background: var(--surface-hover);
  }

  .export-panel {
    display: flex;
    gap: var(--spacing-md);
    margin: 0 var(--spacing-lg) var(--spacing-lg) var(--spacing-lg);
    padding: var(--spacing-md);
    background: var(--surface-glass);
    border: 1px solid var(--theme-stroke);
    border-radius: 12px;
    flex-wrap: wrap;
  }

  .btn-primary {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    border-radius: 8px;
    cursor: pointer;
    font-size: var(--font-size-sm);
    font-weight: 600;
    border: none;
    transition: var(--transition-fast);
    background: var(--gradient-primary);
    color: var(--foreground);
    min-height: var(--min-touch-target);
  }

  .btn-primary:hover {
    transform: translateY(var(--hover-lift-sm));
    box-shadow: 0 4px 12px color-mix(in srgb, var(--primary-color) 40%, transparent);
  }

  .btn-sync {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    background: color-mix(in srgb, var(--semantic-success) 20%, transparent);
    border: 1px solid color-mix(in srgb, var(--semantic-success) 40%, transparent);
    border-radius: 8px;
    color: var(--semantic-success);
    cursor: pointer;
    font-size: var(--font-size-sm);
    font-weight: 600;
    transition: var(--transition-fast);
    min-height: var(--min-touch-target);
  }

  .btn-sync:hover {
    background: color-mix(in srgb, var(--semantic-success) 30%, transparent);
  }

  /* Navigation controls */
  .nav-controls {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  .search-container {
    position: relative;
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--surface-color);
    border: 1px solid var(--theme-stroke, var(--theme-stroke-strong));
    border-radius: 8px;
    color: var(--muted);
  }

  .search-container:focus-within {
    border-color: var(--primary-color);
    background: var(--surface-hover);
  }

  .search-input {
    background: transparent;
    border: none;
    outline: none;
    color: var(--foreground);
    font-size: var(--font-size-sm);
    width: 160px;
  }

  .search-input::placeholder {
    color: var(--muted);
  }

  .search-suggestions {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    margin-top: 4px;
    background: var(--surface-glass);
    border: 1px solid var(--theme-stroke, var(--theme-stroke-strong));
    border-radius: 8px;
    overflow: hidden;
    z-index: 100;
    box-shadow: var(--shadow-elevated);
  }

  .suggestion-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    padding: var(--spacing-sm) var(--spacing-md);
    background: transparent;
    border: none;
    color: var(--foreground);
    cursor: pointer;
    text-align: left;
    transition: var(--transition-micro);
  }

  .suggestion-item:hover {
    background: color-mix(in srgb, var(--primary-color) 20%, transparent);
  }

  .suggestion-word {
    font-weight: 500;
    font-size: var(--font-size-sm);
  }

  .suggestion-length {
    font-size: var(--font-size-xs);
    color: var(--muted);
  }

  .browse-btn {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    background: color-mix(in srgb, var(--primary-color) 20%, transparent);
    border: 1px solid color-mix(in srgb, var(--primary-color) 40%, transparent);
    border-radius: 8px;
    color: color-mix(in srgb, var(--primary-color) 65%, white);
    cursor: pointer;
    font-size: var(--font-size-sm);
    font-weight: 600;
    transition: var(--transition-fast);
    min-height: var(--min-touch-target);
  }

  .browse-btn:hover {
    background: color-mix(in srgb, var(--primary-color) 30%, transparent);
    border-color: color-mix(in srgb, var(--primary-color) 60%, transparent);
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  /* Accessibility: Respect user's motion preferences (WCAG AAA) */
  @media (prefers-reduced-motion: reduce) {
    .syncing {
      animation: none;
    }
  }
</style>
