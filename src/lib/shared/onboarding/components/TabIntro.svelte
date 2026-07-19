<!--
  TabIntro.svelte - Full-screen tab introduction with multi-page support

  Shows an immersive intro overlay on first visit to a tab.
  Supports single or multi-page intros with bullet points and tips.

  Sidebar-Aware Centering (2026 pattern):
  - Imports desktop sidebar state directly
  - Offsets overlay left edge by sidebar width on desktop
  - Content centers properly within the content area, not the full viewport

  Usage:
  <TabIntro moduleId="create" tabId="generate" />
-->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import { onMount, onDestroy } from "svelte";
  import { fly, fade } from "svelte/transition";
  import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";
  import { desktopSidebarState } from "$lib/shared/layout/desktop-sidebar-state.svelte";
  import {
    getTabIntroContent,
    type TabIntroPage,
  } from "../config/tab-intro-content";
  import { safeLocalStorageSetItem } from "$lib/shared/foundation/services/storage-manager";
  import { FocusTrap } from "$lib/shared/foundation/ui/drawer/focus-trap";

  interface Props {
    moduleId: string;
    tabId: string;
    /** Optional: show even if already seen (for help button) */
    forceShow?: boolean;
    onDismiss?: () => void;
  }

  const { moduleId, tabId, forceShow = false, onDismiss }: Props = $props();

  // Get content from config - use $derived so these update if props change
  const introContent = $derived(getTabIntroContent(moduleId, tabId));
  const pages = $derived(introContent?.pages ?? []);
  const icon = $derived(introContent?.icon ?? "fa-circle-info");
  const color = $derived(introContent?.color ?? "#6366f1");
  const title = $derived(introContent?.title ?? "Welcome");

  // Sidebar-aware positioning
  // When desktop sidebar is visible, offset overlay to center content in the content area
  const sidebarOffset = $derived(
    desktopSidebarState.isVisible ? desktopSidebarState.width : 0
  );

  // Persistence key - use $derived so it updates if props change
  const storageKey = $derived(`tabIntroSeen:${moduleId}:${tabId}`);

  // State
  let hasSeenIntro = $state(false);
  let isVisible = $state(false);
  let hapticService: HapticFeedback | null = $state(null);
  let currentPageIndex = $state(0);
  let entranceTimer: ReturnType<typeof setTimeout> | null = null;
  let overlayEl = $state<HTMLDivElement | null>(null);

  // Derived
  const currentPage = $derived(pages[currentPageIndex]);
  const isMultiPage = $derived(pages.length > 1);
  const isLastPage = $derived(currentPageIndex === pages.length - 1);
  const hasContent = $derived(pages.length > 0);

  // Check if user has seen this intro before
  onMount(() => {
    try {
      hapticService = getHapticFeedback();
    } catch {
      /* Optional */
    }

    if (forceShow) {
      isVisible = true;
      return;
    }

    if (typeof localStorage !== "undefined") {
      hasSeenIntro = localStorage.getItem(storageKey) === "true";
    }

    // Show intro if not seen before
    if (!hasSeenIntro) {
      // Small delay for smoother entrance after tab renders. Store the handle
      // so we can cancel it if the component unmounts before it fires.
      entranceTimer = setTimeout(() => {
        isVisible = true;
        entranceTimer = null;
      }, 100);
    }
  });

  onDestroy(() => {
    if (entranceTimer !== null) {
      clearTimeout(entranceTimer);
      entranceTimer = null;
    }
  });

  // Reduced-motion gate for the entrance/page transitions below. Reactive
  // (not computed once) so DevTools emulation mid-session is honored — CSS
  // media queries can't cancel Svelte `transition:` directives, only their
  // params can. Matches SequenceViewerShell.svelte / FeedbackTextarea.svelte.
  let prefersReducedMotion = $state(false);
  onMount(() => {
    const mq = matchMedia("(prefers-reduced-motion: reduce)");
    prefersReducedMotion = mq.matches;
    const onReduceChange = () => (prefersReducedMotion = mq.matches);
    mq.addEventListener("change", onReduceChange);
    return () => mq.removeEventListener("change", onReduceChange);
  });

  // Trap focus inside the overlay while it's open: focus moves in on open,
  // Tab is trapped, everything else goes inert (default exclusions — the
  // overlay itself offsets around the desktop sidebar so it stays visible
  // and usable, matching Drawer's default), and focus returns to the
  // trigger on close.
  const focusTrap = new FocusTrap({ focusContainerOnInitial: true });

  $effect(() => {
    if (!overlayEl) return;
    focusTrap.activate(overlayEl);
    return () => focusTrap.deactivate();
  });

  function dismiss() {
    hapticService?.trigger("selection");
    isVisible = false;

    // Persist dismissal. Guarded so a quota/private-browsing throw never
    // blocks the onDismiss callback below.
    if (typeof localStorage !== "undefined") {
      safeLocalStorageSetItem(storageKey, "true");
    }

    onDismiss?.();
  }

  function nextPage() {
    if (currentPageIndex < pages.length - 1) {
      hapticService?.trigger("selection");
      currentPageIndex++;
    } else {
      dismiss();
    }
  }

  function goToPage(index: number) {
    if (index >= 0 && index < pages.length) {
      hapticService?.trigger("selection");
      currentPageIndex = index;
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      dismiss();
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      nextPage();
    } else if (event.key === "ArrowRight" && !isLastPage) {
      event.preventDefault();
      nextPage();
    } else if (event.key === "ArrowLeft" && currentPageIndex > 0) {
      event.preventDefault();
      currentPageIndex--;
    }
  }

  // Helper to check if content is structured (has points)
  function isStructuredContent(
    content: string | { text?: string; points: string[] }
  ): content is { text?: string; points: string[] } {
    return typeof content === "object" && "points" in content;
  }
</script>

{#snippet pageBody(page: TabIntroPage)}
  {#if isStructuredContent(page.content)}
    <!-- Structured content with optional intro text and bullet points -->
    {#if page.content.text}
      <p class="intro-lead">{page.content.text}</p>
    {/if}
    <ul class="intro-points">
      {#each page.content.points as point}
        <li>{point}</li>
      {/each}
    </ul>
  {:else}
    <!-- Simple string content -->
    <p class="intro-description">{page.content}</p>
  {/if}

  <!-- Tip (if present) -->
  {#if page.tip}
    <div class="intro-tip">
      <i class="fas fa-lightbulb" aria-hidden="true"></i>
      <span>{page.tip}</span>
    </div>
  {/if}
{/snippet}

{#if isVisible && hasContent}
  <!-- Full-screen takeover - offset by sidebar width for proper centering -->
  <div
    class="tab-intro-overlay"
    bind:this={overlayEl}
    role="dialog"
    aria-modal="true"
    aria-labelledby="tab-intro-title"
    style="--sidebar-offset: {sidebarOffset}px; --accent-color: {color};"
    transition:fade={{ duration: prefersReducedMotion ? 0 : 250 }}
  >
    <!-- Dismiss on background click -->
    <button
      class="backdrop-dismiss"
      onclick={dismiss}
      onkeydown={handleKeydown}
      aria-label="Dismiss introduction"
    ></button>

    <!-- Content container -->
    <div
      class="intro-content"
      transition:fly={{
        y: prefersReducedMotion ? 0 : 30,
        duration: prefersReducedMotion ? 0 : 350,
        delay: prefersReducedMotion ? 0 : 50,
      }}
    >
      <!-- Icon - large and prominent -->
      <div class="intro-icon">
        <i class="fas {icon}" aria-hidden="true"></i>
      </div>

      <!-- Title (uses page heading if available, else main title) -->
      <h1 id="tab-intro-title" class="intro-title">
        {currentPage?.heading ?? title}
      </h1>

      <!-- Page content. Ghost-sizer (ADR no-layout-shift.md #1): every page's
           body is stacked invisibly in one grid cell so the wrap reserves the
           TALLEST page's height permanently, not just during the transition
           — a future 2-page config with differing bullet counts can't shove
           the dots/action button below it. -->
      {#if currentPage}
        <div class="intro-body-wrap">
          <div class="intro-body-sizer" aria-hidden="true">
            {#each pages as page, index (index)}
              <div class="intro-body">
                {@render pageBody(page)}
              </div>
            {/each}
          </div>
          {#key currentPageIndex}
            <div
              class="intro-body intro-body-live"
              transition:fly={{
                x: prefersReducedMotion ? 0 : 20,
                duration: prefersReducedMotion ? 0 : 200,
              }}
            >
              {@render pageBody(currentPage)}
            </div>
          {/key}
        </div>
      {/if}

      <!-- Pagination dots (for multi-page) -->
      {#if isMultiPage}
        <div class="pagination-dots" role="tablist">
          {#each pages as _, index}
            <button
              class="dot"
              class:active={index === currentPageIndex}
              onclick={() => goToPage(index)}
              aria-label="Go to page {index + 1}"
              aria-selected={index === currentPageIndex}
              role="tab"
            ></button>
          {/each}
        </div>
      {/if}

      <!-- Action button -->
      <button class="intro-action" onclick={nextPage}>
        <span>{isLastPage ? "Let's go" : "Next"}</span>
        <i class="fas fa-arrow-right" aria-hidden="true"></i>
      </button>
    </div>
  </div>
{/if}

<style>
  .tab-intro-overlay {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    /* Offset left edge by sidebar width - content centers in remaining space */
    left: var(--sidebar-offset, 0);
    z-index: var(--z-modal);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: linear-gradient(
      180deg,
      rgba(10, 10, 18, 0.97) 0%,
      rgba(15, 15, 25, 0.99) 100%
    );

    /* Smooth transition when sidebar collapses/expands */
    transition: left var(--duration-emphasis) cubic-bezier(0.16, 1, 0.3, 1);
  }

  .backdrop-dismiss {
    position: absolute;
    inset: 0;
    background: transparent;
    border: none;
    cursor: pointer;
  }

  /* Programmatic focus target (tabindex=-1, set implicitly by FocusTrap) —
     the overlay is the dialog root, not an interactive control, so suppress
     the focus ring the global `:focus-visible` rule would otherwise draw
     around the whole takeover. Matches Drawer.svelte. */
  .tab-intro-overlay:focus,
  .tab-intro-overlay:focus-visible {
    outline: none;
  }

  .intro-content {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    max-width: 480px;
    width: 100%;
  }

  .intro-icon {
    width: 88px;
    height: 88px;
    display: grid;
    place-items: center;
    border-radius: 24px;
    font-size: 2rem;
    color: white;
    background: var(--accent-color);
    box-shadow:
      0 12px 40px color-mix(in srgb, var(--accent-color) 50%, transparent),
      0 0 0 1px rgba(255, 255, 255, 0.1) inset;
    margin-bottom: 24px;
  }

  .intro-title {
    margin: 0 0 20px;
    font-size: clamp(1.75rem, 5vw, 2.25rem);
    font-weight: 700;
    letter-spacing: -0.02em;
    color: white;
  }

  /* Ghost-sizer stack: wrap sizes to the tallest page (sizer's own grid-stack
     of every page, below), the live transitioning page overlays it in the
     same cell. Neither the dots nor the action button below ever jump when
     the active page's content is shorter than another page's. */
  .intro-body-wrap {
    position: relative;
    display: grid;
    margin-bottom: 24px;
    max-width: 400px;
    width: 100%;
  }

  .intro-body-wrap > .intro-body-sizer,
  .intro-body-wrap > .intro-body-live {
    grid-area: 1 / 1;
  }

  .intro-body-sizer {
    display: grid;
    visibility: hidden;
  }

  .intro-body-sizer > .intro-body {
    grid-area: 1 / 1;
  }

  .intro-body {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    width: 100%;
  }

  .intro-lead {
    margin: 0;
    font-size: clamp(1rem, 3vw, 1.125rem);
    line-height: 1.5;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    text-align: center;
  }

  .intro-description {
    margin: 0;
    font-size: clamp(1rem, 3vw, 1.125rem);
    line-height: 1.6;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    text-align: center;
  }

  .intro-points {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 12px;
    text-align: left;
    width: 100%;
  }

  .intro-points li {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    font-size: clamp(0.9375rem, 2.5vw, 1.0625rem);
    line-height: 1.5;
    color: var(--theme-text, #ffffff);
  }

  .intro-points li::before {
    content: "";
    flex-shrink: 0;
    width: 6px;
    height: 6px;
    margin-top: 8px;
    border-radius: 50%;
    background: var(--accent-color);
    box-shadow: 0 0 8px color-mix(in srgb, var(--accent-color) 60%, transparent);
  }

  .intro-tip {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 12px 16px;
    margin-top: 8px;
    border-radius: 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.05));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    font-size: 0.9375rem;
    line-height: 1.5;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
  }

  .intro-tip i {
    flex-shrink: 0;
    color: var(--semantic-warning, #f59e0b);
    font-size: 0.875rem;
    margin-top: 2px;
  }

  .pagination-dots {
    display: flex;
    gap: 4px;
    margin-bottom: 24px;
  }

  /* 24px hit area (2.5.8 floor) around an 8px visible dot, via a centered
     ::before pseudo-element — the dot itself stays visually 8px. */
  .dot {
    width: 24px;
    height: 24px;
    padding: 0;
    border: none;
    background: transparent;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .dot::before {
    content: "";
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    transition: all var(--duration-normal) ease;
  }

  .dot:hover::before {
    background: var(--theme-stroke-strong, rgba(255, 255, 255, 0.4));
  }

  .dot.active::before {
    background: var(--accent-color);
    box-shadow: 0 0 8px color-mix(in srgb, var(--accent-color) 60%, transparent);
  }

  .intro-action {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 16px 36px;
    border: none;
    border-radius: 14px;
    background: var(--accent-color);
    color: white;
    font-size: 1.0625rem;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    box-shadow:
      0 4px 20px color-mix(in srgb, var(--accent-color) 40%, transparent),
      0 0 0 1px rgba(255, 255, 255, 0.1) inset;
  }

  .intro-action:hover {
    transform: translateY(-2px);
    box-shadow:
      0 8px 30px color-mix(in srgb, var(--accent-color) 50%, transparent),
      0 0 0 1px rgba(255, 255, 255, 0.15) inset;
  }

  .intro-action:active {
    transform: translateY(0);
  }

  .intro-action i {
    font-size: 0.9375rem;
    transition: transform var(--duration-normal) ease;
  }

  .intro-action:hover i {
    transform: translateX(4px);
  }

  /* Respect reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .intro-action,
    .intro-action i,
    .dot::before,
    .intro-body {
      transition: none;
    }

    .intro-action:hover {
      transform: none;
    }

    .intro-action:hover i {
      transform: none;
    }
  }

  /* Larger screens - more breathing room */
  @media (min-width: 768px) {
    .intro-icon {
      width: 100px;
      height: 100px;
      font-size: 2.25rem;
      border-radius: 28px;
      margin-bottom: 32px;
    }

    .intro-title {
      margin-bottom: 24px;
    }

    .intro-body-wrap {
      margin-bottom: 32px;
      max-width: 440px;
    }

    .pagination-dots {
      margin-bottom: 32px;
    }
  }
</style>
