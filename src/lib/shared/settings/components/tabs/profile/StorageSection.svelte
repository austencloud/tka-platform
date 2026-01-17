<!-- StorageSection.svelte - Cache clearing controls -->
<script lang="ts">
  import GlassCard from "./GlassCard.svelte";

  interface Props {
    onClearCache: () => Promise<void>;
    isClearing: boolean;
  }

  let { onClearCache, isClearing }: Props = $props();
</script>

<GlassCard
  icon="fas fa-database"
  title="Storage"
  subtitle="Manage local cached data"
>
  {#snippet children()}
    <div class="storage-content">
      <button class="action-btn" onclick={onClearCache} disabled={isClearing}>
        <i class="fas fa-broom" aria-hidden="true"></i>
        <span>{isClearing ? "Clearing..." : "Clear Cache"}</span>
      </button>
      <p class="hint-text">
        Clears IndexedDB, localStorage, and cookies. Your cloud data is safe.
      </p>
    </div>
  {/snippet}
</GlassCard>

<style>
  .storage-content {
    display: flex;
    flex-direction: column;
    gap: clamp(8px, 2cqi, 12px);
  }

  .action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: clamp(8px, 2cqi, 10px);
    width: 100%;
    min-height: var(--min-touch-target);
    padding: clamp(12px, 2.5cqi, 14px) clamp(16px, 3cqi, 24px);
    background: color-mix(in srgb, var(--theme-accent) 15%, transparent);
    border: 1px solid color-mix(in srgb, var(--theme-accent) 40%, transparent);
    border-radius: clamp(8px, 2cqi, 10px);
    color: var(--theme-accent);
    font-size: clamp(14px, 2.5cqi, 15px);
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-fast) ease;
  }

  .action-btn:hover:not(:disabled) {
    background: color-mix(in srgb, var(--theme-accent) 25%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent) 60%, transparent);
    transform: translateY(-2px);
    box-shadow: 0 8px 24px
      color-mix(in srgb, var(--theme-accent) 20%, transparent);
  }

  .action-btn:active:not(:disabled) {
    transform: scale(0.97);
  }

  .action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .action-btn:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  .hint-text {
    font-size: clamp(11px, 2cqi, 13px);
    color: var(--theme-text-dim);
    margin: 0;
    line-height: 1.5;
  }

  /* ========================================
     ACCESSIBILITY
     ======================================== */
  @media (prefers-reduced-motion: reduce) {
    .action-btn {
      transition: none;
    }

    .action-btn:hover:not(:disabled) {
      transform: none;
    }
  }

  @media (prefers-contrast: high) {
    .action-btn {
      border-width: 2px;
    }
  }
</style>
