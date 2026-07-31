<script lang="ts">

import { getLibraryRepository } from "$lib/shared/library/get-library-repository";
import { loadByIdentifier } from "$lib/shared/sequence-viewer/services/sequence-data-provider";
import { shareOrDownloadBlob } from "$lib/shared/foundation/services/file-downloader";
import { loadSequencesByIds } from "$lib/features/choreo-card/services/catalog-loader";
import type { SequenceRouteMeta, SequenceSeoDocument } from "./sequence-seo";
  import { viewportFits3D } from "$lib/shared/3d/capabilities/viewport-3d-gate.svelte";
  import { page } from "$app/state";
  import { goto, replaceState } from "$app/navigation";
  import { browser } from "$app/environment";
  import { onMount, onDestroy } from "svelte";
  import { fade } from "svelte/transition";
  import { getShortCodeManager } from "$lib/shared/qr/get-short-code-manager";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import { hydrateSequence } from "$lib/shared/navigation/services/sequence-hydrator";
  import { loopDetector } from "$lib/features/create/generate/circular/services/loop-detector";
  import { parsePropsFromURL, parseSequenceRouteId, decodeSequenceWithCompression, isInlineEncoded } from "$lib/shared/navigation/services/sequence-encoder";
  import { decodeViewMode } from "$lib/shared/browse/domain/browse-view-mode";
  import { getPublicSequenceHashMatcher } from "$lib/shared/sequence-viewer/get-public-sequence-hash-matcher";
  import { initializeAppServices } from "$lib/shared/application/state/services.svelte";
  import { getImageCompositionManager } from "$lib/shared/share/state/image-composition-state.svelte";
  import { setSkipNextViewTransition } from "$lib/shared/transitions/sequence-drawer-state.svelte";
  import { registerDrawer, unregisterDrawer, generateDrawerId } from "$lib/shared/foundation/ui/drawer/drawer-stack";
  import { createModalSwipeDismiss } from "$lib/shared/sequence-viewer/services/modal-swipe-dismiss";
  import {
    consumeSequenceRouteHandoff,
    type SequenceRouteHandoff
  } from "$lib/shared/coordinators/sequence-handoff.svelte";
  import { lanSyncState } from "$lib/shared/lan-sync/state/lan-sync-state.svelte";
  import SequenceViewerOrchestrator from "$lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte";
  import type { OrchestratorContext } from "$lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte";

  // Components
  import ViewerSplitPane from "$lib/shared/sequence-viewer/components/ViewerSplitPane.svelte";
  import FullscreenControls from "$lib/shared/sequence-viewer/components/FullscreenControls.svelte";
  import ExportVideoDrawer from "$lib/shared/animation-panel/components/AnimationPanel.svelte";
  import ExportImagePanel from "$lib/shared/sequence-viewer/components/ExportImagePanel.svelte";
  import VideoPreviewPanel from "$lib/shared/sequence-viewer/components/VideoPreviewPanel.svelte";
  import PracticeBar from "$lib/shared/sequence-viewer/components/PracticeBar.svelte";
  import PracticeSetupBar from "$lib/shared/sequence-viewer/components/PracticeSetupBar.svelte";
  import ViewerHeader from "$lib/shared/sequence-viewer/components/ViewerHeader.svelte";
  import DeleteConfirmDialog from "$lib/shared/sequence-viewer/components/DeleteConfirmDialog.svelte";

  import {
    getIabBannerVisible,
    getIabBannerHeight,
    IAB_BANNER_HEIGHT,
  } from "$lib/shared/auth/state/iab-banner-state.svelte";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import LoadingGate from "$lib/shared/components/loading/LoadingGate.svelte";
  import ChoreoCardContextMenuHost from "$lib/shared/sequence-viewer/components/choreo-card-context-menu/ChoreoCardContextMenuHost.svelte";
  import {
    openSendSequenceSheet,
    buildSequenceSharePayload,
    buildThumbnailUrl,
  } from "$lib/shared/inbox/state/send-sequence-state.svelte";
  import { settingsService } from "$lib/shared/settings/state/settings-state.svelte";
  import { sendToStickerLab } from "$lib/shared/sequence-viewer/services/send-to-sticker-lab";

  interface Props {
    data: {
      meta: SequenceRouteMeta;
      seo: SequenceSeoDocument;
    };
  }

  const { data }: Props = $props();
  const seo = $derived(data.seo);

  // Route params
  const sequenceId = $derived(page.params.id);

  // URL params for state restoration
  const urlViewMode = $derived(page.url.searchParams.get("view") as "animation" | "image" | "split" | null);
  const urlBpm = $derived(parseInt(page.url.searchParams.get("bpm") || "") || null);
  const urlTime = $derived(parseInt(page.url.searchParams.get("t") || "") || null);

  // URL metadata params (from share URLs)
  const urlWord = $derived(page.url.searchParams.get("word"));
  const urlCreator = $derived(page.url.searchParams.get("creator"));
  const urlNotes = $derived(page.url.searchParams.get("notes"));
  const urlDarkMode = $derived(page.url.searchParams.get("dark"));
  const urlDifficulty = $derived(page.url.searchParams.get("difficulty"));
  const urlBirthday = $derived(page.url.searchParams.get("birthday"));

  // URL render mode param (2D/3D)
  const urlRenderMode = $derived(page.url.searchParams.get("render") as '2d' | '3d' | null);

  // URL prop params (from QR codes with prop info)
  const urlBlueProp = $derived(page.url.searchParams.get("bp"));
  const urlRedProp = $derived(page.url.searchParams.get("rp"));

  // URL view mode param (from QR codes with browse view mode)
  const urlViewModeParam = $derived(page.url.searchParams.get("vm"));
  const decodedBrowseViewMode = $derived(urlViewModeParam ? decodeViewMode(urlViewModeParam) : null);
  const urlHandPathMode = $derived(decodedBrowseViewMode?.subject === "hands");
  const urlInitialBlueVisible = $derived(
    decodedBrowseViewMode?.granularity === "solo" ? decodedBrowseViewMode.color === "blue" : true
  );
  const urlInitialRedVisible = $derived(
    decodedBrowseViewMode?.granularity === "solo" ? decodedBrowseViewMode.color === "red" : true
  );

  // Guest preview mode - forces unauthenticated view for debugging shared link UX
  const forceGuest = $derived(page.url.searchParams.get("guest") === "1");

  // Sequence loading state
  let sequence = $state<SequenceData | null>(null);
  let isLoading = $state(true);
  let loadError = $state<string | null>(null);
  let handoffData = $state<SequenceRouteHandoff | null>(null);

  // IAB banner padding. The measured height is what the banner actually
  // occupies — its second copy line wraps to two or three lines on a phone, so
  // the 56px constant undershoots. It stays as the pre-measurement fallback.
  const iabBannerShowing = $derived(getIabBannerVisible());
  const iabBannerHeight = $derived(getIabBannerHeight());

  // Mobile detection
  let isMobile = $state(false);

  // Swipe-to-dismiss (works at all viewport sizes)
  const swipeDismiss = createModalSwipeDismiss();
  let currentSwipeY = $state(0);
  let currentIsSwiping = $state(false);

  // Page container ref for swipe visual feedback
  let pageContainer: HTMLElement | null = $state(null);

  // Delete confirmation state
  let deleteConfirmOpen = $state(false);
  let isDeleting = $state(false);

  // ChoreoCard context menu
  let choreoCardMenuHost: ChoreoCardContextMenuHost | undefined = $state();

  // DrawerStack registration - blocks pull-to-refresh on mobile
  const drawerId = generateDrawerId();

  // Track if orchestrator needs to restore time from URL after init
  let pendingTimeRestore = $state<number | null>(null);

  // Cleanup
  let resizeCleanup: (() => void) | null = null;

  function handleSendTo() {
    const seq = sequence;
    if (!seq) return;
    const propType = seq.intendedProp?.bluePropType ?? settingsService.settings.bluePropType ?? "staff";
    const thumbnailUrl = buildThumbnailUrl(seq.word || seq.name, String(propType), false);
    openSendSequenceSheet(buildSequenceSharePayload({ ...seq, thumbnailUrl }));
  }

  function handleSendToStickerLab() {
    const seq = sequence;
    if (!seq) return;
    sendToStickerLab(seq);
  }

  onMount(async () => {
    // Non-blocking: settings sync happens in background.
    // Don't block the viewer on service initialization.
    initializeAppServices().catch(() => {});

    // Mobile detection
    const checkMobile = () => { isMobile = window.innerWidth < 768; };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    resizeCleanup = () => window.removeEventListener("resize", checkMobile);

    // Block pull-to-refresh on mobile
    if (isMobile) {
      registerDrawer(drawerId, handleClose);
    }

    // Start sequence loading immediately - don't wait for services
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

    if (urlBirthday && !seq.birthday) {
      // Parse YYYYMMDD back into a Date - restore to birthday (original creation date),
      // not createdAt (when added to library), so the field round-trips correctly
      const y = urlBirthday.slice(0, 4);
      const m = urlBirthday.slice(4, 6);
      const d = urlBirthday.slice(6, 8);
      const date = new Date(`${y}-${m}-${d}`);
      if (!isNaN(date.getTime())) {
        updates.birthday = date;
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

    const parsed = parsePropsFromURL(page.url.searchParams);

    if (parsed.bluePropType || parsed.redPropType) {
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

  /**
   * Fire-and-forget: compute encoderHash, query publicSequences, enrich viewer.
   * If it fails (offline, no match, error), the viewer works fine from URL data alone.
   */
  async function matchPublicRecord(seq: SequenceData) {
    try {
      const matcher = getPublicSequenceHashMatcher();
      const result = await matcher.findPublicMatch(seq);

      if (result.matched && result.publicRecord) {
        const pub = result.publicRecord;
        sequence = {
          ...seq,
          ownerId: pub.ownerId,
          ownerDisplayName: pub.ownerDisplayName,
          intendedProp: seq.intendedProp,
          creatorIntent: pub.creatorIntent ?? undefined,
          word: seq.word || pub.word,
          name: seq.name === "Shared Sequence" ? pub.name : seq.name,
        } as SequenceData;
      }
    } catch {
      // Silent failure - progressive enhancement only
    }
  }

  async function loadReleasedCatalogSequence(id: string): Promise<boolean> {
    const catalogId = data.meta.catalogId;
    if (data.meta.source !== "catalog" || !catalogId) return false;

    try {
      const [catalogSequence] = await loadSequencesByIds(catalogId, [id]);
      if (!catalogSequence) return false;

      sequence = await hydrateSequence(applyUrlMetadata(catalogSequence), {
        loopDetector,
      });
      applyUrlPropPreferences();
      isLoading = false;
      return true;
    } catch {
      return false;
    }
  }

  async function initializeRoute() {
    // Try handoff data first (from Browse gallery)
    handoffData = consumeSequenceRouteHandoff();

    if (handoffData?.sequence) {
      sequence = handoffData.sequence;
      // Apply URL prop preferences even when using handoff (QR might have props)
      applyUrlPropPreferences();
      isLoading = false;
    } else if (sequenceId) {
      const parsed = parseSequenceRouteId(sequenceId);

      if (parsed.encoded) {
        try {
          let decoded = decodeSequenceWithCompression(parsed.encoded);

          decoded = await hydrateSequence(decoded, {
            loopDetector,
          });

          sequence = applyUrlMetadata(decoded);

          // Apply URL dark mode preference before the orchestrator mounts
          if (urlDarkMode !== null) {
            const imageComposition = getImageCompositionManager();
            imageComposition.setDarkMode(urlDarkMode === "1");
          }

          // Apply URL prop preferences (from QR codes with embedded prop info)
          applyUrlPropPreferences();

          isLoading = false;

          // Background: try to match against public library for attribution
          void matchPublicRecord(sequence!);
        } catch (err) {
          console.error("[SequenceRoute] Failed to decode sequence from URL:", err);
          loadError = "Invalid sequence URL";
          isLoading = false;
        }
      } else if (parsed.legacyId) {
        const loadedFromCatalog = await loadReleasedCatalogSequence(
          parsed.legacyId
        );
        if (!loadedFromCatalog) {
          await loadSequenceFromId(parsed.legacyId);
        }
      } else {
        loadError = "No sequence data in URL";
        isLoading = false;
      }
    } else {
      loadError = "No sequence ID provided";
      isLoading = false;
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
      if (isInlineEncoded(id)) {
        try {
          const decoded = decodeSequenceWithCompression(decodeURIComponent(id));
          if (decoded) {
            sequence = await hydrateSequence(decoded, {
              loopDetector,
            });
            isLoading = false;
            return;
          }
        } catch {
          // Not a valid encoded sequence, continue
        }
      }

      const shortCodeManager = getShortCodeManager();
      let resolvedSequence = await shortCodeManager.resolveShortCode(id);

      if (!resolvedSequence) {
        resolvedSequence = await loadByIdentifier(id);
      }

      // Try user's Firestore library (e.g. sync room IDs are Firestore doc IDs)
      if (!resolvedSequence) {
        try {
          const libraryRepo = getLibraryRepository();
          resolvedSequence = await libraryRepo.getSequence(id);
        } catch {
          // Library lookup failed (not logged in, etc.)
        }
      }

      if (!resolvedSequence) {
        loadError = "It may have been deleted by the owner while you were browsing the feed.";
        isLoading = false;
        return;
      }

      sequence = await hydrateSequence(resolvedSequence, {
        loopDetector,
      });
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

  function handleClose() {
    const returnPath = handoffData?.returnPath || "/browse/gallery";
    goto(returnPath);
  }

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
      ctx.onClose();
    } else {
      currentSwipeY = 0;
      currentIsSwiping = false;
    }
  }

  function updateUrlParam(key: string, value: string) {
    if (!browser) return;
    const url = new URL(window.location.href);
    url.searchParams.set(key, value);
    replaceState(url.toString(), {});
  }
</script>

{#if isLoading}
  <div class="sequence-route-page">
    <div class="loading-container">
      <LoadingGate variant="card" message="Loading sequence..." />
    </div>
  </div>
{:else if loadError || !sequence}
  <div class="sequence-route-page">
    <div class="error-container">
      <div class="error-card">
        <i class="fas fa-exclamation-circle error-icon" aria-hidden="true"></i>
        <h1>This sequence isn't available</h1>
        <p>{loadError || "The link may be broken, or the sequence was deleted by its owner."}</p>
        <div class="recovery-actions">
          <a class="recovery-button" href="/browse/gallery">
            <i class="fas fa-compass" aria-hidden="true"></i>
            Browse Sequences
          </a>
          <a class="recovery-button ghost" href="/create">
            <i class="fas fa-pen" aria-hidden="true"></i>
            Create Your Own
          </a>
        </div>
      </div>
    </div>
  </div>
{:else}
  <SequenceViewerOrchestrator
    {sequence}
    {isMobile}
    {forceGuest}
    initialBpm={urlBpm || handoffData?.playbackState?.bpm || 60}
    initialStep={handoffData?.playbackState?.currentStep || 0}
    initialViewMode={urlViewMode || undefined}
    initialRenderMode={urlRenderMode || undefined}
    handPathMode={urlHandPathMode}
    initialBlueVisible={urlInitialBlueVisible}
    initialRedVisible={urlInitialRedVisible}
    onClose={handleClose}
    onUrlParamChange={updateUrlParam}
    blockClicks={swipeDismiss.state.blockClicks}
  >
    {#snippet children(ctx)}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <main
        class="sequence-route-page"
        bind:this={pageContainer}
        data-fullscreen={ctx.isFullscreen}
        style:padding-bottom={iabBannerShowing
          ? `${iabBannerHeight || IAB_BANNER_HEIGHT}px`
          : undefined}
        ontouchstart={(e) => handleTouchStart(e, ctx)}
        ontouchmove={(e) => handleTouchMove(e, ctx)}
        ontouchend={() => handleTouchEnd(ctx)}
      >
        <!-- Header -->
        <ViewerHeader
          profile="full"
          {ctx}
          {isMobile}
          isFullscreen={ctx.isFullscreen}
          editingPane={ctx.editingPane}
          returnLabel={handoffData?.returnLabel || "Back"}
          homeHref="/browse/gallery"
          sequence={sequence}
          onDeleteRequest={() => (deleteConfirmOpen = true)}
        />

        {#if !ctx.isFullscreen && !ctx.editingPane}
          <section
            class="sequence-context"
            aria-labelledby="sequence-context-heading"
            data-sequence-index-content
          >
            <div class="sequence-context-identity">
              <p>Flow Arts Composer</p>
              <h1 id="sequence-context-heading">{seo.heading}</h1>
            </div>

            <p class="sequence-context-facts">
              {#if data.meta.creator}<span>By {data.meta.creator}</span>{/if}
              {#if data.meta.stepCount}
                <span>
                  {data.meta.stepCount}
                  {data.meta.stepCount === 1 ? "step" : "steps"}
                </span>
              {/if}
              {#if data.meta.difficulty}
                <span>Difficulty: {data.meta.difficulty}</span>
              {/if}
            </p>

            <details class="sequence-context-details">
              <summary>
                Details
                <i class="fas fa-chevron-down" aria-hidden="true"></i>
              </summary>
              <div class="sequence-context-panel">
                <p>{seo.description}</p>

                <nav aria-label="More flow arts tools">
                  <a href="/composer">Open Flow Arts Composer</a>
                  <a href="/browse/gallery">Browse public sequences</a>
                </nav>
              </div>
            </details>
          </section>
        {/if}

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
              onRestartToStart={ctx.restartToStart}
              onBpmChange={ctx.handleBpmChange}
            />
          {/if}

          {#if ctx.hasSequence && ctx.effectiveSequence}
            {@const isVideoExportActive = ctx.editingPane === "animation"}
            {@const isImageExportActive = ctx.editingPane === "image"}
            {@const isAnyExportActive = isVideoExportActive || isImageExportActive}
            <div
              class="viewer-and-export"
              class:export-active={isAnyExportActive}
              class:desktop={!isMobile}
            >
              <!-- Mobile 3D fullscreen overlay (lazy-loaded — Three.js is 3.8MB) -->
              {#if isMobile && ctx.renderMode === '3d' && ctx.effectiveSequence && viewportFits3D()}
                {#await import("$lib/shared/3d/components/Viewer3DFullscreen.svelte") then mod}
                  <mod.default
                    sequenceData={ctx.effectiveSequence}
                    currentStep={ctx.currentStepLocal}
                    isPlaying={ctx.isPlayingLocal}
                    bpm={ctx.bpmLocal}
                    word={ctx.effectiveSequence.word ?? null}
                    bluePropType={ctx.bluePropType != null ? String(ctx.bluePropType) : null}
                    redPropType={ctx.redPropType != null ? String(ctx.redPropType) : null}
                    onClose={() => ctx.viewerState.setViewerMode('animation')}
                    onPlaybackToggle={ctx.handlePlaybackToggle}
                    onBpmChange={ctx.handleBpmChange}
                    onStepForward={ctx.stepFullBeatForward}
                    onStepBackward={ctx.stepFullBeatBackward}
                    immersive={ctx.immersive}
                    onToggleImmersive={ctx.toggleImmersive}
                  />
                {/await}
              {/if}

              <!-- Single persistent ViewerSplitPane - never destroyed, CSS grid transitions handle focus -->
              <ViewerSplitPane
                sequence={ctx.effectiveSequence}
                renderMode={isMobile ? '2d' : ctx.renderMode}
                bpm={ctx.bpmLocal}
                onBpmChange={ctx.handleBpmChange}
                playback={ctx.splitPanePlayback}
                imageComposition={isImageExportActive
                  ? {
                      showWord: ctx.exportOptions.imageShowWord,
                      showStepNumbers: ctx.exportOptions.imageShowStepNumbers,
                      showDifficulty: ctx.exportOptions.imageShowDifficulty,
                      showStartPos: ctx.exportOptions.imageIncludeStartPosition,
                      showCreatorName: ctx.exportOptions.imageShowCreatorName,
                      showNotes: ctx.exportOptions.imageShowNotes,
                      showBirthday: ctx.splitPaneImageComposition.showBirthday,
                      showQRCode: ctx.exportOptions.imageShowQRCode,
                      darkMode: ctx.exportOptions.imageDarkMode,
                      // Null delegates to ChoreoCard's per-length composition preference.
                      columnCount: null,
                      forceContain: true,
                      userName: ctx.splitPaneImageComposition.userName,
                    }
                  : ctx.splitPaneImageComposition}
                propRendering={ctx.splitPanePropRendering}
                layout={{
                  isFullscreen: ctx.isFullscreen,
                  fullscreenStackVertical: ctx.fullscreenStackVertical,
                  isMobile,
                  isLandscapeMobile: false,
                  focusedPane: ctx.editingPane,
                  suppressCloseButton: ctx.editingPane !== null,
                }}
                onFocusPane={ctx.enterEditMode}
                onUnfocusPane={ctx.exitEditMode}
                onStepClick={ctx.handleStepClick}
                onCanvasReady={ctx.handleCanvasReady}
                onAutoLayoutResolved={isImageExportActive
                  ? ctx.setResolvedCardAutoLayout
                  : undefined}
                onChoreoCardContextMenu={(x, y) => choreoCardMenuHost?.openContextMenu(x, y)}
                practiceActive={ctx.practiceActive}
                practiceRunning={ctx.practiceRunning}
                practiceCountdown={ctx.practiceCountdown}
                practiceCellSize={ctx.practiceViewPrefs.cellSize}
                practiceCanvasFraction={0.5}
                practiceMirrorEnabled={ctx.mirrorEnabled}
              />
              <ChoreoCardContextMenuHost
                bind:this={choreoCardMenuHost}
                isExportMode={isImageExportActive}
                exportOptions={ctx.exportOptions}
                onSendTo={sequence ? handleSendTo : undefined}
                onSendToStickerLab={sequence ? handleSendToStickerLab : undefined}
                stepCount={sequence?.steps?.length ?? 0}
              />
              {#if isAnyExportActive}
                <div class="export-panel-container" class:sidebar={!isMobile && isVideoExportActive} transition:fade={{ duration: 200 }}>
                  {#if isVideoExportActive}
                    {#if ctx.previewBlobUrl}
                      <VideoPreviewPanel
                        blobUrl={ctx.previewBlobUrl}
                        onDismiss={ctx.dismissPreview}
                        onRedownload={async () => {
                          // Device-gated: native share sheet on mobile, download on
                          // desktop — the preview panel's label reads "Share" on mobile
                          // so the behavior must match (not a blind anchor download).
                          const word = ctx.effectiveSequence?.word || "sequence";
                          const blob = await fetch(ctx.previewBlobUrl!).then((r) => r.blob());
                          await shareOrDownloadBlob(blob, `${word}.mp4`, { title: word });
                        }}
                      />
                    {:else}
                      <ExportVideoDrawer
                        exportOptions={ctx.exportOptions}
                        isExporting={ctx.isExporting}
                        exportProgress={ctx.exportProgress}
                        canvasReady={ctx.canvasReady}
                        layout={isMobile ? "bottom" : "sidebar"}
                        singlePlayDuration={ctx.singlePlayDuration}
                        isPlaying={ctx.isPlayingLocal}
                        bpm={ctx.bpmLocal}
                        playbackMode={ctx.playbackMode}
                        onPlaybackToggle={ctx.handlePlaybackToggle}
                        onPlaybackModeChange={ctx.handlePlaybackModeChange}
                        onBpmChange={ctx.handleBpmChange}
                        onExport={ctx.handleExport}
                        onCancel={ctx.handleCancelExport}
                      />
                    {/if}
                  {:else if isImageExportActive}
                    <ExportImagePanel
                      exportOptions={ctx.exportOptions}
                      isExporting={ctx.isExporting}
                      stepCount={ctx.effectiveSequence?.steps?.length ?? 0}
                      resolvedAutoLayout={ctx.resolvedCardAutoLayout}
                      onExport={ctx.handleExport}
                      onClose={ctx.exitEditMode}
                    />
                  {/if}
                </div>
              {/if}
            </div>
          {/if}
        </div>

        {#if ctx.hasSequence}
          <!-- Stays mounted. Entering practice reserves its row (one canvas resize on
               enter); Start then slides the cockpit in from the right via composited
               transform with no layout change → 60fps. Parked + inert when off. -->
          <div class="practice-bar-rise" class:reserved={ctx.practiceActive} class:up={ctx.practiceActive} inert={!ctx.practiceActive}>
            <!-- Conveyor: setup config (setup) ↔ running cockpit (running). Config
                 slides out left as the cockpit slides in. Cockpit is the flow child
                 (defines bar height); config overlays it. -->
            <div class="bar-pane config" class:active={!ctx.practiceRunning} inert={ctx.practiceRunning}>
              <PracticeSetupBar
                config={ctx.practiceState.userConfig}
                onSetConfig={ctx.handlePracticeSetConfig}
                onStart={ctx.handlePracticeStart}
              />
            </div>
            <div class="bar-pane cockpit" class:active={ctx.practiceRunning} inert={!ctx.practiceRunning}>
              <PracticeBar
                progress={ctx.practiceState.progress}
                bpm={ctx.bpmLocal}
                isPlaying={ctx.isPlayingLocal}
                onBpmChange={ctx.handleBpmChange}
                onPlayPause={ctx.handlePlaybackToggle}
                onStepLevel={ctx.handlePracticeStepLevel}
                onToggleHold={ctx.handlePracticeToggleHold}
                onStop={ctx.handlePracticeStop}
                metronomeOn={ctx.metronomeEnabled}
                onToggleMetronome={ctx.handleToggleMetronome}
                mirrorOn={ctx.mirrorEnabled}
                onToggleMirror={ctx.handleToggleMirror}
              />
            </div>
          </div>
        {/if}
      </main>

      {#if deleteConfirmOpen}
        <DeleteConfirmDialog
          word={sequence?.word}
          {isDeleting}
          positioning="fixed"
          onConfirm={async () => {
            isDeleting = true;
            try {
              await ctx.handleDelete();
            } finally {
              deleteConfirmOpen = false;
              isDeleting = false;
            }
          }}
          onCancel={() => (deleteConfirmOpen = false)}
        />
      {/if}
    {/snippet}
  </SequenceViewerOrchestrator>
{/if}

<style>
  .sequence-route-page {
    /* One shared clock for the practice push (matches the drawer host). */
    --ws-dur: 300ms;
    --ws-ease: cubic-bezier(0.2, 0, 0, 1);
    display: flex;
    flex-direction: column;
    height: 100vh;
    height: 100dvh;
    overflow: hidden;
  }

  .sequence-context {
    position: relative;
    z-index: 19;
    display: grid;
    grid-template-columns: minmax(180px, 1fr) auto auto;
    align-items: center;
    gap: 12px;
    min-height: var(--min-touch-target, 44px);
    padding: 6px 16px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: var(--theme-panel-bg, rgba(15, 20, 30, 0.96));
    flex-shrink: 0;
  }

  .sequence-context-identity {
    min-width: 0;
  }

  .sequence-context-identity p {
    margin: 0 0 2px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
    letter-spacing: 0.08em;
    line-height: 1;
    text-transform: uppercase;
  }

  .sequence-context-identity h1 {
    margin: 0;
    overflow: hidden;
    color: var(--theme-text, #ffffff);
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
    line-height: 1.25;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sequence-context-facts {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 6px 14px;
    margin: 0;
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.72));
    font-size: var(--font-size-compact, 12px);
    line-height: 1.3;
  }

  .sequence-context-facts span {
    white-space: nowrap;
  }

  .sequence-context-details {
    position: relative;
  }

  .sequence-context-details summary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: var(--min-touch-target, 44px);
    padding: 0 12px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.14));
    border-radius: 10px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.05));
    color: var(--theme-text, #ffffff);
    cursor: pointer;
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
    list-style: none;
  }

  .sequence-context-details summary::-webkit-details-marker {
    display: none;
  }

  .sequence-context-details summary:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.09));
  }

  .sequence-context-details summary:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: 2px;
  }

  .sequence-context-details summary i {
    font-size: 10px;
    transition: transform 180ms ease;
  }

  .sequence-context-details[open] summary i {
    transform: rotate(180deg);
  }

  .sequence-context-panel {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    width: min(620px, calc(100vw - 24px));
    padding: 16px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.14));
    border-radius: 14px;
    background: var(--theme-panel-bg, rgba(15, 20, 30, 0.98));
    box-shadow: 0 18px 50px rgba(0, 0, 0, 0.42);
  }

  .sequence-context-panel > p {
    max-width: 62ch;
    margin: 0;
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.78));
    font-size: var(--font-size-sm, 14px);
    line-height: 1.55;
  }

  .sequence-context-panel nav {
    display: flex;
    flex-wrap: wrap;
    gap: 10px 18px;
    margin-top: 16px;
  }

  .sequence-context-panel a {
    color: var(--theme-accent, #a78bfa);
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    text-decoration: underline;
    text-underline-offset: 0.2em;
  }

  .sequence-context-panel a:hover {
    text-decoration-thickness: 2px;
  }

  @media (max-width: 700px) {
    .sequence-context {
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 5px 10px;
      padding: 6px 12px;
    }

    .sequence-context-facts {
      grid-column: 1 / -1;
      grid-row: 2;
      justify-content: flex-start;
    }

    .sequence-context-details {
      grid-column: 2;
      grid-row: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .sequence-context-details summary i {
      transition: none;
    }
  }

  /* Cockpit bar: a flow child that reserves its row when practice is ACTIVE. The
     row's height animates 0↔auto on the --ws-dur clock so the canvas glides into
     its practice height instead of snapping; height settles on enter, so Start/
     Stop never relayout (visible Start motion is a composited slide-in). */
  .practice-bar-rise {
    position: relative; /* anchors the absolute config bar-pane */
    flex-shrink: 0;
    overflow: hidden;
    height: 0;
    transform: translateX(110%);
    opacity: 0;
    will-change: transform, opacity, height;
    /* Scoped to this element only — interpolate-size is inherited, so on an
       ancestor it leaks the height:auto animation into the viewer subtree. */
    interpolate-size: allow-keywords;
    transition:
      transform var(--ws-dur) var(--ws-ease),
      opacity var(--ws-dur) var(--ws-ease),
      height var(--ws-dur) var(--ws-ease);
  }
  /* Entering practice (setup OR running) reserves the row, growing it from 0. */
  .practice-bar-rise.reserved {
    height: auto;
  }
  /* Practice active: bar slides in from the right + fades in (carrying the setup
     config). Start swaps config→cockpit via the inner conveyor; bar stays put. */
  .practice-bar-rise.reserved.up {
    transform: translateX(0);
    opacity: 1;
  }

  /* Inner conveyor: config (setup) ↔ cockpit (running). Cockpit is the flow child
     (defines bar height); config is an absolute overlay. */
  .bar-pane {
    transition: transform var(--ws-dur) var(--ws-ease);
    will-change: transform;
  }
  .bar-pane.config {
    position: absolute;
    inset: 0;
    transform: translateX(-100%);
  }
  .bar-pane.config.active {
    transform: translateX(0);
  }
  .bar-pane.cockpit {
    position: relative;
    transform: translateX(100%);
  }
  .bar-pane.cockpit.active {
    transform: translateX(0);
  }

  @media (prefers-reduced-motion: reduce) {
    .practice-bar-rise,
    .bar-pane { transition: none; }
  }

  .route-body-content {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .route-body-content[data-fullscreen="true"] {
    position: relative;
  }

  /* Loading state */
  .loading-container {
    flex: 1;
    position: relative;
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

  .recovery-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.5rem;
  }

  .recovery-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    min-height: var(--min-touch-target);
    padding: 0.75rem 1.25rem;
    background: var(--theme-accent, #f43f5e);
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-weight: 600;
    font-size: var(--font-size-sm, 14px);
    text-decoration: none;
    cursor: pointer;
    transition: filter var(--duration-normal, 200ms) ease;
  }

  .recovery-button.ghost {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border: 1px solid var(--theme-stroke-strong, rgba(255, 255, 255, 0.18));
    color: var(--theme-text, #ffffff);
  }

  .recovery-button:hover {
    filter: brightness(1.1);
  }

  .recovery-button:focus-visible {
    outline: 2px solid var(--theme-accent, #f43f5e);
    outline-offset: 2px;
  }

  /* Viewer + export panel container. */
  .viewer-and-export {
    --export-sidebar-width: 560px;
    position: relative;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  /* Desktop: always a grid so the sidebar column can transition smoothly
     from 0px to 560px. Use 0px (not 0fr) - fr and px can't interpolate. */
  .viewer-and-export.desktop {
    display: grid;
    grid-template-columns: 1fr 0px;
    grid-template-rows: minmax(0, 1fr);
    transition: grid-template-columns 250ms cubic-bezier(0.2, 0, 0, 1);
  }

  /* Desktop: ViewerSplitPane participates in grid flow (not absolute) */
  .viewer-and-export.desktop :global(.view-container) {
    position: relative;
    inset: auto;
  }

  /* Desktop export active: sidebar column expands */
  .viewer-and-export.export-active.desktop {
    grid-template-columns: 1fr var(--export-sidebar-width);
  }

  /* Export panel - grid child on desktop, flex child on mobile */
  .export-panel-container {
    overflow: hidden;
    overflow-y: auto;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border-left: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    isolation: isolate;
    min-width: 0;
  }

  /* Mobile: export panel is inline in flex layout */
  @media (max-width: 767px) {
    .viewer-and-export.export-active {
      display: flex;
      flex-direction: column;
    }

    .export-panel-container {
      width: 100%;
      flex-shrink: 0;
      overflow: visible;
      border-left: none;
      border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    }
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

</style>
