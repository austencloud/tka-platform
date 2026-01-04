<!--
  VisibilityToggle.svelte

  Toggle button for public/private visibility with contextual hint.
-->
<script lang="ts">
  interface Props {
    /** Current visibility state */
    isPublic: boolean;
    /** Called when visibility changes */
    onToggle: () => void;
    /** Optional creator name to display */
    creatorName?: string;
  }

  let { isPublic, onToggle, creatorName }: Props = $props();
</script>

<div class="visibility-section">
  <div class="meta-row">
    {#if creatorName}
      <div class="creator-chip">
        <i class="fas fa-user" aria-hidden="true"></i>
        <span>By {creatorName}</span>
      </div>
    {/if}

    <button
      type="button"
      class="visibility-toggle"
      class:public={isPublic}
      onclick={onToggle}
      aria-pressed={isPublic}
    >
      {#if isPublic}
        <i class="fas fa-globe" aria-hidden="true"></i>
        <span>Public</span>
      {:else}
        <i class="fas fa-lock" aria-hidden="true"></i>
        <span>Private</span>
      {/if}
    </button>
  </div>

  <p class="visibility-hint">
    <i class="fas fa-info-circle" aria-hidden="true"></i>
    {#if isPublic}
      Will appear in the public gallery for others to discover
    {:else}
      Only you can see this sequence. You can make it public later from your
      library.
    {/if}
  </p>
</div>

<style>
  .visibility-section {
    margin-bottom: 16px;
  }

  .meta-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 8px;
  }

  .creator-chip {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--theme-text-dim);
    font-size: var(--font-size-base, 16px);
  }

  .creator-chip i {
    opacity: 0.6;
  }

  .visibility-toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 18px;
    min-height: 48px;
    background: var(--theme-card-bg);
    border: 1.5px solid var(--theme-stroke-strong);
    border-radius: 24px;
    color: var(--theme-text-dim);
    font-size: var(--font-size-base, 16px);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .visibility-toggle:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.25);
  }

  .visibility-toggle.public {
    background: color-mix(
      in srgb,
      var(--semantic-success, var(--semantic-success)) 15%,
      transparent
    );
    border-color: color-mix(
      in srgb,
      var(--semantic-success, var(--semantic-success)) 40%,
      transparent
    );
    color: var(--semantic-success, var(--semantic-success));
  }

  .visibility-toggle.public:hover {
    background: color-mix(
      in srgb,
      var(--semantic-success, var(--semantic-success)) 25%,
      transparent
    );
  }

  .visibility-hint {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    margin: 0;
    padding: 14px 16px;
    background: rgba(255, 255, 255, 0.03);
    border-radius: var(--radius-2026-sm, 12px);
    font-size: var(--font-size-base, 16px);
    color: var(--theme-text-dim);
    line-height: 1.5;
  }

  .visibility-hint i {
    flex-shrink: 0;
    margin-top: 1px;
    opacity: 0.6;
  }
</style>
