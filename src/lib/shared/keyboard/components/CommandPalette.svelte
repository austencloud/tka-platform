<script lang="ts">
  /**
   * Command Palette Component
   *
   * Searchable command palette (Cmd+K) for quick navigation and actions.
   *
   * Domain: Keyboard Shortcuts - UI
   */

  import { onMount } from "svelte";
  import { getCommandPalette } from "../getCommandPalette";
  import type { CommandPalette } from '$lib/shared/keyboard/services/implementations/CommandPalette'
  import { commandPaletteState } from "../state/command-palette-state.svelte";
  import { keyboardShortcutState } from "../state/keyboard-shortcut-state.svelte";
  import type { CommandPaletteItem } from "../domain/types/keyboard-types";

  // Service
  let paletteService: CommandPalette | null = null;

  // Local state
  let inputElement = $state<HTMLInputElement | null>(null);
  let _dialogElement = $state<HTMLDialogElement | null>(null);

  onMount(async () => {
    try {
      paletteService = getCommandPalette();
    } catch (error) {
      console.error("Failed to resolve command palette:", error);
    }
  });

  // Watch for open state changes
  $effect(() => {
    if (commandPaletteState.isOpen) {
      // Focus the input when opened
      setTimeout(() => {
        inputElement?.focus();
      }, 50);

      // Load initial results (recent commands)
      performSearch("");
    }
  });

  // Perform search when query changes
  $effect(() => {
    const query = commandPaletteState.query;
    if (commandPaletteState.isOpen) {
      performSearch(query);
    }
  });

  function performSearch(query: string) {
    if (!paletteService) return;

    commandPaletteState.setLoading(true);

    try {
      const results = paletteService.search(query);
      commandPaletteState.setResults(results);
    } catch (error) {
      console.error("Search failed:", error);
      commandPaletteState.setResults([]);
    } finally {
      commandPaletteState.setLoading(false);
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        commandPaletteState.selectNext();
        break;
      case "ArrowUp":
        event.preventDefault();
        commandPaletteState.selectPrevious();
        break;
      case "Enter":
        event.preventDefault();
        executeSelected();
        break;
      case "Escape":
        event.preventDefault();
        close();
        break;
    }
  }

  function handleItemClick(item: CommandPaletteItem) {
    commandPaletteState.selectByIndex(
      commandPaletteState.results.indexOf(item)
    );
    executeSelected();
  }

  function handleItemHover(item: CommandPaletteItem) {
    commandPaletteState.selectByIndex(
      commandPaletteState.results.indexOf(item)
    );
  }

  async function executeSelected() {
    if (!paletteService) return;

    const selected = commandPaletteState.selectedItem;
    if (!selected) return;

    try {
      await paletteService.executeCommand(selected.id);
      close();
    } catch (error) {
      console.error("Failed to execute command:", error);
    }
  }

  function close() {
    commandPaletteState.close();
    keyboardShortcutState.closeCommandPalette();
  }

  // Group results by category
  let groupedResults = $derived.by(() => {
    const groups = new Map<string, CommandPaletteItem[]>();

    for (const item of commandPaletteState.results) {
      const category = item.category || "Other";
      if (!groups.has(category)) {
        groups.set(category, []);
      }
      groups.get(category)!.push(item);
    }

    return Array.from(groups.entries());
  });
</script>

{#if commandPaletteState.isOpen}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="command-palette-overlay" onclick={close} aria-hidden="true">
    <div
      class="command-palette"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
      role="dialog"
      aria-label="Command Palette"
      tabindex="-1"
    >
      <!-- Search Input -->
      <div class="command-palette__search">
        <i class="fa fa-search command-palette__search-icon" aria-hidden="true"
        ></i>
        <input
          bind:this={inputElement}
          type="text"
          placeholder="Type a command or search..."
          value={commandPaletteState.query}
          oninput={(e) => commandPaletteState.setQuery(e.currentTarget.value)}
          onkeydown={handleKeydown}
          class="command-palette__input"
        />
        <span class="command-palette__hint">
          {keyboardShortcutState.isMac ? "⌘K" : "Ctrl+K"}
        </span>
      </div>

      <!-- Results -->
      <div class="command-palette__results">
        {#if commandPaletteState.isLoading}
          <div class="command-palette__loading">Searching...</div>
        {:else if commandPaletteState.results.length === 0}
          <div class="command-palette__empty">
            {commandPaletteState.query
              ? "No commands found"
              : "Start typing to search commands"}
          </div>
        {:else}
          {#each groupedResults as [category, items]}
            <div class="command-palette__category">
              <div class="command-palette__category-label">{category}</div>
              {#each items as item, _}
                {@const globalIndex = commandPaletteState.results.indexOf(item)}
                {@const isSelected =
                  globalIndex === commandPaletteState.selectedIndex}
                <button
                  class="command-palette__item"
                  class:command-palette__item--selected={isSelected}
                  onclick={() => handleItemClick(item)}
                  onmouseenter={() => handleItemHover(item)}
                  type="button"
                >
                  {#if item.icon}
                    <i
                      class="fa {item.icon} command-palette__item-icon"
                      aria-hidden="true"
                    ></i>
                  {/if}
                  <div class="command-palette__item-content">
                    <div class="command-palette__item-label">{item.label}</div>
                    {#if item.description}
                      <div class="command-palette__item-description">
                        {item.description}
                      </div>
                    {/if}
                  </div>
                  {#if item.shortcut}
                    <kbd class="command-palette__item-shortcut">
                      {item.shortcut}
                    </kbd>
                  {/if}
                </button>
              {/each}
            </div>
          {/each}
        {/if}
      </div>

      <!-- Footer -->
      <div class="command-palette__footer">
        <span>
          <kbd>↑</kbd>
          <kbd>↓</kbd>
          to navigate
        </span>
        <span>
          <kbd>↵</kbd>
          to select
        </span>
        <span>
          <kbd>Esc</kbd>
          to close
        </span>
      </div>
    </div>
  </div>
{/if}

<style>
  .command-palette-overlay {
    position: fixed;
    inset: 0;
    background: color-mix(in srgb, var(--theme-shadow) 60%, transparent);
    z-index: var(--z-tooltip);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 15vh;
  }

  .command-palette {
    width: 90%;
    max-width: 640px;
    background: var(--theme-panel-bg);
    border: 1px solid var(--theme-stroke, var(--theme-stroke-strong));
    border-radius: 12px;
    box-shadow: 0 20px 60px var(--theme-shadow);
    display: flex;
    flex-direction: column;
    max-height: 70vh;
    overflow: hidden;
  }

  .command-palette__search {
    display: flex;
    align-items: center;
    padding: 1rem;
    border-bottom: 1px solid var(--theme-stroke, var(--theme-stroke-strong));
    gap: 0.75rem;
  }

  .command-palette__search-icon {
    color: var(--theme-text-dim, var(--theme-text-dim));
    font-size: 1.125rem;
  }

  .command-palette__input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    color: var(--theme-text);
    font-size: 1.125rem;
    padding: 0;
  }

  .command-palette__input::placeholder {
    color: var(--theme-text-dim);
  }

  .command-palette__hint {
    color: var(--theme-text-dim, var(--theme-text-dim));
    font-size: 0.875rem;
    padding: 0.25rem 0.5rem;
    background: var(--theme-card-bg, var(--theme-card-bg));
    border-radius: 4px;
  }

  .command-palette__results {
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem;
  }

  .command-palette__category {
    margin-bottom: 1rem;
  }

  .command-palette__category-label {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--theme-text-dim, var(--theme-text-dim));
    padding: 0.5rem 0.75rem;
    letter-spacing: 0.5px;
  }

  .command-palette__item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: var(--theme-text);
    cursor: pointer;
    transition: background var(--duration-instant);
    text-align: left;
  }

  .command-palette__item:hover,
  .command-palette__item--selected {
    background: var(--theme-card-bg);
  }

  .command-palette__item-icon {
    font-size: 1.125rem;
    width: 1.5rem;
    text-align: center;
    color: var(--theme-text-dim, var(--theme-text-dim));
  }

  .command-palette__item-content {
    flex: 1;
    min-width: 0;
  }

  .command-palette__item-label {
    font-weight: 500;
    margin-bottom: 0.125rem;
  }

  .command-palette__item-description {
    font-size: 0.875rem;
    color: var(--theme-text-dim, var(--theme-text-dim));
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .command-palette__item-shortcut {
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;
    background: var(--theme-card-hover-bg, var(--theme-card-hover-bg));
    border-radius: 4px;
    color: var(--theme-text-dim, var(--theme-text-dim));
    font-family: monospace;
  }

  .command-palette__loading,
  .command-palette__empty {
    text-align: center;
    padding: 2rem;
    color: var(--theme-text-dim, var(--theme-text-dim));
  }

  .command-palette__footer {
    display: flex;
    gap: 1.5rem;
    padding: 0.75rem 1rem;
    border-top: 1px solid var(--theme-stroke, var(--theme-stroke-strong));
    font-size: 0.75rem;
    color: var(--theme-text-dim, var(--theme-text-dim));
  }

  .command-palette__footer kbd {
    padding: 0.125rem 0.375rem;
    background: var(--theme-card-bg, var(--theme-card-bg));
    border-radius: 3px;
    font-family: monospace;
    font-size: 0.7rem;
  }
</style>
