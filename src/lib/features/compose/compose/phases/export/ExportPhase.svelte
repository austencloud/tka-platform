<!--
  ExportPhase.svelte

  Export configuration and rendering phase.
  Configure format, quality, and render the composition.
-->
<script lang="ts">
  import type { AudioState } from "../../state/composition-state.svelte";

  let {
    hasContent = false,
    hasAudio = false,
    audioState,
    onExport,
  }: {
    hasContent?: boolean;
    hasAudio?: boolean;
    audioState: AudioState;
    onExport?: (options: ExportOptions) => void;
  } = $props();

  // Export format options
  type ExportFormat = "mp4" | "gif" | "webm";

  interface ExportOptions {
    format: ExportFormat;
    quality: "low" | "medium" | "high";
    includeAudio: boolean;
    loopCount: number;
  }

  let format = $state<ExportFormat>("mp4");
  let quality = $state<"low" | "medium" | "high">("high");
  let includeAudio = $state(true);
  let loopCount = $state(1);
  let isExporting = $state(false);

  const formats: Array<{
    value: ExportFormat;
    label: string;
    icon: string;
    description: string;
  }> = [
    {
      value: "mp4",
      label: "MP4 Video",
      icon: "fas fa-film",
      description: "Best for sharing",
    },
    {
      value: "gif",
      label: "GIF",
      icon: "fas fa-image",
      description: "Animated, no audio",
    },
    {
      value: "webm",
      label: "WebM",
      icon: "fas fa-video",
      description: "Web optimized",
    },
  ];

  const qualities: Array<{
    value: "low" | "medium" | "high";
    label: string;
    resolution: string;
  }> = [
    { value: "low", label: "Low", resolution: "480p" },
    { value: "medium", label: "Medium", resolution: "720p" },
    { value: "high", label: "High", resolution: "1080p" },
  ];

  function handleExport() {
    if (!hasContent) return;

    isExporting = true;

    const options: ExportOptions = {
      format,
      quality,
      includeAudio: includeAudio && hasAudio && format !== "gif",
      loopCount,
    };

    // TODO: Wire to actual export service
    onExport?.(options);

    // Simulate export completion
    setTimeout(() => {
      isExporting = false;
    }, 2000);
  }

  // GIF doesn't support audio
  const canIncludeAudio = $derived(format !== "gif" && hasAudio);
</script>

<div class="export-phase">
  <div class="export-container">
    {#if !hasContent}
      <!-- No Content Warning -->
      <div class="empty-state">
        <div class="empty-icon">
          <i class="fas fa-layer-group" aria-hidden="true"></i>
        </div>
        <h2>Nothing to export</h2>
        <p>Add sequences to your composition first</p>
        <p class="hint">Go back to Canvas to build your composition</p>
      </div>
    {:else}
      <!-- Export Options -->
      <div class="export-options">
        <h2>Export Composition</h2>

        <!-- Format Selection -->
        <section class="option-section">
          <h3>Format</h3>
          <div class="format-grid">
            {#each formats as fmt}
              <button
                class="format-card"
                class:selected={format === fmt.value}
                onclick={() => (format = fmt.value)}
              >
                <i class={fmt.icon} aria-hidden="true"></i>
                <span class="format-label">{fmt.label}</span>
                <span class="format-desc">{fmt.description}</span>
              </button>
            {/each}
          </div>
        </section>

        <!-- Quality Selection -->
        <section class="option-section">
          <h3>Quality</h3>
          <div class="quality-options">
            {#each qualities as q}
              <button
                class="quality-btn"
                class:selected={quality === q.value}
                onclick={() => (quality = q.value)}
              >
                <span class="quality-label">{q.label}</span>
                <span class="quality-res">{q.resolution}</span>
              </button>
            {/each}
          </div>
        </section>

        <!-- Audio Toggle -->
        <section class="option-section">
          <h3>Audio</h3>
          {#if canIncludeAudio}
            <label class="audio-toggle">
              <input
                type="checkbox"
                bind:checked={includeAudio}
                aria-label="Include audio in export"
              />
              <span class="toggle-track"></span>
              <span class="toggle-label">
                Include audio ({audioState.fileName})
              </span>
            </label>
          {:else if format === "gif"}
            <p class="audio-note">
              <i class="fas fa-info-circle" aria-hidden="true"></i>
              GIF format doesn't support audio
            </p>
          {:else}
            <p class="audio-note">
              <i class="fas fa-info-circle" aria-hidden="true"></i>
              No audio loaded. Add audio in the Audio phase.
            </p>
          {/if}
        </section>

        <!-- Loop Count -->
        <section class="option-section">
          <h3>Loops</h3>
          <div class="loop-control">
            <button
              class="loop-btn"
              onclick={() => (loopCount = Math.max(1, loopCount - 1))}
              disabled={loopCount <= 1}
              aria-label="Decrease loop count"
            >
              <i class="fas fa-minus" aria-hidden="true"></i>
            </button>
            <span class="loop-count">{loopCount}x</span>
            <button
              class="loop-btn"
              onclick={() => (loopCount = Math.min(10, loopCount + 1))}
              disabled={loopCount >= 10}
              aria-label="Increase loop count"
            >
              <i class="fas fa-plus" aria-hidden="true"></i>
            </button>
          </div>
        </section>

        <!-- Export Button -->
        <div class="export-action">
          <button
            class="export-btn"
            onclick={handleExport}
            disabled={isExporting}
          >
            {#if isExporting}
              <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
              Exporting...
            {:else}
              <i class="fas fa-download" aria-hidden="true"></i>
              Export {format.toUpperCase()}
            {/if}
          </button>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .export-phase {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: auto;
  }

  .export-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    max-width: 600px;
    margin: 0 auto;
    padding: 1.5rem;
    width: 100%;
  }

  /* Empty State */
  .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    color: var(--theme-text-dim);
  }

  .empty-icon {
    width: 80px;
    height: 80px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--theme-card-bg);
    border-radius: 50%;
    margin-bottom: 1.5rem;
  }

  .empty-icon i {
    font-size: 2rem;
    color: rgba(255, 255, 255, 0.4);
  }

  .empty-state h2 {
    margin: 0 0 0.5rem 0;
    font-size: 1.25rem;
    color: var(--theme-text);
  }

  .empty-state p {
    margin: 0;
    font-size: 0.9rem;
  }

  .empty-state .hint {
    margin-top: 0.5rem;
    font-size: 0.8rem;
    color: var(--theme-text-dim);
  }

  /* Export Options */
  .export-options {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .export-options h2 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.95);
  }

  .option-section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .option-section h3 {
    margin: 0;
    font-size: 0.85rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--theme-text-dim);
  }

  /* Format Grid */
  .format-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.75rem;
  }

  .format-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 1rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .format-card:hover {
    background: rgba(255, 255, 255, 0.06);
    border-color: var(--theme-stroke-strong);
  }

  .format-card.selected {
    background: rgba(139, 92, 246, 0.15);
    border-color: rgba(139, 92, 246, 0.4);
  }

  .format-card:focus-visible {
    outline: 2px solid var(--theme-accent, rgba(139, 92, 246, 0.8));
    outline-offset: 2px;
  }

  .format-card i {
    font-size: 1.25rem;
    color: var(--theme-text-dim);
  }

  .format-card.selected i {
    color: rgba(167, 139, 250, 1);
  }

  .format-label {
    font-weight: 600;
    font-size: 0.9rem;
    color: var(--theme-text);
  }

  .format-desc {
    font-size: 0.75rem;
    color: var(--theme-text-dim);
  }

  /* Quality Options */
  .quality-options {
    display: flex;
    gap: 0.5rem;
  }

  .quality-btn {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0.75rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .quality-btn:hover {
    background: rgba(255, 255, 255, 0.06);
  }

  .quality-btn.selected {
    background: rgba(139, 92, 246, 0.15);
    border-color: rgba(139, 92, 246, 0.4);
  }

  .quality-btn:focus-visible {
    outline: 2px solid var(--theme-accent, rgba(139, 92, 246, 0.8));
    outline-offset: 2px;
  }

  .quality-label {
    font-weight: 600;
    font-size: 0.9rem;
    color: var(--theme-text);
  }

  .quality-res {
    font-size: 0.75rem;
    color: var(--theme-text-dim);
  }

  /* Audio Toggle */
  .audio-toggle {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    cursor: pointer;
  }

  .audio-toggle input {
    display: none;
  }

  .toggle-track {
    width: 44px;
    height: 24px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    position: relative;
    transition: background var(--duration-normal) ease;
  }

  .toggle-track::after {
    content: "";
    position: absolute;
    top: 2px;
    left: 2px;
    width: 20px;
    height: 20px;
    background: white;
    border-radius: 50%;
    transition: transform var(--duration-normal) ease;
  }

  .audio-toggle input:checked + .toggle-track {
    background: rgba(139, 92, 246, 0.6);
  }

  .audio-toggle input:checked + .toggle-track::after {
    transform: translateX(20px);
  }

  .toggle-label {
    font-size: 0.9rem;
    color: rgba(255, 255, 255, 0.8);
  }

  .audio-note {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0;
    font-size: 0.85rem;
    color: var(--theme-text-dim);
  }

  .audio-note i {
    color: rgba(251, 191, 36, 0.7);
  }

  /* Loop Control */
  .loop-control {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .loop-btn {
    width: var(--min-touch-target); /* WCAG AAA touch target */
    height: var(--min-touch-target);
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 8px;
    color: rgba(255, 255, 255, 0.8);
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .loop-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
  }

  .loop-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .loop-btn:focus-visible {
    outline: 2px solid var(--theme-accent, rgba(139, 92, 246, 0.8));
    outline-offset: 2px;
  }

  .loop-count {
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--theme-text);
    min-width: 3rem;
    text-align: center;
  }

  /* Export Action */
  .export-action {
    margin-top: 1rem;
    padding-top: 1.5rem;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }

  .export-btn {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 1rem 2rem;
    background: linear-gradient(
      135deg,
      rgba(139, 92, 246, 0.8) 0%,
      rgba(124, 58, 237, 0.8) 100%
    );
    border: none;
    border-radius: 12px;
    color: white;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .export-btn:hover:not(:disabled) {
    background: linear-gradient(
      135deg,
      rgba(139, 92, 246, 1) 0%,
      rgba(124, 58, 237, 1) 100%
    );
    transform: translateY(-1px);
  }

  .export-btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .export-btn:focus-visible {
    outline: 2px solid white;
    outline-offset: 2px;
  }

  /* Mobile adjustments */
  @media (max-width: 500px) {
    .format-grid {
      grid-template-columns: 1fr;
    }

    .format-card {
      flex-direction: row;
      justify-content: flex-start;
      gap: 1rem;
      text-align: left;
    }

    .format-card i {
      font-size: 1.5rem;
    }
  }

  /* Accessibility: Respect user's motion preferences */
  @media (prefers-reduced-motion: reduce) {
    .format-card,
    .quality-btn,
    .toggle-track,
    .toggle-track::after,
    .loop-btn,
    .export-btn {
      transition: none;
    }

    .export-btn:hover:not(:disabled) {
      transform: none;
    }
  }
</style>
