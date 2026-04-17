<script lang="ts">
  /**
   * ViewerTransportBar
   *
   * Always-visible bottom transport bar for the 3D viewer.
   * Auto-hides after ~2s idle; reappears on mouse/keyboard input.
   *
   * Wired to the primary performer's PlaybackState via viewer-3d context.
   * The 3D playback API uses:
   *   - togglePlay()    (spec calls it togglePlayPause)
   *   - setProgress()   (spec calls it seekRatio)
   *   - loop setter     (spec calls it toggleLoop — we flip the boolean)
   */

  import { onMount } from "svelte";
  import { getViewer3DContext } from "$lib/shared/3d/context/viewer-3d-context";

  const viewer = getViewer3DContext();

  // Primary performer — same derivation used by Viewer3DCanvas
  const avatar = $derived(viewer.performerManager.performers[0] ?? null);

  // ── Derived transport values ─────────────────────────────────────────────

  /** progress ∈ [0,1] — 0 when no avatar */
  const progress = $derived(avatar?.progress ?? 0);

  /** total beats in the loaded sequence */
  const totalSteps = $derived(avatar?.totalSteps ?? 0);

  /** playback speed in cycles/second (1 = 1 full sequence per second) */
  const speed = $derived(avatar?.speed ?? 1);

  /**
   * Total duration in seconds.
   * speed is cycles/sec, so duration = 1/speed. If speed is 0, clamp to 0.
   */
  const totalSec = $derived(speed > 0 ? 1 / speed : 0);

  /** Elapsed seconds */
  const currentSec = $derived(totalSec * progress);

  function formatTime(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  const currentTimeLabel = $derived(formatTime(currentSec));
  const totalTimeLabel = $derived(formatTime(totalSec));

  /**
   * Beat marker positions as fractions of [0,1].
   * One tick per beat boundary (excluding 0 and 1 themselves).
   */
  const beatMarkers = $derived(
    totalSteps > 1
      ? Array.from({ length: totalSteps - 1 }, (_, i) => (i + 1) / totalSteps)
      : ([] as number[])
  );

  // ── Auto-hide ────────────────────────────────────────────────────────────

  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  let visible = $state(true);

  function ping() {
    visible = true;
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      visible = false;
    }, 2000);
  }

  onMount(() => {
    const handler = () => ping();
    window.addEventListener("mousemove", handler);
    window.addEventListener("keydown", handler);
    ping();
    return () => {
      window.removeEventListener("mousemove", handler);
      window.removeEventListener("keydown", handler);
      if (idleTimer) clearTimeout(idleTimer);
    };
  });

  // ── Scrubber ─────────────────────────────────────────────────────────────

  function onScrub(e: MouseEvent) {
    if (!avatar) return;
    const el = e.currentTarget as HTMLDivElement;
    const rect = el.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    avatar.setProgress(Math.max(0, Math.min(1, ratio)));
  }

  // ── Loop toggle ──────────────────────────────────────────────────────────

  function toggleLoop() {
    if (!avatar) return;
    avatar.loop = !avatar.loop;
  }
</script>

{#if visible && avatar}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="transport" role="group" aria-label="Playback transport">
    <button
      class="transport-play"
      onclick={() => avatar.togglePlay()}
      aria-label={avatar.isPlaying ? "Pause" : "Play"}
    >
      <i class="fas {avatar.isPlaying ? 'fa-pause' : 'fa-play'}"></i>
    </button>

    <span class="transport-time">
      {currentTimeLabel} / {totalTimeLabel}
    </span>

    <div
      class="transport-scrubber"
      onclick={onScrub}
      role="slider"
      tabindex="0"
      aria-label="Playback progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
    >
      <div class="fill" style:width="{progress * 100}%"></div>
      {#each beatMarkers as pct (pct)}
        <div class="beat-marker" style:left="{pct * 100}%"></div>
      {/each}
      <div class="knob" style:left="{progress * 100}%"></div>
    </div>

    <button
      class="transport-loop"
      aria-pressed={avatar.loop}
      aria-label="Loop {avatar.loop ? 'on' : 'off'}"
      onclick={toggleLoop}
    >
      <i class="fas fa-sync"></i>
    </button>
  </div>
{/if}

<style>
  .transport {
    position: absolute;
    bottom: 18px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 14px;
    background: rgba(20, 22, 32, 0.78);
    backdrop-filter: blur(24px) saturate(150%);
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-radius: 999px;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.55);
    min-width: 520px;
    max-width: 720px;
    z-index: 8;
  }

  .transport-play {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: #4a9eff;
    border: 1px solid color-mix(in srgb, #4a9eff 70%, white);
    color: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    flex-shrink: 0;
    box-shadow: 0 4px 14px color-mix(in srgb, #4a9eff 40%, transparent);
  }

  .transport-time {
    font-size: 11px;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.62);
    font-variant-numeric: tabular-nums;
    min-width: 100px;
    text-align: center;
  }

  .transport-scrubber {
    flex: 1;
    height: 6px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 999px;
    position: relative;
    min-width: 200px;
    cursor: pointer;
  }

  .transport-scrubber .fill {
    position: absolute;
    left: 0;
    top: 0;
    height: 100%;
    background: #4a9eff;
    border-radius: 999px;
  }

  .transport-scrubber .knob {
    position: absolute;
    top: 50%;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: white;
    transform: translate(-50%, -50%);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.6);
  }

  .beat-marker {
    position: absolute;
    top: -2px;
    width: 2px;
    height: 10px;
    background: rgba(255, 255, 255, 0.25);
    border-radius: 1px;
    transform: translateX(-50%);
  }

  .transport-loop {
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    border-radius: 50%;
    background: color-mix(in srgb, #4a9eff 22%, transparent);
    border: 1px solid color-mix(in srgb, #4a9eff 50%, transparent);
    color: #8fc3ff;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
  }

  .transport-loop[aria-pressed="false"] {
    background: transparent;
    color: rgba(255, 255, 255, 0.4);
    border-color: rgba(255, 255, 255, 0.12);
  }
</style>
