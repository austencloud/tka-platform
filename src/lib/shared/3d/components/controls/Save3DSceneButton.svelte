<!--
  Save3DSceneButton — captures the live 3D viewer configuration into the
  Scenes collection (Playground › Scenes). Mirrors the tunnel "Save tunnel"
  button. Rendered inside the Scene popover (RightRail + mobile sheet); hides
  itself if no viewer 3D context is in scope.
-->
<script lang="ts">
  import { tryGetViewer3DContext } from "../../context/viewer-3d-context";
  import {
    captureScene3DSnapshot,
    captureScene3DPoster,
  } from "$lib/features/scene-3d-collection/services/capture-3d-scene";
  import { scene3dCollectionState } from "$lib/features/scene-3d-collection/state/scene-3d-collection-state.svelte";
  import { toast } from "$lib/shared/toast/state/toast-state.svelte";
  import type { StepData } from "$lib/features/scene-3d-collection/domain/scene-3d-collection-types";

  const viewer3DState = tryGetViewer3DContext();

  let saving = $state(false);

  // A sensible default name from the loaded sequence, falling back to a date.
  function defaultName(): string {
    const seq = viewer3DState?.currentSequenceData;
    const word = seq?.word || seq?.name;
    if (word) return `${word} — 3D scene`;
    return "3D scene";
  }

  async function handleSave() {
    if (saving || !viewer3DState) return;
    saving = true;
    try {
      const snapshot = captureScene3DSnapshot(viewer3DState);
      const poster = captureScene3DPoster(viewer3DState);
      const steps = viewer3DState.currentSequenceData?.steps as StepData[] | undefined;

      await scene3dCollectionState.add({
        name: defaultName(),
        poster,
        snapshot,
        ...(steps && steps.length > 0 ? { steps } : {}),
      });
      toast.success("Scene saved to your collection");
    } catch (error) {
      console.warn("[Scene3DCollection] Save failed:", error);
      toast.error("Couldn't save the scene — try again");
    } finally {
      saving = false;
    }
  }
</script>

{#if viewer3DState}
<button
  type="button"
  class="save-scene-btn"
  onclick={handleSave}
  disabled={saving}
  aria-label="Save this 3D scene to your collection"
>
  <i class="fas {saving ? 'fa-spinner fa-spin' : 'fa-bookmark'}" aria-hidden="true"></i>
  <span>{saving ? "Saving…" : "Save scene"}</span>
</button>
{/if}

<style>
  .save-scene-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    width: 100%;
    min-height: 44px;
    padding: 0.625rem 1rem;
    background: var(--theme-accent, #f97316);
    border: 1px solid color-mix(in srgb, var(--theme-accent, #f97316) 70%, white);
    border-radius: 10px;
    color: white;
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-fast, 150ms) ease;
  }

  @media (hover: hover) {
    .save-scene-btn:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px color-mix(in srgb, var(--theme-accent, #f97316) 35%, transparent);
    }
  }

  .save-scene-btn:disabled {
    opacity: 0.6;
    cursor: default;
  }

  .save-scene-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #f97316);
    outline-offset: 2px;
  }
</style>
