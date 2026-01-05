<!--
  WhatsNewModal - Beautiful changelog modal for version updates

  Displays structured changelog data with category cards,
  proper visual hierarchy, and celebration energy.
-->
<script lang="ts">
  import { whatsNewState } from "../state/whats-new-state.svelte";
  import { handleModuleChange } from "$lib/shared/navigation-coordinator/navigation-coordinator.svelte";
  import { navigationState } from "$lib/shared/navigation/state/navigation-state.svelte";
  import {
    CATEGORY_ICONS,
    CATEGORY_LABELS,
  } from "$lib/features/feedback/domain/constants/changelog-constants";
  import type { ChangelogCategory } from "$lib/features/feedback/domain/models/version-models";

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

  // Group changelog entries by category
  const groupedChangelog = $derived.by(() => {
    if (!version?.changelogEntries) return [];

    const groups = new Map<ChangelogCategory, string[]>();

    for (const entry of version.changelogEntries) {
      const existing = groups.get(entry.category) || [];
      existing.push(entry.text);
      groups.set(entry.category, existing);
    }

    // Convert to sorted array
    return Array.from(groups.entries())
      .map(([category, items]) => ({
        category,
        items,
        ...CATEGORY_CONFIG[category],
      }))
      .sort((a, b) => a.order - b.order);
  });

  // Get explicitly curated highlights (if any were set during release)
  const highlights = $derived(version?.highlights ?? []);

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
    navigationState.setActiveTab("release-notes");
    await handleModuleChange("settings");
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
        <h1 id="whats-new-title">What's New</h1>
        <p class="subtitle">
          {totalChanges}
          {totalChanges === 1 ? "update" : "updates"} in this release
        </p>
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
        <!-- Curated Highlights (optional - only shown if explicitly set during release) -->
        {#if highlights.length > 0}
          <div class="highlights-section">
            {#each highlights as highlight, i}
              <div class="hero-feature">
                <div class="hero-icon">
                  <i class="fas fa-star" aria-hidden="true"></i>
                </div>
                <div class="hero-content">
                  <span class="hero-label"
                    >{highlights.length > 1
                      ? `Highlight ${i + 1}`
                      : "Highlight"}</span
                  >
                  <p class="hero-text">{highlight}</p>
                </div>
              </div>
            {/each}
          </div>
        {/if}

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
                <span class="category-count">{group.items.length}</span>
              </div>
              <ul class="category-list">
                {#each group.items as item}
                  <li>{item}</li>
                {/each}
              </ul>
            </div>
          {/each}
        </div>

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
    z-index: 10000;
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
    max-width: 520px;
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
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 32px 24px 24px;
    text-align: center;
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

  .modal-header h1 {
    margin: 8px 0 0;
    font-size: var(--font-size-2xl);
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
  }

  /* Modern scrollbar styling - matches system drawer scrollbars */
  .modal-body::-webkit-scrollbar {
    width: 8px;
  }

  .modal-body::-webkit-scrollbar-track {
    background: transparent;
  }

  .modal-body::-webkit-scrollbar-thumb {
    background: var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: 4px;
    transition: background 0.2s;
  }

  .modal-body::-webkit-scrollbar-thumb:hover {
    background: var(--theme-stroke-strong, rgba(255, 255, 255, 0.25));
  }

  /* Highlights Section */
  .highlights-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  /* Hero Feature */
  .hero-feature {
    display: flex;
    gap: 16px;
    padding: 16px;
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--theme-accent) 10%, transparent) 0%,
      color-mix(in srgb, var(--theme-accent) 5%, transparent) 100%
    );
    border: 1.5px solid
      color-mix(in srgb, var(--theme-accent) 25%, transparent);
    border-radius: 14px;
  }

  .hero-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    flex-shrink: 0;
    background: linear-gradient(
      135deg,
      var(--theme-accent) 0%,
      color-mix(in srgb, var(--theme-accent) 70%, var(--semantic-info)) 100%
    );
    border-radius: 12px;
    color: white;
    font-size: var(--font-size-lg);
  }

  .hero-content {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .hero-label {
    font-size: var(--font-size-compact);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--theme-accent);
  }

  .hero-text {
    margin: 0;
    font-size: var(--font-size-sm);
    font-weight: 500;
    color: var(--theme-text);
    line-height: 1.5;
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
  }

  .category-list li {
    position: relative;
    padding: 6px 0 6px 16px;
    font-size: var(--font-size-sm);
    color: var(--theme-text);
    line-height: 1.5;
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
    min-height: 48px;
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
  @media (max-width: 540px) {
    .modal-container {
      max-height: calc(100vh - 20px);
      border-radius: 16px;
    }

    .modal-header {
      padding: 24px 20px 20px;
    }

    .modal-header h1 {
      font-size: var(--font-size-xl);
    }

    .modal-body {
      padding: 16px;
    }

    .hero-feature {
      flex-direction: column;
      align-items: flex-start;
      gap: 12px;
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
