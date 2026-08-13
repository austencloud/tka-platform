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
  import { onMount } from "svelte";
  import { afterNavigate, goto } from "$app/navigation";
  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
  import SequenceViewerOrchestrator from "./SequenceViewerOrchestrator.svelte";
  import SequenceViewerShell from "./SequenceViewerShell.svelte";
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
  import {
    clearNativeScanViewerReady,
    isNativeScanViewerTransitionPending,
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

  $effect(() => {
    drawerOpen = overlay.isOpen;
  });

  function handlePopState(event: PopStateEvent) {
    if (overlay.isOpen) {
      closeSequenceOverlay();
    }
  }

  onMount(() => {
    window.addEventListener("popstate", handlePopState);
    const unsubscribeNativeTransition = subscribeNativeScanViewerTransition(
      ({ phase }) => {
        if (phase === "started") {
          playbackReleased = false;
          return;
        }

        playbackReleased = true;
      }
    );
    // MainApplication imports this host after the route has already finished
    // on a cold Capacitor launch. afterNavigate cannot replay that completed
    // navigation, so read the live URL once when the host joins the page.
    requestedCode = new URL(window.location.href).searchParams.get("v");
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

      const stillMatches =
        new URL(window.location.href).searchParams.get("v") === code;
      if (!stillMatches) return;

      const hydrated = await hydrateSequence(resolved, {
        loopDetector: getLoopDetector(),
      });

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

      playbackReleased = !isNativeScanViewerTransitionPending(code);

      openSequenceOverlay(hydrated, {
        fromUrl: true,
        shortCode: code,
        skipHistoryPush: true,
        playOnOpen: true,
      });
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

  function handleViewerReady() {
    const code = overlay.activeShortCode;
    if (code) {
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
  ariaLabel="Sequence Viewer"
  class="sequence-viewer-drawer"
>
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
        onCardReady={handleViewerReady}
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
</style>
