<!--
  ActPlayer.svelte

  Inline docked player for the whole choreo sheet as one "act" sequence. Composes
  the existing AnimationPlayer (owns transport + BPM + progress bar) with the write
  feature's music player (getMusicPlayer service + MusicPlayer.svelte UI). v1 sync:
  BPM is the shared tempo; the two transports are independent (zero-drift audio-clock
  sync is a deferred v2 — see spec 2026-07-01-choreo-act-playback-design.md).
-->
<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import AnimationPlayer from "$lib/shared/sequence-viewer/components/AnimationPlayer.svelte";
  import MusicPlayer from "../MusicPlayer.svelte";
  import { getMusicPlayer } from "../../get-music-player";
  import {
    createDefaultMusicPlayerState,
    type MusicPlayerState,
  } from "../../domain/types/write";

  let { sequence, onClose }: { sequence: SequenceData | null; onClose?: () => void } = $props();

  const music = getMusicPlayer();
  let musicState = $state<MusicPlayerState>(createDefaultMusicPlayerState());
  let objectUrl: string | null = null;

  onMount(() => {
    music.onError((m) => (musicState = { ...musicState, error: m, isLoading: false }));
    music.onLoadedMetadata(
      (durMs) => (musicState = { ...musicState, duration: durMs, isLoaded: true, isLoading: false }),
    );
    music.onTimeUpdate(
      (curMs, durMs) =>
        (musicState = { ...musicState, currentTime: curMs, duration: durMs || musicState.duration }),
    );
    music.onEnded(() => (musicState = { ...musicState, isPlaying: false, currentTime: 0 }));
  });

  onDestroy(() => {
    music.onError(null);
    music.onTimeUpdate(null);
    music.onLoadedMetadata(null);
    music.onEnded(null);
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  });

  async function onFile(e: Event) {
    const file = (e.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(file);
    musicState = {
      ...musicState,
      isLoading: true,
      isLoaded: false,
      error: null,
      filename: file.name,
      currentTime: 0,
    };
    await music.load(objectUrl, file.name);
  }

  async function playMusic() {
    await music.playLoaded();
    musicState = { ...musicState, isPlaying: true };
  }
  async function pauseMusic() {
    await music.pause();
    musicState = { ...musicState, isPlaying: false };
  }
  async function stopMusic() {
    await music.stop();
    musicState = { ...musicState, isPlaying: false, currentTime: 0 };
  }
  function seekMusic(ms: number) {
    music.seek(ms);
    musicState = { ...musicState, currentTime: ms };
  }
</script>

<aside class="act-player" aria-label="Play act">
  <div class="dock-head">
    <span class="dock-title">Play act</span>
    <button type="button" class="dock-close" aria-label="Close player" onclick={() => onClose?.()}>
      <i class="fa-solid fa-xmark" aria-hidden="true"></i>
    </button>
  </div>

  {#if sequence}
    <div class="player-host">
      <AnimationPlayer
        {sequence}
        autoPlay={false}
        showControls={true}
        controlsLevel="full"
        layout="vertical"
        tapToToggle={true}
      />
    </div>
    <div class="music-host">
      <label class="load-music">
        <i class="fa-solid fa-music" aria-hidden="true"></i>
        {musicState.filename ? "Change music" : "Load music"}
        <input type="file" accept="audio/*" onchange={onFile} hidden />
      </label>
      <MusicPlayer
        playerState={musicState}
        onPlayRequested={playMusic}
        onPauseRequested={pauseMusic}
        onStopRequested={stopMusic}
        onSeekRequested={seekMusic}
      />
    </div>
  {:else}
    <p class="empty">Add sequences to play the act.</p>
  {/if}
</aside>

<style>
  .act-player {
    flex-shrink: 0;
    width: min(460px, 42vw);
    display: flex;
    flex-direction: column;
    min-height: 0;
    background: var(--theme-panel-bg, #14141c);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: 8px;
    overflow: hidden;
  }

  .dock-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    flex-shrink: 0;
  }

  .dock-title {
    font-size: var(--font-size-sm, 0.875rem);
    font-weight: 600;
    color: var(--theme-text, #fff);
  }

  .dock-close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--min-touch-target, 44px);
    height: var(--min-touch-target, 44px);
    background: none;
    border: none;
    border-radius: 6px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    cursor: pointer;
  }

  .dock-close:hover {
    background: var(--theme-card-bg-hover, rgba(255, 255, 255, 0.1));
    color: var(--theme-text, #fff);
  }

  .player-host {
    flex: 1;
    min-height: 280px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .music-host {
    flex-shrink: 0;
    padding: var(--spacing-sm) var(--spacing-md) var(--spacing-md);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .load-music {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-xs);
    min-height: var(--min-touch-target, 44px);
    padding: 0 var(--spacing-md);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: 8px;
    color: var(--theme-text, #fff);
    font-size: var(--font-size-sm, 0.875rem);
    cursor: pointer;
    align-self: flex-start;
  }

  .load-music:hover {
    background: var(--theme-card-bg-hover, rgba(255, 255, 255, 0.1));
  }

  .empty {
    text-align: center;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-sm, 0.875rem);
    margin: var(--spacing-md);
  }

  @media (max-width: 900px) {
    .act-player {
      width: 100%;
    }
  }
</style>
