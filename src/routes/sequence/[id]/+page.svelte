<!--
  /sequence/[id]/+page.svelte

  Dedicated sequence viewer route - the canonical way to view sequences.
  Uses SequenceViewerOrchestrator for all shared state/logic, keeping only
  route-specific concerns:
  - URL param parsing and state restoration
  - Sequence loading (handoff, encoded URL, legacy ID)
  - initializeAppServices() for standalone access
  - SSR metadata (<svelte:head>)
  - View Transitions
  - Swipe-to-dismiss gesture (all viewports)
  - DrawerStack registration (blocks pull-to-refresh)
  - Browse gallery background (mobile drawer effect)
-->
<script lang="ts">
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { browser } from "$app/environment";
  import { onMount, onDestroy } from "svelte";
  import { container } from "$lib/shared/di";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { ISequenceEncoder } from "$lib/shared/navigation/services/contracts/ISequenceEncoder";
  import type { ILetterDeriver } from "$lib/shared/navigation/services/contracts/ILetterDeriver";
  import type { IPositionDeriver } from "$lib/shared/navigation/services/contracts/IPositionDeriver";
  import { initializeAppServices } from "$lib/shared/application/state/services.svelte";
  import { getImageCompositionManager } from "$lib/shared/share/state/image-composition-state.svelte";
  import { setSkipNextViewTransition } from "$lib/shared/transitions/sequence-drawer-state.svelte";
  import { registerDrawer, unregisterDrawer, generateDrawerId } from "$lib/shared/foundation/ui/drawer/DrawerStack";
  import { createModalSwipeDismiss } from "$lib/shared/sequence-viewer/services/implementations/ModalSwipeDismiss";
  import {
    consumeSequenceRouteHandoff,
    type SequenceRouteHandoff
  } from "$lib/shared/coordinators/sequence-handoff.svelte";
  import { lanSyncState } from "$lib/shared/lan-sync/state/lan-sync-state.svelte";
  import { playbackTimeCalculator } from "$lib/shared/sequence-viewer/services/implementations/PlaybackTimeCalculator";
  import SequenceViewerOrchestrator from "$lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte";
  import type { OrchestratorContext } from "$lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte";

  // Components
  import ViewerSplitPane from "$lib/shared/sequence-viewer/components/ViewerSplitPane.svelte";
  import ViewerFooter from "$lib/shared/sequence-viewer/components/ViewerFooter.svelte";
  import FullscreenControls from "$lib/shared/sequence-viewer/components/FullscreenControls.svelte";
  import ExportModeContent from "$lib/shared/sequence-viewer/components/ExportModeContent.svelte";
  import ExportFooter from "$lib/shared/sequence-viewer/components/ExportFooter.svelte";
  import RampProgressIndicator from "$lib/shared/sequence-viewer/components/RampProgressIndicator.svelte";
  import RouteViewerHeader from "./RouteViewerHeader.svelte";
  import ViewerSettingsModal from "$lib/shared/sequence-viewer/components/ViewerSettingsModal.svelte";
  import { openSequenceOverlay } from "$lib/shared/sequence-viewer/state/sequence-viewer-overlay-state.svelte";
  import { getIabBannerVisible, IAB_BANNER_HEIGHT } from "$lib/shared/auth/state/iab-banner-state.svelte";
  import type { ISettingsState } from "$lib/shared/settings/services/contracts/ISettingsState";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";

  // ============================================================================
  // ROUTE-SPECIFIC STATE
  // ============================================================================

  // Route params
  const sequenceId = $derived($page.params.id);

  // URL params for state restoration
  const urlViewMode = $derived($page.url.searchParams.get("view") as "animation" | "image" | "split" | null);
  const urlBpm = $derived(parseInt($page.url.searchParams.get("bpm") || "") || null);
  const urlTime = $derived(parseInt($page.url.searchParams.get("t") || "") || null);

  // URL metadata params (from share URLs)
  const urlWord = $derived($page.url.searchParams.get("word"));
  const urlCreator = $derived($page.url.searchParams.get("creator"));
  const urlNotes = $derived($page.url.searchParams.get("notes"));
  const urlDarkMode = $derived($page.url.searchParams.get("dark"));
  const urlDifficulty = $derived($page.url.searchParams.get("difficulty"));
  const urlBirthday = $derived($page.url.searchParams.get("birthday"));

  // URL prop params (from QR codes with prop info)
  const urlBlueProp = $derived($page.url.searchParams.get("bp"));
  const urlRedProp = $derived($page.url.searchParams.get("rp"));

  // Sequence loading state
  let sequence = $state<SequenceData | null>(null);
  let isLoading = $state(true);
  let loadError = $state<string | null>(null);
  let handoffData = $state<SequenceRouteHandoff | null>(null);

  // IAB banner padding
  const iabBannerShowing = $derived(getIabBannerVisible());

  // Mobile detection
  let isMobile = $state(false);

  // Swipe-to-dismiss (works at all viewport sizes)
  const swipeDismiss = createModalSwipeDismiss();
  let currentSwipeY = $state(0);
  let currentIsSwiping = $state(false);

  // Page container ref for swipe visual feedback
  let pageContainer: HTMLElement | null = $state(null);

  // Settings modal state
  let settingsModalOpen = $state(false);

  // DrawerStack registration - blocks pull-to-refresh on mobile
  const drawerId = generateDrawerId();

  // Track if orchestrator needs to restore time from URL after init
  let pendingTimeRestore = $state<number | null>(null);

  // Cleanup
  let resizeCleanup: (() => void) | null = null;

  // ============================================================================
  // LIFECYCLE
  // ============================================================================

  onMount(async () => {
    // Ensure services are initialized (standalone route needs this;
    // inside the app shell, MainApplication handles it)
    await initializeAppServices();

    // Mobile detection
    const checkMobile = () => { isMobile = window.innerWidth < 768; };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    resizeCleanup = () => window.removeEventListener("resize", checkMobile);

    // Block pull-to-refresh on mobile
    if (isMobile) {
      registerDrawer(drawerId, handleBack);
    }

    // Start sequence loading
    void initializeRoute();
  });

  onDestroy(() => {
    unregisterDrawer(drawerId);
    resizeCleanup?.();
    swipeDismiss.dispose();
  });

  // Apply visual feedback during swipe gesture
  $effect(() => {
    if (!pageContainer) return;
    if (currentIsSwiping && currentSwipeY > 0) {
      pageContainer.style.transform = `translateY(${currentSwipeY}px)`;
      pageContainer.style.opacity = `${Math.max(0.3, 1 - currentSwipeY / 300)}`;
      pageContainer.style.transition = "none";
    } else if (!currentIsSwiping) {
      pageContainer.style.transform = "";
      pageContainer.style.opacity = "";
      pageContainer.style.transition = "";
    }
  });

  // ============================================================================
  // METADATA RESTORATION
  // ============================================================================

  /** Apply URL metadata params to a decoded sequence (fills in data lost during encoding). */
  function applyUrlMetadata(seq: SequenceData): SequenceData {
    // Build a mutable updates object and cast to Partial<SequenceData>
    // since updateSequenceData uses spread which bypasses readonly
    const updates: Record<string, unknown> = {};

    if (urlWord && !seq.word) updates.word = urlWord;
    if (urlCreator && !seq.ownerDisplayName) updates.ownerDisplayName = urlCreator;
    if (urlDifficulty && !seq.difficultyLevel) updates.difficultyLevel = urlDifficulty;

    if (urlNotes) {
      updates.metadata = { ...seq.metadata, notes: urlNotes };
    }

    if (urlBirthday && !seq.createdAt) {
      // Parse YYYYMMDD back into a Date
      const y = urlBirthday.slice(0, 4);
      const m = urlBirthday.slice(4, 6);
      const d = urlBirthday.slice(6, 8);
      const date = new Date(`${y}-${m}-${d}`);
      if (!isNaN(date.getTime())) {
        updates.createdAt = date;
      }
    }

    if (Object.keys(updates).length === 0) return seq;
    return { ...seq, ...updates } as SequenceData;
  }

  /**
   * Apply URL prop preferences to settings state.
   * Uses PROP_TYPE_DECODE mapping (single char -> PropType).
   */
  function applyUrlPropPreferences() {
    if (!urlBlueProp && !urlRedProp) return;

    const encoderService = container.items.sequenceEncoder as ISequenceEncoder;
    const parsed = encoderService.parsePropsFromURL($page.url.searchParams);

    if (parsed.bluePropType || parsed.redPropType) {
      const settingsService = container.items.settingsState as ISettingsState;
      const updates: { bluePropType?: PropType; redPropType?: PropType } = {};

      if (parsed.bluePropType) {
        updates.bluePropType = parsed.bluePropType as PropType;
      }
      if (parsed.redPropType) {
        updates.redPropType = parsed.redPropType as PropType;
      }

      settingsService.updateSettings(updates);
    }
  }

  // ============================================================================
  // SEQUENCE LOADING
  // ============================================================================

  async function initializeRoute() {
    // Try handoff data first (from Browse gallery)
    handoffData = consumeSequenceRouteHandoff();

    if (handoffData?.sequence) {
      sequence = handoffData.sequence;
      // Apply URL prop preferences even when using handoff (QR might have props)
      applyUrlPropPreferences();
      isLoading = false;
    } else if (sequenceId) {
      const encoderService = container.items.sequenceEncoder as ISequenceEncoder;
      const parsed = encoderService.parseSequenceRouteId(sequenceId);

      if (parsed.encoded) {
        try {
          let decoded = encoderService.decodeWithCompression(parsed.encoded);

          const letterDeriver = container.items.letterDeriver as ILetterDeriver | null;
          const positionDeriver = container.items.positionDeriver as IPositionDeriver | null;

          if (letterDeriver) {
            decoded = await letterDeriver.deriveLettersForSequence(decoded);
          }
          if (positionDeriver) {
            decoded = await positionDeriver.derivePositionsForSequence(decoded);
          }

          sequence = applyUrlMetadata(decoded);

          // Apply URL dark mode preference before the orchestrator mounts
          if (urlDarkMode !== null) {
            const imageComposition = getImageCompositionManager();
            imageComposition.setDarkMode(urlDarkMode === "1");
          }

          // Apply URL prop preferences (from QR codes with embedded prop info)
          applyUrlPropPreferences();

          isLoading = false;
        } catch (err) {
          console.error("[SequenceRoute] Failed to decode sequence from URL:", err);
          loadError = "Invalid sequence URL";
          isLoading = false;
        }
      } else if (parsed.legacyId) {
        await loadSequenceFromId(parsed.legacyId);
      } else {
        loadError = "No sequence data in URL";
        isLoading = false;
      }
    } else {
      loadError = "No sequence ID provided";
      isLoading = false;
    }

    // Mobile: redirect to app shell with drawer overlay
    // This handles QR code / shared link scenarios where the user lands on
    // the route but would get a better experience with the drawer overlay.
    // Works for both authenticated and unauthenticated users since
    // SequenceViewerDrawerHost renders outside the auth gate.
    if (isMobile && sequence) {
      const returnPath = handoffData?.returnPath || "/browse/gallery";
      const returnLabel = handoffData?.returnLabel || "Browse";
      // Set overlay state without history push (goto will handle navigation)
      // dismissPath ensures swipe-down navigates to the app instead of history.back()
      openSequenceOverlay(sequence, {
        returnLabel,
        initialBpm: urlBpm ?? undefined,
        initialStep: urlTime ?? undefined,
        skipHistoryPush: true,
        dismissPath: returnPath,
      });
      // Skip view transition so it doesn't compete with drawer animation
      setSkipNextViewTransition();
      // Navigate to app shell - replaces the /sequence/[id] entry
      // Once MainApplication mounts, SequenceViewerDrawerHost picks up overlay state
      await goto(returnPath, { replaceState: true });
      // Push overlay history entry after navigation completes
      window.history.pushState({ sequenceOverlay: true }, '');
      return;
    }

    // Store pending time restore from URL (orchestrator will handle after animation init)
    if (urlTime) {
      pendingTimeRestore = urlTime;
    }
  }

  async function loadSequenceFromId(id: string) {
    isLoading = true;
    loadError = null;

    try {
      const encoderService = container.items.sequenceEncoder as ISequenceEncoder;

      if (encoderService.isInlineEncoded(id)) {
        try {
          const decoded = encoderService.decodeWithCompression(decodeURIComponent(id));
          if (decoded) {
            sequence = decoded;
            isLoading = false;
            return;
          }
        } catch {
          // Not a valid encoded sequence, continue
        }
      }

      const shortCodeManager = container.items.shortCodeManager;
      let resolvedSequence = await shortCodeManager.resolveShortCode(id);

      if (!resolvedSequence) {
        const provider = container.items.sequenceDataProvider;
        resolvedSequence = await provider.loadByIdentifier(id);
      }

      if (!resolvedSequence) {
        loadError = "Sequence not found";
        isLoading = false;
        return;
      }

      sequence = resolvedSequence;
      // Apply URL prop preferences (from QR codes with embedded prop info)
      applyUrlPropPreferences();
      isLoading = false;
    } catch (err) {
      console.error("[SequenceRoute] Failed to load sequence:", err);
      loadError = "Failed to load sequence";
      isLoading = false;
    }
  }

  // ============================================================================
  // NAVIGATION
  // ============================================================================

  function handleBack() {
    const returnPath = handoffData?.returnPath || "/browse/gallery";
    goto(returnPath);
  }

  // ============================================================================
  // SWIPE HANDLING (ALL VIEWPORTS)
  // ============================================================================

  function handleTouchStart(e: TouchEvent, ctx: OrchestratorContext) {
    if (ctx.isFullscreen || ctx.isExportMode) return;
    swipeDismiss.handleTouchStart(e);
  }

  function handleTouchMove(e: TouchEvent, ctx: OrchestratorContext) {
    if (ctx.isFullscreen || ctx.isExportMode) return;
    const handled = swipeDismiss.handleTouchMove(e);
    currentSwipeY = swipeDismiss.state.swipeY;
    currentIsSwiping = swipeDismiss.state.isSwiping;
    if (handled && e.cancelable) {
      e.preventDefault();
    }
  }

  async function handleTouchEnd(ctx: OrchestratorContext) {
    const shouldDismiss = swipeDismiss.handleTouchEnd();
    if (shouldDismiss) {
      if (pageContainer) {
        pageContainer.style.transition = "transform 200ms ease-out, opacity 200ms ease-out";
        pageContainer.style.transform = "translateY(100%)";
        pageContainer.style.opacity = "0";
        await new Promise((r) => setTimeout(r, 200));
      }
      setSkipNextViewTransition();
      ctx.onBack();
    } else {
      currentSwipeY = 0;
      currentIsSwiping = false;
    }
  }

  // ============================================================================
  // URL HELPERS
  // ============================================================================

  function updateUrlParam(key: string, value: string) {
    if (!browser) return;
    const url = new URL(window.location.href);
    url.searchParams.set(key, value);
    window.history.replaceState({}, "", url.toString());
  }
</script>

<svelte:head>
  <title>{sequence?.word || sequence?.name || "Sequence"} - TKA Scribe</title>
  <meta
    name="description"
    content={sequence?.word
      ? `View the "${sequence.word}" flow sequence in TKA Scribe`
      : "View this flow sequence in TKA Scribe"}
  />
</svelte:head>

{#if isLoading}
  <div class="sequence-route-page">
    <div class="loading-container">
      <div class="spinner"></div>
      <p>Loading sequence...</p>
    </div>
  </div>
{:else if loadError || !sequence}
  <div class="sequence-route-page">
    <div class="error-container">
      <div class="error-card">
        <i class="fas fa-exclamation-circle error-icon" aria-hidden="true"></i>
        <h1>Sequence Not Found</h1>
        <p>{loadError || "This sequence could not be loaded."}</p>
        <button class="back-button" onclick={() => goto("/browse/gallery")}>
          Browse Sequences
        </button>
      </div>
    </div>
  </div>
{:else}
  <SequenceViewerOrchestrator
    {sequence}
    {isMobile}
    initialBpm={urlBpm || handoffData?.playbackState?.bpm || 60}
    initialStep={handoffData?.playbackState?.currentStep || 0}
    initialViewMode={urlViewMode || undefined}
    onBack={handleBack}
    onUrlParamChange={updateUrlParam}
    blockClicks={swipeDismiss.state.blockClicks}
  >
    {#snippet children(ctx)}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="sequence-route-page"
        bind:this={pageContainer}
        data-fullscreen={ctx.isFullscreen}
        style:padding-bottom={iabBannerShowing ? `${IAB_BANNER_HEIGHT}px` : undefined}
        ontouchstart={(e) => handleTouchStart(e, ctx)}
        ontouchmove={(e) => handleTouchMove(e, ctx)}
        ontouchend={() => handleTouchEnd(ctx)}
      >
        <!-- Header -->
        <RouteViewerHeader
          isExportMode={ctx.isExportMode}
          exportType={ctx.exportType}
          isFullscreen={ctx.isFullscreen}
          {isMobile}
          darkMode={ctx.imgDarkMode}
          returnLabel={handoffData?.returnLabel || "Back"}
          onBack={ctx.onBack}
          onExitExportMode={ctx.exitExportMode}
          onBackToExportTypeSelection={ctx.backToExportTypeSelection}
          onDarkModeToggle={ctx.handleUnifiedDarkModeToggle}
          onSettingsOpen={() => (settingsModalOpen = true)}
        />

        <!-- Main content -->
        <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
        <div
          class="route-body-content"
          data-fullscreen={ctx.isFullscreen}
          style:view-transition-name="sequence-{sequence?.id || 'viewer'}"
          onclick={ctx.isFullscreen ? ctx.handleFullscreenTap : undefined}
          onkeydown={ctx.isFullscreen ? (e) => { if (e.key === 'Enter' || e.key === ' ') ctx.handleFullscreenTap(); } : undefined}
          role={ctx.isFullscreen ? "button" : undefined}
          tabindex={ctx.isFullscreen ? 0 : undefined}
        >
          {#if ctx.isFullscreen}
            <FullscreenControls
              visible={ctx.fullscreenControlsVisible}
              viewMode={ctx.viewMode}
              isPlaying={ctx.isPlayingLocal}
              bpm={ctx.bpmLocal}
              onExit={ctx.exitFullscreen}
              onPlaybackToggle={ctx.handlePlaybackToggle}
              onStepHalfBeatBackward={ctx.stepHalfBeatBackward}
              onStepHalfBeatForward={ctx.stepHalfBeatForward}
              onStepFullBeatBackward={ctx.stepFullBeatBackward}
              onStepFullBeatForward={ctx.stepFullBeatForward}
              onBpmChange={ctx.handleBpmChange}
            />
          {/if}

          {#if ctx.hasSequence && ctx.effectiveSequence}
            {#if ctx.isExportMode}
              <ExportModeContent
                sequence={ctx.effectiveSequence}
                exportType={ctx.exportType}
                exportOptions={ctx.exportOptions}
                animationState={ctx.modalAnimationState}
                animationLoading={ctx.animationLoading}
                currentStep={ctx.currentStepLocal}
                currentLetter={ctx.currentLetter}
                currentStepData={ctx.currentStepData}
                userName={ctx.userName}
                bluePropType={ctx.bluePropType}
                redPropType={ctx.redPropType}
                catDogModeEnabled={ctx.catDogModeEnabled}
                onSelectType={ctx.selectExportType}
                onCanvasReady={ctx.handleCanvasReady}
              />
            {:else}
              <ViewerSplitPane
                sequence={ctx.effectiveSequence}
                playback={ctx.splitPanePlayback}
                imageComposition={ctx.splitPaneImageComposition}
                propRendering={ctx.splitPanePropRendering}
                layout={{ isFullscreen: ctx.isFullscreen, fullscreenStackVertical: ctx.fullscreenStackVertical, isMobile, isLandscapeMobile: false, focusedPane: ctx.editingPane }}
                onFocusPane={ctx.enterEditMode}
                onUnfocusPane={ctx.exitEditMode}
                onStepClick={ctx.handleStepClick}
                onCanvasReady={ctx.handleCanvasReady}
              />
            {/if}
          {/if}
        </div>

        <!-- Footer -->
        {#if !ctx.isFullscreen}
          {#if ctx.isExportMode}
            <ExportFooter
              exportType={ctx.exportType}
              isExporting={ctx.isExporting}
              exportProgress={ctx.exportProgress}
              exportError={ctx.exportError}
              isFullscreen={ctx.isFullscreen}
              onExport={ctx.handleExport}
              onCancel={ctx.handleCancelExport}
              onRetry={ctx.handleRetryExport}
            />
          {:else}
            <ViewerFooter
              bpm={ctx.bpmLocal}
              isPlaying={ctx.isPlayingLocal}
              isLoggedIn={ctx.isLoggedIn}
              rampActive={ctx.rampActive}
              isSyncToggling={ctx.isSyncToggling}
              isSyncActive={ctx.isSyncActive}
              isSyncConnected={ctx.isSyncConnected}
              onBpmChange={ctx.handleBpmChange}
              onPlayPause={ctx.handlePlaybackToggle}
              onStepBack={ctx.stepFullBeatBackward}
              onStepForward={ctx.stepFullBeatForward}
              onStepHalfBack={ctx.stepHalfBeatBackward}
              onStepHalfForward={ctx.stepHalfBeatForward}
              onSave={ctx.handleSave}
              onEdit={ctx.handleEditInConstructor}
              onCompose={() => ctx.handleOpenInCompose()}
              onShare={ctx.handleShare}
              onExport={ctx.enterExportMode}
              onGetApp={ctx.handleGetApp}
              onRampStart={ctx.handleRampStart}
              onRampStop={ctx.handleRampStop}
              onConnect={ctx.handleSyncToggle}
            />
            {#if ctx.rampActive}
              <RampProgressIndicator
                progress={ctx.rampState.progress}
                onStop={ctx.handleRampStop}
                variant="floating"
              />
            {/if}
          {/if}
        {/if}
      </div>
    {/snippet}
  </SequenceViewerOrchestrator>
{/if}

<!-- Settings modal - rendered outside constrained containers so position:fixed works -->
<ViewerSettingsModal
  bind:open={settingsModalOpen}
  onClose={() => (settingsModalOpen = false)}
/>

<style>
  .sequence-route-page {
    display: flex;
    flex-direction: column;
    height: 100vh;
    height: 100dvh;
    overflow: hidden;
  }

  .route-body-content {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;
  }

  .route-body-content[data-fullscreen="true"] {
    position: relative;
  }

  /* Loading state */
  .loading-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  .spinner {
    width: 48px;
    height: 48px;
    border: 3px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-top-color: var(--theme-accent, #f43f5e);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .loading-container p {
    font-size: var(--font-size-sm, 14px);
    margin: 0;
  }

  /* Error state */
  .error-container {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  }

  .error-card {
    text-align: center;
    padding: 2rem;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 1rem;
    max-width: 400px;
  }

  .error-icon {
    font-size: 48px;
    color: var(--semantic-error, #ef4444);
    margin-bottom: 1rem;
  }

  .error-card h1 {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--theme-text, #ffffff);
    margin: 0 0 0.5rem 0;
  }

  .error-card p {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    margin: 0 0 1.5rem 0;
    font-size: var(--font-size-sm, 14px);
  }

  .back-button {
    min-height: 48px;
    padding: 0.75rem 1.5rem;
    background: var(--theme-accent, #f43f5e);
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-weight: 600;
    font-size: var(--font-size-sm, 14px);
    cursor: pointer;
    transition: filter var(--duration-normal, 200ms) ease;
  }

  .back-button:hover {
    filter: brightness(1.1);
  }

  .back-button:focus-visible {
    outline: 2px solid var(--theme-accent, #f43f5e);
    outline-offset: 2px;
  }

  /* Mobile drawer appearance */
  @media (max-width: 767px) {
    .sequence-route-page {
      border-top-left-radius: 16px;
      border-top-right-radius: 16px;
      box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.4);
      background: var(--theme-panel-bg, #0a0a14);
      overflow: hidden;
      overscroll-behavior-y: contain;
      touch-action: pan-y;
    }

    /* Suppress morph view-transition-name on mobile so the drawer
       slide-up doesn't fight with a morph animation */
    .route-body-content {
      view-transition-name: none !important;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .spinner {
      animation: none;
    }
  }
</style>
