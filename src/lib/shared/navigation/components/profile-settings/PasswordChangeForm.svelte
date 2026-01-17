<!--
  PasswordChangeForm Component

  Expandable form for changing password with visibility toggles.
  Uses shared profile-settings-state for password form state.
  Extracted from AccountSettingsSection for single responsibility.
-->
<script lang="ts">
  import type { IHapticFeedback } from "../../../application/services/contracts/IHapticFeedback";
  import {
    passwordState,
    resetPasswordForm,
    uiState,
  } from "../../state/profile-settings-state.svelte";

  interface Props {
    onChangePassword: () => Promise<void>;
    hapticService: IHapticFeedback | null;
  }

  let { onChangePassword, hapticService }: Props = $props();

  // Password visibility toggles
  let showCurrentPassword = $state(false);
  let showNewPassword = $state(false);

  const isFormValid = $derived(
    passwordState.new && passwordState.new.length >= 8 && !uiState.saving
  );

  const isPasswordWeak = $derived(
    passwordState.new && passwordState.new.length < 8
  );

  function handleExpand() {
    hapticService?.trigger("selection");
    uiState.showPasswordSection = true;
  }

  function handleCancel() {
    hapticService?.trigger("selection");
    uiState.showPasswordSection = false;
    resetPasswordForm();
    showCurrentPassword = false;
    showNewPassword = false;
  }

  function toggleCurrentPassword() {
    hapticService?.trigger("selection");
    showCurrentPassword = !showCurrentPassword;
  }

  function toggleNewPassword() {
    hapticService?.trigger("selection");
    showNewPassword = !showNewPassword;
  }
</script>

<div class="section">
  <span class="label">Password</span>
  {#if !uiState.showPasswordSection}
    <button class="button button--secondary" onclick={handleExpand}>
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
            aria-label={showCurrentPassword ? "Hide password" : "Show password"}
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
        <button class="button button--secondary" onclick={handleCancel}>
          Cancel
        </button>
        <button
          class="button button--primary"
          onclick={onChangePassword}
          disabled={!isFormValid}
        >
          <i class="fas fa-check" aria-hidden="true"></i>
          Update Password
        </button>
      </div>
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

  .field-label {
    display: block;
    font-size: var(--font-size-sm);
    font-weight: 500;
    color: var(--theme-text);
    margin-bottom: 8px;
  }

  .optional {
    color: var(--theme-text-dim);
    font-weight: 500;
    font-size: var(--font-size-compact);
  }

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

  .input-with-toggle {
    padding-right: 50px;
  }

  .input[aria-invalid="true"] {
    border-color: rgba(251, 191, 36, 0.6);
  }

  .input[aria-invalid="true"]:focus {
    border-color: rgba(251, 191, 36, 0.8);
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
    transition: all var(--duration-normal) ease;
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
    transition: all var(--duration-normal) ease;
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
    box-shadow: 0 2px 8px color-mix(in srgb, var(--theme-accent) 30%, transparent);
  }

  .button--primary:hover:not(:disabled) {
    filter: brightness(1.1);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px color-mix(in srgb, var(--theme-accent) 40%, transparent);
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
  .toggle-visibility:focus-visible {
    outline: 3px solid var(--theme-accent);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .button,
    .toggle-visibility {
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
