<!--
  FeedCard

  TikTok-style full-viewport content card.
  - Fills exactly 100dvh (dynamic viewport height)
  - Entry animations on snap completion
  - Scroll snap alignment
  - Per-card media type switching (video/animation/pictograph)
-->
<script lang="ts">
  import { t } from "$lib/shared/i18n/i18n.svelte";
  import { onMount, onDestroy } from "svelte";
  import type { FeedItem, FeedContentType } from "../../domain/models/feed-models";
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import FeedCardMedia from "./FeedCardMedia.svelte";
  import MediaTypeSwitcher from "./MediaTypeSwitcher.svelte";
  import ContentTypeBadge from "./ContentTypeBadge.svelte";
  import CreatorBadge from "./CreatorBadge.svelte";
  import ContextualCTA from "./ContextualCTA.svelte";

  interface Props {
    item: FeedItem;
    bluePropType?: PropType;
    redPropType?: PropType;
    catDogModeEnabled?: boolean;
    preloadPriority?: "high" | "low";
    onCardClick?: (item: FeedItem) => void;
    onCreatorClick?: (creatorId: string, creatorName: string) => void;
    onCtaClick?: (item: FeedItem) => void;
    onMount?: (ref: { triggerEntryAnimation: () => void }) => void;
    onDestroy?: () => void;
  }

  const {
    item,
    bluePropType,
    redPropType,
    catDogModeEnabled = false,
    preloadPriority = "low",
    onCardClick,
    onCreatorClick,
    onCtaClick,
    onMount: onMountCallback,
    onDestroy: onDestroyCallback,
  }: Props = $props();

  let isMuted = $state(true);
  let isAnimatedIn = $state(false); // Start hidden, animate in

  // Determine available media types
  const hasVideo = $derived(!!item.videoUrl);
  const hasAnimation = $derived(!!item.animationUrl);
  const hasPictograph = $derived(!!item.thumbnailUrl); // thumbnailUrl doubles as pictograph

  // Default to video if available, then animation, then pictograph
  const defaultMediaType = $derived.by((): FeedContentType => {
    if (hasVideo) return "video";
    if (hasAnimation) return "animation";
    return "pictograph";
  });

  // Track selected media type (initialized to default)
  let selectedMediaType = $state<FeedContentType | null>(null);
  const activeMediaType = $derived(selectedMediaType ?? defaultMediaType);

  function handleMediaTypeChange(type: FeedContentType) {
    selectedMediaType = type;
  }

  // Expose animation trigger to parent
  function triggerEntryAnimation() {
    isAnimatedIn = false;
    // Trigger reflow then animate
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        isAnimatedIn = true;
      });
    });
  }

  onMount(() => {
    // Register ref with parent for animation callbacks
    onMountCallback?.({ triggerEntryAnimation });

    // Animate in the first visible card on mount
    requestAnimationFrame(() => {
      isAnimatedIn = true;
    });
  });

  onDestroy(() => {
    onDestroyCallback?.();
  });

  function handleCardClick() {
    onCardClick?.(item);
  }

  function handleCreatorClick(creatorId: string, creatorName: string) {
    onCreatorClick?.(creatorId, creatorName);
  }

  function handleCtaClick() {
    onCtaClick?.(item);
  }

  function handleMuteToggle(muted: boolean) {
    isMuted = !muted;
  }

  // Format step count for display
  const stepCountText = $derived(
    item.stepCount ? t('watch_card_beats', { count: item.stepCount }) : ""
  );
</script>

<article class="feed-card" data-preload-priority={preloadPriority}>
  <!-- Media container (clickable to open detail) -->
  <button
    class="media-container"
    onclick={handleCardClick}
    type="button"
    aria-label={t('watch_card_view', { title: item.title })}
  >
    <FeedCardMedia
      {item}
      displayType={activeMediaType}
      {bluePropType}
      {redPropType}
      {catDogModeEnabled}
      {isMuted}
      {preloadPriority}
      onMuteToggle={handleMuteToggle}
    />

    <!-- Content type badge (overlay) -->
    <div class="badge-overlay" class:animated-in={isAnimatedIn}>
      <ContentTypeBadge intent={item.intent} />
    </div>

    <!-- Media type switcher (overlay) -->
    <div class="switcher-overlay" class:animated-in={isAnimatedIn}>
      <MediaTypeSwitcher
        {hasVideo}
        {hasAnimation}
        {hasPictograph}
        selectedType={activeMediaType}
        onTypeChange={handleMediaTypeChange}
      />
    </div>
  </button>

  <!-- Card footer -->
  <div class="card-footer" class:animated-in={isAnimatedIn}>
    <!-- Creator and title row -->
    <div class="info-row">
      <CreatorBadge
        creatorId={item.creatorId}
        creatorName={item.creatorName}
        creatorAvatarUrl={item.creatorAvatarUrl}
        onClick={handleCreatorClick}
      />
      <div class="title-area">
        <h3 class="title">{item.title}</h3>
        {#if stepCountText}
          <span class="meta">{stepCountText}</span>
        {/if}
      </div>
    </div>

    <!-- CTA button -->
    <ContextualCTA intent={item.intent} onClick={handleCtaClick} />
  </div>
</article>

<style>
  .feed-card {
    width: 100%;
    max-width: 600px;
    margin: 0 auto;
    background: #000;
    border: none;
    border-radius: 0;
    overflow: hidden;
    /* Fill viewport exactly with dynamic viewport height */
    height: 100dvh;
    min-height: 100dvh; /* Prevent shrinking */
    display: flex;
    flex-direction: column;
    /* Snap alignment - start means top of card aligns with top of viewport */
    scroll-snap-align: start;
    /* CRITICAL: Prevent skipping cards on fast scroll - one card per swipe */
    scroll-snap-stop: always;
  }

  /* Fallback for browsers without dvh */
  @supports not (height: 100dvh) {
    .feed-card {
      height: var(--viewport-height, 100vh);
      min-height: var(--viewport-height, 100vh);
    }
  }

  /* Media container */
  .media-container {
    position: relative;
    width: 100%;
    flex: 1;
    min-height: 0;
    padding: 0;
    border: none;
    background: none;
    cursor: pointer;
    display: flex;
    flex-direction: column;
  }

  .media-container:focus-visible {
    outline: none;
  }

  .media-container:focus-visible::after {
    content: "";
    position: absolute;
    inset: 0;
    border: 2px solid var(--theme-accent);
    pointer-events: none;
  }

  /* Badge overlay with entry animation */
  .badge-overlay {
    position: absolute;
    top: max(12px, calc(env(safe-area-inset-top) + 60px)); /* Below floating header */
    left: 12px;
    z-index: 1;
    opacity: 0;
    transform: translateY(-10px);
    transition: opacity 0.3s ease, transform 0.3s ease;
  }

  .badge-overlay.animated-in {
    opacity: 1;
    transform: translateY(0);
  }

  /* Media type switcher overlay */
  .switcher-overlay {
    position: absolute;
    bottom: 16px;
    right: 16px;
    z-index: 2;
    opacity: 0;
    transform: translateX(10px);
    transition: opacity 0.3s ease 0.15s, transform 0.3s ease 0.15s;
  }

  .switcher-overlay.animated-in {
    opacity: 1;
    transform: translateX(0);
  }

  /* Card footer with entry animation */
  .card-footer {
    flex-shrink: 0;
    padding: 16px;
    padding-bottom: max(16px, env(safe-area-inset-bottom));
    display: flex;
    flex-direction: column;
    gap: 16px;
    background: linear-gradient(
      to top,
      rgba(0, 0, 0, 0.9) 0%,
      rgba(0, 0, 0, 0.7) 60%,
      transparent 100%
    );
    /* Entry animation */
    opacity: 0;
    transform: translateY(20px);
    transition: opacity 0.3s ease 0.1s, transform 0.3s ease 0.1s;
  }

  .card-footer.animated-in {
    opacity: 1;
    transform: translateY(0);
  }

  /* Info row */
  .info-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .title-area {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .title {
    margin: 0;
    font-size: var(--font-size-base, 16px);
    font-weight: 600;
    color: #fff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  }

  .meta {
    font-size: var(--font-size-compact, 12px);
    color: rgba(255, 255, 255, 0.7);
  }

  /* Responsive adjustments */
  @media (max-width: 480px) {
    .card-footer {
      padding: 12px;
      padding-bottom: max(12px, env(safe-area-inset-bottom));
      gap: 12px;
    }

    .badge-overlay {
      top: max(8px, calc(env(safe-area-inset-top) + 50px));
      left: 8px;
    }
  }

  /* Reduced motion: disable animations */
  @media (prefers-reduced-motion: reduce) {
    .badge-overlay,
    .card-footer {
      transition: none;
      opacity: 1;
      transform: none;
    }
  }
</style>
