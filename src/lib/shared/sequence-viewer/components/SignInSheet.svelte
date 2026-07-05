<script lang="ts">
  import type { SignInReason } from "./auth-action-queue.svelte";
  interface Props {
    open: boolean;
    reason: SignInReason | null;
    webviewMode: boolean;
    onPrimaryAction: () => void;
    onDismiss: () => void;
  }

  let { open, reason, webviewMode, onPrimaryAction, onDismiss }: Props = $props();

  const REASON_COPY: Record<SignInReason, string> = {
    save: "Sign in to save this to your library.",
    favorite: "Sign in to favorite this sequence.",
    publish: "Sign in to publish this sequence.",
    remix: "Sign in to remix this sequence.",
    sendTo: "Sign in to send this to someone.",
    download: "Create a free account to download this sequence.",
    account: "Sign in to save your scans and build your library.",
  };

  const REASON_COPY_WEBVIEW: Record<SignInReason, string> = {
    save: "Saving works best in your browser. We'll open this sequence in Chrome so you can sign in - your save will happen automatically.",
    favorite: "Favoriting works best in your browser. We'll open this sequence in Chrome so you can sign in - your favorite will apply automatically.",
    publish: "Publishing works best in your browser. We'll open this sequence in Chrome so you can sign in - your publish will go through automatically.",
    remix: "Remixing works best in your browser. We'll open this sequence in Chrome so you can sign in - you'll land in the editor.",
    sendTo: "Sending works best in your browser. We'll open this sequence in Chrome so you can sign in.",
    download: "Downloading works best in your browser. We'll open this sequence in Chrome so you can sign in - your download will start automatically.",
    account: "Sign-in works best in your browser. We'll open this sequence in Chrome so you can sign in.",
  };

  const message = $derived.by(() => {
    if (!reason) return "";
    return webviewMode ? REASON_COPY_WEBVIEW[reason] : REASON_COPY[reason];
  });

  const primaryLabel = $derived(webviewMode ? "Continue in browser" : "Sign in with Google");

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape" && open) {
      onDismiss();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
  <div
    class="backdrop"
    role="button"
    tabindex="-1"
    aria-label="Close sign-in"
    onclick={onDismiss}
    onkeydown={(e) => { if (e.key === "Enter" || e.key === " ") onDismiss(); }}
  ></div>
  <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="signin-title">
    <button type="button" class="close-btn" onclick={onDismiss} aria-label="Close">
      <i class="fas fa-xmark" aria-hidden="true"></i>
    </button>
    <h2 id="signin-title" class="title">Sign in</h2>
    <p class="message">{message}</p>
    <button type="button" class="primary-btn" onclick={onPrimaryAction}>
      {#if !webviewMode}
        <i class="fab fa-google" aria-hidden="true"></i>
      {:else}
        <i class="fas fa-arrow-up-right-from-square" aria-hidden="true"></i>
      {/if}
      <span>{primaryLabel}</span>
    </button>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    z-index: var(--z-priority);
    cursor: pointer;
  }
  .sheet {
    position: fixed;
    left: 50%;
    bottom: 0;
    transform: translateX(-50%);
    width: min(480px, 100vw);
    background: var(--theme-panel-bg, #1a1a1a);
    border-top-left-radius: 16px;
    border-top-right-radius: 16px;
    padding: 24px 20px 32px;
    z-index: calc(var(--z-priority) + 1);
    box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.4);
    color: var(--theme-text, #fff);
  }
  @media (min-width: 768px) {
    .sheet {
      bottom: auto;
      top: 50%;
      transform: translate(-50%, -50%);
      border-radius: 16px;
      padding: 32px 28px;
    }
  }
  .close-btn {
    position: absolute;
    top: 12px;
    right: 12px;
    background: transparent;
    border: none;
    color: inherit;
    font-size: 18px;
    cursor: pointer;
    padding: 8px;
    border-radius: 8px;
  }
  .close-btn:hover { background: rgba(255,255,255,0.08); }
  .title {
    font-size: 20px;
    font-weight: 600;
    margin: 0 0 8px;
  }
  .message {
    font-size: 14px;
    line-height: 1.5;
    margin: 0 0 20px;
    opacity: 0.85;
  }
  .primary-btn {
    width: 100%;
    padding: 14px 20px;
    border-radius: 10px;
    border: none;
    background: var(--semantic-primary, #4f8cff);
    color: #fff;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
  }
  .primary-btn:hover { filter: brightness(1.1); }
</style>
