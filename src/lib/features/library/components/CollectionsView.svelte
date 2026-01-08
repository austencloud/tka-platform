<!--
  CollectionsView.svelte - Collections Tab Content

  Displays user's collections (folders) with ability to:
  - View all collections
  - Create new collections
  - Open collection to see contents
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { resolve } from "$lib/shared/inversify/di";
  import { TYPES } from "$lib/shared/inversify/types";
  import type { ICollectionManager } from "../services/contracts/ICollectionManager";
  import type { LibraryCollection } from "../domain/models/Collection";
  import { authState } from "$lib/shared/auth/state/authState.svelte";
  import PanelState from "$lib/shared/components/panel/PanelState.svelte";
  import PanelButton from "$lib/shared/components/panel/PanelButton.svelte";
  import { t } from "$lib/shared/i18n/i18n.svelte.js";

  let collections = $state<LibraryCollection[]>([]);
  let isLoading = $state(true);
  let error = $state<string | null>(null);
  let collectionService: ICollectionManager | null = null;

  const isAuthenticated = $derived(!!authState.user);

  onMount(async () => {
    if (!isAuthenticated) {
      isLoading = false;
      return;
    }

    try {
      collectionService = resolve<ICollectionManager>(TYPES.ICollectionManager);
      collections = await collectionService.getCollections();
      isLoading = false;
    } catch (err) {
      console.error("[CollectionsView] Failed to load collections:", err);
      error = err instanceof Error ? err.message : "Failed to load collections";
      isLoading = false;
    }
  });

  async function handleCreateCollection() {
    // TODO: Open create collection modal
  }

  function handleOpenCollection(collection: LibraryCollection) {
    // TODO: Navigate to collection detail view
  }
</script>

<div class="collections-view">
  {#if !isAuthenticated}
    <PanelState
      type="info"
      title={t("library_sign_in_required")}
      message={t("library_sign_in_collections")}
    />
  {:else if isLoading}
    <PanelState type="loading" message={t("library_loading_collections")} />
  {:else if error}
    <PanelState type="error" title={t("common_error")} message={error} />
  {:else}
    <!-- Header with create button -->
    <div class="header">
      <h2>{t("library_my_collections")}</h2>
      <PanelButton variant="primary" onclick={handleCreateCollection}>
        <i class="fas fa-plus" aria-hidden="true"></i>
        {t("library_new_collection")}
      </PanelButton>
    </div>

    {#if collections.length === 0}
      <div class="empty-state">
        <i class="fas fa-folder-open" aria-hidden="true"></i>
        <h3>{t("library_no_collections")}</h3>
        <p>
          {t("library_create_collections_desc")}
        </p>
        <PanelButton variant="primary" onclick={handleCreateCollection}>
          <i class="fas fa-plus" aria-hidden="true"></i>
          {t("library_create_first_collection")}
        </PanelButton>
      </div>
    {:else}
      <!-- Collections grid -->
      <div class="collections-grid">
        {#each collections as collection (collection.id)}
          <button
            class="collection-card"
            onclick={() => handleOpenCollection(collection)}
            style="--card-color: {collection.color ||
              'var(--theme-accent-strong, var(--theme-accent-strong))'}"
          >
            <div class="card-icon">
              <i class="fas {collection.icon || 'fa-folder'}" aria-hidden="true"
              ></i>
            </div>
            <div class="card-content">
              <h3>{collection.name}</h3>
              <p class="item-count">
                {collection.sequenceCount}
                {collection.sequenceCount === 1 ? t("common_item") : t("common_items")}
              </p>
            </div>
            {#if collection.systemType}
              <div class="system-badge">
                <i class="fas fa-lock" aria-hidden="true"></i>
              </div>
            {/if}
          </button>
        {/each}
      </div>
    {/if}
  {/if}
</div>

<style>
  .collections-view {
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
  }

  .empty-state h3 {
    margin: 0 0 8px 0;
    font-size: 1.25rem;
    color: var(--theme-text);
  }

  .empty-state p {
    margin: 0 0 20px 0;
    max-width: 300px;
  }

  .collections-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 16px;
  }

  .collection-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 20px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
    position: relative;
    text-align: center;
  }

  .collection-card:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: var(
      --card-color,
      var(--theme-accent-strong, var(--theme-accent-strong))
    );
    transform: translateY(-2px);
  }

  .card-icon {
    width: 56px;
    height: 56px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(
      --card-color,
      var(--theme-accent-strong, var(--theme-accent-strong))
    );
    border-radius: 12px;
    margin-bottom: 12px;
  }

  .card-icon i {
    font-size: 1.5rem;
    color: white;
  }

  .card-content h3 {
    margin: 0 0 4px 0;
    font-size: 1rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.95);
  }

  .item-count {
    margin: 0;
    font-size: 0.875rem;
    color: var(--theme-text-dim);
  }

  .system-badge {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 4px;
  }

  .system-badge i {
    font-size: 0.625rem;
    color: var(--theme-text-dim);
  }

  @media (max-width: 480px) {
    .collections-grid {
      grid-template-columns: repeat(2, 1fr);
    }

    .collection-card {
      padding: 16px;
    }

    .card-icon {
      width: var(--min-touch-target);
      height: var(--min-touch-target);
    }

    .card-icon i {
      font-size: 1.25rem;
    }
  }
</style>
