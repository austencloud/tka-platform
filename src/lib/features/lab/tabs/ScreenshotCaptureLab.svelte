<!--
  ScreenshotCaptureLab — Full-width gallery with optional capture modal.

  The gallery is the primary experience. Capture controls (route picker, device
  selector) are accessed via a modal triggered from the gallery header.
-->
<script lang="ts">
  import ScreenshotGallery from "../components/screenshots/ScreenshotGallery.svelte";
</script>

<div class="screenshot-lab">
  <ScreenshotGallery />
</div>

<style>
  .screenshot-lab {
    display: flex;
    height: 100%;
    overflow: hidden;
  }
</style>
