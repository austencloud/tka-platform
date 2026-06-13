<!--
  DisplayNameEditor Component

  Inline editor for user display name with edit/save/cancel flow.
  Extracted from AccountSettingsSection for single responsibility.
-->
<script lang="ts">
  import type { HapticFeedback } from "../../../application/services/haptic-feedback";
  import type { User } from "firebase/auth";
  import { authState } from "../../../auth/state/auth-state.svelte";

  interface Props {
    user: User;
    hapticService: HapticFeedback | null;
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
  <p class="helper-text">This is your public identity. Other users will see this name when they view your sequences, comments, and profile.</p>
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
    <div
      class="value-row"
      onclick={startEditing}
      onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && startEditing()}
      role="button"
      tabindex="0"
      aria-label="Edit display name"
    >
      <span class="current-value">{user.displayName || "Not set"}</span>
      <i class="fas fa-pen edit-icon" aria-hidden="true"></i>
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

  .helper-text {
    margin: 0;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim);
    line-height: 1.4;
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
    cursor: pointer;
    transition: all var(--duration-fast) ease;
  }

  .value-row:hover,
  .value-row:focus {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
  }

  .value-row:focus-visible {
    outline: 3px solid var(--theme-accent);
    outline-offset: 2px;
  }

  .current-value {
    font-size: var(--font-size-sm);
    color: var(--theme-text-dim);
  }

  .edit-icon {
    font-size: 12px;
    color: var(--theme-text-dim);
    opacity: 0;
    transition: opacity var(--duration-fast) ease;
  }

  .value-row:hover .edit-icon,
  .value-row:focus .edit-icon {
    opacity: 0.6;
  }

  /* Always show on touch devices (no hover capability) */
  @media (hover: none) {
    .edit-icon {
      opacity: 0.4;
    }
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
    background: color-mix(in srgb, var(--semantic-success, #22c55e) 15%, transparent);
    color: color-mix(in srgb, var(--semantic-success, #22c55e) 75%, white);
  }

  .icon-btn.save:hover:not(:disabled) {
    background: color-mix(in srgb, var(--semantic-success, #22c55e) 25%, transparent);
  }

  .icon-btn.cancel {
    background: color-mix(in srgb, var(--semantic-error, #ef4444) 15%, transparent);
    color: color-mix(in srgb, var(--semantic-error, #ef4444) 75%, white);
  }

  .icon-btn.cancel:hover:not(:disabled) {
    background: color-mix(in srgb, var(--semantic-error, #ef4444) 25%, transparent);
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

  .icon-btn:focus-visible {
    outline: 3px solid var(--theme-accent);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .value-row,
    .edit-icon,
    .icon-btn {
      transition: none;
    }
  }
</style>
