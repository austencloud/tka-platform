<!-- src/lib/shared/3d/components/MobileSceneControls.svelte -->
<script lang="ts">
  import BottomSheet from "./controls/BottomSheet.svelte";
  import MobileScenePerformerSheet from "./MobileScenePerformerSheet.svelte";
  import MobileSceneEverythingSheet from "./MobileSceneEverythingSheet.svelte";

  interface Props {
    isPlaying: boolean;
    onPlaybackToggle: () => void;
    onStepForward: () => void;
    onStepBackward: () => void;
  }
  let { isPlaying, onPlaybackToggle, onStepForward, onStepBackward }: Props = $props();

  type Sheet = "performer" | "everything" | null;
  let openSheet = $state<Sheet>(null);
  let playbackVisible = $state(true);

  function toggle(sheet: Exclude<Sheet, null>) {
    openSheet = openSheet === sheet ? null : sheet;
  }
</script>

<!-- Sheets render above everything in the bar -->
<BottomSheet
  open={openSheet === "performer"}
  title="Performer"
  onClose={() => (openSheet = null)}
>
  <MobileScenePerformerSheet />
</BottomSheet>

<BottomSheet
  open={openSheet === "everything"}
  title="Scene & Controls"
  onClose={() => (openSheet = null)}
>
  <MobileSceneEverythingSheet />
</BottomSheet>

<!-- Playback row (toggleable) -->
{#if playbackVisible}
  <div class="playback-row">
    <button class="ctl" onclick={onStepBackward} aria-label="Previous step">
      <i class="fas fa-backward-step"></i>
    </button>
    <button class="ctl play" onclick={onPlaybackToggle} aria-label={isPlaying ? "Pause" : "Play"}>
      <i class="fas {isPlaying ? 'fa-pause' : 'fa-play'}"></i>
    </button>
    <button class="ctl" onclick={onStepForward} aria-label="Next step">
      <i class="fas fa-forward-step"></i>
    </button>
  </div>
{/if}

<!-- FAB row: performer (left), playback toggle (center), everything (right) -->
<div class="fab-row">
  <button
    class="fab"
    class:active={openSheet === "performer"}
    aria-label="Performer controls"
    aria-pressed={openSheet === "performer"}
    onclick={() => toggle("performer")}
  >
    <i class="fas fa-user"></i>
  </button>

  <button
    class="fab toggle"
    aria-label={playbackVisible ? "Hide playback bar" : "Show playback bar"}
    aria-expanded={playbackVisible}
    onclick={() => (playbackVisible = !playbackVisible)}
  >
    <i class="fas {playbackVisible ? 'fa-chevron-down' : 'fa-chevron-up'}"></i>
  </button>

  <button
    class="fab"
    class:active={openSheet === "everything"}
    aria-label="Scene and controls"
    aria-pressed={openSheet === "everything"}
    onclick={() => toggle("everything")}
  >
    <i class="fas fa-sliders"></i>
  </button>
</div>

<style>
  .playback-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
  }
  .fab-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
  }
  .ctl, .fab {
    min-width: 44px;
    min-height: 44px;
    border-radius: 50%;
    background: rgba(20, 22, 32, 0.78);
    backdrop-filter: blur(20px) saturate(140%);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: rgba(255, 255, 255, 0.85);
    font-size: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    padding: 0;
  }
  .ctl.play { min-width: 52px; min-height: 52px; font-size: 18px; background: rgba(255, 255, 255, 0.15); }
  /* Secondary control: visually lighter (smaller icon + dimmed) but the tap
     target stays at the 44px project floor. */
  .fab.toggle { font-size: 13px; opacity: 0.8; }
  .fab.active {
    background: color-mix(in srgb, var(--theme-accent, #4a9eff) 22%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent, #4a9eff) 55%, transparent);
    color: color-mix(in srgb, var(--theme-accent, #4a9eff) 70%, #fff);
  }
  .ctl:active, .fab:active { background: rgba(255, 255, 255, 0.22); }
</style>
