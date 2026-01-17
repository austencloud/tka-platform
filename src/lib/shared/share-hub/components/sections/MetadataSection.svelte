<!--
  MetadataSection.svelte - Notes and Tags Editing

  Library-specific section for managing sequence metadata.
  Includes notes textarea and tags input with edit mode.
-->
<script lang="ts">
  interface Props {
    notes: string;
    tags: string[];
    onNotesChange?: (notes: string) => void;
    onTagsChange?: (tags: string[]) => void;
  }

  let { notes = "", tags = [], onNotesChange, onTagsChange }: Props = $props();

  // Edit mode state
  let isEditing = $state(false);
  let editedNotes = $state("");
  let editedTags = $state<string[]>([]);
  let newTagInput = $state("");

  // Initialize edit state when props change
  $effect(() => {
    if (!isEditing) {
      editedNotes = notes;
      editedTags = [...tags];
    }
  });

  function handleStartEdit() {
    editedNotes = notes;
    editedTags = [...tags];
    isEditing = true;
  }

  function handleCancelEdit() {
    isEditing = false;
    editedNotes = notes;
    editedTags = [...tags];
    newTagInput = "";
  }

  function handleSaveChanges() {
    if (editedNotes !== notes) {
      onNotesChange?.(editedNotes);
    }
    if (JSON.stringify(editedTags) !== JSON.stringify(tags)) {
      onTagsChange?.(editedTags);
    }
    isEditing = false;
    newTagInput = "";
  }

  function handleAddTag() {
    const tag = newTagInput.trim().toLowerCase();
    if (tag && !editedTags.includes(tag)) {
      editedTags = [...editedTags, tag];
      newTagInput = "";
    }
  }

  function handleRemoveTag(tagToRemove: string) {
    editedTags = editedTags.filter((t) => t !== tagToRemove);
  }

  function handleTagInputKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddTag();
    }
  }
</script>

<div class="metadata-section">
  <!-- Notes Section -->
  <div class="section">
    <div class="section-header">
      <h3 class="section-title">Notes</h3>
      {#if !isEditing}
        <button class="edit-btn" onclick={handleStartEdit}>
          <i class="fas fa-pencil-alt" aria-hidden="true"></i>
          Edit
        </button>
      {/if}
    </div>

    {#if isEditing}
      <textarea
        class="notes-input"
        bind:value={editedNotes}
        placeholder="Add notes about this sequence..."
        rows="4"
      ></textarea>
    {:else}
      <p class="notes-text">
        {notes || "No notes yet"}
      </p>
    {/if}
  </div>

  <!-- Tags Section -->
  <div class="section">
    <h3 class="section-title">Tags</h3>
    {#if isEditing}
      <div class="tags-editor">
        <div class="tags-input-row">
          <input
            type="text"
            class="tag-input"
            bind:value={newTagInput}
            placeholder="Add a tag..."
            maxlength="30"
            onkeydown={handleTagInputKeydown}
          />
          <button
            class="add-tag-btn"
            onclick={handleAddTag}
            disabled={!newTagInput.trim()}
            aria-label="Add tag"
          >
            <i class="fas fa-plus" aria-hidden="true"></i>
          </button>
        </div>
        <div class="tags-list">
          {#each editedTags as tag}
            <span class="tag-chip editing">
              {tag}
              <button
                class="remove-tag-btn"
                onclick={() => handleRemoveTag(tag)}
                aria-label="Remove tag {tag}"
              >
                <i class="fas fa-times" aria-hidden="true"></i>
              </button>
            </span>
          {/each}
          {#if editedTags.length === 0}
            <span class="no-tags">No tags</span>
          {/if}
        </div>
      </div>
    {:else}
      <div class="tags-display">
        {#if tags.length > 0}
          {#each tags as tag}
            <span class="tag-chip">{tag}</span>
          {/each}
        {:else}
          <span class="no-tags">No tags</span>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Edit Actions -->
  {#if isEditing}
    <div class="edit-actions">
      <button class="btn btn-secondary" onclick={handleCancelEdit}>
        Cancel
      </button>
      <button class="btn btn-primary" onclick={handleSaveChanges}>
        Save Changes
      </button>
    </div>
  {/if}
</div>

<style>
  .metadata-section {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .section-title {
    margin: 0;
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    color: var(--theme-text-dim);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .edit-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: transparent;
    border: none;
    color: var(--theme-accent);
    font-size: var(--font-size-sm, 14px);
    cursor: pointer;
    transition: opacity var(--duration-normal);
  }

  .edit-btn:hover {
    opacity: 0.8;
  }

  /* Notes */
  .notes-input {
    width: 100%;
    padding: 12px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: var(--radius-2026-sm, 10px);
    color: var(--theme-text);
    font-size: var(--font-size-sm, 14px);
    font-family: inherit;
    resize: vertical;
    min-height: 100px;
  }

  .notes-input:focus {
    outline: none;
    border-color: var(--theme-accent);
  }

  .notes-input::placeholder {
    color: var(--theme-text-dim);
  }

  .notes-text {
    margin: 0;
    padding: 12px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: var(--radius-2026-sm, 10px);
    color: var(--theme-text-dim);
    font-size: var(--font-size-sm, 14px);
    line-height: 1.5;
    min-height: 60px;
  }

  /* Tags */
  .tags-editor {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .tags-input-row {
    display: flex;
    gap: 8px;
  }

  .tag-input {
    flex: 1;
    padding: 10px 14px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: var(--radius-2026-sm, 10px);
    color: var(--theme-text);
    font-size: var(--font-size-sm, 14px);
  }

  .tag-input:focus {
    outline: none;
    border-color: var(--theme-accent);
  }

  .tag-input::placeholder {
    color: var(--theme-text-dim);
  }

  .add-tag-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    background: var(--theme-accent);
    border: none;
    border-radius: var(--radius-2026-sm, 10px);
    color: white;
    cursor: pointer;
    transition: opacity var(--duration-normal);
  }

  .add-tag-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .add-tag-btn:not(:disabled):hover {
    opacity: 0.9;
  }

  .tags-list,
  .tags-display {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 12px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: var(--radius-2026-sm, 10px);
    min-height: 44px;
  }

  .tag-chip {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: color-mix(in srgb, var(--theme-accent) 20%, transparent);
    border: 1px solid color-mix(in srgb, var(--theme-accent) 40%, transparent);
    border-radius: 999px;
    color: var(--theme-accent);
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
  }

  .tag-chip.editing {
    padding-right: 8px;
  }

  .remove-tag-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    padding: 0;
    background: transparent;
    border: none;
    color: var(--theme-accent);
    cursor: pointer;
    opacity: 0.7;
    transition: opacity var(--duration-fast);
  }

  .remove-tag-btn:hover {
    opacity: 1;
  }

  .remove-tag-btn i {
    font-size: 10px;
  }

  .no-tags {
    color: var(--theme-text-dim);
    font-size: var(--font-size-sm, 14px);
    font-style: italic;
  }

  /* Edit Actions */
  .edit-actions {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
    padding-top: 8px;
  }

  .btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px 20px;
    border-radius: var(--radius-2026-sm, 10px);
    font-size: var(--font-size-sm, 14px);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    min-height: 44px;
  }

  .btn-secondary {
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    color: var(--theme-text);
  }

  .btn-secondary:hover {
    background: var(--theme-card-hover-bg);
  }

  .btn-primary {
    background: var(--theme-accent);
    border: none;
    color: white;
  }

  .btn-primary:hover {
    opacity: 0.9;
  }
</style>
