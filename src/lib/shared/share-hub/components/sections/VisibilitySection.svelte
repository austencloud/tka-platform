<!--
  VisibilitySection.svelte - Public/Private Toggle

  Library-specific section for managing sequence visibility.
  Shows a publish CTA when sequence is private.
-->
<script lang="ts">
  interface Props {
    visibility: "public" | "private";
    onVisibilityChange?: (visibility: "public" | "private") => void;
  }

  let { visibility = "private", onVisibilityChange }: Props = $props();

  const isPublic = $derived(visibility === "public");

  function handleToggle() {
    const newVisibility = isPublic ? "private" : "public";
    onVisibilityChange?.(newVisibility);
  }
</script>

<div class="visibility-section">
  {#if isPublic}
    <!-- Public: Show visibility toggle -->
    <div class="visibility-toggle">
      <div class="toggle-info">
        <div class="toggle-icon public">
          <i class="fas fa-globe" aria-hidden="true"></i>
        </div>
        <div class="toggle-text">
          <strong>Public</strong>
          <span>Visible in the Gallery</span>
        </div>
      </div>
      <button class="toggle-btn" onclick={handleToggle}>
        <i class="fas fa-lock" aria-hidden="true"></i>
        Make Private
      </button>
    </div>
  {:else}
    <!-- Private: Show publish CTA -->
    <div class="publish-cta">
      <div class="cta-content">
        <i class="fas fa-rocket" aria-hidden="true"></i>
        <div class="cta-text">
          <strong>Ready to share?</strong>
          <span>Publish to the Gallery to see how your sequence performs</span>
        </div>
      </div>
      <button class="cta-btn" onclick={handleToggle}>
        Publish
      </button>
    </div>
  {/if}
</div>

<style>
  .visibility-section {
    display: flex;
    flex-direction: column;
  }

  /* Public state - toggle row */
  .visibility-toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 16px;
    background: color-mix(in srgb, var(--semantic-success) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--semantic-success) 30%, transparent);
    border-radius: var(--radius-2026-md, 14px);
  }

  .toggle-info {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
    min-width: 0;
  }

  .toggle-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 10px;
    flex-shrink: 0;
  }

  .toggle-icon.public {
    background: color-mix(in srgb, var(--semantic-success) 20%, transparent);
    color: var(--semantic-success);
  }

  .toggle-icon i {
    font-size: 18px;
  }

  .toggle-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .toggle-text strong {
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text);
  }

  .toggle-text span {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim);
  }

  .toggle-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: var(--radius-2026-sm, 10px);
    color: var(--theme-text);
    font-size: var(--font-size-sm, 14px);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
    min-height: var(--min-touch-target);
  }

  .toggle-btn:hover {
    background: var(--theme-card-hover-bg);
  }

  /* Private state - publish CTA */
  .publish-cta {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px;
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--semantic-success) 10%, transparent) 0%,
      color-mix(in srgb, var(--semantic-info) 10%, transparent) 100%
    );
    border: 1px solid color-mix(in srgb, var(--semantic-success) 30%, transparent);
    border-radius: var(--radius-2026-md, 14px);
  }

  .cta-content {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
    min-width: 0;
  }

  .cta-content > i {
    font-size: 1.25rem;
    color: var(--semantic-success);
    flex-shrink: 0;
  }

  .cta-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .cta-text strong {
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text);
  }

  .cta-text span {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim);
  }

  .cta-btn {
    padding: 10px 20px;
    background: var(--semantic-success);
    border: none;
    border-radius: var(--radius-2026-sm, 10px);
    color: white;
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
    min-height: var(--min-touch-target);
  }

  .cta-btn:hover {
    filter: brightness(1.1);
  }
</style>
