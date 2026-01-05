<!--
  AccountSettingsSection Component

  Allows users to update their display name and (if they have password auth) change their password.
  Display name editing is always available; password section is conditional.
-->
<script lang="ts">
  import type { IHapticFeedback } from "../../../application/services/contracts/IHapticFeedback";
  import {
    passwordState,
    resetPasswordForm,
    uiState,
  } from "../../state/profile-settings-state.svelte";
  import { updateProfile, type User } from "firebase/auth";

  interface Props {
    user: User;
    hasPasswordProvider: boolean;
    onChangePassword: () => Promise<void>;
    hapticService: IHapticFeedback | null;
  }

  let { user, hasPasswordProvider, onChangePassword, hapticService }: Props =
    $props();

  // Display name editing state
  // Initialize empty - $effect below syncs with user.displayName when not editing
  let editedName = $state("");
  let isEditingName = $state(false);
  let isSavingName = $state(false);

  // Password visibility toggles
  let showCurrentPassword = $state(false);
  let showNewPassword = $state(false);

  // Sync editedName when user changes
  $effect(() => {
    if (!isEditingName) {
      editedName = user.displayName || "";
    }
  });

  function startEditingName() {
    editedName = user.displayName || "";
    isEditingName = true;
    hapticService?.trigger("selection");
  }

  function cancelEditingName() {
    isEditingName = false;
    editedName = user.displayName || "";
  }

  async function saveDisplayName() {
    const trimmedName = editedName.trim();
    if (!trimmedName || trimmedName === user.displayName) {
      cancelEditingName();
      return;
    }

    isSavingName = true;
    try {
      await updateProfile(user, { displayName: trimmedName });
      hapticService?.trigger("success");
      isEditingName = false;
    } catch (error) {
      console.error("Failed to update display name:", error);
      hapticService?.trigger("error");
    } finally {
      isSavingName = false;
    }
  }

  function handleNameKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      saveDisplayName();
    } else if (e.key === "Escape") {
      cancelEditingName();
    }
  }

  function handlePasswordCancel() {
    hapticService?.trigger("selection");
    uiState.showPasswordSection = false;
    resetPasswordForm();
    showCurrentPassword = false;
    showNewPassword = false;
  }

  function handlePasswordExpand() {
    hapticService?.trigger("selection");
    uiState.showPasswordSection = true;
  }

  function toggleCurrentPassword() {
    hapticService?.trigger("selection");
    showCurrentPassword = !showCurrentPassword;
  }

  function toggleNewPassword() {
    hapticService?.trigger("selection");
    showNewPassword = !showNewPassword;
  }

  const isPasswordFormValid = $derived(
    passwordState.new && passwordState.new.length >= 8 && !uiState.saving
  );

  const isPasswordWeak = $derived(
    passwordState.new && passwordState.new.length < 8
  );
</script>

<div class="account-settings">
  <!-- Display Name Section -->
  <div class="section">
    <label class="label" for="display-name">Display Name</label>
    {#if isEditingName}
      <div class="input-row">
        <input
          id="display-name"
          type="text"
          class="input"
          bind:value={editedName}
          onkeydown={handleNameKeydown}
          maxlength="50"
          placeholder="Your display name"
          disabled={isSavingName}
        />
        <div class="inline-actions">
          <button
            class="icon-btn save"
            onclick={saveDisplayName}
            disabled={isSavingName || !editedName.trim()}
            aria-label="Save display name"
          >
            {#if isSavingName}
              <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
            {:else}
              <i class="fas fa-check" aria-hidden="true"></i>
            {/if}
          </button>
          <button
            class="icon-btn cancel"
            onclick={cancelEditingName}
            disabled={isSavingName}
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
          onclick={startEditingName}
          aria-label="Edit display name"
        >
          <i class="fas fa-pen" aria-hidden="true"></i>
          Edit
        </button>
      </div>
    {/if}
  </div>

  <!-- Password Section (only for password-authenticated users) -->
  {#if hasPasswordProvider}
    <div class="divider"></div>
    <div class="section">
      <span class="label">Password</span>
      {#if !uiState.showPasswordSection}
        <button class="button button--secondary" onclick={handlePasswordExpand}>
          <i class="fas fa-lock" aria-hidden="true"></i>
          Change Password
        </button>
      {:else}
        <div class="password-form">
          <div class="field">
            <label class="field-label" for="current-password">
              Current Password <span class="optional">(optional)</span>
            </label>
            <div class="input-wrapper">
              <input
                id="current-password"
                type={showCurrentPassword ? "text" : "password"}
                class="input input-with-toggle"
                bind:value={passwordState.current}
                placeholder="Enter current password (fallback)"
                autocomplete="current-password"
              />
              <button
                type="button"
                class="toggle-visibility"
                onclick={toggleCurrentPassword}
                aria-label={showCurrentPassword
                  ? "Hide password"
                  : "Show password"}
              >
                <i
                  class="fas {showCurrentPassword ? 'fa-eye-slash' : 'fa-eye'}"
                  aria-hidden="true"
                ></i>
              </button>
            </div>
            <p class="hint-message subtle">
              If you have passkeys enabled, you can leave this blank and verify
              with your device.
            </p>
          </div>

          <div class="field">
            <label class="field-label" for="new-password">New Password</label>
            <div class="input-wrapper">
              <input
                id="new-password"
                type={showNewPassword ? "text" : "password"}
                class="input input-with-toggle"
                bind:value={passwordState.new}
                placeholder="Enter new password"
                aria-required="true"
                aria-invalid={isPasswordWeak ? "true" : "false"}
                aria-describedby={isPasswordWeak ? "password-hint" : undefined}
                autocomplete="new-password"
              />
              <button
                type="button"
                class="toggle-visibility"
                onclick={toggleNewPassword}
                aria-label={showNewPassword ? "Hide password" : "Show password"}
              >
                <i
                  class="fas {showNewPassword ? 'fa-eye-slash' : 'fa-eye'}"
                  aria-hidden="true"
                ></i>
              </button>
            </div>
            {#if isPasswordWeak}
              <p id="password-hint" class="hint-message" role="status">
                Password must be at least 8 characters
              </p>
            {/if}
          </div>

          <div class="button-row">
            <button
              class="button button--secondary"
              onclick={handlePasswordCancel}
            >
              Cancel
            </button>
            <button
              class="button button--primary"
              onclick={onChangePassword}
              disabled={!isPasswordFormValid}
            >
              <i class="fas fa-check" aria-hidden="true"></i>
              Update Password
            </button>
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .account-settings {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .section {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .divider {
    height: 1px;
    background: var(--theme-stroke);
    margin: 16px 0;
  }

  .label {
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--theme-text);
  }

  .field-label {
    display: block;
    font-size: var(--font-size-sm);
    font-weight: 500;
    color: var(--theme-text);
    margin-bottom: 8px;
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
    transition: all 0.15s ease;
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
    transition: all 0.15s ease;
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
    transition: all 0.2s ease;
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

  /* Password form specific styles */
  .password-form {
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 12px;
    padding: 20px;
  }

  .field {
    margin-bottom: 20px;
  }

  .input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  .input-with-toggle {
    padding-right: 50px;
  }

  .toggle-visibility {
    position: absolute;
    right: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: var(--theme-text-dim);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .toggle-visibility:hover {
    color: var(--theme-text);
    background: var(--theme-card-hover-bg);
  }

  .toggle-visibility:active {
    transform: scale(0.95);
  }

  .toggle-visibility i {
    font-size: var(--font-size-base);
  }

  .input[aria-invalid="true"] {
    border-color: rgba(251, 191, 36, 0.6);
  }

  .input[aria-invalid="true"]:focus {
    border-color: rgba(251, 191, 36, 0.8);
  }

  .hint-message {
    font-size: var(--font-size-compact);
    color: rgba(251, 191, 36, 0.9);
    margin: 6px 0 0 0;
    font-weight: 500;
  }

  .hint-message.subtle {
    color: var(--theme-text-dim);
    font-weight: 500;
  }

  .optional {
    color: var(--theme-text-dim);
    font-weight: 500;
    font-size: var(--font-size-compact);
  }

  .button-row {
    display: flex;
    gap: 12px;
    margin-top: 16px;
  }

  .button-row .button {
    flex: 1;
    margin-top: 0;
  }

  .button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: clamp(10px, 3cqi, 14px) clamp(12px, 4cqi, 24px);
    min-height: var(--min-touch-target);
    border-radius: 10px;
    font-size: var(--font-size-sm);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    border: none;
  }

  .button i {
    font-size: var(--font-size-base);
  }

  .button--primary {
    background: linear-gradient(
      135deg,
      var(--theme-accent),
      var(--theme-accent-strong)
    );
    color: white;
    box-shadow: 0 2px 8px
      color-mix(in srgb, var(--theme-accent) 30%, transparent);
  }

  .button--primary:hover:not(:disabled) {
    filter: brightness(1.1);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px
      color-mix(in srgb, var(--theme-accent) 40%, transparent);
  }

  .button--secondary {
    background: color-mix(in srgb, var(--theme-accent) 15%, transparent);
    color: var(--theme-accent);
    border: 1px solid color-mix(in srgb, var(--theme-accent) 40%, transparent);
  }

  .button--secondary:hover:not(:disabled) {
    background: color-mix(in srgb, var(--theme-accent) 25%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent) 60%, transparent);
  }

  .button:active:not(:disabled) {
    transform: scale(0.98);
  }

  .button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none !important;
  }

  /* Accessibility */
  .input:focus-visible {
    outline: 3px solid var(--theme-accent);
    outline-offset: 2px;
  }

  .button:focus-visible,
  .toggle-visibility:focus-visible,
  .edit-btn:focus-visible,
  .icon-btn:focus-visible {
    outline: 3px solid var(--theme-accent);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .button,
    .toggle-visibility,
    .edit-btn,
    .icon-btn {
      transition: none;
    }

    .button:hover,
    .button:active,
    .toggle-visibility:active {
      transform: none;
    }
  }

  @media (prefers-contrast: high) {
    .input:focus-visible {
      outline: 3px solid white;
    }

    .button:focus-visible,
    .toggle-visibility:focus-visible {
      outline: 3px solid white;
    }
  }
</style>
