<!--
  Gallery Error

  Error message display.
-->
<script lang="ts">
  import { galleryGeneratorState } from "../state/gallery-generator-state.svelte";

  const state = galleryGeneratorState;
</script>

{#if state.error}
  <div class="error-message">{state.error}</div>
{/if}

<style>
  .error-message {
    background: color-mix(in srgb, var(--semantic-error, #ef4444) 12%, transparent);
    border-left: 3px solid var(--semantic-error, #ef4444);
    color: color-mix(in srgb, var(--semantic-error, #ef4444) 60%, white);
    padding: 0.75rem 1rem;
    border-radius: 6px;
    margin-bottom: 1rem;
    font-size: 0.875rem;
  }
</style>
