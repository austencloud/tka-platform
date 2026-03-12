<!--
  AudioToolkitLab.svelte

  Lab tab for evaluating archived audio toolkit components.
  Drop in an audio file to see the waveform timeline, beat markers,
  tempo regions, and manual beat tapper in action.
-->
<script lang="ts">
  import type {
    AudioState,
    BeatMarker,
    TempoRegion,
  } from "$lib/features/compose/compose/state/composition-types";
  import { analyzeAudioBpm } from "$lib/features/compose/compose/phases/audio/bpm-analyzer";
  import WaveformTimeline from "./components/WaveformTimeline.svelte";
  import BeatMarkerTrack from "./components/BeatMarkerTrack.svelte";
  import TempoRegionTrack from "./components/TempoRegionTrack.svelte";
  import ManualBeatTapper from "./components/ManualBeatTapper.svelte";

  // Local audio state (self-contained, no external dependencies)
  let audioState = $state<AudioState>({
    file: null,
    url: null,
    fileName: null,
    duration: 0,
    detectedBpm: null,
    manualBpm: null,
    globalBeatMarkers: [],
    tempoRegions: [],
    isAnalyzing: false,
    isLoaded: false,
  });

  let isPlaying = $state(false);
  let currentTime = $state(0);
  let isDragging = $state(false);
  let fileInput = $state<HTMLInputElement>();
  let bpmProgress = $state(0);
  let bpmError = $state<string | null>(null);

  // Load an audio file
  function loadAudio(file: File) {
    // Revoke old URL to prevent memory leaks
    if (audioState.url) {
      URL.revokeObjectURL(audioState.url);
    }

    const url = URL.createObjectURL(file);
    audioState = {
      ...audioState,
      file,
      url,
      fileName: file.name,
      isLoaded: true,
      detectedBpm: null,
      manualBpm: null,
      globalBeatMarkers: [],
      tempoRegions: [],
      isAnalyzing: false,
    };

    // Auto-analyze BPM
    analyzeBpm(url);
  }

  async function analyzeBpm(url: string) {
    bpmError = null;
    bpmProgress = 0;
    audioState.isAnalyzing = true;

    try {
      const result = await analyzeAudioBpm(url, (progress) => {
        bpmProgress = progress;
      });
      audioState.detectedBpm = result.bpm;
    } catch (err) {
      console.error("BPM analysis failed:", err);
      bpmError = "BPM analysis failed. Set it manually.";
    } finally {
      audioState.isAnalyzing = false;
      bpmProgress = 0;
    }
  }

  function clearAudio() {
    if (audioState.url) {
      URL.revokeObjectURL(audioState.url);
    }
    audioState = {
      file: null,
      url: null,
      fileName: null,
      duration: 0,
      detectedBpm: null,
      manualBpm: null,
      globalBeatMarkers: [],
      tempoRegions: [],
      isAnalyzing: false,
      isLoaded: false,
    };
    isPlaying = false;
    currentTime = 0;
  }

  // Beat marker handlers
  function addBeatMarker(marker: BeatMarker) {
    audioState.globalBeatMarkers = [...audioState.globalBeatMarkers, marker];
  }

  function removeBeatMarker(id: string) {
    audioState.globalBeatMarkers = audioState.globalBeatMarkers.filter(
      (m) => m.id !== id
    );
  }

  // Tempo region handlers
  function addTempoRegion(region: TempoRegion) {
    audioState.tempoRegions = [...audioState.tempoRegions, region];
  }

  function removeTempoRegion(id: string) {
    audioState.tempoRegions = audioState.tempoRegions.filter(
      (r) => r.id !== id
    );
  }

  function updateTempoRegion(id: string, updates: Partial<TempoRegion>) {
    audioState.tempoRegions = audioState.tempoRegions.map((r) =>
      r.id === id ? { ...r, ...updates } : r
    );
  }

  // Drag-and-drop
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
      loadAudio(file);
    }
  }

  function handleFileSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      loadAudio(file);
    }
  }

  function openFilePicker() {
    fileInput?.click();
  }
</script>

<div class="audio-toolkit-lab">
  <header class="lab-header">
    <h1>
      <i class="fas fa-music" aria-hidden="true"></i>
      Audio Toolkit Lab
    </h1>
    <p class="subtitle">
      Archived audio components from the compose module. Drop an audio file to
      test the waveform, beat markers, tempo regions, and manual beat tapper.
    </p>
  </header>

  <div class="lab-content">
    {#if !audioState.isLoaded}
      <!-- Drop zone -->
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
      </div>
    {:else}
      <!-- Audio loaded - show all components -->
      <div class="timeline-container">
        <!-- File info header -->
        <div class="audio-header">
          <div class="file-info">
            <i class="fas fa-file-audio" aria-hidden="true"></i>
            <span class="file-name">{audioState.fileName}</span>
            {#if audioState.duration > 0}
              <span class="duration">
                {Math.floor(audioState.duration / 60)}:{String(
                  Math.floor(audioState.duration % 60)
                ).padStart(2, "0")}
              </span>
            {/if}
          </div>
          <button
            class="clear-btn"
            onclick={clearAudio}
            aria-label="Remove audio file"
          >
            <i class="fas fa-times" aria-hidden="true"></i>
            Remove
          </button>
        </div>

        <!-- Waveform Timeline -->
        <section class="component-section">
          <div class="section-label">
            <span class="badge">WaveformTimeline</span>
            <span class="desc">Wavesurfer.js waveform with zoom, minimap, keyboard controls</span>
          </div>
          <WaveformTimeline
            audioUrl={audioState.url ?? ""}
            {isPlaying}
            {currentTime}
            onReady={() => {}}
            onTimeUpdate={(time) => (currentTime = time)}
            onDurationChange={(duration) => (audioState.duration = duration)}
            onPlayPause={(playing) => (isPlaying = playing)}
          />
        </section>

        <!-- BPM display -->
        <div class="bpm-controls">
          <span class="label">BPM:</span>
          {#if audioState.isAnalyzing}
            <div class="analyzing">
              <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
              Analyzing... {Math.round(bpmProgress * 100)}%
              <div class="progress-bar">
                <div class="progress-fill" style="width: {bpmProgress * 100}%"></div>
              </div>
            </div>
          {:else if bpmError}
            <span class="error">{bpmError}</span>
            <input
              type="number"
              class="bpm-input"
              placeholder="Enter BPM"
              min="40"
              max="220"
              onchange={(e) => {
                const val = parseInt((e.target as HTMLInputElement).value);
                if (val >= 40 && val <= 220) audioState.manualBpm = val;
              }}
            />
          {:else if audioState.detectedBpm}
            <input
              type="number"
              class="bpm-input"
              value={audioState.manualBpm ?? audioState.detectedBpm}
              min="40"
              max="220"
              onchange={(e) => {
                const val = parseInt((e.target as HTMLInputElement).value);
                if (val >= 40 && val <= 220) audioState.manualBpm = val;
              }}
            />
            <span class="source">
              ({audioState.manualBpm ? "manual" : "detected"})
            </span>
          {:else}
            <input
              type="number"
              class="bpm-input"
              placeholder="Enter BPM"
              min="40"
              max="220"
              onchange={(e) => {
                const val = parseInt((e.target as HTMLInputElement).value);
                if (val >= 40 && val <= 220) audioState.manualBpm = val;
              }}
            />
          {/if}
        </div>

        <!-- Beat Marker Track -->
        <section class="component-section">
          <div class="section-label">
            <span class="badge">BeatMarkerTrack</span>
            <span class="desc">Auto-generated beat markers from BPM, with custom marker support</span>
          </div>
          <BeatMarkerTrack
            duration={audioState.duration}
            bpm={audioState.manualBpm ?? audioState.detectedBpm}
            {currentTime}
            beatMarkers={audioState.globalBeatMarkers}
            onAddMarker={addBeatMarker}
            onRemoveMarker={removeBeatMarker}
          />
        </section>

        <!-- Tempo Region Track -->
        <section class="component-section">
          <div class="section-label">
            <span class="badge">TempoRegionTrack</span>
            <span class="desc">Variable BPM regions with color-coded visualization</span>
          </div>
          <TempoRegionTrack
            duration={audioState.duration}
            {currentTime}
            baseBpm={audioState.manualBpm ?? audioState.detectedBpm}
            tempoRegions={audioState.tempoRegions}
            onAddRegion={addTempoRegion}
            onRemoveRegion={removeTempoRegion}
            onUpdateRegion={updateTempoRegion}
          />
        </section>

        <!-- Manual Beat Tapper -->
        <section class="component-section">
          <div class="section-label">
            <span class="badge">ManualBeatTapper</span>
            <span class="desc">Tap along with audio to mark beats manually</span>
          </div>
          <ManualBeatTapper
            {currentTime}
            duration={audioState.duration}
            {isPlaying}
            beatMarkers={audioState.globalBeatMarkers}
            onAddMarker={addBeatMarker}
            onRemoveMarker={removeBeatMarker}
            onClearAll={() => {
              audioState.globalBeatMarkers = [];
            }}
          />
        </section>
      </div>
    {/if}
  </div>
</div>

<style>
  .audio-toolkit-lab {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 24px;
    overflow-y: auto;
  }

  .lab-header {
    margin-bottom: 1.5rem;
  }

  .lab-header h1 {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin: 0 0 0.5rem 0;
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--theme-text, #fff);
  }

  .lab-header h1 i {
    color: rgba(139, 92, 246, 0.8);
  }

  .subtitle {
    margin: 0;
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    line-height: 1.5;
  }

  .lab-content {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  /* Drop zone */
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
    transition: all 200ms ease;
    min-height: 300px;
  }

  .drop-zone:hover,
  .drop-zone.dragging {
    border-color: rgba(139, 92, 246, 0.5);
    background: rgba(139, 92, 246, 0.05);
  }

  .drop-zone:focus-visible {
    outline: 2px solid rgba(139, 92, 246, 0.8);
    outline-offset: 2px;
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
    color: var(--theme-text, #fff);
  }

  .drop-zone p {
    margin: 0;
    font-size: 0.9rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  .formats {
    margin-top: 1rem !important;
    font-size: 0.75rem !important;
    color: rgba(255, 255, 255, 0.75) !important;
  }

  /* Timeline container */
  .timeline-container {
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
    color: var(--theme-text, #fff);
  }

  .file-info i {
    color: rgba(139, 92, 246, 0.8);
  }

  .file-name {
    font-weight: 500;
  }

  .duration {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
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
    transition: all 200ms ease;
  }

  .clear-btn:hover {
    background: rgba(239, 68, 68, 0.2);
    border-color: rgba(239, 68, 68, 0.3);
  }

  .clear-btn:focus-visible {
    outline: 2px solid rgba(248, 113, 113, 0.8);
    outline-offset: 2px;
  }

  /* Component sections with labels */
  .component-section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .section-label {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .badge {
    padding: 0.2rem 0.5rem;
    background: rgba(139, 92, 246, 0.2);
    border: 1px solid rgba(139, 92, 246, 0.3);
    border-radius: 4px;
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    font-family: monospace;
    color: rgba(167, 139, 250, 0.95);
  }

  .desc {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  /* BPM controls */
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
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-weight: 500;
  }

  .analyzing {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: rgba(251, 191, 36, 0.9);
    flex: 1;
  }

  .progress-bar {
    flex: 1;
    height: 4px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 2px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: rgba(251, 191, 36, 0.8);
    border-radius: 2px;
    transition: width 200ms ease;
  }

  .error {
    color: rgba(248, 113, 113, 0.9);
    font-size: 0.85rem;
  }

  .bpm-input {
    width: 70px;
    padding: 0.35rem 0.5rem;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
    border-radius: 6px;
    color: rgba(167, 139, 250, 1);
    font-size: 0.95rem;
    font-weight: 600;
    text-align: center;
  }

  .bpm-input:focus {
    outline: none;
    border-color: rgba(139, 92, 246, 0.5);
  }

  .source {
    color: rgba(255, 255, 255, 0.75);
    font-size: 0.8rem;
  }

  @media (prefers-reduced-motion: reduce) {
    .drop-zone,
    .clear-btn,
    .progress-fill {
      transition: none;
    }
  }
</style>
