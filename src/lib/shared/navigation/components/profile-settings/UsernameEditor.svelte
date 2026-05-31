<!--
  UsernameEditor Component

  Inline editor for username with real-time availability checking and suggestions.
  Extracted from AccountSettingsSection for single responsibility.
-->
<script lang="ts">
  import { checkUsernameAvailability } from "$lib/shared/auth/services/username-validator";
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
  let isChecking = $state(false);
  let error = $state("");
  let isAvailable = $state(false);
  let suggestions = $state<string[]>([]);
  let checkTimeoutId: ReturnType<typeof setTimeout> | null = null;

  // Load current username from Firestore on mount
  onMount(async () => {
    try {
      const firestore = await getFirestoreInstance();
      const userDocRef = doc(firestore, "users", user.uid);
      const userDoc = await getDoc(userDocRef);
      if (userDoc.exists()) {
        currentUsername = userDoc.data()?.username || "";
      }
    } catch (err) {
      console.error("Failed to load username:", err);
    }
  });

  const isSaveDisabled = $derived(
    isSaving ||
    isChecking ||
    !isAvailable ||
    !editedUsername.trim() ||
    editedUsername.trim().toLowerCase() === currentUsername.toLowerCase()
  );

  function startEditing() {
    editedUsername = currentUsername;
    isEditing = true;
    error = "";
    isAvailable = false;
    suggestions = [];
    hapticService?.trigger("selection");
  }

  function cancelEditing() {
    isEditing = false;
    editedUsername = "";
    error = "";
    isAvailable = false;
    suggestions = [];
    if (checkTimeoutId) {
      clearTimeout(checkTimeoutId);
      checkTimeoutId = null;
    }
  }

  function handleInput() {
    // Clear previous timeout
    if (checkTimeoutId) {
      clearTimeout(checkTimeoutId);
    }

    error = "";
    isAvailable = false;
    suggestions = [];

    const username = editedUsername.trim();
    if (!username) return;

    // Debounce the availability check
    checkTimeoutId = setTimeout(() => {
      checkAvailability(username);
    }, 500);
  }

  async function checkAvailability(username: string) {
    // Skip check if unchanged
    if (username.toLowerCase() === currentUsername.toLowerCase()) {
      isAvailable = true;
      return;
    }

    isChecking = true;
    try {
      const result = await checkUsernameAvailability(username, user.uid);
      if (result.isValid) {
        isAvailable = true;
        error = "";
      } else {
        isAvailable = false;
        error = result.error || "Username unavailable";
        suggestions = result.suggestions || [];
      }
    } catch (err) {
      console.error("Failed to check username:", err);
      error = "Unable to check availability";
    } finally {
      isChecking = false;
    }
  }

  async function save() {
    const trimmedUsername = editedUsername.trim();
    if (!trimmedUsername || !isAvailable) {
      cancelEditing();
      return;
    }

    // Don't save if unchanged
    if (trimmedUsername.toLowerCase() === currentUsername.toLowerCase()) {
      cancelEditing();
      return;
    }

    isSaving = true;
    try {
      await authState.updateUsername(trimmedUsername);
      currentUsername = trimmedUsername;
      hapticService?.trigger("success");
      toast.success("Username updated successfully");
      isEditing = false;
    } catch (err) {
      console.error("Failed to update username:", err);
      hapticService?.trigger("error");
      toast.error(err instanceof Error ? err.message : "Failed to update username");
    } finally {
      isSaving = false;
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" && isAvailable && !isChecking) {
      e.preventDefault();
      save();
    } else if (e.key === "Escape") {
      cancelEditing();
    }
  }

  function selectSuggestion(suggestion: string) {
    editedUsername = suggestion;
    handleInput();
  }
</script>

<div class="section">
  <label class="label" for="username">Username</label>
  {#if isEditing}
    <div class="input-row">
      <div class="username-input-wrapper" class:error class:success={isAvailable && !isChecking}>
        <span class="username-prefix">@</span>
        <input
          id="username"
          type="text"
          class="input username-input"
          bind:value={editedUsername}
          oninput={handleInput}
          onkeydown={handleKeydown}
          maxlength="20"
          placeholder="your_username"
          disabled={isSaving}
          aria-invalid={error ? "true" : "false"}
          aria-describedby={error ? "username-error" : undefined}
        />
      </div>
      <div class="inline-actions">
        <button
          class="icon-btn save"
          onclick={save}
          disabled={isSaveDisabled}
          aria-label="Save username"
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
    {#if isChecking}
      <p class="hint-message checking">
        <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
        Checking availability...
      </p>
    {:else if error}
      <p id="username-error" class="hint-message error" role="alert">
        <i class="fas fa-exclamation-circle" aria-hidden="true"></i>
        {error}
      </p>
      {#if suggestions.length > 0}
        <div class="suggestions">
          <span class="suggestions-label">Try:</span>
          {#each suggestions as suggestion}
            <button
              type="button"
              class="suggestion-btn"
              onclick={() => selectSuggestion(suggestion)}
            >
              @{suggestion}
            </button>
          {/each}
        </div>
      {/if}
    {:else if isAvailable && editedUsername.trim()}
      <p class="hint-message success">
        <i class="fas fa-check-circle" aria-hidden="true"></i>
        Username available
      </p>
    {/if}
  {:else}
    <div
      class="value-row"
      onclick={startEditing}
      onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && startEditing()}
      role="button"
      tabindex="0"
      aria-label="Edit username"
    >
      <span class="current-value">@{currentUsername || "Not set"}</span>
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

  /* Username input wrapper */
  .username-input-wrapper {
    flex: 1;
    display: flex;
    align-items: center;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 8px;
    transition: all var(--duration-normal) ease;
  }

  .username-input-wrapper:focus-within {
    border-color: color-mix(in srgb, var(--theme-accent) 60%, transparent);
    background: var(--theme-card-hover-bg);
  }

  .username-input-wrapper.error {
    border-color: rgba(239, 68, 68, 0.6);
  }

  .username-input-wrapper.success {
    border-color: rgba(34, 197, 94, 0.6);
  }

  .username-prefix {
    padding: 12px 0 12px 16px;
    color: var(--theme-text-dim);
    font-size: var(--font-size-sm);
    user-select: none;
  }

  .username-input {
    border: none;
    background: transparent;
    padding-left: 4px;
  }

  .username-input:focus {
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

  .hint-message.checking {
    color: var(--theme-text-dim);
  }

  .hint-message.error {
    color: rgba(239, 68, 68, 0.9);
  }

  .hint-message.success {
    color: rgba(34, 197, 94, 0.9);
  }

  /* Suggestions */
  .suggestions {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 8px;
  }

  .suggestions-label {
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim);
  }

  .suggestion-btn {
    padding: 4px 10px;
    font-size: var(--font-size-compact);
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 6px;
    color: var(--theme-text-dim);
    cursor: pointer;
    transition: all var(--duration-fast) ease;
  }

  .suggestion-btn:hover {
    background: rgba(255, 255, 255, 0.12);
    border-color: rgba(255, 255, 255, 0.25);
    color: var(--theme-text);
  }

  /* Accessibility */
  .input:focus-visible {
    outline: 3px solid var(--theme-accent);
    outline-offset: 2px;
  }

  .icon-btn:focus-visible,
  .suggestion-btn:focus-visible {
    outline: 3px solid var(--theme-accent);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .value-row,
    .edit-icon,
    .icon-btn,
    .suggestion-btn {
      transition: none;
    }
  }
</style>
