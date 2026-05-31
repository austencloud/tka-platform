<!--
  LibraryModeInfo.svelte

  Displays creator attribution for sequences in Library mode.
  Shows the creator's display name with a subtle "by" prefix.
-->
<script lang="ts">
  import { fade } from "svelte/transition";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

  let {
    sequence,
  }: {
    sequence: SequenceData | null;
  } = $props();

  let sequenceName = $derived(sequence?.displayName || null);
</script>

{#if sequence && sequenceName}
  <div class="library-info" in:fade={{ duration: 200 }}>
    <span class="sequence-name">{sequenceName}</span>
  </div>
{/if}

<style>
  .library-info {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.875rem;
    min-height: 24px;
  }

  .sequence-name {
    font-weight: 500;
    color: rgba(255, 255, 255, 0.8);
  }

  @media (max-width: 600px) {
    .library-info {
      font-size: 0.8125rem;
    }
  }
</style>
