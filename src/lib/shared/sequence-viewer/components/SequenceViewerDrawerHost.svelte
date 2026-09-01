<!--
  SequenceViewerDrawerHost.svelte

  App host for the sequence viewer: a full-height bottom Drawer bound to the
  sequence-overlay state, with ?v= short-code bootstrap. ALL viewer chrome
  (header, rail, split pane, export panels, practice workstation) lives in
  SequenceViewerShell — shared verbatim with the /sequence route so the two
  surfaces are identical by construction. Host-only concerns here: the Drawer
  shell, overlay open/close/dismiss routing, and URL bootstrap.
-->
<script lang="ts">
  import { onMount, tick } from "svelte";
  import { afterNavigate, goto } from "$app/navigation";
  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
  import SequenceViewerOrchestrator from "./SequenceViewerOrchestrator.svelte";
  import SequenceViewerShell from "./SequenceViewerShell.svelte";
  import ScanSequenceLoader from "./ScanSequenceLoader.svelte";
  import {
    getSequenceOverlayState,
    closeSequenceOverlay,
    openSequenceOverlay,
  } from "../state/sequence-viewer-overlay-state.svelte";
  import { getShortCodeManager } from "$lib/shared/qr/get-short-code-manager";
  import { resolveScanPropConfig } from "$lib/shared/qr/services/scan-prop-resolver";
  import { authState } from "$lib/shared/auth/state/auth-state.svelte";
  import { updateSettings } from "$lib/shared/application/state/app-state.svelte";
  import { parsePropsFromURL } from "$lib/shared/navigation/services/sequence-encoder";
  import { hydrateSequence } from "$lib/shared/navigation/services/sequence-hydrator";
  import { getLoopDetector } from "$lib/shared/create/get-loop-detector";
  import { removeCurrentUrlParams } from "$lib/shared/navigation/services/url-state";
  import { getGlyphCache } from "$lib/shared/render/get-glyph-cache";
  import { simplifyRepeatedWord } from "$lib/shared/foundation/utils/word-simplifier";
  import { getSequenceMotionProfile } from "$lib/shared/foundation/services/sequence-motion-profile";
  import { getScanLoaderBaseLetters } from "../services/scan-sequence-loader";
  import {
    clearNativeScanViewerReady,
    isNativeScanViewerTransitionPending,
    markNativeScanLoadingSurfaceReady,
    markNativeScanTransitionStage,
    markNativeScanViewerFailed,
    markNativeScanViewerReady,
    subscribeNativeScanViewerTransition,
  } from "$lib/shared/platform/services/native-scan-viewer-readiness";

  const overlay = getSequenceOverlayState();

  let isMobileWidth = $state(true);

  $effect(() => {
    if (typeof window !== "undefined") {
      const check = () => {
        isMobileWidth = window.innerWidth < 768;
      };
      check();
      window.addEventListener("resize", check);
      return () => window.removeEventListener("resize", check);
    }
    return undefined;
  });

  let drawerOpen = $state(false);
  let requestedCode = $state<string | null>(null);
  let resolvingCode = $state<string | null>(null);
  let playbackReleased = $state(true);
  let nativeLoadingCode = $state<string | null>(null);
  let nativeLoadingWord = $state("");
  let nativeGlyphsReady = $state(false);
  let nativeLoadingProgress = $state(0);
  let nativeLoaderSurface = $state<HTMLDivElement | null>(null);

  $effect(() => {
    drawerOpen = overlay.isOpen || nativeLoadingCode !== null;
  });

  async function afterNextPaint(): Promise<void> {
    await tick();
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
  }

  function loaderVisibilityDetails(): Record<
    string,
    string | number | boolean | null
  > {
    const surface = nativeLoaderSurface;
    const drawer = surface?.closest("dialog");
    if (!surface) {
      return {
        elementPresent: false,
        drawerState: drawer?.dataset.state ?? null,
        viewportCoverage: 0,
      };
    }

    const rect = surface.getBoundingClientRect();
    const visibleWidth = Math.max(
      0,
      Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0)
    );
    const visibleHeight = Math.max(
      0,
      Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0)
    );
    const viewportArea = Math.max(1, window.innerWidth * window.innerHeight);
    const drawerStyle = drawer ? getComputedStyle(drawer) : null;

    return {
      elementPresent: true,
      drawerState: drawer?.dataset.state ?? null,
      viewportCoverage:
        Math.round((visibleWidth * visibleHeight * 1000) / viewportArea) / 10,
      surfaceTop: Math.round(rect.top),
      surfaceBottom: Math.round(rect.bottom),
      viewportHeight: window.innerHeight,
      drawerTransform: drawerStyle?.transform ?? null,
      drawerOpacity: drawerStyle?.opacity ?? null,
    };
  }

  function watchLoaderVisibility(code: string): void {
    const startedAt = performance.now();
    const inspect = () => {
      if (nativeLoadingCode !== code) return;

      const details = loaderVisibilityDetails();
      if (Number(details.viewportCoverage) >= 99) {
        markNativeScanTransitionStage(code, "loader-visible", details);
        return;
      }

      if (performance.now() - startedAt < 5_000) requestAnimationFrame(inspect);
    };
    requestAnimationFrame(inspect);
  }

  function clearNativeLoader(code?: string): void {
    if (code && nativeLoadingCode !== code) return;
    nativeLoadingCode = null;
    nativeLoadingWord = "";
    nativeGlyphsReady = false;
    nativeLoadingProgress = 0;
  }

  function showNativeLoader(code: string): void {
    if (nativeLoadingCode === code) return;
    nativeLoadingCode = code;
    nativeLoadingWord = "";
    nativeGlyphsReady = false;
    nativeLoadingProgress = 8;
    playbackReleased = false;
    markNativeScanTransitionStage(code, "loader-state-created");
    watchLoaderVisibility(code);

    void afterNextPaint().then(() => {
      if (nativeLoadingCode === code) {
        markNativeScanTransitionStage(
          code,
          "loader-dom-painted",
          loaderVisibilityDetails()
        );
        markNativeScanLoadingSurfaceReady(code);
      }
    });
  }

  function handlePopState(event: PopStateEvent) {
    if (overlay.isOpen) {
      closeSequenceOverlay();
    }
  }

  onMount(() => {
    window.addEventListener("popstate", handlePopState);
    const unsubscribeNativeTransition = subscribeNativeScanViewerTransition(
      ({ code, phase }) => {
        if (phase === "started") {
          showNativeLoader(code);
          return;
        }

        playbackReleased = true;
        if (phase === "failed") {
          clearNativeLoader(code);
        } else {
          markNativeScanTransitionStage(code, "playback-released");
        }
      }
    );
    // MainApplication imports this host after the route has already finished
    // on a cold Capacitor launch. afterNavigate cannot replay that completed
    // navigation, so read the live URL once when the host joins the page.
    requestedCode = new URL(window.location.href).searchParams.get("v");
    if (requestedCode && isNativeScanViewerTransitionPending(requestedCode)) {
      showNativeLoader(requestedCode);
    }
    return () => {
      window.removeEventListener("popstate", handlePopState);
      unsubscribeNativeTransition();
    };
  });

  // The host stays mounted while someone moves around the app. A QR scan can
  // therefore arrive long after its first URL check, so every completed app
  // navigation gets a chance to hand off a new sequence code.
  afterNavigate(({ to }) => {
    requestedCode = to?.url.searchParams.get("v") ?? null;
  });

  $effect(() => {
    const loading = authState.loading;
    const code = requestedCode;
    const activeResolution = resolvingCode;
    if (loading || !code || activeResolution) return;

    resolvingCode = code;
    void bootstrapFromCode(code).finally(() => {
      if (requestedCode === code) requestedCode = null;
      resolvingCode = null;
    });
  });

  async function bootstrapFromCode(code: string) {
    if (typeof window === "undefined") return;
    let openedSuccessfully = false;
    let failureReason: string | null = null;
    try {
      markNativeScanTransitionStage(code, "shortcode-resolve-start");
      const manager = getShortCodeManager();
      const { sequence: resolved, record } =
        await manager.resolveShortCodeWithRecord(code);
      if (!resolved) {
        stripInvalidV(code);
        return;
      }
      markNativeScanTransitionStage(code, "shortcode-resolved");

      if (nativeLoadingCode === code) {
        const rawWord =
          resolved.word || resolved.displayName || resolved.name || "";
        nativeLoadingWord =
          getSequenceMotionProfile(resolved).kind === "solo"
            ? ""
            : simplifyRepeatedWord(rawWord);
        nativeLoadingProgress = 35;

        const baseLetters = getScanLoaderBaseLetters(nativeLoadingWord);
        if (baseLetters.length > 0) {
          markNativeScanTransitionStage(code, "glyph-load-start", {
            glyphCount: baseLetters.length,
          });
          void getGlyphCache()
            .loadGlyphsByLetter(baseLetters)
            .then(() => {
              if (nativeLoadingCode === code) {
                nativeGlyphsReady = true;
                markNativeScanTransitionStage(code, "glyphs-ready");
              }
            })
            .catch(() => {
              /* Keep the animated dots if a glyph asset is unavailable. */
            });
        }
      }

      const stillMatches =
        new URL(window.location.href).searchParams.get("v") === code;
      if (!stillMatches) return;

      markNativeScanTransitionStage(code, "hydrate-start");
      const hydrated = await hydrateSequence(resolved, {
        loopDetector: getLoopDetector(),
      });
      markNativeScanTransitionStage(code, "hydrate-complete");

      if (nativeLoadingCode === code) nativeLoadingProgress = 72;

      if (new URL(window.location.href).searchParams.get("v") !== code) return;

      const currentUrl = new URL(window.location.href);
      const propConfig = resolveScanPropConfig(
        hydrated,
        parsePropsFromURL(currentUrl.searchParams),
        record
      );
      await updateSettings({
        leftPropType: propConfig.leftPropType,
        rightPropType: propConfig.rightPropType,
        catDogMode: propConfig.catDogMode,
      });
      markNativeScanTransitionStage(code, "settings-applied");

      if (nativeLoadingCode === code) nativeLoadingProgress = 88;

      playbackReleased = !isNativeScanViewerTransitionPending(code);

      openSequenceOverlay(hydrated, {
        analyticsSource: "qr",
        fromUrl: true,
        shortCode: code,
        skipHistoryPush: true,
        playOnOpen: true,
      });
      markNativeScanTransitionStage(code, "viewer-overlay-opened");
      if (nativeLoadingCode === code) nativeLoadingProgress = 94;
      openedSuccessfully = true;
    } catch (error) {
      failureReason = error instanceof Error ? error.message : String(error);
      console.warn(
        "[SequenceViewerDrawerHost] Failed to bootstrap from ?v= code:",
        error
      );
    } finally {
      if (!openedSuccessfully) {
        markNativeScanViewerFailed(
          code,
          failureReason ? { reason: failureReason } : undefined
        );
        stripInvalidV(code);
      }
    }
  }

  function stripInvalidV(code: string) {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("v") !== code) return;
    removeCurrentUrlParams(["v"]);
  }

  function handleDismiss() {
    const path = overlay.dismissPath;
    const wasOpen = overlay.isOpen;
    const wasFromUrl = overlay.openedFromUrl;

    clearNativeScanViewerReady();
    clearNativeLoader();
    closeSequenceOverlay();

    if (path) {
      goto(path, { replaceState: true });
    } else if (wasOpen && !wasFromUrl) {
      window.history.back();
    }
  }

  function handleDrawerClose() {
    handleDismiss();
  }

  async function handleViewerReady() {
    const code = overlay.activeShortCode;
    if (code) {
      if (nativeLoadingCode === code) {
        markNativeScanTransitionStage(code, "animation-surface-ready");
        nativeLoadingProgress = 100;
        await afterNextPaint();
        markNativeScanTransitionStage(
          code,
          "loader-complete-painted",
          loaderVisibilityDetails()
        );
        clearNativeLoader(code);
        await afterNextPaint();
        markNativeScanTransitionStage(code, "loader-removed-painted");
      }
      markNativeScanViewerReady(code);
    } else {
      clearNativeScanViewerReady();
    }
  }
</script>

<Drawer
  bind:isOpen={drawerOpen}
  placement="bottom"
  snapPoints={["100%"]}
  onclose={handleDrawerClose}
  showHandle={false}
  focusContainerOnOpen
  dismissible={nativeLoadingCode === null}
  closeOnBackdrop={nativeLoadingCode === null}
  closeOnEscape={nativeLoadingCode === null}
  ariaLabel="Sequence Viewer"
  class="sequence-viewer-drawer"
>
  <div class="viewer-stage">
    {#if overlay.sequence}
      {#key overlay.sessionKey}
        <SequenceViewerOrchestrator
          sequence={overlay.sequence}
          isMobile={isMobileWidth}
          initialBpm={overlay.initialBpm}
          initialPlaybackMode={overlay.initialPlaybackMode}
          initialStep={overlay.initialStep}
          initialViewMode={overlay.initialViewMode}
          initialViewerMode={overlay.initialViewerMode}
          handPathMode={overlay.handPathMode}
          playOnOpen={overlay.playOnOpen}
          {playbackReleased}
          onReadyForReveal={handleViewerReady}
          onClose={handleDismiss}
        >
          {#snippet children(ctx)}
            <SequenceViewerShell
              {ctx}
              sequence={overlay.sequence!}
              analyticsSource={overlay.analyticsSource}
              isMobile={isMobileWidth}
              onClose={handleDismiss}
              shareOnOpen={overlay.shareOnOpen}
              tunnelComposition={overlay.tunnelComposition}
              tunnelSaveTarget={overlay.tunnelSaveTarget}
              onTunnelSaved={overlay.onTunnelSaved}
            />
          {/snippet}
        </SequenceViewerOrchestrator>
      {/key}
    {/if}

    {#if nativeLoadingCode}
      <div class="native-loader-surface" bind:this={nativeLoaderSurface}>
        <ScanSequenceLoader
          word={nativeLoadingWord}
          glyphsReady={nativeGlyphsReady}
          progress={nativeLoadingProgress}
          fill
        />
      </div>
    {/if}
  </div>
</Drawer>

<style>
  /* Routed through the Drawer.css --sheet-* API; the direct border-top-*-radius
     overrides are redundant (the radius vars already drive those corners). */
  :global(.sequence-viewer-drawer) {
    --sheet-bg: var(--theme-panel-bg, #0a0a14);
    --sheet-filter: none;
    --sheet-border-radius-top-left: 0px;
    --sheet-border-radius-top-right: 0px;
  }

  .viewer-stage {
    position: relative;
    flex: 1;
    width: 100%;
    height: 100%;
    min-height: 0;
    overflow: hidden;
  }

  .native-loader-surface {
    position: absolute;
    inset: 0;
    z-index: 2;
  }
</style>
