<!--
  SequenceViewerDrawerHost.svelte

  App host for the sequence viewer: a full-height bottom Drawer bound to the
  sequence-overlay state, with ?v= short-code bootstrap. ALL viewer chrome
  (header, rail, split pane, export panels, practice workstation) lives in
  SequenceViewerShell — shared verbatim with the /q scan route so the two
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

  $effect(() => {
    drawerOpen = overlay.isOpen || nativeLoadingCode !== null;
  });

  async function afterNextPaint(): Promise<void> {
    await tick();
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
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

    void afterNextPaint().then(() => {
      if (nativeLoadingCode === code) {
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
        if (phase === "failed") clearNativeLoader(code);
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
    try {
      const manager = getShortCodeManager();
      const { sequence: resolved, record } =
        await manager.resolveShortCodeWithRecord(code);
      if (!resolved) {
        stripInvalidV(code);
        return;
      }

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
          void getGlyphCache()
            .loadGlyphsByLetter(baseLetters)
            .then(() => {
              if (nativeLoadingCode === code) nativeGlyphsReady = true;
            })
            .catch(() => {
              /* Keep the animated dots if a glyph asset is unavailable. */
            });
        }
      }

      const stillMatches =
        new URL(window.location.href).searchParams.get("v") === code;
      if (!stillMatches) return;

      const hydrated = await hydrateSequence(resolved, {
        loopDetector: getLoopDetector(),
      });

      if (nativeLoadingCode === code) nativeLoadingProgress = 72;

      if (new URL(window.location.href).searchParams.get("v") !== code) return;

      const currentUrl = new URL(window.location.href);
      const propConfig = resolveScanPropConfig(
        hydrated,
        parsePropsFromURL(currentUrl.searchParams),
        record
      );
      await updateSettings({
        bluePropType: propConfig.bluePropType,
        redPropType: propConfig.redPropType,
        catDogMode: propConfig.catDogMode,
      });

      if (nativeLoadingCode === code) nativeLoadingProgress = 88;

      playbackReleased = !isNativeScanViewerTransitionPending(code);

      openSequenceOverlay(hydrated, {
        fromUrl: true,
        shortCode: code,
        skipHistoryPush: true,
        playOnOpen: true,
      });
      if (nativeLoadingCode === code) nativeLoadingProgress = 94;
      openedSuccessfully = true;
    } catch (error) {
      console.warn(
        "[SequenceViewerDrawerHost] Failed to bootstrap from ?v= code:",
        error
      );
    } finally {
      if (!openedSuccessfully) {
        markNativeScanViewerFailed(code);
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
        nativeLoadingProgress = 100;
        await afterNextPaint();
        clearNativeLoader(code);
        await afterNextPaint();
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
          initialStep={overlay.initialStep}
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
              isMobile={isMobileWidth}
              onClose={handleDismiss}
              shareOnOpen={overlay.shareOnOpen}
            />
          {/snippet}
        </SequenceViewerOrchestrator>
      {/key}
    {/if}

    {#if nativeLoadingCode}
      <ScanSequenceLoader
        word={nativeLoadingWord}
        glyphsReady={nativeGlyphsReady}
        progress={nativeLoadingProgress}
        fill
      />
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
</style>
