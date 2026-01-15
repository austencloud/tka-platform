<!--
  LibraryModeInfo.svelte

  Displays creator attribution for sequences in Library mode.
  Shows the creator's display name with a subtle "by" prefix.
-->
<script lang="ts">
  import { fade } from "svelte/transition";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

  let {
    sequence,
  }: {
    sequence: SequenceData | null;
  } = $props();

  let creatorName = $derived(
    sequence?.ownerDisplayName || sequence?.author || "Unknown"
  );

  let sequenceName = $derived(sequence?.displayName || null);
</script>

{#if sequence}
  <div class="library-info" in:fade={{ duration: 200 }}>
    {#if sequenceName}
      <span class="sequence-name">{sequenceName}</span>
      <span class="separator">·</span>
    {/if}
    <span class="creator">by {creatorName}</span>
  </div>
{/if}

<style>
  .library-info {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-size: 0.875rem;
    color: rgba(255, 255, 255, 0.6);
    min-height: 24px;
  }

  .sequence-name {
    font-weight: 500;
    color: rgba(255, 255, 255, 0.8);
  }

  .separator {
    color: rgba(255, 255, 255, 0.3);
  }

  .creator {
    font-style: italic;
  }

  @media (max-width: 600px) {
    .library-info {
      font-size: 0.8125rem;
    }
  }
</style>
