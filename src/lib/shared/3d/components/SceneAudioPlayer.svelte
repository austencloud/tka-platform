<script lang="ts">
  import { sceneAudioState } from "../state/scene-audio-state.svelte";
  import { getTracksForVariant, getTrackById, getDefaultTrackForVariant, type AudioTrack } from "../audio/ocean-audio-tracks";
  import type { OceanVariant } from "../environments/domain/enums/environment-enums";
  import { settingsService } from "$lib/shared/settings/state/SettingsState.svelte";
  import { BackgroundType } from "@austencloud/backgrounds";
  import { getViewer3DContext } from "../context/viewer-3d-context";

  const viewer3DState = getViewer3DContext();

  const isOcean = $derived.by(() => {
    try {
      return (settingsService as any)?.settings?.backgroundType === BackgroundType.OCEAN;
    } catch {
      return false;
    }
  });

  const oceanVariant = $derived.by((): OceanVariant => {
    return viewer3DState.oceanVariant ?? "abyss";
  });

  let expanded = $state(false);
  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  let idle = $state(false);

  const variantTracks = $derived(getTracksForVariant(oceanVariant));

  const activeTrack = $derived.by((): AudioTrack => {
    const prefId = sceneAudioState.getTrackPreference(oceanVariant);
    if (prefId) {
      const t = getTrackById(prefId);
      if (t && t.variant === oceanVariant) return t;
    }
    return getDefaultTrackForVariant(oceanVariant);
  });

  const variantLabel = $derived(oceanVariant.charAt(0).toUpperCase() + oceanVariant.slice(1));

  function resetIdle() {
    idle = false;
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { idle = true; }, expanded ? 8000 : 5000);
  }

  function toggle() {
    expanded = !expanded;
    resetIdle();
  }

  function selectTrack(track: AudioTrack) {
    sceneAudioState.setTrackPreference(oceanVariant, track.id);
    resetIdle();
  }

  function cycleTrack(dir: 1 | -1) {
    const idx = variantTracks.findIndex((t) => t.id === activeTrack.id);
    const next = (idx + dir + variantTracks.length) % variantTracks.length;
    const nextTrack = variantTracks[next];
    if (nextTrack) sceneAudioState.setTrackPreference(oceanVariant, nextTrack.id);
    resetIdle();
  }

  function togglePlay() {
    sceneAudioState.playing = !sceneAudioState.playing;
    resetIdle();
  }

  function onVolumeInput(e: Event) {
    const val = parseFloat((e.target as HTMLInputElement).value);
    sceneAudioState.masterVolume = val;
    resetIdle();
  }

  $effect(() => {
    if (isOcean) resetIdle();
    return () => { if (idleTimer) clearTimeout(idleTimer); };
  });

  $effect(() => {
    if (sceneAudioState.audioUnlocked && sceneAudioState.playing && !expanded) {
      expanded = true;
      resetIdle();
    }
  });
</script>

{#if isOcean}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="scene-audio-player"
    class:expanded
    class:idle={idle && !expanded}
    onpointerenter={resetIdle}
    onpointermove={resetIdle}
  >
    {#if !expanded}
      <button
        type="button"
        class="collapsed-btn"
        class:playing={sceneAudioState.playing && sceneAudioState.audioUnlocked}
        onclick={toggle}
        aria-label="Open audio player"
      >
        <i class="fa-solid fa-music"></i>
      </button>
    {:else}
      <div class="expanded-card">
        <div class="header">
          <span class="track-label" title="{variantLabel}: {activeTrack.name}">
            <i class="fa-solid fa-music"></i>
            {variantLabel}: {activeTrack.name}
          </span>
          <button type="button" class="close-btn" onclick={toggle} aria-label="Collapse player">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div class="controls">
          <button type="button" class="ctrl-btn" onclick={() => cycleTrack(-1)} aria-label="Previous track">
            <i class="fa-solid fa-backward-step"></i>
          </button>
          <button type="button" class="ctrl-btn play-btn" onclick={togglePlay} aria-label={sceneAudioState.playing ? "Pause" : "Play"}>
            <i class="fa-solid {sceneAudioState.playing ? 'fa-pause' : 'fa-play'}"></i>
          </button>
          <button type="button" class="ctrl-btn" onclick={() => cycleTrack(1)} aria-label="Next track">
            <i class="fa-solid fa-forward-step"></i>
          </button>
          <input
            type="range"
            class="volume-slider"
            min="0"
            max="1"
            step="0.01"
            value={sceneAudioState.masterVolume}
            oninput={onVolumeInput}
            aria-label="Volume"
          />
          <button
            type="button"
            class="ctrl-btn mute-btn"
            onclick={() => sceneAudioState.toggleMute()}
            aria-label={sceneAudioState.muted ? "Unmute" : "Mute"}
          >
            <i class="fa-solid {sceneAudioState.muted ? 'fa-volume-xmark' : 'fa-volume-high'}"></i>
          </button>
        </div>

        <div class="track-list">
          {#each variantTracks as track}
            <button
              type="button"
              class="track-item"
              class:active={track.id === activeTrack.id}
              onclick={() => selectTrack(track)}
            >
              {#if track.id === activeTrack.id}
                <i class="fa-solid fa-caret-right"></i>
              {/if}
              {track.name}
            </button>
          {/each}
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>
  .scene-audio-player {
    position: absolute;
    top: 12px;
    left: 12px;
    z-index: 50;
    transition: opacity 0.3s ease;
  }

  .scene-audio-player.idle {
    opacity: 0.5;
  }

  .scene-audio-player:hover {
    opacity: 1;
  }

  .collapsed-btn {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(18, 18, 24, 0.8);
    backdrop-filter: blur(8px);
    color: rgba(255, 255, 255, 0.7);
    font-size: 14px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }

  .collapsed-btn:hover {
    background: rgba(30, 30, 38, 0.9);
    color: rgba(255, 255, 255, 0.95);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .collapsed-btn.playing {
    animation: pulse-glow 3s ease-in-out infinite;
  }

  @keyframes pulse-glow {
    0%, 100% { box-shadow: 0 0 4px rgba(255, 255, 255, 0.05); }
    50% { box-shadow: 0 0 12px rgba(255, 255, 255, 0.15); }
  }

  .expanded-card {
    width: 200px;
    background: rgba(18, 18, 24, 0.88);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    overflow: hidden;
    animation: card-in 0.2s ease;
  }

  @keyframes card-in {
    from { opacity: 0; transform: scale(0.9); }
    to { opacity: 1; transform: scale(1); }
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 10px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .track-label {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.85);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    min-width: 0;
  }

  .track-label i {
    margin-right: 6px;
    font-size: 10px;
    opacity: 0.6;
  }

  .close-btn {
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.4);
    cursor: pointer;
    padding: 2px 4px;
    font-size: 12px;
    flex-shrink: 0;
    margin-left: 4px;
  }

  .close-btn:hover {
    color: rgba(255, 255, 255, 0.85);
  }

  .controls {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 10px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .ctrl-btn {
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.6);
    cursor: pointer;
    padding: 4px;
    font-size: 12px;
    border-radius: 4px;
    flex-shrink: 0;
  }

  .ctrl-btn:hover {
    color: rgba(255, 255, 255, 0.95);
    background: rgba(255, 255, 255, 0.08);
  }

  .play-btn {
    font-size: 14px;
  }

  .volume-slider {
    flex: 1;
    min-width: 0;
    height: 4px;
    appearance: none;
    background: rgba(255, 255, 255, 0.12);
    border-radius: 2px;
    outline: none;
    cursor: pointer;
  }

  .volume-slider::-webkit-slider-thumb {
    appearance: none;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.7);
    cursor: pointer;
  }

  .volume-slider::-moz-range-thumb {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.7);
    border: none;
    cursor: pointer;
  }

  .mute-btn {
    font-size: 11px;
  }

  .track-list {
    padding: 4px 6px 6px;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .track-item {
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.5);
    font-size: 11px;
    text-align: left;
    padding: 4px 8px;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .track-item:hover {
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.85);
  }

  .track-item.active {
    color: rgba(255, 255, 255, 0.95);
    background: rgba(255, 255, 255, 0.12);
    font-weight: 500;
  }

  .track-item i {
    margin-right: 4px;
    font-size: 10px;
  }
</style>
