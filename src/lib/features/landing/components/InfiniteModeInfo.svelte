<!--
  InfiniteModeInfo.svelte

  Displays information about generated sequences in Infinite mode.
  Shows birth timestamp and a "First rendering" badge that fades out.
-->
<script lang="ts">
  import { fade } from "svelte/transition";
  import type { GeneratedSequenceInfo } from "../domain/models/spinner-models";

  let {
    sequenceInfo,
    showBadge = true,
  }: {
    sequenceInfo: GeneratedSequenceInfo | null;
    showBadge?: boolean;
  } = $props();

  // Format timestamp as "Jan 14, 2026 · 4:12 PM"
  function formatTimestamp(date: Date): string {
    const dateStr = date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const timeStr = date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    return `${dateStr} · ${timeStr}`;
  }

  // Track badge visibility with auto-hide after 2 seconds
  let badgeVisible = $state(false);
  let badgeTimeout: ReturnType<typeof setTimeout> | null = null;

  // Show badge when new sequence arrives
  $effect(() => {
    if (sequenceInfo && showBadge) {
      badgeVisible = true;

      if (badgeTimeout) {
        clearTimeout(badgeTimeout);
      }

      badgeTimeout = setTimeout(() => {
        badgeVisible = false;
      }, 2500);
    }

    return () => {
      if (badgeTimeout) {
        clearTimeout(badgeTimeout);
      }
    };
  });
</script>

{#if sequenceInfo}
  <div class="infinite-info" in:fade={{ duration: 200 }}>
    {#if badgeVisible}
      <span class="first-rendering-badge" in:fade out:fade={{ delay: 200 }}>
        First rendering
      </span>
    {/if}
    <span class="timestamp">
      Generated {formatTimestamp(sequenceInfo.generatedAt)}
    </span>
  </div>
{/if}

<style>
  .infinite-info {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    min-height: 48px;
  }

  .first-rendering-badge {
    display: inline-flex;
    align-items: center;
    padding: 4px 12px;
    background: linear-gradient(135deg, rgba(80, 200, 120, 0.2), rgba(52, 211, 153, 0.15));
    border: 1px solid rgba(80, 200, 120, 0.3);
    border-radius: 20px;
    font-size: 0.75rem;
    font-weight: 600;
    color: #50c878;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .timestamp {
    font-size: 0.875rem;
    color: rgba(255, 255, 255, 0.5);
  }

  @media (max-width: 600px) {
    .infinite-info {
      min-height: 40px;
    }

    .first-rendering-badge {
      font-size: 0.6875rem;
      padding: 3px 10px;
    }

    .timestamp {
      font-size: 0.8125rem;
    }
  }
</style>
