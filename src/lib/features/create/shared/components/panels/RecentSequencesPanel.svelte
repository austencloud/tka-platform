<script lang="ts">
  /**
   * Recent Sequences Panel
   *
   * Shows recent drafts and saved sequences for the current user.
   * Allows resuming drafts or loading saved sequences.
   *
   * Domain: Create module - Session management
   */

  import { onMount } from "svelte";
  import { createEventDispatcher } from "svelte";
  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
  import { SessionManager } from "../../services/SessionManager.svelte";
  import { Autosaver } from "../../services/Autosaver";
  import { container } from "$lib/shared/di";
  import type { LibrarySequence } from "$lib/features/library/domain/models/LibrarySequence";
  import type { SequenceSession } from "../../domain/SequenceSession";
  import type { DraftSequence } from "../../domain/DraftSequence";

  interface Props {
    show: boolean;
  }

  let { show = $bindable(false) }: Props = $props();

  const dispatch = createEventDispatcher<{
    loadDraft: { sessionId: string; draft: DraftSequence };
    loadSequence: { sequenceId: string; sequence: LibrarySequence };
    deleteDraft: { sessionId: string };
  }>();

  const sessionManager = new SessionManager();
  const autosaver = new Autosaver();

  let sessions = $state<SequenceSession[]>([]);
  let drafts = $state<DraftSequence[]>([]);
  let savedSequences = $state<LibrarySequence[]>([]);
  let isLoading = $state(false);

  onMount(async () => {
    await loadData();
  });

  async function loadData() {
    isLoading = true;
    try {
      const [sessionsResult, draftsResult, savedResult] = await Promise.all([
        sessionManager.getRecentSessions(10),
        autosaver.getAllDrafts(),
        container?.items?.libraryRepository?.getSequences({
          limit: 10,
          sortBy: "updatedAt",
          sortDirection: "desc",
        }) ?? [],
      ]);
      sessions = sessionsResult;
      drafts = draftsResult;
      savedSequences = savedResult;
    } catch (error) {
      console.error("Failed to load recent sequences:", error);
    } finally {
      isLoading = false;
    }
  }

  function handleLoadDraft(sessionId: string) {
    const draft = drafts.find((d) => d.sessionId === sessionId);
    if (draft) {
      dispatch("loadDraft", { sessionId, draft });
      show = false;
    }
  }

  function handleLoadSequence(sequenceId: string) {
    const sequence = savedSequences.find((s) => s.id === sequenceId);
    if (sequence) {
      dispatch("loadSequence", { sequenceId, sequence });
      show = false;
    }
  }

  async function handleDeleteDraft(sessionId: string) {
    try {
      await autosaver.deleteDraft(sessionId);
      drafts = drafts.filter((d) => d.sessionId !== sessionId);
      dispatch("deleteDraft", { sessionId });
    } catch (error) {
      console.error("Failed to delete draft:", error);
    }
  }

  function formatDate(timestamp: any): string {
    if (!timestamp) return "Unknown";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  }
</script>

<Drawer bind:isOpen={show}>
  <div class="recent-sequences-panel">
    <div class="panel-header">
      <h2>
        <i class="fas fa-clock-rotate-left" aria-hidden="true"></i>
        Recent Sequences
      </h2>
      <button
        class="close-btn"
        onclick={() => (show = false)}
        aria-label="Close panel"
      >
        <i class="fas fa-times" aria-hidden="true"></i>
      </button>
    </div>

    {#if isLoading}
      <div class="loading">
        <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
        <span>Loading...</span>
      </div>
    {:else}
      <div class="recent-sequences-body">
        <!-- Unsaved Drafts -->
        {#if drafts.length > 0}
          <section class="section">
            <h3 class="section-title">
              <i class="fas fa-file-dashed" aria-hidden="true"></i>
              Unsaved Drafts ({drafts.length})
            </h3>
            <div class="list">
              {#each drafts as draft}
                <div class="draft list-item">
                  <div class="item-icon">
                    <i class="fas fa-file-dashed" aria-hidden="true"></i>
                  </div>
                  <div class="item-info">
                    <div class="item-title">
                      {draft.name || "Untitled Sequence"}
                    </div>
                    <div class="item-meta">
                      {draft.stepCount} steps · {formatDate(draft.updatedAt)}
                    </div>
                  </div>
                  <div class="item-actions">
                    <button
                      class="action-btn load"
                      onclick={() => handleLoadDraft(draft.sessionId)}
                      title="Resume editing"
                      aria-label="Resume editing"
                    >
                      <i class="fas fa-folder-open" aria-hidden="true"></i>
                    </button>
                    <button
                      class="action-btn delete"
                      onclick={() => handleDeleteDraft(draft.sessionId)}
                      title="Delete draft"
                      aria-label="Delete draft"
                    >
                      <i class="fas fa-trash" aria-hidden="true"></i>
                    </button>
                  </div>
                </div>
              {/each}
            </div>
          </section>
        {/if}

        <!-- Saved Sequences -->
        {#if savedSequences.length > 0}
          <section class="section">
            <h3 class="section-title">
              <i class="fas fa-bookmark" aria-hidden="true"></i>
              Saved Sequences ({savedSequences.length})
            </h3>
            <div class="list">
              {#each savedSequences as sequence}
                <div class="saved list-item">
                  <div class="item-icon">
                    <i class="fas fa-bookmark" aria-hidden="true"></i>
                  </div>
                  <div class="item-info">
                    <div class="item-title">
                      {sequence.name}
                    </div>
                    <div class="item-meta">
                      {sequence.steps?.length ?? 0} steps · {formatDate(
                        sequence.updatedAt
                      )}
                    </div>
                  </div>
                  <div class="item-actions">
                    <button
                      class="action-btn load"
                      onclick={() => handleLoadSequence(sequence.id)}
                      title="Load sequence"
                      aria-label="Load sequence"
                    >
                      <i class="fas fa-folder-open" aria-hidden="true"></i>
                    </button>
                  </div>
                </div>
              {/each}
            </div>
          </section>
        {/if}

        {#if drafts.length === 0 && savedSequences.length === 0}
          <div class="empty-state">
            <i class="fas fa-inbox" aria-hidden="true"></i>
            <p>No recent sequences</p>
            <span class="empty-hint">
              Start building a sequence to see it here
            </span>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</Drawer>

<style>
  .recent-sequences-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    max-width: 600px;
    margin: 0 auto;
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.5rem;
    border-bottom: 1px solid var(--border-color);
  }

  .panel-header h2 {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.25rem;
    color: var(--text-secondary);
    cursor: pointer;
    padding: 0.5rem;
    transition: color var(--duration-normal);
  }

  .close-btn:hover {
    color: var(--text-primary);
  }

  .loading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 3rem;
    color: var(--text-secondary);
  }

  .recent-sequences-body {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
  }

  .section {
    margin-bottom: 2rem;
  }

  .section-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0 0 1rem;
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
    padding: 0 0.5rem;
  }

  .list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .list-item {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    background: var(--background-secondary);
    border-radius: 12px;
    border: 1px solid var(--border-color);
    transition: all var(--duration-normal);
  }

  .list-item:hover {
    background: var(--background-tertiary);
    transform: translateY(-1px);
  }

  .list-item.draft {
    border-left: 3px solid var(--color-warning);
  }

  .list-item.saved {
    border-left: 3px solid var(--color-success);
  }

  .item-icon {
    font-size: 1.5rem;
    color: var(--text-secondary);
    flex-shrink: 0;
  }

  .list-item.draft .item-icon {
    color: var(--color-warning);
  }

  .list-item.saved .item-icon {
    color: var(--color-success);
  }

  .item-info {
    flex: 1;
    min-width: 0;
  }

  .item-title {
    font-weight: 500;
    color: var(--text-primary);
    margin-bottom: 0.25rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .item-meta {
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .item-actions {
    display: flex;
    gap: 0.5rem;
  }

  .action-btn {
    padding: 0.5rem 0.75rem;
    border: none;
    border-radius: 6px;
    background: var(--background-primary);
    color: var(--text-secondary);
    cursor: pointer;
    transition: all var(--duration-normal);
  }

  .action-btn:hover {
    color: var(--text-primary);
    background: var(--background-hover);
  }

  .action-btn.load:hover {
    color: var(--color-info);
  }

  .action-btn.delete:hover {
    color: var(--color-danger);
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 2rem;
    text-align: center;
    color: var(--text-secondary);
  }

  .empty-state i {
    font-size: 4rem;
    opacity: 0.3;
    margin-bottom: 1rem;
  }

  .empty-state p {
    margin: 0.5rem 0;
    font-size: 1.125rem;
    font-weight: 500;
  }

  .empty-hint {
    font-size: 0.875rem;
    opacity: 0.7;
  }
</style>
