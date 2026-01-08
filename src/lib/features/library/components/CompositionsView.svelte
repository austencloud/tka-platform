<!--
  CompositionsView.svelte - Compositions Tab Content

  Displays user's saved compositions from the Compose module.
  Allows viewing, opening, and managing compositions.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { authState } from "$lib/shared/auth/state/authState.svelte";
  import { handleModuleChange } from "$lib/shared/navigation-coordinator/navigation-coordinator.svelte";
  import PanelState from "$lib/shared/components/panel/PanelState.svelte";
  import PanelButton from "$lib/shared/components/panel/PanelButton.svelte";
  import type { Composition } from "$lib/features/compose/compose/domain/types";
  import { t } from "$lib/shared/i18n/i18n.svelte.js";

  // TODO: Replace with actual composition storage service
  let compositions = $state<Composition[]>([]);
  let isLoading = $state(true);
  let error = $state<string | null>(null);

  const isAuthenticated = $derived(!!authState.user);

  onMount(async () => {
    if (!isAuthenticated) {
      isLoading = false;
      return;
    }

    try {
      // TODO: Load compositions from storage service
      // For now, show empty state since persistence isn't implemented yet
      compositions = [];
      isLoading = false;
    } catch (err) {
      console.error("[CompositionsView] Failed to load compositions:", err);
      error =
        err instanceof Error ? err.message : "Failed to load compositions";
      isLoading = false;
    }
  });

  function handleCreateComposition() {
    // Navigate to Compose module to create new composition
    void handleModuleChange("compose", "arrange");
  }

  function handleOpenComposition(composition: Composition) {
    // TODO: Load composition into Compose module and navigate there
    void handleModuleChange("compose", "arrange");
  }

  function formatDate(date: Date): string {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);
  }

  function getLayoutLabel(rows: number, cols: number): string {
    const total = rows * cols;
    if (total === 1) return "Single";
    if (rows === 1 && cols === 2) return "Side by Side";
    if (rows === 2 && cols === 2) return "2×2 Grid";
    return `${rows}×${cols} Grid`;
  }
</script>

<div class="compositions-view">
  {#if !isAuthenticated}
    <PanelState
      type="info"
      title={t("library_sign_in_required")}
      message={t("library_sign_in_compositions")}
    />
  {:else if isLoading}
    <PanelState type="loading" message={t("library_loading_compositions")} />
  {:else if error}
    <PanelState type="error" title={t("common_error")} message={error} />
  {:else}
    <!-- Header with create button -->
    <div class="header">
      <h2>{t("library_my_compositions")}</h2>
      <PanelButton variant="primary" onclick={handleCreateComposition}>
        <i class="fas fa-plus" aria-hidden="true"></i>
        {t("library_new_composition")}
      </PanelButton>
    </div>

    {#if compositions.length === 0}
      <div class="empty-state">
        <i class="fas fa-layer-group" aria-hidden="true"></i>
        <h3>{t("library_no_compositions")}</h3>
        <p>
          {t("library_create_compositions_desc")}
        </p>
        <PanelButton variant="primary" onclick={handleCreateComposition}>
          <i class="fas fa-plus" aria-hidden="true"></i>
          {t("library_create_first_composition")}
        </PanelButton>
      </div>
    {:else}
      <!-- Compositions grid -->
      <div class="compositions-grid">
        {#each compositions as composition (composition.id)}
          <button
            class="composition-card"
            onclick={() => handleOpenComposition(composition)}
          >
            <div class="card-thumbnail">
              {#if composition.thumbnailUrl}
                <img src={composition.thumbnailUrl} alt={composition.name} />
              {:else}
                <div class="placeholder-thumbnail">
                  <i class="fas fa-film" aria-hidden="true"></i>
                </div>
              {/if}
              {#if composition.isFavorite}
                <div class="favorite-badge">
                  <i class="fas fa-heart" aria-hidden="true"></i>
                </div>
              {/if}
            </div>
            <div class="card-content">
              <h3>{composition.name || "Untitled"}</h3>
              <div class="card-meta">
                <span class="layout-label">
                  {getLayoutLabel(
                    composition.layout.rows,
                    composition.layout.cols
                  )}
                </span>
                <span class="date">{formatDate(composition.updatedAt)}</span>
              </div>
            </div>
          </button>
        {/each}
      </div>
    {/if}
  {/if}
</div>

<style>
  .compositions-view {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 16px;
    overflow-y: auto;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }

  .header h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.95);
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    text-align: center;
    padding: 40px 20px;
    color: var(--theme-text-dim);
  }

  .empty-state i {
    font-size: 4rem;
    margin-bottom: 16px;
    opacity: 0.4;
    color: #ec4899;
  }

  .empty-state h3 {
    margin: 0 0 8px 0;
    font-size: 1.25rem;
    color: var(--theme-text);
  }

  .empty-state p {
    margin: 0 0 20px 0;
    max-width: 320px;
  }

  .compositions-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 16px;
  }

  .composition-card {
    display: flex;
    flex-direction: column;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
    overflow: hidden;
    text-align: left;
  }

  .composition-card:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: #ec4899;
    transform: translateY(-2px);
  }

  .card-thumbnail {
    position: relative;
    aspect-ratio: 16 / 9;
    background: rgba(0, 0, 0, 0.2);
    overflow: hidden;
  }

  .card-thumbnail img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .placeholder-thumbnail {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, #f472b6 0%, #ec4899 100%);
  }

  .placeholder-thumbnail i {
    font-size: 2.5rem;
    color: var(--theme-text-dim);
  }

  .favorite-badge {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.5);
    border-radius: 50%;
  }

  .favorite-badge i {
    font-size: 0.75rem;
    color: var(--semantic-error);
  }

  .card-content {
    padding: 12px;
  }

  .card-content h3 {
    margin: 0 0 6px 0;
    font-size: 1rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.95);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .card-meta {
    display: flex;
    justify-content: space-between;
    font-size: 0.75rem;
    color: var(--theme-text-dim);
  }

  .layout-label {
    color: #ec4899;
  }

  @media (max-width: 480px) {
    .compositions-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
