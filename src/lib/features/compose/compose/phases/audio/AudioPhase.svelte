<!--
  AudioPhase.svelte

  Audio timeline editor phase.
  Desktop: Full waveform timeline with beat markers
  Mobile: Placeholder message directing to desktop
-->
<script lang="ts">
  import { onMount } from "svelte";
  import type {
    AudioState,
    BeatMarker,
    TempoRegion,
  } from "../../state/composition-state.svelte";
  import WaveformTimeline from "./WaveformTimeline.svelte";
  import BeatMarkerTrack from "./BeatMarkerTrack.svelte";
  import TempoRegionTrack from "./TempoRegionTrack.svelte";
  import ManualBeatTapper from "./ManualBeatTapper.svelte";
  import { analyzeAudioBpm } from "./bpm-analyzer";
  import AudioLibraryPanel from "./library/components/AudioLibraryPanel.svelte";
  import LibrarySourceButton from "./library/components/LibrarySourceButton.svelte";
  import { audioLibraryState } from "./library/state/audio-library-state.svelte";

  let {
    audioState,
    onLoadAudio,
    onClearAudio,
    onSetDetectedBpm,
    onSetManualBpm,
    onSetDuration,
    onSetAnalyzing,
    onAddBeatMarker,
    onRemoveBeatMarker,
    onAddTempoRegion,
    onRemoveTempoRegion,
    onUpdateTempoRegion,
    onRestoreFromCache,
  }: {
    audioState: AudioState;
    onLoadAudio: (file: File) => void;
    onClearAudio: () => void;
    onSetDetectedBpm: (bpm: number) => void;
    onSetManualBpm?: (bpm: number) => void;
    onSetDuration?: (duration: number) => void;
    onSetAnalyzing?: (analyzing: boolean) => void;
    onAddBeatMarker: (marker: BeatMarker) => void;
    onRemoveBeatMarker: (id: string) => void;
    onAddTempoRegion?: (region: TempoRegion) => void;
    onRemoveTempoRegion?: (id: string) => void;
    onUpdateTempoRegion?: (id: string, updates: Partial<TempoRegion>) => void;
    onRestoreFromCache?: () => Promise<boolean>;
  } = $props();

  // Playback state for waveform
  let isAudioPlaying = $state(false);
  let currentAudioTime = $state(0);

  let isDesktop = $state(false);
  let isDragging = $state(false);
  let fileInput = $state<HTMLInputElement>();
  let bpmAnalysisProgress = $state(0);
  let bpmError = $state<string | null>(null);
  let bpmIsUncertain = $state(false);
  let analysisAttempted = $state(false);

  // Auto-analyze BPM when audio is loaded (only once)
  $effect(() => {
    if (
      audioState.isLoaded &&
      audioState.url &&
      !audioState.detectedBpm &&
      !audioState.isAnalyzing &&
      !analysisAttempted
    ) {
      analyzeBpm();
    }
  });

  async function analyzeBpm() {
    if (!audioState.url) return;

    bpmError = null;
    bpmIsUncertain = false;
    bpmAnalysisProgress = 0;
    analysisAttempted = true;
    onSetAnalyzing?.(true);

    try {
      const result = await analyzeAudioBpm(audioState.url, (progress) => {
        bpmAnalysisProgress = progress;
      });

      // Always set the BPM, but track if it's uncertain
      onSetDetectedBpm(result.bpm);
      bpmIsUncertain = result.isUncertain ?? result.confidence < 0.5;

      if (bpmIsUncertain) {
      } else {
      }

      if (result.bestSectionStart !== undefined) {
      }
    } catch (err) {
      console.error("🎵 BPM analysis failed:", err);
      bpmError = "BPM analysis failed. Set it manually below.";
    } finally {
      onSetAnalyzing?.(false);
      bpmAnalysisProgress = 0;
    }
  }

  function updateDesktopState() {
    isDesktop = typeof window !== "undefined" && window.innerWidth >= 768;
  }

  onMount(() => {
    updateDesktopState();
    window.addEventListener("resize", updateDesktopState);

    // Try to restore cached audio on mount (for dev workflow)
    if (!audioState.isLoaded && onRestoreFromCache) {
      onRestoreFromCache();
    }

    return () => window.removeEventListener("resize", updateDesktopState);
  });

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    isDragging = true;
  }

  function handleDragLeave() {
    isDragging = false;
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    isDragging = false;

    const file = e.dataTransfer?.files[0];
    if (file && file.type.startsWith("audio/")) {
      onLoadAudio(file);
    }
  }

  function handleFileSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      onLoadAudio(file);
    }
  }

  function openFilePicker() {
    fileInput?.click();
  }

  function handleLibraryAudioSelected(
    audioBlob: Blob,
    metadata: { title: string; duration: number }
  ) {
    // Create a File from the Blob with the track title
    const fileName = `${metadata.title.replace(/[^a-zA-Z0-9 ]/g, "")}.mp3`;
    const file = new File([audioBlob], fileName, { type: "audio/mpeg" });
    onLoadAudio(file);
    audioLibraryState.close();
  }

  function openLibraryPanel() {
    audioLibraryState.open();
  }

  function closeLibraryPanel() {
    audioLibraryState.close();
  }
</script>

<div class="audio-phase">
  {#if !isDesktop}
    <!-- Mobile Placeholder -->
    <div class="mobile-placeholder">
      <div class="placeholder-icon">
        <i class="fas fa-desktop" aria-hidden="true"></i>
      </div>
      <h3>Audio Timeline</h3>
      <p>The audio editor is optimized for desktop screens.</p>
      <p class="hint">
        Switch to a larger screen for the full timeline experience.
      </p>
    </div>
  {:else}
    <!-- Desktop Audio Editor -->
    <div class="audio-editor">
      {#if !audioState.isLoaded}
        <!-- Drop Zone or Library Panel -->
        {#if audioLibraryState.isOpen}
          <AudioLibraryPanel
            onAudioSelected={handleLibraryAudioSelected}
            onClose={closeLibraryPanel}
          />
        {:else}
          <div
            class="drop-zone"
            class:dragging={isDragging}
            ondragover={handleDragOver}
            ondragleave={handleDragLeave}
            ondrop={handleDrop}
            onclick={openFilePicker}
            onkeydown={(e) => e.key === "Enter" && openFilePicker()}
            role="button"
            tabindex="0"
            aria-label="Drop audio file here or click to browse"
          >
            <input
              bind:this={fileInput}
              type="file"
              accept="audio/*"
              onchange={handleFileSelect}
              hidden
            />
            <div class="drop-icon">
              <i class="fas fa-music" aria-hidden="true"></i>
            </div>
            <h3>Drop audio file here</h3>
            <p>or click to browse</p>
            <p class="formats">Supports MP3, WAV, OGG, M4A</p>

            <div class="divider">
              <span>or</span>
            </div>

            <div class="source-buttons">
              <LibrarySourceButton
                onclick={(e) => {
                  e.stopPropagation();
                  openLibraryPanel();
                }}
              />
            </div>
          </div>
        {/if}
      {:else}
        <!-- Audio Loaded - Timeline UI -->
        <div class="timeline-container">
          <div class="audio-header">
            <div class="file-info">
              <i class="fas fa-file-audio" aria-hidden="true"></i>
              <span class="file-name">{audioState.fileName}</span>
              <span class="duration">
                {Math.floor(audioState.duration / 60)}:{String(
                  Math.floor(audioState.duration % 60)
                ).padStart(2, "0")}
              </span>
            </div>
            <button
              class="clear-btn"
              onclick={onClearAudio}
              aria-label="Remove audio file"
            >
              <i class="fas fa-times" aria-hidden="true"></i>
              Remove
            </button>
          </div>

          <WaveformTimeline
            audioUrl={audioState.url ?? ""}
            isPlaying={isAudioPlaying}
            currentTime={currentAudioTime}
            onReady={() => {}}
            onTimeUpdate={(time) => (currentAudioTime = time)}
            onDurationChange={(duration) => onSetDuration?.(duration)}
            onPlayPause={(playing) => (isAudioPlaying = playing)}
          />

          <div class="bpm-controls">
            <span class="label">BPM:</span>
            {#if audioState.isAnalyzing}
              <div class="analyzing-container">
                <span class="analyzing">
                  <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
                  Analyzing sections... {Math.round(bpmAnalysisProgress * 100)}%
                </span>
                <div class="progress-bar">
                  <div
                    class="progress-fill"
                    style="width: {bpmAnalysisProgress * 100}%"
                  ></div>
                </div>
              </div>
            {:else if bpmError}
              <div class="error-container">
                <span class="error" role="alert" aria-live="assertive">
                  <i class="fas fa-exclamation-triangle" aria-hidden="true"></i>
                  {bpmError}
                </span>
                <input
                  type="number"
                  class="manual-bpm-input"
                  placeholder="Enter BPM"
                  min="40"
                  max="220"
                  onchange={(e) => {
                    const val = parseInt((e.target as HTMLInputElement).value);
                    if (val >= 40 && val <= 220) onSetManualBpm?.(val);
                  }}
                />
              </div>
            {:else if audioState.detectedBpm}
              <div class="bpm-display" class:uncertain={bpmIsUncertain}>
                <input
                  type="number"
                  class="bpm-input"
                  value={audioState.manualBpm ?? audioState.detectedBpm}
                  min="40"
                  max="220"
                  onchange={(e) => {
                    const val = parseInt((e.target as HTMLInputElement).value);
                    if (val >= 40 && val <= 220) onSetManualBpm?.(val);
                  }}
                />
                {#if bpmIsUncertain}
                  <span class="source uncertain">
                    <i class="fas fa-question-circle" aria-hidden="true"></i>
                    estimate - verify
                  </span>
                {:else if audioState.manualBpm}
                  <span class="source">(manual)</span>
                {:else}
                  <span class="source">(detected)</span>
                {/if}
              </div>
            {:else}
              <input
                type="number"
                class="manual-bpm-input"
                placeholder="Enter BPM"
                min="40"
                max="220"
                onchange={(e) => {
                  const val = parseInt((e.target as HTMLInputElement).value);
                  if (val >= 40 && val <= 220) onSetManualBpm?.(val);
                }}
              />
            {/if}
          </div>

          <!-- Beat Marker Track -->
          <BeatMarkerTrack
            duration={audioState.duration}
            bpm={audioState.detectedBpm ?? audioState.manualBpm}
            currentTime={currentAudioTime}
            beatMarkers={audioState.globalBeatMarkers}
            onAddMarker={onAddBeatMarker}
            onRemoveMarker={onRemoveBeatMarker}
          />

          <!-- Tempo Region Track (Variable BPM) -->
          <TempoRegionTrack
            duration={audioState.duration}
            currentTime={currentAudioTime}
            baseBpm={audioState.detectedBpm ?? audioState.manualBpm}
            tempoRegions={audioState.tempoRegions}
            onAddRegion={onAddTempoRegion}
            onRemoveRegion={onRemoveTempoRegion}
            onUpdateRegion={onUpdateTempoRegion}
          />

          <!-- Manual Beat Tapper (for recordings) -->
          <ManualBeatTapper
            currentTime={currentAudioTime}
            duration={audioState.duration}
            isPlaying={isAudioPlaying}
            beatMarkers={audioState.globalBeatMarkers}
            onAddMarker={onAddBeatMarker}
            onRemoveMarker={onRemoveBeatMarker}
            onClearAll={() => {
              // Clear all beat markers
              audioState.globalBeatMarkers.forEach((m) =>
                onRemoveBeatMarker(m.id)
              );
            }}
          />
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .audio-phase {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* Mobile Placeholder */
  .mobile-placeholder {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 2rem;
    color: var(--theme-text-dim);
  }

  .placeholder-icon {
    width: 80px;
    height: 80px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(139, 92, 246, 0.15);
    border-radius: 50%;
    margin-bottom: 1.5rem;
  }

  .placeholder-icon i {
    font-size: 2rem;
    color: rgba(167, 139, 250, 0.8);
  }

  .mobile-placeholder h3 {
    font-size: 1.25rem;
    font-weight: 600;
    margin: 0 0 0.5rem 0;
    color: var(--theme-text);
  }

  .mobile-placeholder p {
    margin: 0;
    font-size: 0.9rem;
    line-height: 1.5;
  }

  .mobile-placeholder .hint {
    margin-top: 0.5rem;
    font-size: 0.8rem;
    color: var(--theme-text-dim);
  }

  /* Desktop Audio Editor */
  .audio-editor {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 1.5rem;
    overflow: auto;
  }

  /* Drop Zone */
  .drop-zone {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    border: 2px dashed rgba(255, 255, 255, 0.2);
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.02);
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    min-height: 300px;
  }

  .drop-zone:hover,
  .drop-zone.dragging {
    border-color: rgba(139, 92, 246, 0.5);
    background: rgba(139, 92, 246, 0.05);
  }

  .drop-icon {
    width: 64px;
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(139, 92, 246, 0.15);
    border-radius: 50%;
    margin-bottom: 1rem;
  }

  .drop-icon i {
    font-size: 1.5rem;
    color: rgba(167, 139, 250, 0.9);
  }

  .drop-zone h3 {
    margin: 0 0 0.5rem 0;
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--theme-text);
  }

  .drop-zone p {
    margin: 0;
    font-size: 0.9rem;
    color: var(--theme-text-dim);
  }

  .drop-zone .formats {
    margin-top: 1rem;
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.75); /* WCAG AAA */
  }

  .drop-zone .divider {
    display: flex;
    align-items: center;
    width: 60%;
    margin: 1.5rem 0;
    gap: 1rem;
  }

  .drop-zone .divider::before,
  .drop-zone .divider::after {
    content: "";
    flex: 1;
    height: 1px;
    background: rgba(255, 255, 255, 0.15);
  }

  .drop-zone .divider span {
    font-size: 0.8rem;
    color: rgba(255, 255, 255, 0.75); /* WCAG AAA */
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .source-buttons {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    align-items: center;
  }

  /* Timeline Container */
  .timeline-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .audio-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    background: rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 8px;
  }

  .file-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    color: var(--theme-text);
  }

  .file-info i {
    color: rgba(139, 92, 246, 0.8);
  }

  .file-name {
    font-weight: 500;
  }

  .duration {
    color: var(--theme-text-dim);
    font-size: 0.85rem;
  }

  .clear-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.2);
    border-radius: 6px;
    color: rgba(248, 113, 113, 0.9);
    font-size: 0.85rem;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .clear-btn:hover {
    background: rgba(239, 68, 68, 0.2);
    border-color: rgba(239, 68, 68, 0.3);
  }

  .clear-btn:focus-visible {
    outline: 2px solid var(--theme-accent, rgba(248, 113, 113, 0.8));
    outline-offset: 2px;
  }

  /* BPM Controls */
  .bpm-controls {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 8px;
    font-size: 0.9rem;
  }

  .bpm-controls .label {
    color: var(--theme-text-dim);
    font-weight: 500;
  }

  .bpm-controls .source {
    color: rgba(255, 255, 255, 0.75); /* WCAG AAA */
    font-size: 0.8rem;
  }

  .bpm-controls .analyzing {
    color: rgba(251, 191, 36, 0.9);
  }

  /* Analyzing Container */
  .analyzing-container {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    flex: 1;
  }

  .progress-bar {
    width: 100%;
    height: 4px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 2px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: rgba(251, 191, 36, 0.8);
    border-radius: 2px;
    transition: width var(--duration-normal) ease;
  }

  /* Error Container */
  .error-container {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex: 1;
  }

  .bpm-controls .error {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: rgba(248, 113, 113, 0.9);
    font-size: 0.85rem;
  }

  /* BPM Display with input */
  .bpm-display {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .bpm-display.uncertain {
    padding: 0.25rem 0.5rem;
    background: rgba(251, 191, 36, 0.1);
    border-radius: 6px;
  }

  .bpm-input,
  .manual-bpm-input {
    width: 70px;
    padding: 0.35rem 0.5rem;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke-strong);
    border-radius: 6px;
    color: rgba(167, 139, 250, 1);
    font-size: 0.95rem;
    font-weight: 600;
    text-align: center;
    transition: all var(--duration-normal) ease;
  }

  .bpm-input:focus,
  .manual-bpm-input:focus {
    outline: none;
    border-color: rgba(139, 92, 246, 0.5);
    background: var(--theme-card-hover-bg);
  }

  .bpm-input::-webkit-inner-spin-button,
  .bpm-input::-webkit-outer-spin-button,
  .manual-bpm-input::-webkit-inner-spin-button,
  .manual-bpm-input::-webkit-outer-spin-button {
    opacity: 1;
  }

  .source.uncertain {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    color: rgba(251, 191, 36, 0.9);
    font-size: 0.75rem;
  }

  .source.uncertain i {
    font-size: 0.85rem;
  }

  /* Focus indicators for inputs */
  .drop-zone:focus-visible {
    outline: 2px solid var(--theme-accent, rgba(139, 92, 246, 0.8));
    outline-offset: 2px;
  }

  /* Accessibility: Respect user's motion preferences */
  @media (prefers-reduced-motion: reduce) {
    .drop-zone,
    .clear-btn,
    .progress-fill,
    .bpm-input,
    .manual-bpm-input {
      transition: none;
    }
  }
</style>
