<script lang="ts">
  /**
   * CollisionLab
   *
   * Root component for the collision lab tab. Resolves services from the
   * DI container, constructs state, sets context, and wires keyboard
   * shortcuts. Child components consume state via getCollisionLabContext.
   */

  import { onMount, onDestroy } from "svelte";
  import { container } from "$lib/shared/di";
  import {
    createCollisionLabState,
    type CollisionLabState,
  } from "./state/collision-lab-state.svelte";
  import { setCollisionLabContext } from "./context/collision-lab-context";
  import PoseViewport from "./components/PoseViewport.svelte";
  import PoseScrubber from "./components/PoseScrubber.svelte";
  import CollisionReadout from "./components/CollisionReadout.svelte";
  import LabelControls from "./components/LabelControls.svelte";
  import StanceVariantPicker from "./components/StanceVariantPicker.svelte";
  import type { LabelStatus } from "./domain/types";

  let labState = $state<CollisionLabState | null>(null);
  let loadError = $state<string | null>(null);

  const hotkeyToStatus: Record<string, LabelStatus> = {
    "1": "clear",
    "2": "needs-adjustment",
    "3": "unreachable",
    "4": "skip",
  };

  const variantHotkeys: Record<string, number> = {
    q: 0,
    w: 1,
    e: 2,
    r: 3,
  };

  function handleKeydown(ev: KeyboardEvent) {
    const s = labState;
    if (!s) return;
    // Ignore hotkeys when a form element has focus
    const tag = (ev.target as HTMLElement)?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

    if (ev.key === "ArrowRight") {
      s.stepForward();
      ev.preventDefault();
      return;
    }
    if (ev.key === "ArrowLeft") {
      s.stepBackward();
      ev.preventDefault();
      return;
    }
    if (hotkeyToStatus[ev.key]) {
      s.labelCurrent(hotkeyToStatus[ev.key]!);
      ev.preventDefault();
      return;
    }
    if (ev.key in variantHotkeys) {
      s.setVariant(variantHotkeys[ev.key]!);
      ev.preventDefault();
    }
  }

  onMount(async () => {
    try {
      const enumerator = container.items.diamondPoseEnumerator;
      const repo = container.items.collisionLabPoseLabelRepository;
      const stance = container.items.collisionLabStanceVariantProvider;
      const created = await createCollisionLabState(enumerator, repo, stance);
      labState = created;
      setCollisionLabContext({ state: created });
    } catch (e) {
      loadError = (e as Error).message;
      console.error("CollisionLab: failed to initialize", e);
    }
    window.addEventListener("keydown", handleKeydown);
  });

  onDestroy(() => {
    window.removeEventListener("keydown", handleKeydown);
  });
</script>

{#if loadError}
  <div class="error">
    Failed to load Collision Lab: {loadError}
  </div>
{:else if !labState}
  <div class="loading">Loading pose catalog…</div>
{:else}
  <div class="collision-lab">
    <div class="main">
      <PoseViewport />
    </div>
    <aside class="sidebar">
      <CollisionReadout />
      <LabelControls />
      <StanceVariantPicker />
      {#if labState.currentPose}
        <div class="pose-id">ID: <code>{labState.currentPose.id}</code></div>
      {/if}
    </aside>
    <footer class="footer">
      <PoseScrubber />
    </footer>
  </div>
{/if}

<style>
  .collision-lab {
    display: grid;
    grid-template-columns: 1fr 320px;
    grid-template-rows: 1fr auto;
    grid-template-areas:
      "main sidebar"
      "footer footer";
    gap: 12px;
    padding: 12px;
    width: 100%;
    height: 100%;
    box-sizing: border-box;
  }
  .main {
    grid-area: main;
    min-height: 0;
  }
  .sidebar {
    grid-area: sidebar;
    display: flex;
    flex-direction: column;
    gap: 12px;
    overflow-y: auto;
  }
  .footer {
    grid-area: footer;
  }
  .pose-id {
    font-size: 12px;
    opacity: 0.6;
    padding: 0 8px;
  }
  .pose-id code {
    font-family: monospace;
  }
  .loading,
  .error {
    padding: 32px;
    text-align: center;
    opacity: 0.7;
  }
  .error {
    color: #ef4444;
  }
</style>
