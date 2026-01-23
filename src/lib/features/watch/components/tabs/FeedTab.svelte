<!--
  FeedTab.svelte

  TikTok-style full-screen vertical feed with:
  - Viewport-perfect cards (100dvh)
  - Scroll snap on touch devices
  - Snap detection with haptic feedback
  - Directional preloading
  - Floating header that auto-hides
-->
<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { container } from "$lib/shared/di";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { handleModuleChange } from "$lib/shared/navigation-coordinator/navigation-coordinator.svelte";
  import type { ModuleId } from "$lib/shared/navigation/domain/types";
  import {
    openSpotlightWithVideo,
    openSpotlightWithImage,
  } from "$lib/shared/application/state/ui/ui-state.svelte";
  import {
    userPreviewState,
    getEffectiveUserId,
  } from "$lib/shared/debug/state/user-preview-state.svelte";
  import { authState } from "$lib/shared/auth/state/authState.svelte";
  import { t } from "$lib/shared/i18n/i18n.svelte.js";
  import { settingsService } from "$lib/shared/settings/state/SettingsState.svelte";
  import { feedScrollState } from "../../state/feed-scroll-state.svelte";

  // Feed components
  import FeedContainer from "../feed/FeedContainer.svelte";
  import FloatingHeader from "../header/FloatingHeader.svelte";

  // State
  import { createWatchFeedState } from "../../state/watch-feed-state.svelte";
  import type { FeedItem } from "../../domain/models/feed-models";

  // Services
  let hapticService: IHapticFeedback | undefined;

  // State
  const feedState = createWatchFeedState();
  let isVisible = $state(false);

  // Header visibility from scroll state
  const isHeaderVisible = $derived(feedScrollState.isHeaderVisible);

  // Preview-aware derived values
  const isPreviewActive = $derived(userPreviewState.isActive);
  const previewProfile = $derived(userPreviewState.data.profile);

  const greeting = $derived.by(() => {
    const hour = new Date().getHours();
    if (hour < 12) return t("dashboard_greeting_morning");
    if (hour < 18) return t("dashboard_greeting_afternoon");
    return t("dashboard_greeting_evening");
  });

  const effectiveWelcomeMessage = $derived.by(() => {
    if (isPreviewActive && previewProfile) {
      const firstName = (
        previewProfile.displayName ||
        previewProfile.email ||
        "User"
      ).split(" ")[0] ?? "User";
      return t("dashboard_viewing_as", { name: firstName });
    }
    if (authState.isAuthenticated && authState.user?.displayName) {
      const firstName = authState.user.displayName.split(" ")[0];
      return `${greeting}, ${firstName}`;
    }
    return "Watch";
  });

  // Settings-derived prop types
  const bluePropType = $derived(settingsService.currentSettings.bluePropType);
  const redPropType = $derived(settingsService.currentSettings.redPropType);
  const catDogModeEnabled = $derived(settingsService.currentSettings.catDogMode);

  onMount(() => {
    try {
      hapticService = container.items.hapticFeedback;
    } catch {
      // Not available
    }

    setTimeout(() => {
      isVisible = true;
    }, 30);

    // Load initial feed
    feedState.loadInitial();

    return () => {
      feedScrollState.reset();
    };
  });

  // Feed handlers
  function handleLoadMore() {
    feedState.loadMore();
  }

  function handleCardClick(item: FeedItem) {
    hapticService?.trigger("selection");
    // Open in fullscreen spotlight - tap to dismiss
    if (item.contentType === "video" && item.videoUrl) {
      openSpotlightWithVideo(item.videoUrl, item.thumbnailUrl);
    } else if (item.contentType === "animation" && item.animationUrl) {
      openSpotlightWithImage(item.animationUrl);
    } else if (item.thumbnailUrl) {
      openSpotlightWithImage(item.thumbnailUrl);
    }
  }

  function handleCreatorClick(creatorId: string, creatorName: string) {
    hapticService?.trigger("selection");
    const event = new CustomEvent("open-user-profile", {
      detail: { userId: creatorId, displayName: creatorName },
      bubbles: true,
    });
    document.dispatchEvent(event);
  }

  function handleCtaClick(item: FeedItem) {
    hapticService?.trigger("selection");
    switch (item.intent) {
      case "tutorial":
        handleModuleChange("learn" as ModuleId);
        break;
      case "demo":
      case "sequence":
        if (item.sequenceId) {
          handleModuleChange("explore" as ModuleId, { sequenceId: item.sequenceId });
        }
        break;
      case "composition":
        handleModuleChange("compose" as ModuleId, { sequenceId: item.sequenceId });
        break;
    }
  }

  // Header icon handlers
  function handleInboxClick() {
    hapticService?.trigger("selection");
    // TODO: Implement messages view navigation
  }

  function handleAlertsClick() {
    hapticService?.trigger("selection");
    // TODO: Implement notifications view navigation
  }
</script>

<div class="feed-tab" class:visible={isVisible}>
  <!-- Floating Header (auto-hides on scroll) -->
  <FloatingHeader
    welcomeMessage={effectiveWelcomeMessage}
    isVisible={isHeaderVisible}
    onInboxClick={handleInboxClick}
    onAlertsClick={handleAlertsClick}
  />

  <!-- Feed container - full viewport, positioned absolute -->
  <FeedContainer
    items={feedState.items}
    isLoading={feedState.isLoading}
    hasMore={feedState.hasMore}
    {bluePropType}
    {redPropType}
    {catDogModeEnabled}
    onLoadMore={handleLoadMore}
    onCardClick={handleCardClick}
    onCreatorClick={handleCreatorClick}
    onCtaClick={handleCtaClick}
  />
</div>

<style>
  .feed-tab {
    position: relative;
    width: 100%;
    height: 100dvh;
    max-width: 100%;
    overflow: hidden;
    background: #000;
    opacity: 0;
    transition: opacity var(--duration-emphasis, 200ms) ease;
  }

  /* Fallback for browsers without dvh */
  @supports not (height: 100dvh) {
    .feed-tab {
      height: var(--viewport-height, 100vh);
    }
  }

  .feed-tab.visible {
    opacity: 1;
  }

  @media (prefers-reduced-motion: reduce) {
    .feed-tab {
      transition: none;
    }
  }
</style>
