<!--
  WhatsNewModal - Beautiful changelog modal for version updates

  Displays structured changelog data with category cards,
  proper visual hierarchy, and celebration energy.
-->
<script lang="ts">
  import { whatsNewState } from "../state/whats-new-state.svelte";
  import { handleModuleChange } from "$lib/shared/navigation-coordinator/navigation-coordinator.svelte";
  import { navigationState } from "$lib/shared/navigation/state/navigation-state.svelte";
  import { getContributorLoader } from "$lib/shared/feedback/get-contributor-loader";
  import {
    CATEGORY_ICONS,
    CATEGORY_LABELS,
  } from "$lib/shared/versioning/domain/constants/changelog-constants";
  import type { Contributor } from "$lib/shared/versioning/domain/models/contributor-models";
  import type {
    ChangelogCategory,
    ChangelogEntry,
  } from "$lib/shared/versioning/domain/models/version-models";
  import ContributorBadge from "./tabs/release-notes/ContributorBadge.svelte";
  import ChangelogRichText from "./tabs/release-notes/ChangelogRichText.svelte";

  // Category display order and colors
  const CATEGORY_CONFIG: Record<
    ChangelogCategory,
    { order: number; color: string; bgColor: string }
  > = {
    added: {
      order: 1,
      color: "var(--semantic-success)",
      bgColor: "color-mix(in srgb, var(--semantic-success) 12%, transparent)",
    },
    improved: {
      order: 2,
      color: "var(--semantic-info)",
      bgColor: "color-mix(in srgb, var(--semantic-info) 12%, transparent)",
    },
    fixed: {
      order: 3,
      color: "var(--semantic-warning)",
      bgColor: "color-mix(in srgb, var(--semantic-warning) 12%, transparent)",
    },
  };

  // Derived state
  const version = $derived(whatsNewState.version);
  const isOpen = $derived(whatsNewState.isOpen);

  let contributors = $state<Map<string, Contributor>>(new Map());

  $effect(() => {
    if (!version?.contributorIds?.length) {
      contributors = new Map();
      return;
    }
    const loader = getContributorLoader();
    loader.getByIds(version.contributorIds).then((list) => {
      contributors = new Map(list.map((c) => [c.id, c]));
    });
  });

  // Group changelog entries by category
  const groupedChangelog = $derived.by(() => {
    if (!version?.changelogEntries) return [];

    const groups = new Map<ChangelogCategory, ChangelogEntry[]>();

    for (const entry of version.changelogEntries) {
      const existing = groups.get(entry.category) || [];
      existing.push(entry);
      groups.set(entry.category, existing);
    }

    return Array.from(groups.entries())
      .map(([category, entries]) => ({
        category,
        entries,
        ...CATEGORY_CONFIG[category],
      }))
      .sort((a, b) => a.order - b.order);
  });

  // Total count for summary
  const totalChanges = $derived(version?.changelogEntries?.length ?? 0);

  function handleClose() {
    whatsNewState.close();
  }

  function handleBackdropClick() {
    whatsNewState.dismiss();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      whatsNewState.dismiss();
    }
  }

  async function handleViewAllReleases() {
    whatsNewState.close();
    await handleModuleChange("settings", "release-notes");
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen && version}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    class="modal-overlay"
    onclick={handleBackdropClick}
    role="button"
    tabindex="-1"
    aria-label="Close"
  >
    <div
      class="modal-container"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="whats-new-title"
      tabindex="-1"
    >
      <!-- Header -->
      <header class="modal-header">
        <div class="version-badge">
          <i class="fas fa-rocket" aria-hidden="true"></i>
          <span>v{version.version}</span>
        </div>
        <div class="header-text">
          <h1 id="whats-new-title">What's New</h1>
          <p class="subtitle">
            {totalChanges}
            {totalChanges === 1 ? "update" : "updates"} in this release
          </p>
        </div>
        <button
          class="close-btn"
          onclick={handleClose}
          aria-label="Close"
          type="button"
        >
          <i class="fas fa-times" aria-hidden="true"></i>
        </button>
      </header>

      <!-- Body -->
      <div class="modal-body">
        <!-- Category Cards -->
        <div class="category-grid">
          {#each groupedChangelog as group}
            <div
              class="category-card"
              style="--cat-color: {group.color}; --cat-bg: {group.bgColor};"
            >
              <div class="category-header">
                <div class="category-icon">
                  <i
                    class="fas {CATEGORY_ICONS[group.category]}"
                    aria-hidden="true"
                  ></i>
                </div>
                <h3>{CATEGORY_LABELS[group.category]}</h3>
                <span class="category-count">{group.entries.length}</span>
              </div>
              <ul class="category-list">
                {#each group.entries as entry}
                  <li>
                    <ChangelogRichText
                      text={entry.text}
                      onNavigate={handleClose}
                    />
                    {#if entry.contributorIds?.length}
                      <span class="entry-contributors">
                        {#each entry.contributorIds as cid}
                          {@const contrib = contributors.get(cid)}
                          {#if contrib}
                            <ContributorBadge contributor={contrib} />
                          {/if}
                        {/each}
                      </span>
                    {/if}
                  </li>
                {/each}
              </ul>
            </div>
          {/each}
        </div>

        {#if version?.contributorIds?.length && contributors.size > 0}
          <div class="contributors-footer">
            <h4 class="contributors-title">Contributors</h4>
            <div class="contributors-list">
              {#each version.contributorIds as cid}
                {@const contrib = contributors.get(cid)}
                {#if contrib}
                  <ContributorBadge contributor={contrib} size="md" />
                {/if}
              {/each}
            </div>
          </div>
        {/if}

        <!-- Empty state -->
        {#if groupedChangelog.length === 0}
          <div class="empty-state">
            <i class="fas fa-box-open" aria-hidden="true"></i>
            <p>No detailed changelog for this version.</p>
          </div>
        {/if}
      </div>

      <!-- Footer -->
      <footer class="modal-footer">
        <button
          class="footer-btn secondary"
          onclick={handleViewAllReleases}
          type="button"
        >
          <i class="fas fa-history" aria-hidden="true"></i>
          All Releases
        </button>
        <button class="footer-btn primary" onclick={handleClose} type="button">
          <i class="fas fa-check" aria-hidden="true"></i>
          Got it
        </button>
      </footer>
    </div>
  </div>
{/if}

<style>
  /* ============================================================================
     OVERLAY
     ============================================================================ */
  .modal-overlay {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    background: rgba(0, 0, 0, 0.85);
    backdrop-filter: blur(8px);
    z-index: var(--z-modal);
    animation: fadeIn 0.2s ease-out;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  /* ============================================================================
     MODAL CONTAINER
     ============================================================================ */
  .modal-container {
    position: relative;
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: 45rem;
    max-height: calc(100vh - 40px);
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 20px;
    overflow: hidden;
    box-shadow:
      0 24px 80px rgba(0, 0, 0, 0.6),
      0 0 0 1px rgba(255, 255, 255, 0.05) inset;
    animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes slideUp {
    from {
      transform: translateY(24px) scale(0.96);
      opacity: 0;
    }
    to {
      transform: translateY(0) scale(1);
      opacity: 1;
    }
  }

  /* ============================================================================
     HEADER
     ============================================================================ */
  .modal-header {
    position: relative;
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 14px;
    padding: 20px 24px;
    padding-right: 56px;
    background: linear-gradient(
      180deg,
      color-mix(in srgb, var(--theme-accent) 8%, transparent) 0%,
      transparent 100%
    );
    border-bottom: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .version-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    background: linear-gradient(
      135deg,
      var(--theme-accent) 0%,
      color-mix(in srgb, var(--theme-accent) 70%, var(--semantic-info)) 100%
    );
    border-radius: 24px;
    color: white;
    font-size: var(--font-size-sm);
    font-weight: 700;
    letter-spacing: 0.5px;
    box-shadow: 0 4px 16px
      color-mix(in srgb, var(--theme-accent) 30%, transparent);
  }

  .version-badge i {
    font-size: var(--font-size-compact);
  }

  .header-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .modal-header h1 {
    margin: 0;
    font-size: var(--font-size-xl);
    font-weight: 700;
    color: var(--theme-text);
  }

  .subtitle {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--theme-text-dim);
  }

  .close-btn {
    position: absolute;
    top: 16px;
    right: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 10px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    cursor: pointer;
    transition: all 0.2s;
  }

  .close-btn:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    color: var(--theme-text, #ffffff);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  /* ============================================================================
     BODY
     ============================================================================ */
  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 16px;

    /* Modern scrollbar styling */
    scrollbar-width: thin;
    scrollbar-color: color-mix(in srgb, var(--theme-text) 20%, transparent)
      transparent;
  }

  /* Webkit scrollbar for Chrome/Edge/Safari */
  .modal-body::-webkit-scrollbar {
    width: 10px;
  }

  .modal-body::-webkit-scrollbar-track {
    background: transparent;
    border-radius: 10px;
  }

  .modal-body::-webkit-scrollbar-thumb {
    background: color-mix(in srgb, var(--theme-text) 20%, transparent);
    border-radius: 10px;
    border: 2px solid var(--theme-panel-bg);
  }

  .modal-body::-webkit-scrollbar-thumb:hover {
    background: color-mix(in srgb, var(--theme-text) 30%, transparent);
  }

  .modal-body::-webkit-scrollbar-thumb:active {
    background: color-mix(in srgb, var(--theme-text) 40%, transparent);
  }

  /* Category Grid */
  .category-grid {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .category-card {
    padding: 16px;
    background: var(--cat-bg);
    border: 1.5px solid color-mix(in srgb, var(--cat-color) 20%, transparent);
    border-radius: 14px;
    transition: all 0.2s;
  }

  .category-card:hover {
    border-color: color-mix(in srgb, var(--cat-color) 35%, transparent);
  }

  .category-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;
  }

  .category-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: color-mix(in srgb, var(--cat-color) 20%, transparent);
    border-radius: 8px;
    color: var(--cat-color);
    font-size: var(--font-size-sm);
  }

  .category-header h3 {
    flex: 1;
    margin: 0;
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--cat-color);
  }

  .category-count {
    padding: 4px 10px;
    background: color-mix(in srgb, var(--cat-color) 15%, transparent);
    border-radius: 10px;
    font-size: var(--font-size-compact);
    font-weight: 600;
    color: var(--cat-color);
  }

  .category-list {
    margin: 0;
    padding: 0;
    list-style: none;
    columns: 1;
  }

  @media (min-width: 600px) {
    .category-list {
      columns: 2;
      column-gap: 24px;
    }
  }

  .category-list li {
    position: relative;
    padding: 6px 0 6px 16px;
    font-size: var(--font-size-sm);
    color: var(--theme-text);
    line-height: 1.5;
    break-inside: avoid;
  }

  .category-list li::before {
    content: "";
    position: absolute;
    left: 0;
    top: 14px;
    width: 6px;
    height: 6px;
    background: var(--cat-color);
    border-radius: 50%;
    opacity: 0.7;
  }

  /* Empty State */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 40px 20px;
    text-align: center;
  }

  .empty-state i {
    font-size: var(--font-size-3xl);
    color: var(--theme-text-dim);
    opacity: 0.5;
  }

  .empty-state p {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--theme-text-dim);
  }

  /* ============================================================================
     CONTRIBUTORS
     ============================================================================ */
  .entry-contributors {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 4px;
  }

  .contributors-footer {
    padding: 16px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 14px;
  }

  .contributors-title {
    margin: 0 0 12px;
    font-size: var(--font-size-compact);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--theme-text-dim);
  }

  .contributors-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  /* ============================================================================
     FOOTER
     ============================================================================ */
  .modal-footer {
    display: flex;
    gap: 12px;
    padding: 16px 24px;
    border-top: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
  }

  .footer-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: var(--min-touch-target);
    padding: 12px 20px;
    border-radius: 12px;
    font-size: var(--font-size-sm);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .footer-btn.primary {
    background: linear-gradient(
      135deg,
      var(--theme-accent) 0%,
      color-mix(in srgb, var(--theme-accent) 80%, var(--semantic-info)) 100%
    );
    border: none;
    color: white;
    box-shadow: 0 4px 12px
      color-mix(in srgb, var(--theme-accent) 30%, transparent);
  }

  .footer-btn.primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px
      color-mix(in srgb, var(--theme-accent) 40%, transparent);
  }

  .footer-btn.primary:active {
    transform: translateY(0);
  }

  .footer-btn.secondary {
    background: transparent;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    color: var(--theme-text, #ffffff);
  }

  .footer-btn.secondary:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  /* ============================================================================
     RESPONSIVE
     ============================================================================ */

  /* Big-screen tiers (4k-native-layout: 1680 seam, second tier >= 2600).
     The modal grows with the canvas instead of floating as a phone column. */
  @media (min-width: 1680px) {
    .modal-container {
      max-width: 62rem;
      border-radius: 24px;
    }

    .modal-body {
      padding: 32px;
      gap: 20px;
    }

    .category-card {
      padding: 22px;
    }

    .category-list li {
      font-size: var(--font-size-base, 1rem);
      padding: 8px 0 8px 18px;
    }

    .category-list li::before {
      top: 16px;
    }

    .modal-header {
      padding: 24px 32px;
      padding-right: 64px;
    }

    .modal-footer {
      padding: 20px 32px;
    }
  }

  @media (min-width: 2600px) {
    /* 4K @ 100%: nothing scales for us here, so type and spacing step too. */
    .modal-container {
      max-width: 96rem;
      border-radius: 28px;
    }

    .category-list {
      columns: 3;
      column-gap: 40px;
    }

    .category-list li {
      font-size: 1.25rem;
      line-height: 1.55;
      padding: 10px 0 10px 22px;
    }

    .category-list li::before {
      top: 19px;
      width: 8px;
      height: 8px;
    }

    .modal-header h1 {
      font-size: 2rem;
    }

    .subtitle {
      font-size: 1.125rem;
    }

    .version-badge {
      padding: 10px 20px;
      font-size: 1.05rem;
    }

    .category-header h3 {
      font-size: 1.2rem;
    }

    .category-icon {
      width: 44px;
      height: 44px;
      font-size: 1.1rem;
    }

    .category-count {
      font-size: 1rem;
    }

    .category-card {
      padding: 28px;
      border-radius: 18px;
    }

    .modal-body {
      padding: 40px;
      gap: 24px;
    }

    .footer-btn {
      font-size: 1.1rem;
      padding: 16px 24px;
    }
  }

  @media (max-width: 540px) {
    .modal-container {
      max-height: calc(100vh - 20px);
      border-radius: 16px;
    }

    .modal-header {
      padding: 16px;
      padding-right: 48px;
    }

    .modal-body {
      padding: 16px;
    }

    .category-card {
      padding: 14px;
    }

    .modal-footer {
      padding: 12px 16px;
    }

    .footer-btn {
      padding: 10px 16px;
      font-size: var(--font-size-sm);
    }
  }

  /* ============================================================================
     ACCESSIBILITY
     ============================================================================ */
  @media (prefers-reduced-motion: reduce) {
    .modal-overlay,
    .modal-container {
      animation: none;
    }

    .footer-btn:hover {
      transform: none;
    }
  }

  @media (prefers-contrast: high) {
    .modal-container {
      border-width: 2px;
    }

    .category-card {
      border-width: 2px;
    }
  }
</style>
