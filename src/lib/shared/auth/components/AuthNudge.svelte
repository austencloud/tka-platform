<script lang="ts">
  import type { AuthNudgeTrigger } from "../domain/auth-nudge-trigger";
  import { AUTH_NUDGE_TEXTS } from "../domain/auth-nudge-trigger";

  interface Props {
    trigger: AuthNudgeTrigger;
    onCreateAccount: () => void;
    onLogin: () => void;
    onDismiss: () => void;
  }

  let { trigger, onCreateAccount, onLogin, onDismiss }: Props = $props();

  const text = $derived(AUTH_NUDGE_TEXTS[trigger]);
  const isScribeNudge = $derived(trigger === "beat-cap-composer");
  const buttonText = $derived(
    isScribeNudge ? "Become a Scribe" : "Create Account - free"
  );
</script>

<div class="auth-nudge" role="alert">
  <p class="auth-nudge-text">{text}</p>
  <div class="auth-nudge-actions">
    <button class="auth-nudge-primary" onclick={onCreateAccount}>
      {buttonText}
    </button>
    <button class="auth-nudge-login-btn" onclick={onLogin}>Log in</button>
  </div>
  <button class="auth-nudge-dismiss" onclick={onDismiss}>Not now</button>
</div>

<style>
  .auth-nudge {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--radius-lg, 12px);
    padding: 20px;
    text-align: center;
    max-width: 360px;
    margin: 24px auto;
  }

  .auth-nudge-text {
    color: var(--theme-text, #ffffff);
    font-size: var(--font-size-min, 14px);
    line-height: 1.5;
    margin: 0 0 16px 0;
  }

  .auth-nudge-actions {
    display: flex;
    align-items: stretch;
    justify-content: center;
    gap: 10px;
  }

  /* Equal-width pair so the row reads as two peer choices. */
  .auth-nudge-primary,
  .auth-nudge-login-btn {
    flex: 1 1 0;
    min-height: var(--min-touch-target, 44px);
    border-radius: var(--radius-md, 8px);
    padding: 10px 16px;
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    cursor: pointer;
    transition:
      background 0.15s,
      border-color 0.15s,
      opacity 0.15s;
  }

  .auth-nudge-primary {
    background: var(--theme-accent, #3b82f6);
    color: #ffffff;
    border: none;
  }

  .auth-nudge-primary:hover {
    opacity: 0.9;
  }

  .auth-nudge-login-btn {
    background: color-mix(
      in srgb,
      var(--theme-accent, #3b82f6) 12%,
      transparent
    );
    color: var(--theme-text, #ffffff);
    border: 1.5px solid
      color-mix(in srgb, var(--theme-accent, #3b82f6) 45%, transparent);
  }

  .auth-nudge-login-btn:hover {
    background: color-mix(
      in srgb,
      var(--theme-accent, #3b82f6) 22%,
      transparent
    );
    border-color: color-mix(
      in srgb,
      var(--theme-accent, #3b82f6) 70%,
      transparent
    );
  }

  .auth-nudge-dismiss {
    background: transparent;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    border: none;
    margin-top: 10px;
    padding: 6px 12px;
    font-size: var(--font-size-compact, 12px);
    cursor: pointer;
  }

  .auth-nudge-dismiss:hover {
    color: var(--theme-text, #ffffff);
  }
</style>
