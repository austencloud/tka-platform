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
  import { goto, replaceState } from "$app/navigation";
  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
  import SequenceViewerOrchestrator from "./SequenceViewerOrchestrator.svelte";
  import SequenceViewerShell from "./SequenceViewerShell.svelte";
  import {
    getSequenceOverlayState,
    closeSequenceOverlay,
    openSequenceOverlay,
  } from "../state/sequence-viewer-overlay-state.svelte";
  import { getShortCodeManager } from "$lib/shared/qr/get-short-code-manager";
  import { authState } from "$lib/shared/auth/state/auth-state.svelte";
  import { hydrateSequence } from "$lib/shared/navigation/services/sequence-hydrator";
  import { getLoopDetector } from "$lib/shared/create/get-loop-detector";

  const overlay = getSequenceOverlayState();

  let isMobileWidth = $state(true);

  $effect(() => {
    if (typeof window !== "undefined") {
      const check = () => { isMobileWidth = window.innerWidth < 768; };
      check();
      window.addEventListener("resize", check);
      return () => window.removeEventListener("resize", check);
    }
    return undefined;
  });

  let drawerOpen = $state(false);

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
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  });

  let bootstrapAttempted = false;
  $effect(() => {
    const loading = authState.loading;
    if (loading || bootstrapAttempted) return;
    bootstrapAttempted = true;
    void bootstrapFromUrl();
  });

  async function bootstrapFromUrl() {
    if (typeof window === "undefined") return;
    const code = new URL(window.location.href).searchParams.get("v");
    if (!code || overlay.isOpen) return;
    let openedSuccessfully = false;
    try {
      const manager = getShortCodeManager();
      const resolved = await manager.resolveShortCode(code);
      if (!resolved) {
        stripInvalidV(code);
        return;
      }

      if (overlay.isOpen) return;
      const stillMatches = new URL(window.location.href).searchParams.get("v") === code;
      if (!stillMatches) return;

      const hydrated = await hydrateSequence(resolved, {
        loopDetector: getLoopDetector(),
      });

      if (overlay.isOpen) return;
      if (new URL(window.location.href).searchParams.get("v") !== code) return;

      openSequenceOverlay(hydrated, {
        fromUrl: true,
        shortCode: code,
        skipHistoryPush: true,
      });
      openedSuccessfully = true;
    } catch (error) {
      console.warn("[SequenceViewerDrawerHost] Failed to bootstrap from ?v= code:", error);
    } finally {
      if (!openedSuccessfully) stripInvalidV(code);
    }
  }

  function stripInvalidV(code: string) {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("v") !== code) return;
    url.searchParams.delete("v");
    replaceState(url.pathname + url.search + url.hash, {});
  }

  function handleDismiss() {
    const path = overlay.dismissPath;
    const wasOpen = overlay.isOpen;
    const wasFromUrl = overlay.openedFromUrl;

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
    <SequenceViewerOrchestrator
      sequence={overlay.sequence}
      isMobile={isMobileWidth}
      initialBpm={overlay.initialBpm}
      initialStep={overlay.initialStep}
      handPathMode={overlay.handPathMode}
      onClose={handleDismiss}
    >
      {#snippet children(ctx)}
        <SequenceViewerShell
          {ctx}
          sequence={overlay.sequence!}
          isMobile={isMobileWidth}
          onClose={handleDismiss}
        />
      {/snippet}
    </SequenceViewerOrchestrator>
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
