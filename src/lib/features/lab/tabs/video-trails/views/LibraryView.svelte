<script lang="ts">
  import { getVideoTrailsContext } from "../context/video-trails-context";

  const { state: trailsState } = getVideoTrailsContext();
</script>

<div class="library-placeholder">
  <i class="fas fa-folder-open" aria-hidden="true"></i>
  <h2>Video Library</h2>
  <p>Project management coming in Phase 5.</p>
</div>

<style>
  .library-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 12px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
  }
  .library-placeholder i { font-size: 48px; opacity: 0.3; }
  .library-placeholder h2 { margin: 0; font-size: 20px; color: var(--theme-text, #fff); }
  .library-placeholder p { margin: 0; font-size: var(--font-size-min, 14px); }
</style>
