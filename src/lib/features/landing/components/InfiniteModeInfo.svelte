<!--
  InfiniteModeInfo.svelte

  Displays information about generated LOOP sequences in Infinite mode.
  Shows the LOOP type, timestamp, and a "First rendering" badge that fades out.
-->
<script lang="ts">
  import { fade, fly } from "svelte/transition";
  import { t } from "$lib/shared/i18n/i18n.svelte";
  import type { GeneratedSequenceInfo } from "../domain/models/spinner-models";
  import {
    LOOPType,
    Period,
    LOOP_TYPE_LABELS,
  } from "$lib/shared/foundation/domain/models/generation/circular-models";

  let {
    sequenceInfo,
    showBadge = true,
  }: {
    sequenceInfo: GeneratedSequenceInfo | null;
    showBadge?: boolean;
  } = $props();

  // Format timestamp as "Jan 14 · 4:12 PM"
  function formatTimestamp(date: Date): string {
    const dateStr = date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    const timeStr = date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    return `${dateStr} · ${timeStr}`;
  }

  // Get human-readable LOOP type label
  function getLoopLabel(loopType: LOOPType): string {
    return LOOP_TYPE_LABELS[loopType] || loopType;
  }

  // Get period description
  function getPeriodLabel(period: Period): string {
    return period === Period.QUARTERED ? "Quartered" : "Halved";
  }

  // Get a color for the LOOP type badge
  function getLoopColor(loopType: LOOPType): string {
    const colors: Partial<Record<LOOPType, string>> = {
      [LOOPType.ROTATED]: "#6366f1", // Indigo
      [LOOPType.MIRRORED]: "#8b5cf6", // Purple
      [LOOPType.SWAPPED]: "#ec4899", // Pink
      [LOOPType.INVERTED]: "#f59e0b", // Amber
      [LOOPType.ROTATED_SWAPPED]: "#10b981", // Emerald
      [LOOPType.MIRRORED_SWAPPED]: "#06b6d4", // Cyan
      [LOOPType.ROTATED_INVERTED]: "#f97316", // Orange
      [LOOPType.MIRRORED_INVERTED]: "#a855f7", // Violet
      [LOOPType.MIRRORED_ROTATED]: "#14b8a6", // Teal
      [LOOPType.SWAPPED_INVERTED]: "#ef4444", // Red
      [LOOPType.MIRRORED_INVERTED_ROTATED]: "#84cc16", // Lime
    };
    return colors[loopType] || "#6366f1";
  }

  // Honor prefers-reduced-motion — gates the JS fade/fly transition durations
  // below (a CSS @media block alone can't stop Svelte's JS-driven transitions).
  let reduceMotion = $state(
    typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  $effect(() => {
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    )
      return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e: MediaQueryListEvent) => {
      reduceMotion = e.matches;
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  });

  // Track badge visibility with auto-hide after 3 seconds
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
      }, 3000);
    }

    return () => {
      if (badgeTimeout) {
        clearTimeout(badgeTimeout);
      }
    };
  });

  // Derived values for display
  let loopLabel = $derived(
    sequenceInfo?.settings ? getLoopLabel(sequenceInfo.settings.loopType) : ""
  );
  let sliceLabel = $derived(
    sequenceInfo?.settings ? getPeriodLabel(sequenceInfo.settings.period) : ""
  );
  let loopColor = $derived(
    sequenceInfo?.settings
      ? getLoopColor(sequenceInfo.settings.loopType)
      : "#6366f1"
  );
  let totalSteps = $derived(sequenceInfo?.settings?.totalSteps ?? 0);
</script>

{#if sequenceInfo}
  <div class="infinite-info" in:fade={{ duration: reduceMotion ? 0 : 200 }}>
    <!-- LOOP Type Badge -->
    <div class="loop-info">
      {#key sequenceInfo.generatedAt.getTime()}
        <span
          class="loop-badge"
          style="--loop-color: {loopColor}"
          in:fly={{
            y: reduceMotion ? 0 : -10,
            duration: reduceMotion ? 0 : 300,
          }}
        >
          {loopLabel}
        </span>
      {/key}
      <span class="loop-details">
        {sliceLabel} · {t("landing_infinite_steps", { count: totalSteps })}
      </span>
    </div>

    <!-- First Rendering Badge: the slot stays in flow and only opacity
         changes, so the timed hide never moves the rows around it. -->
    <span
      class="first-rendering-badge"
      class:visible={badgeVisible}
      aria-hidden={!badgeVisible}
    >
      {t("landing_infinite_first_rendering")}
    </span>

    <!-- Timestamp -->
    <span class="timestamp">
      {t("landing_infinite_generated_at", {
        timestamp: formatTimestamp(sequenceInfo.generatedAt),
      })}
    </span>
  </div>
{/if}

<style>
  .infinite-info {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }

  .loop-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .loop-badge {
    display: inline-flex;
    align-items: center;
    padding: 0.375rem 0.875rem;
    background: color-mix(in srgb, var(--loop-color) 20%, transparent);
    border: 1px solid color-mix(in srgb, var(--loop-color) 40%, transparent);
    border-radius: 1.25rem;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--loop-color);
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .loop-details {
    font-size: 0.8125rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  .first-rendering-badge {
    display: inline-flex;
    align-items: center;
    opacity: 0;
    transition: opacity 200ms ease;
    padding: 0.25rem 0.75rem;
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--color-success, #50c878) 20%, transparent),
      color-mix(in srgb, var(--color-success, #50c878) 15%, transparent)
    );
    border: 1px solid
      color-mix(in srgb, var(--color-success, #50c878) 30%, transparent);
    border-radius: 1.25rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-success, #50c878);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .first-rendering-badge.visible {
    opacity: 1;
  }

  @media (prefers-reduced-motion: reduce) {
    .first-rendering-badge {
      transition: none;
    }
  }

  .timestamp {
    font-size: 0.8125rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
  }

  @media (max-width: 600px) {
    .infinite-info {
      gap: 0.375rem;
    }

    .loop-info {
      flex-direction: column;
      gap: 0.25rem;
    }

    .loop-badge {
      font-size: 0.8125rem;
      padding: 0.3125rem 0.75rem;
    }

    .loop-details {
      font-size: 0.75rem;
    }

    .first-rendering-badge {
      font-size: var(--font-size-compact, 0.75rem);
      padding: 0.1875rem 0.625rem;
    }

    .timestamp {
      font-size: 0.75rem;
    }
  }

  @media (min-width: 700px) and (max-height: 600px) {
    .infinite-info {
      flex-direction: row;
      justify-content: center;
      gap: 0.75rem;
    }

    .loop-info {
      gap: 0.5rem;
    }
  }

</style>
