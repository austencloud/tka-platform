<!--
  TagAutocompleteInput.svelte

  Modern chip-based tag picker with inline creation.
  Features:
  - Show all available tags as clickable chips
  - Selected tags displayed separately
  - Tag color/icon display
  - Inline tag creation via input
  - Optimized for Phase 1 of AI tagging system
-->
<script lang="ts">
  import { container } from "$lib/shared/di";
  import type { ITagManager } from "../../services/contracts/ITagManager";
  import type { LibraryTag } from "../../domain/models/Tag";
  import { TAG_COLORS } from "../../domain/models/Tag";

  interface Props {
    selectedTags: string[];
    onTagsChange: (tags: string[]) => void;
    placeholder?: string;
    maxTags?: number;
    resetTrigger?: number; // Increment this to trigger a reset of pending tags
  }

  let {
    selectedTags = [],
    onTagsChange,
    placeholder = "Add tags...",
    maxTags = 10,
    resetTrigger = 0,
  }: Props = $props();

  // Services
  const tagService = container.items.tagManager;

  // State
  let inputValue = $state("");
  let allTags = $state<LibraryTag[]>([]);
  let pendingTags = $state<LibraryTag[]>([]); // Optimistically created tags (not yet saved)
  let showAddInput = $state(false);
  let selectedColor = $state<string>(TAG_COLORS[0]);
  let customInputElement = $state<HTMLInputElement | null>(null);

  // Focus input when entering add mode (accessible alternative to autofocus)
  $effect(() => {
    if (showAddInput && customInputElement) {
      customInputElement.focus();
    }
  });

  // Combined tags (persisted + pending)
  const combinedTags = $derived([...allTags, ...pendingTags]);

  // All tags sorted by use count, with selection state
  const sortedTags = $derived.by(() => {
    const selectedSet = new Set(
      selectedTags.map((t) => t.toLowerCase().trim())
    );

    return combinedTags
      .map((tag) => ({
        ...tag,
        isSelected: selectedSet.has(tag.name),
      }))
      .sort((a, b) => {
        // Sort by use count descending
        if (b.useCount !== a.useCount) return b.useCount - a.useCount;
        // Then alphabetically
        return a.name.localeCompare(b.name);
      });
  });

  // Load tags on mount
  $effect(() => {
    if (tagService) {
      loadTags();
    }
  });

  // Reset pending tags when resetTrigger changes (e.g., panel closed without saving)
  $effect(() => {
    if (resetTrigger > 0) {
      pendingTags = [];
    }
  });

  async function loadTags() {
    try {
      allTags = await tagService!.getAllTags();
    } catch (error) {
      console.error("Failed to load tags:", error);
    }
  }

  function toggleTag(tagName: string) {
    const normalized = tagName.toLowerCase().trim();
    const isCurrentlySelected = selectedTags.some(
      (t) => t.toLowerCase().trim() === normalized
    );

    if (isCurrentlySelected) {
      // Remove tag
      onTagsChange(selectedTags.filter((t) => t !== tagName));
    } else {
      // Add tag (if under limit)
      if (selectedTags.length < maxTags) {
        onTagsChange([...selectedTags, tagName]);
      }
    }
  }

  function handleCreateCustomTag() {
    const normalized = inputValue.toLowerCase().trim();
    if (!normalized) return;

    // Check if tag already exists (in persisted or pending)
    const existing = combinedTags.find((t) => t.name === normalized);
    if (existing) {
      toggleTag(existing.name);
    } else {
      // Create a pending tag (optimistic UI - will be saved later)
      const newTag: LibraryTag = {
        id: crypto.randomUUID(), // Temporary ID
        name: normalized,
        ownerId: "", // Will be set on save
        color: selectedColor,
        useCount: 0,
        createdAt: new Date(),
      };

      pendingTags = [...pendingTags, newTag];
      toggleTag(normalized);
    }

    inputValue = "";
    showAddInput = false;
    // Reset color to first option for next tag
    selectedColor = TAG_COLORS[0];
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Enter") {
      event.preventDefault();
      handleCreateCustomTag();
    } else if (event.key === "Escape") {
      showAddInput = false;
      inputValue = "";
    }
  }
</script>

<div class="tag-picker">
  <!-- Unified Tags Section -->
  <div class="section">
    <h4 class="section-label">
      Tags
      {#if selectedTags.length > 0}
        <span class="selection-count">({selectedTags.length} selected)</span>
      {/if}
    </h4>
    {#if sortedTags.length > 0}
      <div class="tags-grid">
        {#each sortedTags as tag}
          <button
            type="button"
            class="tag-chip"
            class:selected={tag.isSelected}
            style:--tag-color={tag.color || "#8b5cf6"}
            onclick={() => toggleTag(tag.name)}
            disabled={!tag.isSelected && selectedTags.length >= maxTags}
            aria-label={tag.isSelected
              ? `Remove tag ${tag.name}`
              : `Add tag ${tag.name}`}
            aria-pressed={tag.isSelected}
          >
            {#if tag.icon}
              <span class="tag-icon">{tag.icon}</span>
            {:else if tag.color}
              <span class="tag-color-dot"></span>
            {/if}
            <span class="tag-text">{tag.name}</span>
            {#if tag.isSelected}
              <i class="fas fa-check tag-check-icon" aria-hidden="true"></i>
            {:else if tag.useCount > 0}
              <span class="tag-count">{tag.useCount}</span>
            {/if}
          </button>
        {/each}
      </div>
    {:else}
      <div class="empty-state">
        <i class="fas fa-inbox" aria-hidden="true"></i>
        <span>No tags yet - create one below</span>
      </div>
    {/if}
  </div>

  <!-- Add Custom Tag -->
  <div class="section">
    {#if !showAddInput}
      <button
        type="button"
        class="add-custom-button"
        onclick={() => (showAddInput = true)}
        disabled={selectedTags.length >= maxTags}
      >
        <i class="fas fa-plus" aria-hidden="true"></i>
        Add custom tag
      </button>
    {:else}
      <div class="custom-tag-creator">
        <div class="custom-input-container">
          <input
            bind:this={customInputElement}
            bind:value={inputValue}
            type="text"
            class="custom-input"
            placeholder="Enter tag name..."
            onkeydown={handleKeydown}
            maxlength="50"
          />
          <button
            type="button"
            class="input-action-button confirm"
            onclick={handleCreateCustomTag}
            disabled={!inputValue.trim()}
            aria-label="Add tag"
          >
            <i class="fas fa-check" aria-hidden="true"></i>
          </button>
          <button
            type="button"
            class="input-action-button cancel"
            onclick={() => {
              showAddInput = false;
              inputValue = "";
              selectedColor = TAG_COLORS[0];
            }}
            aria-label="Cancel"
          >
            <i class="fas fa-times" aria-hidden="true"></i>
          </button>
        </div>

        <!-- Color Picker -->
        <div class="color-picker">
          <span class="color-picker-label">Color:</span>
          <div class="color-options">
            {#each TAG_COLORS as color}
              <button
                type="button"
                class="color-option"
                class:selected={selectedColor === color}
                style:background-color={color}
                onclick={() => (selectedColor = color)}
                aria-label="Select color {color}"
              >
                {#if selectedColor === color}
                  <i class="fas fa-check" aria-hidden="true"></i>
                {/if}
              </button>
            {/each}
          </div>
        </div>
      </div>
    {/if}
  </div>

  {#if selectedTags.length >= maxTags}
    <p class="max-tags-message">
      <i class="fas fa-info-circle" aria-hidden="true"></i>
      Maximum {maxTags} tags reached
    </p>
  {/if}
</div>

<style>
  .tag-picker {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .section-label {
    margin: 0;
    font-size: var(--font-size-compact);
    font-weight: 600;
    color: var(--theme-text-secondary, var(--theme-text-dim));
    text-transform: uppercase;
    letter-spacing: 0.5px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .selection-count {
    font-size: var(--font-size-compact);
    font-weight: 500;
    color: var(--theme-accent-strong, var(--theme-accent-strong));
    text-transform: none;
    letter-spacing: normal;
  }

  .tags-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  /* Empty State */
  .empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 24px 16px;
    background: var(--theme-card-bg);
    border: 1px dashed var(--theme-stroke, var(--theme-stroke));
    border-radius: var(--radius-2026-md, 14px);
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact);
    font-style: italic;
    min-height: 60px;
  }

  .empty-state i {
    font-size: var(--font-size-sm);
    opacity: 0.5;
  }

  /* Tag Chips */
  .tag-chip {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 12px 16px;
    border-radius: 24px;
    font-size: var(--font-size-compact);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    min-height: var(--min-touch-target); /* WCAG 2.1 AA touch target minimum */
    box-sizing: border-box;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke, var(--theme-stroke-strong));
    color: var(--theme-text, var(--theme-text));
  }

  .tag-chip:hover:not(:disabled) {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke);
    transform: translateY(-1px);
  }

  /* Selected tags - colored to indicate selection */
  .tag-chip.selected {
    background: color-mix(
      in srgb,
      var(--tag-color, var(--theme-accent-strong)) 20%,
      transparent
    );
    border: 1px solid
      color-mix(
        in srgb,
        var(--tag-color, var(--theme-accent-strong)) 50%,
        transparent
      );
    color: var(--tag-color, var(--theme-accent-strong));
  }

  .tag-chip.selected:hover {
    background: color-mix(in srgb, var(--tag-color, #8b5cf6) 30%, transparent);
    border-color: var(--tag-color, var(--theme-accent-strong));
    transform: translateY(-1px);
  }

  .tag-chip:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .tag-color-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background-color: var(--tag-color, var(--theme-accent-strong));
    flex-shrink: 0;
  }

  .tag-icon {
    font-size: var(--font-size-sm);
    flex-shrink: 0;
  }

  .tag-text {
    font-weight: 500;
  }

  .tag-count {
    margin-left: auto;
    padding: 4px 8px;
    background: color-mix(
      in srgb,
      var(--tag-color, var(--theme-accent-strong)) 20%,
      transparent
    );
    border-radius: var(--radius-2026-sm, 10px);
    font-size: var(--font-size-compact);
    font-weight: 600;
    opacity: 0.8;
  }

  .tag-check-icon {
    margin-left: 4px;
    font-size: var(--font-size-compact);
    opacity: 0.8;
    transition: all 0.2s ease;
  }

  .tag-chip.selected:hover .tag-check-icon {
    opacity: 1;
    transform: scale(1.1);
  }

  /* Add Custom Tag Button */
  .add-custom-button {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 14px 20px;
    background: transparent;
    border: 1px dashed rgba(255, 255, 255, 0.3);
    border-radius: var(--radius-2026-sm, 10px);
    color: var(--theme-text-secondary, var(--theme-text-dim));
    font-size: var(--font-size-min);
    cursor: pointer;
    transition: all 0.2s ease;
    min-height: var(--min-touch-target);
    box-sizing: border-box;
  }

  .add-custom-button:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.03);
    border-color: rgba(255, 255, 255, 0.75); /* WCAG AAA */
    color: var(--theme-text, var(--theme-text));
  }

  .add-custom-button:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .add-custom-button i {
    font-size: var(--font-size-compact);
  }

  /* Custom Tag Creator */
  .custom-tag-creator {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .custom-input-container {
    display: flex;
    gap: 10px;
    align-items: center;
  }

  .custom-input {
    flex: 1;
    padding: 14px 16px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke, var(--theme-stroke));
    border-radius: var(--radius-2026-sm, 10px);
    color: var(--theme-text);
    font-size: var(--font-size-min);
    outline: none;
    transition: all 0.2s ease;
    min-height: var(--min-touch-target);
    box-sizing: border-box;
  }

  .custom-input:focus {
    border-color: var(--theme-accent-strong);
    background: var(--theme-card-hover-bg);
  }

  .custom-input::placeholder {
    color: rgba(255, 255, 255, 0.75); /* WCAG AAA */
  }

  .input-action-button {
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    padding: 0;
    border: none;
    border-radius: var(--radius-2026-sm, 10px);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: var(--font-size-sm);
    flex-shrink: 0;
  }

  .input-action-button.confirm {
    background: var(--semantic-success, var(--semantic-success));
    color: white;
  }

  .input-action-button.confirm:hover:not(:disabled) {
    background: #16a34a;
    transform: scale(1.05);
  }

  .input-action-button.confirm:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .input-action-button.cancel {
    background: var(--theme-card-bg, var(--theme-card-bg));
    color: var(--theme-text-secondary, var(--theme-text-dim));
  }

  .input-action-button.cancel:hover {
    background: var(--theme-card-hover-bg);
    color: var(--theme-text, var(--theme-text));
  }

  /* Color Picker */
  .color-picker {
    display: flex;
    align-items: center;
    gap: 16px;
    padding-top: 4px;
  }

  .color-picker-label {
    font-size: var(--font-size-compact);
    font-weight: 500;
    color: var(--theme-text-secondary, var(--theme-text-dim));
  }

  .color-options {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }

  .color-option {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    border: 2px solid transparent;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    flex-shrink: 0;
  }

  .color-option:hover {
    transform: scale(1.1);
    border-color: rgba(255, 255, 255, 0.3);
  }

  .color-option.selected {
    border-color: var(--theme-text-dim);
    box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.2);
  }

  .color-option i {
    font-size: var(--font-size-base);
    color: white;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  }

  /* Max Tags Message */
  .max-tags-message {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    padding: 10px 12px;
    background: color-mix(in srgb, var(--semantic-warning) 10%, transparent);
    border: 1px solid
      color-mix(in srgb, var(--semantic-warning) 30%, transparent);
    border-radius: var(--radius-2026-sm, 10px);
    color: var(--semantic-warning);
    font-size: var(--font-size-compact);
  }

  .max-tags-message i {
    font-size: var(--font-size-sm);
  }
</style>
