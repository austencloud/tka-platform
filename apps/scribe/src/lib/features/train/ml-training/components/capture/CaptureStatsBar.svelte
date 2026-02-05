<!--
  CaptureStatsBar.svelte

  Displays capture statistics: time, frames, FPS, and prop type.
-->
<script lang="ts">
  import type { PropType } from "../../domain/models";

  interface Props {
    formattedTime: string;
    frameCount: number;
    fps: number;
    propType: PropType;
  }

  let { formattedTime, frameCount, fps, propType }: Props = $props();
</script>

<div class="stats-bar">
  <div class="stat">
    <span class="value">{formattedTime}</span>
    <span class="label">Time</span>
  </div>
  <div class="stat">
    <span class="value">{frameCount}</span>
    <span class="label">Frames</span>
  </div>
  <div class="stat">
    <span class="value">{fps}</span>
    <span class="label">FPS</span>
  </div>
  <div class="stat">
    <span class="value">{propType}</span>
    <span class="label">Prop</span>
  </div>
</div>

<style>
  .stats-bar {
    display: flex;
    justify-content: center;
    gap: 2rem;
    padding: 0.75rem 1rem;
    background: var(--theme-panel-bg);
    border: 1px solid var(--theme-stroke);
    box-shadow: var(--theme-panel-shadow, 0 12px 28px rgba(0, 0, 0, 0.35));
    backdrop-filter: blur(24px) saturate(180%);
    -webkit-backdrop-filter: blur(24px) saturate(180%);
    border-radius: 12px;
    margin-top: 0.75rem;
  }

  .stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.2rem;
  }

  .stat .value {
    font-size: 1.25rem;
    font-weight: 700;
    font-family: "JetBrains Mono", monospace;
  }

  .stat .label {
    font-size: 0.7rem;
    opacity: 0.6;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  @media (min-width: 1024px) {
    .stats-bar {
      flex-direction: row;
      justify-content: space-between;
      padding: 1rem 1.5rem;
    }
  }
</style>
