<!--
  EffortLabModule.svelte

  Effort Lab: compare 7 Laban-inspired movement qualities side by side.
  Each canvas plays the same sequence with a different easing function applied
  to the interpolation progress, revealing how effort qualities affect
  the visual character of prop animation.
-->
<script lang="ts">
  import EffortLabPlaybackHost from "./components/EffortLabPlaybackHost.svelte";
</script>

<div class="effort-lab">
  <header class="effort-lab-header">
    <h2 class="effort-lab-title">Effort Lab</h2>
    <span class="experiment-badge">Experimental</span>
  </header>

  <EffortLabPlaybackHost />
</div>

<style>
  .effort-lab {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
  }

  .effort-lab-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: var(--spacing-sm, 8px) var(--spacing-md, 16px);
    flex-shrink: 0;
  }

  .effort-lab-title {
    font-size: var(--font-size-lg, 18px);
    font-weight: 600;
    color: var(--theme-text, #ffffff);
    margin: 0;
  }

  .experiment-badge {
    font-size: var(--font-size-xs, 10px);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: 2px 8px;
    border-radius: 4px;
    background: rgba(139, 92, 246, 0.2);
    color: #a78bfa;
    border: 1px solid rgba(139, 92, 246, 0.3);
  }
</style>
