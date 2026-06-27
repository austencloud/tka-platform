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
    <div class="placeholder" aria-label="{productName} preview coming soon">
      <i class="fas fa-cards" aria-hidden="true"></i>
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
    /* This is the view-transition-named element. Keep CSS containment OFF it —
       container-type/contain on a morphing (named) element is a known-fragile
       combination (the Chrome 129 containing-block change). The cqw query
       container lives on the child .placeholder instead. */
    /* Shared morph styling for the grid<->detail view transition (only takes
       effect on instances that also carry a view-transition-name). */
    view-transition-class: product-cover;
  }

  .cover-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
    /* Ken-Burns zoom on hover. Transform only (compositor); .mockup-container's
       overflow: hidden crops it. Applied to the inner content, NOT the
       view-transition-named container, so the morph capture is never affected. */
    transition: transform 0.45s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .placeholder {
    width: 100%;
    height: 100%;
    display: grid;
    place-items: center;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
    background: radial-gradient(
      circle at 50% 40%,
      rgba(255, 255, 255, 0.06),
      rgba(255, 255, 255, 0.02)
    );
    /* Query container for the glyph's cqw sizing. Kept on this child, not on the
       view-transition-named parent. Same width as the box (width:100%), so the
       glyph still scales as a fraction of the cover and the morph stays seamless. */
    container-type: inline-size;
  }

  .placeholder i {
    /* Fraction of the box, not a fixed px, so the cross-route morph is seamless. */
    font-size: 26cqw;
  }

  .placeholder {
    transition: transform 0.45s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .mockup-container:hover .cover-image,
  .mockup-container:hover .placeholder {
    transform: scale(1.05);
  }

  @media (prefers-reduced-motion: reduce) {
    .cover-image,
    .placeholder {
      transition: none;
    }
    .mockup-container:hover .cover-image,
    .mockup-container:hover .placeholder {
      transform: none;
    }
  }
</style>
