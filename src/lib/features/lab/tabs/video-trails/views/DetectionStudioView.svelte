<script lang="ts">
  import { getVideoTrailsContext } from "../context/video-trails-context";

  const { state } = getVideoTrailsContext();
</script>

<div class="studio-placeholder">
  <i class="fas fa-crosshairs" aria-hidden="true"></i>
  <h2>Detection Studio</h2>
  <p>Frame-by-frame correction coming in Phase 3.</p>
  {#if state.correctionCount > 0}
    <p class="stat">{state.correctionCount} corrections recorded</p>
  {/if}
</div>

<style>
  .studio-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 12px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
  }
  .studio-placeholder i { font-size: 48px; opacity: 0.3; }
  .studio-placeholder h2 { margin: 0; font-size: 20px; color: var(--theme-text, #fff); }
  .studio-placeholder p { margin: 0; font-size: var(--font-size-min, 14px); }
  .stat { color: var(--theme-accent, #f43f5e); }
</style>
