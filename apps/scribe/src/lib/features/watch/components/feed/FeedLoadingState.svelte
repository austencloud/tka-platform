<!--
  FeedLoadingState

  Skeleton loading cards for the feed.
  Shows animated placeholder cards while content loads.
  In fullscreen mode, shows a single card filling the viewport.
-->
<script lang="ts">
  interface Props {
    count?: number;
    fullscreen?: boolean;
  }

  const { count = 3, fullscreen = false }: Props = $props();

  const skeletonArray = $derived(Array.from({ length: fullscreen ? 1 : count }, (_, i) => i));
</script>

<div class="feed-loading" class:fullscreen>
  {#each skeletonArray as i (i)}
    <article class="skeleton-card" class:fullscreen>
      <div class="skeleton-media"></div>
      <div class="skeleton-footer">
        <div class="skeleton-creator">
          <div class="skeleton-avatar"></div>
          <div class="skeleton-text-group">
            <div class="skeleton-text short"></div>
            <div class="skeleton-text tiny"></div>
          </div>
        </div>
        <div class="skeleton-cta"></div>
      </div>
    </article>
  {/each}
</div>

<style>
  .feed-loading {
    display: flex;
    flex-direction: column;
    gap: 24px;
    padding: 16px;
  }

  .feed-loading.fullscreen {
    position: absolute;
    inset: 0;
    padding: 0;
    gap: 0;
  }

  .skeleton-card {
    width: 100%;
    max-width: 600px;
    margin: 0 auto;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 16px;
    overflow: hidden;
  }

  .skeleton-card.fullscreen {
    max-width: none;
    height: 100dvh;
    border: none;
    border-radius: 0;
    display: flex;
    flex-direction: column;
    background: #000;
  }

  /* Fallback for browsers without dvh */
  @supports not (height: 100dvh) {
    .skeleton-card.fullscreen {
      height: var(--viewport-height, 100vh);
    }
  }

  .skeleton-media {
    width: 100%;
    aspect-ratio: 1 / 1;
    background: linear-gradient(
      90deg,
      var(--theme-card-bg, rgba(255, 255, 255, 0.04)) 25%,
      rgba(255, 255, 255, 0.08) 50%,
      var(--theme-card-bg, rgba(255, 255, 255, 0.04)) 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
  }

  .fullscreen .skeleton-media {
    aspect-ratio: unset;
    flex: 1;
    background: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.02) 25%,
      rgba(255, 255, 255, 0.06) 50%,
      rgba(255, 255, 255, 0.02) 75%
    );
  }

  .skeleton-footer {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .fullscreen .skeleton-footer {
    flex-shrink: 0;
    background: linear-gradient(
      to top,
      rgba(0, 0, 0, 0.9) 0%,
      transparent 100%
    );
    padding-bottom: max(16px, env(safe-area-inset-bottom));
  }

  .skeleton-creator {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .skeleton-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.1);
    animation: shimmer 1.5s infinite;
  }

  .skeleton-text-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .skeleton-text {
    height: 12px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.1);
    animation: shimmer 1.5s infinite;
  }

  .skeleton-text.short {
    width: 120px;
  }

  .skeleton-text.tiny {
    width: 60px;
    height: 10px;
  }

  .skeleton-cta {
    height: 44px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.1);
    animation: shimmer 1.5s infinite;
  }

  @keyframes shimmer {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }
</style>
