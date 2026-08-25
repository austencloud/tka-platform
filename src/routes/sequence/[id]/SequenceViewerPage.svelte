<script lang="ts">
  import { getLibraryRepository } from "$lib/shared/library/get-library-repository";
  import { loadByIdentifier } from "$lib/shared/sequence-viewer/services/sequence-data-provider";
  import { loadSequencesByIds } from "$lib/features/choreo-card/services/catalog-loader";
  import type { SequenceRouteMeta, SequenceSeoDocument } from "./sequence-seo";
  import { page } from "$app/state";
  import { goto } from "$app/navigation";
  import { browser } from "$app/environment";
  import { mutateCurrentUrl } from "$lib/shared/navigation/services/url-state";
  import { onMount, onDestroy } from "svelte";
  import {
    configureShortCodeManager,
    getShortCodeManager,
  } from "$lib/shared/qr/get-short-code-manager";
  import type { ShortCodeSequenceLoader } from "$lib/shared/qr/services/short-code-manager";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import { hydrateSequence } from "$lib/shared/navigation/services/sequence-hydrator";
  import { loopDetector } from "$lib/features/create/generate/circular/services/loop-detector";
  import { registerLoopDetector } from "$lib/shared/create/get-loop-detector";
  import { registerLoopDisplayResolver } from "$lib/shared/loop-labeler/get-loop-display-resolver";
  import { resolveLoopDisplay } from "$lib/features/loop-labeler/services/loop-display-resolver";
  import {
    parsePropsFromURL,
    parseSequenceRouteId,
    decodeSequenceWithCompression,
    isInlineEncoded,
  } from "$lib/shared/navigation/services/sequence-encoder";
  import { decodeViewMode } from "$lib/shared/browse/domain/browse-view-mode";
  import { getPublicSequenceHashMatcher } from "$lib/shared/sequence-viewer/get-public-sequence-hash-matcher";
  import { initializeAppServices } from "$lib/shared/application/state/services.svelte";
  import { getImageCompositionManager } from "$lib/shared/share/state/image-composition-state.svelte";
  import { setSkipNextViewTransition } from "$lib/shared/transitions/sequence-drawer-state.svelte";
  import {
    registerDrawer,
    unregisterDrawer,
    generateDrawerId,
  } from "$lib/shared/foundation/ui/drawer/drawer-stack";
  import { createModalSwipeDismiss } from "$lib/shared/sequence-viewer/services/modal-swipe-dismiss";
  import {
    consumeSequenceRouteHandoff,
    type SequenceRouteHandoff,
  } from "$lib/shared/coordinators/sequence-handoff.svelte";
  import SequenceViewerOrchestrator from "$lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte";
  import type { OrchestratorContext } from "$lib/shared/sequence-viewer/domain/viewer-orchestrator-context";
  import SequenceViewerShell from "$lib/shared/sequence-viewer/components/SequenceViewerShell.svelte";

  import {
    getIabBannerVisible,
    getIabBannerHeight,
    IAB_BANNER_HEIGHT,
  } from "$lib/shared/auth/state/iab-banner-state.svelte";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import LoadingGate from "$lib/shared/components/loading/LoadingGate.svelte";
  import { settingsService } from "$lib/shared/settings/state/settings-state.svelte";
  import { registerLibraryRepository } from "$lib/shared/composition-root/register-library-repository";

  // Same bare-layout gap /q/[code] wires around: this standalone route never
  // imports the composition root, so nothing registered the library repository
  // or the visual save coordinator. SequenceViewerShell's Save then threw
  // "Visual sequence saving has not been registered" on the first tap, and the
  // shell's saved/owner sync threw on getLibraryRepository() for signed-in
  // viewers. Register during component init, before the descendant viewer
  // mounts, so the first saved-state sync cannot race route bootstrap.
  // Re-registering is idempotent - app mode supplies the same factories.
  if (browser) registerLibraryRepository();

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
  const urlViewMode = $derived(
    page.url.searchParams.get("view") as "animation" | "image" | "split" | null
  );
  const urlBpm = $derived(
    parseInt(page.url.searchParams.get("bpm") || "") || null
  );
  const urlTime = $derived(
    parseInt(page.url.searchParams.get("t") || "") || null
  );

  // URL metadata params (from share URLs)
  const urlWord = $derived(page.url.searchParams.get("word"));
  const urlCreator = $derived(page.url.searchParams.get("creator"));
  const urlNotes = $derived(page.url.searchParams.get("notes"));
  const urlDarkMode = $derived(page.url.searchParams.get("dark"));
  const urlDifficulty = $derived(page.url.searchParams.get("difficulty"));
  const urlBirthday = $derived(page.url.searchParams.get("birthday"));

  // URL render mode param (2D/3D)
  const urlRenderMode = $derived(
    page.url.searchParams.get("render") as "2d" | "3d" | null
  );

  // URL prop params (from QR codes with prop info)
  const urlBlueProp = $derived(page.url.searchParams.get("bp"));
  const urlRedProp = $derived(page.url.searchParams.get("rp"));

  // URL view mode param (from QR codes with browse view mode)
  const urlViewModeParam = $derived(page.url.searchParams.get("vm"));
  const decodedBrowseViewMode = $derived(
    urlViewModeParam ? decodeViewMode(urlViewModeParam) : null
  );
  const urlHandPathMode = $derived(decodedBrowseViewMode?.subject === "hands");
  const urlInitialBlueVisible = $derived(
    decodedBrowseViewMode?.granularity === "solo"
      ? decodedBrowseViewMode.color === "blue"
      : true
  );
  const urlInitialRedVisible = $derived(
    decodedBrowseViewMode?.granularity === "solo"
      ? decodedBrowseViewMode.color === "red"
      : true
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

  // DrawerStack registration - blocks pull-to-refresh on mobile
  const drawerId = generateDrawerId();

  // Track if orchestrator needs to restore time from URL after init
  let pendingTimeRestore = $state<number | null>(null);

  // Cleanup
  let resizeCleanup: (() => void) | null = null;

  onMount(async () => {
    // The root layout only imports composition-root in app mode, so this
    // standalone route never got the short-code registration and
    // getShortCodeManager() threw on EVERY id that is not an inline blob —
    // short codes, library doc ids, sync-room ids all dead-ended at "Failed to
    // load sequence". Wire the one registration this route consumes, the way
    // /q/[code] wires the three its bare layout skips. Resolution reads the
    // short-code doc directly; it never needs the public gallery loader.
    // Only when nothing else configured it — in app mode the composition root
    // supplies the real browse loader and must win (same guard the store's
    // hero-scan-code uses).
    try {
      getShortCodeManager();
    } catch {
      configureShortCodeManager({
        loadFullSequenceData: async () => null,
      } satisfies ShortCodeSequenceLoader);
    }

    // Same bare-layout gap as /q/[code]: without the composition root, the
    // animation playback path's getLoopDetector() throws and the whole
    // animation/3D view dead-ends at "Animation data not available"; the
    // loop display resolver degrades silently, dropping LOOP labels.
    // Registering is idempotent — app mode re-registers the same singletons.
    registerLoopDetector(loopDetector);
    registerLoopDisplayResolver(resolveLoopDisplay);

    // Non-blocking: settings sync happens in background.
    // Don't block the viewer on service initialization.
    initializeAppServices().catch(() => {});

    // Mobile detection
    const checkMobile = () => {
      isMobile = window.innerWidth < 768;
    };
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
    if (urlCreator && !seq.ownerDisplayName)
      updates.ownerDisplayName = urlCreator;
    if (urlDifficulty && !seq.difficultyLevel)
      updates.difficultyLevel = urlDifficulty;

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
          console.error(
            "[SequenceRoute] Failed to decode sequence from URL:",
            err
          );
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
        loadError =
          "It may have been deleted by the owner while you were browsing the feed.";
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
        pageContainer.style.transition =
          "transform 200ms ease-out, opacity 200ms ease-out";
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
    mutateCurrentUrl((url) => {
      url.searchParams.set(key, value);
    });
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
        <p>
          {loadError ||
            "The link may be broken, or the sequence was deleted by its owner."}
        </p>
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
      {#snippet routeContext()}
        {#if !ctx.editingPane}
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
                  <a href="/create">Open Flow Arts Composer</a>
                  <a href="/browse/gallery">Browse public sequences</a>
                </nav>
              </div>
            </details>
          </section>
        {/if}
      {/snippet}

      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <main
        class="sequence-route-page"
        bind:this={pageContainer}
        data-fullscreen={ctx.isFullscreen}
        style:padding-bottom={iabBannerShowing
          ? `${iabBannerHeight || IAB_BANNER_HEIGHT}px`
          : undefined}
        ontouchstart={(event) => handleTouchStart(event, ctx)}
        ontouchmove={(event) => handleTouchMove(event, ctx)}
        ontouchend={() => handleTouchEnd(ctx)}
      >
        <SequenceViewerShell
          {ctx}
          {sequence}
          {isMobile}
          onClose={handleClose}
          navigation={{
            label: `Back to ${handoffData?.returnLabel || "Browse"}`,
          }}
          openAppHref="/browse/gallery"
          contextContent={routeContext}
          showFullscreenControls
        />
      </main>
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
  }
</style>
