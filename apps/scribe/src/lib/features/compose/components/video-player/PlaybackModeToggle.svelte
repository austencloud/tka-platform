<!--
  PlaybackModeToggle.svelte

  Toggle between live preview and video playback modes.
  Displayed when a video has been successfully generated.
-->
<script lang="ts">
  let {
    currentMode = $bindable("live"),
    onModeChange,
  }: {
    currentMode?: "live" | "video";
    onModeChange: (mode: "live" | "video") => void;
  } = $props();

  function switchToLive() {
    currentMode = "live";
    onModeChange("live");
  }

  function switchToVideo() {
    currentMode = "video";
    onModeChange("video");
  }
</script>

<div class="mode-toggle">
  <button
    class="animation-mode-btn"
    class:active={currentMode === "live"}
    onclick={switchToLive}
  >
    Live
  </button>
  <button
    class="animation-mode-btn"
    class:active={currentMode === "video"}
    onclick={switchToVideo}
  >
    Video
  </button>
</div>

<style>
  .mode-toggle {
    position: absolute;
    bottom: 12px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(8px);
    border-radius: 8px;
    padding: 4px;
    z-index: 20;
  }

  .animation-mode-btn {
    background: transparent;
    border: none;
    color: var(--theme-text-dim);
    padding: 12px 18px;
    min-height: var(--min-touch-target);
    border-radius: 8px;
    cursor: pointer;
    font-size: var(--font-size-compact);
    transition: all var(--duration-normal) ease;
  }

  .animation-mode-btn:hover {
    color: white;
  }

  .animation-mode-btn.active {
    background: rgba(255, 255, 255, 0.2);
    color: white;
  }
</style>
