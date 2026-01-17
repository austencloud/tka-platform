<!--
  GenerateVideoButton.svelte

  CTA button that initiates video generation process.
  Displayed when no video has been generated yet.
-->
<script lang="ts">
  let {
    onGenerate,
  }: {
    onGenerate: () => void;
  } = $props();
</script>

<button class="generate-video-btn" onclick={onGenerate}>
  Generate Video
</button>

<style>
  .generate-video-btn {
    position: absolute;
    bottom: 12px;
    right: 12px;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: white;
    padding: 14px 20px;
    min-height: var(--min-touch-target);
    border-radius: 10px;
    cursor: pointer;
    font-size: var(--font-size-compact);
    font-weight: 500;
    z-index: 20;
    transition: all var(--duration-normal) ease;
  }

  .generate-video-btn:hover {
    background: rgba(0, 0, 0, 0.85);
    border-color: rgba(255, 255, 255, 0.4);
  }

  .generate-video-btn:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }
</style>
