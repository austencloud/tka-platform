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
    <button class="auth-nudge-dismiss" onclick={onDismiss}>Not now</button>
  </div>
  <div class="auth-nudge-login">
    <span class="login-text">Already have an account?</span>
    <button class="login-link" onclick={onLogin}>Log in</button>
  </div>
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
    align-items: center;
    justify-content: center;
    gap: 12px;
  }

  .auth-nudge-primary {
    background: var(--theme-accent, #3b82f6);
    color: #ffffff;
    border: none;
    border-radius: var(--radius-md, 8px);
    padding: 10px 20px;
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.15s;
  }

  .auth-nudge-primary:hover {
    opacity: 0.9;
  }

  .auth-nudge-dismiss {
    background: transparent;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    border: none;
    padding: 10px 12px;
    font-size: var(--font-size-min, 14px);
    cursor: pointer;
  }

  .auth-nudge-dismiss:hover {
    color: var(--theme-text, #ffffff);
  }

  .auth-nudge-login {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    margin-top: 8px;
    font-size: var(--font-size-compact, 12px);
  }

  .login-text {
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.45));
  }

  .login-link {
    background: none;
    border: none;
    color: var(--theme-accent, #3b82f6);
    cursor: pointer;
    font-size: var(--font-size-compact, 12px);
    padding: 0;
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .login-link:hover {
    opacity: 0.8;
  }
</style>
