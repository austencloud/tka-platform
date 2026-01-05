<!--
  SequenceDetailDrawer.svelte - Library Sequence Detail View

  Drawer for viewing and editing library sequences.
  Features:
  - View sequence thumbnail
  - Edit name, notes
  - Manage visibility (public/private)
  - Add/remove tags
  - Toggle favorite status
  - Delete sequence
-->
<script lang="ts">
  import { onMount } from "svelte";
  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
  import SequenceViewer from "$lib/shared/sequence-viewer/components/SequenceViewer.svelte";
  import TagAutocompleteInput from "./tags/TagAutocompleteInput.svelte";
  import VisibilityToggle from "./VisibilityToggle.svelte";
  import { libraryState } from "../state/library-state.svelte";
  import { toast } from "$lib/shared/toast/state/toast-state.svelte";
  import { tryResolve } from "$lib/shared/inversify/di";
  import { TYPES } from "$lib/shared/inversify/types";
  import type { ILibraryRepository } from "../services/contracts/ILibraryRepository";
  import type { LibrarySequence } from "../domain/models/LibrarySequence";

  interface Props {
    isOpen: boolean;
    sequenceId: string | null;
    onClose: () => void;
  }

  let { isOpen = $bindable(), sequenceId, onClose }: Props = $props();

  // State
  let isEditing = $state(false);
  let isSaving = $state(false);
  let showDeleteConfirm = $state(false);
  let editedNotes = $state("");
  let editedTags = $state<string[]>([]);
  let tagResetTrigger = $state(0);

  // Get sequence from library state
  const sequence = $derived(
    sequenceId ? libraryState.getSequenceById(sequenceId) : undefined
  );

  // Format dates nicely
  function formatDate(date: Date | undefined): string {
    if (!date) return "Unknown";
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  }

  // Initialize edit state when sequence changes
  $effect(() => {
    if (sequence) {
      editedNotes = sequence.notes || "";
      // Combine legacy tagIds and sequenceTags for editing
      const tagNames = [
        ...sequence.tagIds,
        ...sequence.sequenceTags.map((st) => st.tagId),
      ];
      editedTags = [...new Set(tagNames)]; // Dedupe
    }
  });

  // Note: Reset logic is handled in handleClose() instead of an $effect
  // to avoid infinite loops from repeatedly running when isOpen is false

  async function handleToggleFavorite() {
    if (!sequenceId) return;
    await libraryState.toggleFavorite(sequenceId);
  }

  async function handleToggleVisibility() {
    if (!sequenceId || !sequence) return;
    const newVisibility =
      sequence.visibility === "public" ? "private" : "public";
    const success = await libraryState.setVisibility(sequenceId, newVisibility);
    if (success) {
      toast.success(
        newVisibility === "public"
          ? "Sequence is now public"
          : "Sequence is now private"
      );
    }
  }

  function handleStartEdit() {
    isEditing = true;
  }

  function handleCancelEdit() {
    isEditing = false;
    // Reset to original values
    if (sequence) {
      editedNotes = sequence.notes || "";
      const tagNames = [
        ...sequence.tagIds,
        ...sequence.sequenceTags.map((st) => st.tagId),
      ];
      editedTags = [...new Set(tagNames)];
    }
    tagResetTrigger++;
  }

  async function handleSaveChanges() {
    if (!sequenceId) return;

    isSaving = true;
    try {
      const service = tryResolve<ILibraryRepository>(TYPES.ILibraryRepository);
      if (!service) {
        toast.error("Library service not available");
        return;
      }

      await service.updateSequence(sequenceId, {
        notes: editedNotes,
        tagIds: editedTags,
      });

      isEditing = false;
      toast.success("Sequence updated");
    } catch (error) {
      console.error("Failed to save changes:", error);
      toast.error("Failed to save changes");
    } finally {
      isSaving = false;
    }
  }

  async function handleDelete() {
    if (!sequenceId) return;

    const success = await libraryState.deleteSequence(sequenceId);
    if (success) {
      toast.success("Sequence deleted");
      onClose();
    } else {
      toast.error("Failed to delete sequence");
    }
    showDeleteConfirm = false;
  }

  function handleTagsChange(tags: string[]) {
    editedTags = tags;
  }

  function handleClose() {
    // Reset all state when closing
    isEditing = false;
    showDeleteConfirm = false;
    tagResetTrigger++;
    onClose();
  }
</script>

<Drawer
  bind:isOpen
  placement="right"
  onclose={handleClose}
  closeOnBackdrop={!isEditing}
  closeOnEscape={!isEditing}
  class="sequence-detail-drawer"
  showHandle={false}
  ariaLabel="Sequence details"
>
  {#if sequence}
    <div class="drawer-content">
      <!-- Header with quick actions -->
      <header class="drawer-header">
        <h2 class="sequence-title">{sequence.word || sequence.name}</h2>
        <div class="header-actions">
          <button
            class="header-action-btn"
            class:active={sequence.isFavorite}
            onclick={handleToggleFavorite}
            aria-label={sequence.isFavorite ? "Remove from favorites" : "Add to favorites"}
          >
            <i class="fas fa-star" aria-hidden="true"></i>
          </button>
          <button
            class="header-action-btn"
            class:public={sequence.visibility === "public"}
            onclick={handleToggleVisibility}
            aria-label={sequence.visibility === "public" ? "Make private" : "Make public"}
          >
            <i class="fas fa-{sequence.visibility === 'public' ? 'globe' : 'lock'}" aria-hidden="true"></i>
          </button>
          <button
            class="close-btn"
            onclick={handleClose}
            aria-label="Close drawer"
          >
            <i class="fas fa-times" aria-hidden="true"></i>
          </button>
        </div>
      </header>

      <!-- Media Viewer - Fixed height section -->
      <div class="media-section">
        <SequenceViewer
          {sequence}
          initialMediaType="image"
          controlsLevel="minimal"
        />
      </div>

      <!-- Scrollable details section -->
      <div class="details-section">
        <!-- Compact stats row -->
        <div class="stats-row">
          <span class="stat-chip">
            <i class="fas fa-layer-group" aria-hidden="true"></i>
            {sequence.beats?.length || 0} beats
          </span>
          <span class="stat-chip">
            <i class="fas fa-calendar" aria-hidden="true"></i>
            {formatDate(sequence.createdAt)}
          </span>
        </div>

      <!-- Analytics Section (unique to Library) -->
      {#if sequence.visibility === "public" && (sequence.viewCount > 0 || sequence.forkCount > 0 || sequence.starCount > 0)}
        <div class="analytics-section">
          <h3 class="section-title">
            <i class="fas fa-chart-line" aria-hidden="true"></i>
            Analytics
          </h3>
          <div class="analytics-grid">
            <div class="analytics-card views">
              <div class="analytics-value">{sequence.viewCount || 0}</div>
              <div class="analytics-label">
                <i class="fas fa-eye" aria-hidden="true"></i>
                Views
              </div>
            </div>
            <div class="analytics-card forks">
              <div class="analytics-value">{sequence.forkCount || 0}</div>
              <div class="analytics-label">
                <i class="fas fa-code-branch" aria-hidden="true"></i>
                Forks
              </div>
            </div>
            <div class="analytics-card stars">
              <div class="analytics-value">{sequence.starCount || 0}</div>
              <div class="analytics-label">
                <i class="fas fa-star" aria-hidden="true"></i>
                Stars
              </div>
            </div>
          </div>
        </div>
      {:else if sequence.visibility === "private"}
        <div class="publish-cta">
          <div class="cta-content">
            <i class="fas fa-rocket" aria-hidden="true"></i>
            <div class="cta-text">
              <strong>Ready to share?</strong>
              <span>Publish to the Gallery to see how your sequence performs</span>
            </div>
          </div>
          <button class="cta-btn" onclick={handleToggleVisibility}>
            Publish
          </button>
        </div>
      {/if}

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
            {sequence.notes || "No notes yet"}
          </p>
        {/if}
      </div>

      <!-- Tags Section -->
      <div class="section">
        <h3 class="section-title">Tags</h3>
        {#if isEditing}
          <TagAutocompleteInput
            selectedTags={editedTags}
            onTagsChange={handleTagsChange}
            placeholder="Add tags..."
            maxTags={10}
            resetTrigger={tagResetTrigger}
          />
        {:else}
          <div class="tags-display">
            {#if editedTags.length > 0}
              {#each editedTags as tag}
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
          <button
            class="btn btn-secondary"
            onclick={handleCancelEdit}
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            class="btn btn-primary"
            onclick={handleSaveChanges}
            disabled={isSaving}
          >
            {#if isSaving}
              <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
              Saving...
            {:else}
              Save Changes
            {/if}
          </button>
        </div>
      {/if}
      </div><!-- End details-section -->

      <!-- Danger Zone -->
      <div class="danger-zone">
        {#if showDeleteConfirm}
          <div class="delete-confirm">
            <p>Delete this sequence? This cannot be undone.</p>
            <div class="confirm-actions">
              <button
                class="btn btn-secondary"
                onclick={() => (showDeleteConfirm = false)}
              >
                Cancel
              </button>
              <button class="btn btn-danger" onclick={handleDelete}>
                Delete
              </button>
            </div>
          </div>
        {:else}
          <button class="delete-btn" onclick={() => (showDeleteConfirm = true)}>
            <i class="fas fa-trash" aria-hidden="true"></i>
            Delete Sequence
          </button>
        {/if}
      </div>
    </div>
  {:else}
    <div class="empty-state">
      <i class="fas fa-question-circle" aria-hidden="true"></i>
      <p>Sequence not found</p>
    </div>
  {/if}
</Drawer>

<style>
  :global(.sequence-detail-drawer) {
    --sheet-bg: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    --sheet-filter: none;
    width: min(480px, 95vw) !important;
    max-width: 480px !important;
  }

  .drawer-content {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 16px;
    height: 100%;
    overflow: hidden;
  }

  .drawer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-shrink: 0;
  }

  .sequence-title {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--theme-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    min-width: 0;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .header-action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: var(--radius-2026-sm, 10px);
    color: var(--theme-text-dim);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .header-action-btn:hover {
    background: var(--theme-card-hover-bg);
    color: var(--theme-text);
  }

  .header-action-btn.active {
    background: color-mix(in srgb, var(--semantic-warning) 20%, transparent);
    border-color: color-mix(in srgb, var(--semantic-warning) 40%, transparent);
    color: var(--semantic-warning);
  }

  .header-action-btn.public {
    background: color-mix(in srgb, var(--semantic-success) 20%, transparent);
    border-color: color-mix(in srgb, var(--semantic-success) 40%, transparent);
    color: var(--semantic-success);
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: var(--radius-2026-sm, 10px);
    color: var(--theme-text-dim);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .close-btn:hover {
    background: var(--theme-card-hover-bg);
    color: var(--theme-text);
  }

  /* Media Section - Flexible height to fit content */
  .media-section {
    border-radius: var(--radius-2026-md, 14px);
    overflow: hidden;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    flex-shrink: 0;
    /* Use min/max height instead of fixed height */
    min-height: 300px;
    max-height: 50vh;
  }

  /* Hide the settings chips in the compact drawer view */
  .media-section :global(.settings-chips) {
    display: none !important;
  }

  /* Also hide the sequence title in the viewer since we show it in header */
  .media-section :global(.sequence-title-display) {
    display: none !important;
  }

  /* Make the mode switch row more compact */
  .media-section :global(.mode-switch-row) {
    padding: 8px !important;
    gap: 8px !important;
  }

  .media-section :global(.mode-switch-btn) {
    padding: 8px 12px !important;
    font-size: 12px !important;
  }

  /* Scrollable details section */
  .details-section {
    display: flex;
    flex-direction: column;
    gap: 16px;
    overflow-y: auto;
    flex: 1;
    min-height: 0;
  }

  /* Compact stats row */
  .stats-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .stat-chip {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 999px;
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact, 12px);
  }

  .stat-chip i {
    font-size: 10px;
    opacity: 0.7;
  }

  /* Analytics Section */
  .analytics-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .analytics-section .section-title {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .analytics-section .section-title i {
    color: var(--theme-accent);
  }

  .analytics-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }

  .analytics-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 16px 12px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: var(--radius-2026-md, 14px);
    text-align: center;
  }

  .analytics-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--theme-text);
    font-variant-numeric: tabular-nums;
  }

  .analytics-label {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim);
  }

  .analytics-label i {
    font-size: 10px;
  }

  .analytics-card.views .analytics-label i {
    color: rgba(96, 165, 250, 0.95);
  }

  .analytics-card.forks .analytics-label i {
    color: var(--semantic-success);
  }

  .analytics-card.stars .analytics-label i {
    color: rgba(250, 204, 21, 0.95);
  }

  /* Publish CTA */
  .publish-cta {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px;
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--semantic-success) 10%, transparent) 0%,
      color-mix(in srgb, var(--semantic-info) 10%, transparent) 100%
    );
    border: 1px solid color-mix(in srgb, var(--semantic-success) 30%, transparent);
    border-radius: var(--radius-2026-md, 14px);
  }

  .cta-content {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
    min-width: 0;
  }

  .cta-content > i {
    font-size: 1.25rem;
    color: var(--semantic-success);
    flex-shrink: 0;
  }

  .cta-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .cta-text strong {
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text);
  }

  .cta-text span {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim);
  }

  .cta-btn {
    padding: 10px 20px;
    background: var(--semantic-success);
    border: none;
    border-radius: var(--radius-2026-sm, 10px);
    color: white;
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
    min-height: var(--min-touch-target);
  }

  .cta-btn:hover {
    filter: brightness(1.1);
  }

  /* Section */
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
    transition: opacity 0.2s;
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

  /* Tags Display */
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
    padding: 6px 12px;
    background: color-mix(in srgb, var(--theme-accent) 20%, transparent);
    border: 1px solid color-mix(in srgb, var(--theme-accent) 40%, transparent);
    border-radius: 999px;
    color: var(--theme-accent);
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
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
    transition: all 0.2s ease;
    min-height: 44px;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-secondary {
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    color: var(--theme-text);
  }

  .btn-secondary:hover:not(:disabled) {
    background: var(--theme-card-hover-bg);
  }

  .btn-primary {
    background: var(--theme-accent);
    border: none;
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    opacity: 0.9;
  }

  .btn-danger {
    background: var(--semantic-error);
    border: none;
    color: white;
  }

  .btn-danger:hover:not(:disabled) {
    opacity: 0.9;
  }

  /* Danger Zone */
  .danger-zone {
    margin-top: auto;
    padding-top: 20px;
    border-top: 1px solid var(--theme-stroke);
  }

  .delete-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    padding: 12px;
    background: transparent;
    border: 1px solid color-mix(in srgb, var(--semantic-error) 40%, transparent);
    border-radius: var(--radius-2026-sm, 10px);
    color: var(--semantic-error);
    font-size: var(--font-size-sm, 14px);
    cursor: pointer;
    transition: all 0.2s ease;
    min-height: 44px;
  }

  .delete-btn:hover {
    background: color-mix(in srgb, var(--semantic-error) 10%, transparent);
  }

  .delete-confirm {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    background: color-mix(in srgb, var(--semantic-error) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--semantic-error) 30%, transparent);
    border-radius: var(--radius-2026-sm, 10px);
  }

  .delete-confirm p {
    margin: 0;
    color: var(--semantic-error);
    font-size: var(--font-size-sm, 14px);
    font-weight: 500;
  }

  .confirm-actions {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
  }

  /* Empty State */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    height: 100%;
    padding: 40px;
    color: var(--theme-text-dim);
    text-align: center;
  }

  .empty-state i {
    font-size: 3rem;
    opacity: 0.5;
  }

  .empty-state p {
    margin: 0;
    font-size: var(--font-size-sm, 14px);
  }
</style>
