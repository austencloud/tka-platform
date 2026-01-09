<!--
  ImageExportPreview.svelte

  Shows a live preview of what the image export will look like
  with current visibility settings.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import type { BeatData } from "$lib/features/create/shared/domain/models/BeatData";
  import { resolve } from "$lib/shared/inversify/di";
  import { TYPES } from "$lib/shared/inversify/types";
  import type { IImageComposer } from "$lib/shared/render/services/contracts/IImageComposer";
  import type { IStartPositionDeriver } from "$lib/shared/pictograph/shared/services/contracts/IStartPositionDeriver";
  import { getImageCompositionManager } from "$lib/shared/share/state/image-composition-state.svelte";
  import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";

  interface Props {
    beatData: BeatData;
  }

  let { beatData }: Props = $props();

  const compositionManager = getImageCompositionManager();
  const animationVisibilityManager = getAnimationVisibilityManager();

  let previewImageUrl = $state<string | null>(null);
  let isGenerating = $state(false);

  async function generatePreview() {
    isGenerating = true;
    try {
      const compositionService = resolve<IImageComposer>(TYPES.IImageComposer);

      // Derive start position from beat data if needed
      // Since we no longer store start position explicitly, derive it from first beat
      let derivedStartPosition = undefined;
      if (compositionManager.includeStartPosition) {
        try {
          const startPosDeriver = resolve<IStartPositionDeriver>(
            TYPES.IStartPositionDeriver
          );
          derivedStartPosition = startPosDeriver.deriveFromFirstBeat(beatData);
        } catch (e) {
          console.warn("Failed to derive start position for preview:", e);
        }
      }

      // Generate canvas from beat data using a minimal SequenceData object
      const sequenceData = {
        id: "preview-temp",
        name: "Preview",
        word: "",
        beats: [beatData],
        startPosition: derivedStartPosition,
        thumbnails: [],
        isFavorite: false,
        isCircular: false,
        tags: [],
        metadata: {},
      };
      const canvas = await compositionService.composeSequenceImage(
        sequenceData,
        {
          beatSize: 300,
          beatScale: 1,
          addWord: compositionManager.addWord,
          addBeatNumbers: compositionManager.addBeatNumbers,
          addUserInfo: compositionManager.addUserInfo,
          addDifficultyLevel: compositionManager.addDifficultyLevel,
          includeStartPosition: compositionManager.includeStartPosition,
        }
      );

      // Convert canvas to blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b: Blob | null) => {
          if (b) resolve(b);
          else reject(new Error("Failed to convert canvas to blob"));
        }, "image/png");
      });

      // Create preview URL
      if (previewImageUrl) {
        URL.revokeObjectURL(previewImageUrl);
      }
      previewImageUrl = URL.createObjectURL(blob);
    } catch (error) {
      console.error("Failed to generate image preview:", error);
    } finally {
      isGenerating = false;
    }
  }

  onMount(() => {
    generatePreview();

    // Subscribe to composition settings changes
    const handleSettingsChange = () => {
      generatePreview();
    };
    compositionManager.registerObserver(handleSettingsChange);

    // Subscribe to animation visibility changes (for Dark Mode)
    animationVisibilityManager.registerObserver(handleSettingsChange);

    return () => {
      if (previewImageUrl) {
        URL.revokeObjectURL(previewImageUrl);
      }
      compositionManager.unregisterObserver(handleSettingsChange);
      animationVisibilityManager.unregisterObserver(handleSettingsChange);
    };
  });

  // Regenerate when beatData changes
  $effect(() => {
    // Access beatData to trigger effect
    beatData;
    generatePreview();
  });
</script>

{#if isGenerating}
  <div class="preview-loading">
    <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
    <span>Generating...</span>
  </div>
{:else if previewImageUrl}
  <img src={previewImageUrl} alt="Export preview" class="preview-image" />
{:else}
  <div class="preview-error">
    <i class="fas fa-exclamation-triangle" aria-hidden="true"></i>
    <span>Preview unavailable</span>
  </div>
{/if}

<style>
  .preview-loading,
  .preview-error {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    width: 100%;
    height: 100%;
    color: var(--theme-text-dim);
  }

  .preview-loading i,
  .preview-error i {
    font-size: var(--font-size-3xl);
    color: #34d399;
    opacity: 0.6;
  }

  .preview-error i {
    color: var(--semantic-warning);
  }

  .preview-loading span,
  .preview-error span {
    font-size: var(--font-size-compact);
    font-weight: 500;
  }

  .preview-image {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
</style>
