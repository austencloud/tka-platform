<script lang="ts">
  import { getVideoTrailsContext } from "../context/video-trails-context";
  import type { ExportConfig } from "../domain/types";

  const { state } = getVideoTrailsContext();

  let format = $state<"mp4" | "webm">("webm");
  let resolution = $state<"720p" | "1080p" | "original">("1080p");

  interface Props {
    onExport: (config: ExportConfig) => void;
  }

  let { onExport }: Props = $props();

  function getResolution(): { width: number; height: number } {
    if (resolution === "720p") return { width: 1280, height: 720 };
    if (resolution === "1080p") return { width: 1920, height: 1080 };
    return state.source?.resolution ?? { width: 1920, height: 1080 };
  }

  function handleExport() {
    onExport({
      format,
      resolution: getResolution(),
      fps: state.source?.fps ?? 30,
      bitrate: resolution === "1080p" ? 8_000_000 : 4_000_000,
    });
  }

  function handleDownload() {
    if (state.exportState.phase !== "complete" || !state.exportState.blob) return;
    const url = URL.createObjectURL(state.exportState.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `video-trails-export.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  }
</script>

<div class="export-panel">
  <h3 class="panel-title">Export</h3>

  <div class="export-options">
    <label class="select-row">
      <span>Format</span>
      <select bind:value={format}>
        <option value="webm">WebM</option>
        <option value="mp4">MP4</option>
      </select>
    </label>

    <label class="select-row">
      <span>Resolution</span>
      <select bind:value={resolution}>
        <option value="720p">720p</option>
        <option value="1080p">1080p</option>
        <option value="original">Original</option>
      </select>
    </label>
  </div>

  {#if state.exportState.phase === "idle" || state.exportState.phase === "complete" || state.exportState.phase === "error"}
    <button class="export-btn" onclick={handleExport} disabled={!state.source}>
      <i class="fas fa-download" aria-hidden="true"></i>
      Export Video
    </button>
  {:else}
    <div class="progress-section">
      <div class="progress-bar">
        <div class="progress-fill" style="width: {(state.exportState.progress ?? 0) * 100}%"></div>
      </div>
      <span class="progress-label">{state.exportState.phase}... {Math.round((state.exportState.progress ?? 0) * 100)}%</span>
    </div>
  {/if}

  {#if state.exportState.phase === "complete"}
    <button class="download-btn" onclick={handleDownload}>
      <i class="fas fa-file-video" aria-hidden="true"></i>
      Download
    </button>
  {/if}

  {#if state.exportState.phase === "error"}
    <p class="error-text">{state.exportState.error}</p>
  {/if}
</div>

<style>
  .export-panel {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-radius: 8px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .panel-title {
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    margin: 0;
  }

  .export-options {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .select-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
  }

  .select-row span { min-width: 70px; }

  .select-row select {
    flex: 1;
    background: transparent;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 4px;
    color: var(--theme-text, #ffffff);
    padding: 4px 8px;
  }

  .export-btn,
  .download-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 10px;
    border: none;
    border-radius: 6px;
    background: var(--theme-accent, #f43f5e);
    color: white;
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    cursor: pointer;
  }

  .export-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  .download-btn { background: var(--semantic-success, #22c55e); }

  .progress-section {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .progress-bar {
    height: 4px;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 2px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: var(--theme-accent, #f43f5e);
    transition: width 0.2s;
  }

  .progress-label {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    text-transform: capitalize;
  }

  .error-text {
    font-size: var(--font-size-compact, 12px);
    color: var(--semantic-error, #ef4444);
    margin: 0;
  }
</style>
