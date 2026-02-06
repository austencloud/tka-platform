<script lang="ts">
  /**
   * MLTrainingModule.svelte
   *
   * Module wrapper for the ML Training feature.
   * Provides prop detection model training capabilities:
   * - Webcam capture of prop images
   * - Bounding box labeling interface
   * - COCO format dataset export for MediaPipe Model Maker
   *
   * Access: Testers and Admins only
   */
  import MLTrainingPanel from "./MLTrainingPanel.svelte";
</script>

<div class="ml-training-module">
  <MLTrainingPanel />
</div>

<style>
  .ml-training-module {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
</style>
