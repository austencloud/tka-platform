<!-- VersionCard - Clickable card showing a single version's summary -->
<script lang="ts">
  import type {
    AppVersion,
    ChangelogEntry,
  } from "$lib/shared/versioning/domain/models/version-models";
  import { PRE_RELEASE_VERSION } from "$lib/shared/versioning/domain/models/version-models";

  const { version, onclick } = $props<{
    version: AppVersion;
    onclick: () => void;
  }>();

  // Check if we have curated changelog entries
  const hasChangelog = $derived(
    version.changelogEntries && version.changelogEntries.length > 0
  );

  // Group changelog entries by category for summary
  const groupedChangelog = $derived.by(() => {
    if (!version.changelogEntries)
      return { fixed: [], added: [], improved: [] };
    const fixed = version.changelogEntries.filter(
      (e: ChangelogEntry) => e.category === "fixed"
    );
    const added = version.changelogEntries.filter(
      (e: ChangelogEntry) => e.category === "added"
    );
    const improved = version.changelogEntries.filter(
      (e: ChangelogEntry) => e.category === "improved"
    );
    return { fixed, added, improved };
  });

  // Format date
  const formattedDate = $derived(
    version.releasedAt.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  );

  // Check if pre-release
  const isPreRelease = $derived(version.version === PRE_RELEASE_VERSION);

  // Summary text based on changelog entries if available
  const summary = $derived.by(() => {
    if (hasChangelog) {
      const parts: string[] = [];
      if (groupedChangelog.fixed.length > 0) {
        parts.push(
          `${groupedChangelog.fixed.length} fix${groupedChangelog.fixed.length === 1 ? "" : "es"}`
        );
      }
      if (groupedChangelog.added.length > 0) {
        parts.push(
          `${groupedChangelog.added.length} new feature${groupedChangelog.added.length === 1 ? "" : "s"}`
        );
      }
      if (groupedChangelog.improved.length > 0) {
        parts.push(
          `${groupedChangelog.improved.length} improvement${groupedChangelog.improved.length === 1 ? "" : "s"}`
        );
      }
      return parts.join(", ") || "Updates included";
    }
    // Fall back to feedback summary
    const parts: string[] = [];
    if (version.feedbackSummary.bugs > 0) {
      parts.push(
        `${version.feedbackSummary.bugs} bug${version.feedbackSummary.bugs === 1 ? "" : "s"} fixed`
      );
    }
    if (version.feedbackSummary.features > 0) {
      parts.push(
        `${version.feedbackSummary.features} feature${version.feedbackSummary.features === 1 ? "" : "s"} added`
      );
    }
    if (version.feedbackSummary.general > 0) {
      parts.push(
        `${version.feedbackSummary.general} improvement${version.feedbackSummary.general === 1 ? "" : "s"}`
      );
    }
    return parts.join(", ") || "No changes recorded";
  });

  // Total changes count
  const totalChanges = $derived(
    hasChangelog && version.changelogEntries
      ? version.changelogEntries.length
      : version.feedbackCount
  );
</script>

<button
  type="button"
  class="version-card"
  class:pre-release={isPreRelease}
  {onclick}
>
  <div class="version-info">
    <span class="version-number">
      {#if isPreRelease}
        Pre-Release
      {:else}
        v{version.version}
      {/if}
    </span>
    <span class="version-date">{formattedDate}</span>
  </div>

  <div class="version-summary">
    <span class="summary-text">{summary}</span>
    <span class="total-count">
      {totalChanges}
      {hasChangelog ? "change" : "resolved item"}{totalChanges === 1 ? "" : "s"}
    </span>
  </div>

  <div class="arrow-icon">
    <i class="fas fa-chevron-right" aria-hidden="true"></i>
  </div>
</button>

<style>
  .version-card {
    display: flex;
    align-items: center;
    gap: 16px;
    width: 100%;
    padding: 16px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 12px;
    cursor: pointer;
    text-align: left;
    transition: all var(--duration-normal) ease;
  }

  .version-card:hover {
    background: var(--theme-card-hover-bg);
    border-color: color-mix(
      in srgb,
      var(--theme-accent, var(--theme-accent-strong)) 30%,
      transparent
    );
  }

  .version-card:active {
    transform: scale(0.99);
  }

  .version-card.pre-release {
    opacity: 0.7;
  }

  .version-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 100px;
  }

  .version-number {
    font-size: var(--font-size-base);
    font-weight: 700;
    color: var(--theme-accent);
  }

  .pre-release .version-number {
    color: var(--theme-text-dim, var(--theme-text-dim));
    font-size: var(--font-size-sm);
  }

  .version-date {
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim, var(--theme-text-dim));
  }

  .version-summary {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .summary-text {
    font-size: var(--font-size-sm);
    color: var(--theme-text);
  }

  .total-count {
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim);
  }

  .arrow-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    color: var(--theme-text-dim);
    transition:
      color 0.2s ease,
      transform 0.2s ease;
  }

  .version-card:hover .arrow-icon {
    color: var(--theme-accent);
    transform: translateX(2px);
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .version-card,
    .arrow-icon {
      transition: none;
    }

    .version-card:active {
      transform: none;
    }
  }
</style>
