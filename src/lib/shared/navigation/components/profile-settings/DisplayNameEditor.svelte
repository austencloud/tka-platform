<!--
  DisplayNameEditor Component

  Inline editor for user display name with edit/save/cancel flow.
  Extracted from AccountSettingsSection for single responsibility.
-->
<script lang="ts">
  import type { IHapticFeedback } from "../../../application/services/contracts/IHapticFeedback";
  import type { User } from "firebase/auth";
  import { authState } from "../../../auth/state/authState.svelte";

  interface Props {
    user: User;
    hapticService: IHapticFeedback | null;
  }

  let { user, hapticService }: Props = $props();

  // Local state
  let editedName = $state("");
  let isEditing = $state(false);
  let isSaving = $state(false);

  // Sync editedName when user changes (and not editing)
  $effect(() => {
    if (!isEditing) {
      editedName = user.displayName || "";
    }
  });

  function startEditing() {
    editedName = user.displayName || "";
    isEditing = true;
    hapticService?.trigger("selection");
  }

  function cancelEditing() {
    isEditing = false;
    editedName = user.displayName || "";
  }

  async function save() {
    const trimmedName = editedName.trim();
    if (!trimmedName || trimmedName === user.displayName) {
      cancelEditing();
      return;
    }

    isSaving = true;
    try {
      await authState.updateDisplayName(trimmedName);
      hapticService?.trigger("success");
      isEditing = false;
    } catch (error) {
      console.error("Failed to update display name:", error);
      hapticService?.trigger("error");
    } finally {
      isSaving = false;
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      save();
    } else if (e.key === "Escape") {
      cancelEditing();
    }
  }
</script>

<div class="section">
  <label class="label" for="display-name">Display Name</label>
  {#if isEditing}
    <div class="input-row">
      <input
        id="display-name"
        type="text"
        class="input"
        bind:value={editedName}
        onkeydown={handleKeydown}
        maxlength="50"
        placeholder="Your display name"
        disabled={isSaving}
      />
      <div class="inline-actions">
        <button
          class="icon-btn save"
          onclick={save}
          disabled={isSaving || !editedName.trim()}
          aria-label="Save display name"
        >
          {#if isSaving}
            <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
          {:else}
            <i class="fas fa-check" aria-hidden="true"></i>
          {/if}
        </button>
        <button
          class="icon-btn cancel"
          onclick={cancelEditing}
          disabled={isSaving}
          aria-label="Cancel editing"
        >
          <i class="fas fa-times" aria-hidden="true"></i>
        </button>
      </div>
    </div>
  {:else}
    <div class="value-row">
      <span class="current-value">{user.displayName || "Not set"}</span>
      <button
        class="edit-btn"
        onclick={startEditing}
        aria-label="Edit display name"
      >
        <i class="fas fa-pen" aria-hidden="true"></i>
        Edit
      </button>
    </div>
  {/if}
</div>

<style>
  .section {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .label {
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--theme-text);
  }

  .value-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 16px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 10px;
  }

  .current-value {
    font-size: var(--font-size-sm);
    color: var(--theme-text-dim);
  }

  .edit-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 8px;
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-fast) ease;
  }

  .edit-btn:hover {
    background: rgba(255, 255, 255, 0.12);
    border-color: rgba(255, 255, 255, 0.25);
    color: var(--theme-text);
  }

  .edit-btn i {
    font-size: 11px;
  }

  .input-row {
    display: flex;
    gap: 8px;
  }

  .inline-actions {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
  }

  .icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 8px;
    border: none;
    cursor: pointer;
    transition: all var(--duration-fast) ease;
  }

  .icon-btn.save {
    background: rgba(34, 197, 94, 0.15);
    color: #4ade80;
  }

  .icon-btn.save:hover:not(:disabled) {
    background: rgba(34, 197, 94, 0.25);
  }

  .icon-btn.cancel {
    background: rgba(239, 68, 68, 0.15);
    color: #f87171;
  }

  .icon-btn.cancel:hover:not(:disabled) {
    background: rgba(239, 68, 68, 0.25);
  }

  .icon-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .input {
    flex: 1;
    min-width: 0;
    padding: 12px 16px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 8px;
    color: var(--theme-text);
    font-size: var(--font-size-sm);
    transition: all var(--duration-normal) ease;
  }

  .input:focus {
    outline: none;
    border-color: color-mix(in srgb, var(--theme-accent) 60%, transparent);
    background: var(--theme-card-hover-bg);
  }

  .input::placeholder {
    color: var(--theme-text-dim);
    opacity: 0.6;
  }

  .input:disabled {
    opacity: 0.6;
  }

  /* Accessibility */
  .input:focus-visible {
    outline: 3px solid var(--theme-accent);
    outline-offset: 2px;
  }

  .edit-btn:focus-visible,
  .icon-btn:focus-visible {
    outline: 3px solid var(--theme-accent);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .edit-btn,
    .icon-btn {
      transition: none;
    }
  }
</style>
