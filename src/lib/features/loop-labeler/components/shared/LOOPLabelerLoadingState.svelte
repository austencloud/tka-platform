<!--
  LOOP Labeler Loading State

  Full-screen loading spinner shown during initialization.
-->
<script lang="ts">
  // No props needed - purely presentational
  import ProgressRing from "$lib/shared/components/loading/ProgressRing.svelte";
</script>

<div class="loading" role="status" aria-live="polite" aria-busy="true">
  <ProgressRing percent={-1} size={32} strokeWidth={3} />
  <p>Loading LOOP Labeler...</p>
</div>

<style>
  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-lg);
    height: 100vh;
    font-size: var(--font-size-lg);
    color: var(--muted);
  }
</style>
