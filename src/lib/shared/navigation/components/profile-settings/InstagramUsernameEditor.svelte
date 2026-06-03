<!--
  InstagramUsernameEditor Component

  Inline editor for Instagram username with format validation.
  Simpler than UsernameEditor - no availability checking needed.
-->
<script lang="ts">
  import type { HapticFeedback } from "../../../application/services/haptic-feedback";
  import type { User } from "firebase/auth";
  import { authState } from "../../../auth/state/auth-state.svelte";
  import { toast } from "../../../toast/state/toast-state.svelte";
  import { doc, getDoc } from "firebase/firestore";
  import { getFirestoreInstance } from "../../../auth/firebase";
  import { onMount } from "svelte";

  interface Props {
    user: User;
    hapticService: HapticFeedback | null;
  }

  let { user, hapticService }: Props = $props();

  // Local state
  let currentUsername = $state("");
  let editedUsername = $state("");
  let isEditing = $state(false);
  let isSaving = $state(false);
  let error = $state("");

  // Instagram username validation: alphanumeric, underscores, periods, 1-30 chars
  const INSTAGRAM_REGEX = /^[a-zA-Z0-9._]{1,30}$/;

  // Load current Instagram username from Firestore on mount
  onMount(async () => {
    try {
      const firestore = await getFirestoreInstance();
      const userDocRef = doc(firestore, "users", user.uid);
      const userDoc = await getDoc(userDocRef);
      if (userDoc.exists()) {
        currentUsername = userDoc.data()?.instagramUsername || "";
      }
    } catch (err) {
      console.error("Failed to load Instagram username:", err);
    }
  });

  // Derived: can save if valid format and changed
  const isSaveDisabled = $derived(
    isSaving ||
    !!error ||
    (editedUsername.trim() !== "" && !validateFormat(editedUsername.trim())) ||
    editedUsername.trim() === currentUsername
  );

  function validateFormat(username: string): boolean {
    if (!username) return true; // Empty is valid (clears the field)
    return INSTAGRAM_REGEX.test(username);
  }

  function startEditing() {
    editedUsername = currentUsername;
    isEditing = true;
    error = "";
    hapticService?.trigger("selection");
  }

  function cancelEditing() {
    isEditing = false;
    editedUsername = "";
    error = "";
  }

  function handleInput() {
    error = "";

    // Strip @ if user enters it
    if (editedUsername.startsWith("@")) {
      editedUsername = editedUsername.slice(1);
    }

    // Validate format
    const username = editedUsername.trim();
    if (username && !validateFormat(username)) {
      error = "Letters, numbers, underscores, and periods only (1-30 chars)";
    }
  }

  async function save() {
    const trimmedUsername = editedUsername.trim();

    // Validate format
    if (trimmedUsername && !validateFormat(trimmedUsername)) {
      error = "Invalid format";
      return;
    }

    // Don't save if unchanged
    if (trimmedUsername === currentUsername) {
      cancelEditing();
      return;
    }

    isSaving = true;
    try {
      await authState.updateInstagramUsername(trimmedUsername);
      currentUsername = trimmedUsername;
      hapticService?.trigger("success");
      toast.success(trimmedUsername ? "Instagram username updated" : "Instagram username cleared");
      isEditing = false;
    } catch (err) {
      console.error("Failed to update Instagram username:", err);
      hapticService?.trigger("error");
      toast.error(err instanceof Error ? err.message : "Failed to update Instagram");
    } finally {
      isSaving = false;
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" && !isSaveDisabled) {
      e.preventDefault();
      save();
    } else if (e.key === "Escape") {
      cancelEditing();
    }
  }
</script>

<div class="section">
  <label class="label" for="instagram-username">Instagram</label>
  {#if isEditing}
    <div class="input-row">
      <div class="instagram-input-wrapper" class:error class:success={editedUsername.trim() && !error}>
        <i class="fab fa-instagram instagram-icon" aria-hidden="true"></i>
        <input
          id="instagram-username"
          type="text"
          class="input instagram-input"
          bind:value={editedUsername}
          oninput={handleInput}
          onkeydown={handleKeydown}
          maxlength="30"
          placeholder="your_username"
          disabled={isSaving}
          aria-invalid={error ? "true" : "false"}
          aria-describedby={error ? "instagram-error" : undefined}
        />
      </div>
      <div class="inline-actions">
        <button
          class="icon-btn save"
          onclick={save}
          disabled={isSaveDisabled}
          aria-label="Save Instagram username"
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

    <!-- Real-time feedback -->
    {#if error}
      <p id="instagram-error" class="hint-message error" role="alert">
        <i class="fas fa-exclamation-circle" aria-hidden="true"></i>
        {error}
      </p>
    {/if}
  {:else}
    <div
      class="value-row"
      onclick={startEditing}
      onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && startEditing()}
      role="button"
      tabindex="0"
      aria-label="Edit Instagram username"
    >
      <div class="current-value-wrapper">
        <i class="fab fa-instagram instagram-icon" aria-hidden="true"></i>
        <span class="current-value">{currentUsername || "Not set"}</span>
      </div>
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

  .current-value-wrapper {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .current-value {
    font-size: var(--font-size-sm);
    color: var(--theme-text-dim);
  }

  .instagram-icon {
    font-size: 16px;
    color: #E4405F;
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

  /* Instagram input wrapper */
  .instagram-input-wrapper {
    flex: 1;
    display: flex;
    align-items: center;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 8px;
    transition: all var(--duration-normal) ease;
    padding-left: 12px;
  }

  .instagram-input-wrapper:focus-within {
    border-color: color-mix(in srgb, #E4405F 60%, transparent);
    background: var(--theme-card-hover-bg);
  }

  .instagram-input-wrapper.error {
    border-color: rgba(239, 68, 68, 0.6);
  }

  .instagram-input-wrapper.success {
    border-color: rgba(228, 64, 95, 0.6);
  }

  .instagram-input {
    border: none;
    background: transparent;
    padding-left: 8px;
  }

  .instagram-input:focus {
    border: none;
    background: transparent;
    outline: none;
  }

  /* Hint messages */
  .hint-message {
    font-size: var(--font-size-compact);
    margin: 6px 0 0 0;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .hint-message.error {
    color: rgba(239, 68, 68, 0.9);
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
