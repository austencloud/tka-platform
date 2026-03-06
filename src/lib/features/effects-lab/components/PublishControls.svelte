<!--
  PublishControls.svelte

  Admin-only publish-to-production workflow with confirmation step.
-->
<script lang="ts">
  interface Props {
    onPublish: () => Promise<void>;
  }

  let { onPublish }: Props = $props();

  let publishing = $state(false);
  let showConfirm = $state(false);
  let showSuccess = $state(false);
  let successTimer: ReturnType<typeof setTimeout> | null = null;

  async function handlePublish() {
    publishing = true;
    try {
      await onPublish();
      showConfirm = false;
      showSuccess = true;
      if (successTimer !== null) clearTimeout(successTimer);
      successTimer = setTimeout(() => {
        showSuccess = false;
        successTimer = null;
      }, 3000);
    } finally {
      publishing = false;
    }
  }
</script>

<div class="publish-section">
  {#if showSuccess}
    <div class="publish-success">
      <i class="fas fa-check-circle" aria-hidden="true"></i>
      Published to all users
    </div>
  {:else if !showConfirm}
    <button class="publish-btn" onclick={() => (showConfirm = true)} aria-label="Publish fire settings to production">
      <i class="fas fa-upload" aria-hidden="true"></i>
      Publish to Production
    </button>
  {:else}
    <div class="publish-confirm">
      <span class="publish-confirm-text">Push these fire settings to all users?</span>
      <button class="confirm-btn" onclick={handlePublish} disabled={publishing} aria-label={publishing ? "Publishing in progress" : "Confirm publish to production"}>
        {publishing ? "Publishing..." : "Yes, Publish"}
      </button>
      <button class="cancel-btn" onclick={() => (showConfirm = false)} aria-label="Cancel publish">Cancel</button>
    </div>
  {/if}
</div>

<style>
  .publish-section {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .publish-btn {
    width: 100%;
    min-height: var(--min-touch-target);
    padding: 10px 16px;
    background: var(--semantic-warning, #f59e0b);
    color: #000000;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    font-size: var(--font-size-min, 14px);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: opacity 150ms ease;
  }

  .publish-btn:hover {
    opacity: 0.9;
  }

  .publish-success {
    padding: 10px 16px;
    background: var(--semantic-success-dim, rgba(34, 197, 94, 0.15));
    color: var(--semantic-success, #22c55e);
    border: 1px solid var(--semantic-success, #22c55e);
    border-radius: 8px;
    font-weight: 600;
    font-size: var(--font-size-min, 14px);
    text-align: center;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  .publish-confirm {
    display: flex;
    flex-direction: column;
    gap: 8px;
    text-align: center;
  }

  .publish-confirm-text {
    color: var(--theme-text, #fff);
    font-size: var(--font-size-min, 14px);
  }

  .confirm-btn {
    min-height: var(--min-touch-target);
    padding: 10px;
    background: var(--semantic-success, #22c55e);
    color: #000000;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    font-size: var(--font-size-min, 14px);
    cursor: pointer;
    transition: opacity 150ms ease;
  }

  .confirm-btn:hover {
    opacity: 0.9;
  }

  .confirm-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .cancel-btn {
    min-height: var(--min-touch-target);
    padding: 8px;
    background: transparent;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    font-size: var(--font-size-min, 14px);
    cursor: pointer;
    transition: opacity 150ms ease;
  }

  .cancel-btn:hover {
    opacity: 0.8;
  }

  @media (prefers-reduced-motion: reduce) {
    .publish-btn,
    .confirm-btn,
    .cancel-btn {
      transition: none;
    }
  }
</style>
