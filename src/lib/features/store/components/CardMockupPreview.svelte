<!-- src/lib/features/store/components/CardMockupPreview.svelte -->
<script lang="ts">
  interface Props {
    coverImageUrl?: string;
    productName: string;
    /** When set, names this element for a cross-route view-transition morph. */
    viewTransitionName?: string;
  }

  let { coverImageUrl, productName, viewTransitionName }: Props = $props();
</script>

<div class="mockup-container" style:view-transition-name={viewTransitionName}>
  {#if coverImageUrl}
    <img
      src={coverImageUrl}
      alt="{productName} card preview"
      class="cover-image"
      loading="lazy"
    />
  {:else}
    <div class="placeholder">
      <i class="fas fa-cards" aria-hidden="true"></i>
      <span>Preview coming soon</span>
    </div>
  {/if}
</div>

<style>
  .mockup-container {
    aspect-ratio: 3 / 4;
    border-radius: 12px;
    overflow: hidden;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    display: flex;
    align-items: center;
    justify-content: center;
    /* Shared morph styling for the grid<->detail view transition (only takes
       effect on instances that also carry a view-transition-name). */
    view-transition-class: product-cover;
  }

  .cover-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
    font-size: var(--font-size-min, 14px);
  }

  .placeholder i {
    font-size: 32px;
  }
</style>
