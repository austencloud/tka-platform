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
    background: #1c1012;
    border-left: 3px solid #ef4444;
    color: #fca5a5;
    padding: 0.75rem 1rem;
    border-radius: 6px;
    margin-bottom: 1rem;
    font-size: 0.875rem;
  }
</style>
