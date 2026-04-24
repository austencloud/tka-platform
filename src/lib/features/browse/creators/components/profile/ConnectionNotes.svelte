<script lang="ts">
  /**
   * ConnectionNotes - Private notes about a user
   *
   * Auto-saves with 1s debounce, shows saving/saved status.
   * Only visible to the current user viewing another profile.
   */

  import { getConnectionManager } from "$lib/shared/community/getConnectionManager";
  import type { IConnectionManager } from "$lib/shared/community/services/contracts/IConnectionManager";

  interface Props {
    targetUserId: string;
    initialNotes?: string;
    onNotesChange?: (notes: string) => void;
  }

  let { targetUserId, initialNotes = "", onNotesChange }: Props = $props();

  let notes = $state("");
  let saveStatus = $state<"idle" | "saving" | "saved">("idle");
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  // Service
  let connectionManager: IConnectionManager;

  $effect(() => {
    connectionManager = getConnectionManager();
  });

  // Sync with initial notes if they change
  $effect.pre(() => {
    if (initialNotes !== notes && saveStatus === "idle") {
      notes = initialNotes;
    }
  });

  async function saveNotes() {
    if (!connectionManager || saveStatus === "saving") return;

    saveStatus = "saving";

    try {
      await connectionManager.saveNotes(targetUserId, notes);
      onNotesChange?.(notes);
      saveStatus = "saved";
      setTimeout(() => {
        saveStatus = "idle";
      }, 1500);
    } catch (err) {
      console.error("[ConnectionNotes] Failed to save:", err);
      saveStatus = "idle";
    }
  }

  function handleInput() {
    // Clear existing timer
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    // Debounce save
    debounceTimer = setTimeout(() => {
      saveNotes();
    }, 1000);
  }

  function handleBlur() {
    // Save immediately on blur if there's pending changes
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
      saveNotes();
    }
  }
</script>

<div class="connection-notes">
  <label class="notes-label" for="connection-notes">
    <span class="label-text">
      <i class="fas fa-sticky-note" aria-hidden="true"></i>
      Private Notes
    </span>
    {#if saveStatus === "saving"}
      <span class="save-status saving">
        <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
        Saving...
      </span>
    {:else if saveStatus === "saved"}
      <span class="save-status saved">
        <i class="fas fa-check" aria-hidden="true"></i>
        Saved
      </span>
    {/if}
  </label>
  <textarea
    id="connection-notes"
    class="notes-input"
    bind:value={notes}
    oninput={handleInput}
    onblur={handleBlur}
    placeholder="Add notes about this person (only you can see this)"
    rows="3"
  ></textarea>
  <span class="notes-hint">Only you can see these notes</span>
</div>

<style>
  .connection-notes {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .notes-label {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    color: var(--theme-text-dim);
  }

  .label-text {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .save-status {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: var(--font-size-xs, 11px);
    font-weight: 400;
  }

  .save-status.saving {
    color: var(--theme-text-dim);
  }

  .save-status.saved {
    color: var(--semantic-success);
  }

  .notes-input {
    width: 100%;
    padding: 12px 14px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    color: var(--theme-text);
    font-size: var(--font-size-sm, 14px);
    font-family: inherit;
    line-height: 1.5;
    resize: vertical;
    min-height: 80px;
    outline: none;
    transition: border-color var(--duration-normal, 200ms) ease;
  }

  .notes-input:focus {
    border-color: var(--theme-accent);
  }

  .notes-input::placeholder {
    color: var(--theme-text-dim);
  }

  .notes-hint {
    font-size: var(--font-size-xs, 11px);
    color: var(--theme-text-dim);
    opacity: 0.7;
  }
</style>
