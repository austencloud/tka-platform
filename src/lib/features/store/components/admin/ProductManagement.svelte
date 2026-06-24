<!--
  ProductManagement — admin list + form for shop products. Mirrors the
  AnnouncementManagement pattern (load on mount, create/edit/delete, AdminModal
  for delete confirm). This is the "Products" admin surface; on the test page it
  renders standalone.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import AdminModal from "$lib/shared/admin/components/AdminModal.svelte";
  import type { Product } from "../../domain/models/product";
  import { loadAllProducts } from "../../services/product-loader";
  import { deleteProduct } from "../../services/product-admin";
  import ProductForm from "./ProductForm.svelte";

  let products = $state<Product[]>([]);
  let isLoading = $state(true);
  let loadError = $state("");
  let showForm = $state(false);
  let selected = $state<Product | null>(null);

  let showDelete = $state(false);
  let pendingDeleteId = $state<string | null>(null);

  onMount(load);

  async function load() {
    isLoading = true;
    loadError = "";
    try {
      products = await loadAllProducts();
    } catch (err) {
      console.error("[ProductManagement] load failed:", err);
      loadError = "Couldn't load products. Check you're signed in as an admin.";
    } finally {
      isLoading = false;
    }
  }

  function createNew() {
    selected = null;
    showForm = true;
  }
  function edit(p: Product) {
    selected = p;
    showForm = true;
  }
  function requestDelete(id: string) {
    pendingDeleteId = id;
    showDelete = true;
  }
  async function confirmDelete() {
    if (pendingDeleteId) {
      try {
        await deleteProduct(pendingDeleteId);
        await load();
      } catch (err) {
        console.error("[ProductManagement] delete failed:", err);
      }
    }
    showDelete = false;
    pendingDeleteId = null;
  }
  async function onSave() {
    showForm = false;
    selected = null;
    await load();
  }

  function priceLabel(cents: number) {
    return `$${(cents / 100).toFixed(2)}`;
  }
</script>

<div class="product-management">
  {#if showForm}
    <ProductForm product={selected} {onSave} onCancel={() => (showForm = false)} />
  {:else}
    <div class="head">
      <div>
        <h2>Products</h2>
        <p class="sub">{products.length} total · drafts are admin-only</p>
      </div>
      <button class="create" onclick={createNew}>
        <i class="fas fa-plus" aria-hidden="true"></i> New product
      </button>
    </div>

    {#if isLoading}
      <div class="state"><i class="fas fa-spinner fa-spin" aria-hidden="true"></i> Loading…</div>
    {:else if loadError}
      <div class="state error">{loadError}</div>
    {:else if products.length === 0}
      <div class="state empty">
        No products yet. Click <strong>New product</strong> to add one.
      </div>
    {:else}
      <ul class="list">
        {#each products as p (p.id)}
          <li class="item">
            <div class="thumb" class:empty={!p.coverImageUrl}>
              {#if p.coverImageUrl}
                <img src={p.coverImageUrl} alt="" />
              {:else}
                <i class="fas fa-image" aria-hidden="true"></i>
              {/if}
            </div>
            <div class="meta">
              <span class="name">{p.name || "Untitled"}</span>
              <span class="tags">
                <span class="tag type">{p.type}</span>
                <span class="tag status {p.status}">{p.status}</span>
                {#if p.cardCount}<span class="tag">{p.cardCount} cards</span>{/if}
              </span>
            </div>
            <span class="price">{priceLabel(p.price)}</span>
            <div class="row-actions">
              <button class="icon" aria-label="Edit" onclick={() => edit(p)}>
                <i class="fas fa-pen" aria-hidden="true"></i>
              </button>
              <button class="icon danger" aria-label="Delete" onclick={() => requestDelete(p.id)}>
                <i class="fas fa-trash" aria-hidden="true"></i>
              </button>
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  {/if}
</div>

{#if showDelete}
  <AdminModal
    title="Delete product"
    message="This removes the product from the catalog. This can't be undone."
    variant="danger"
    confirmLabel="Delete"
    cancelLabel="Cancel"
    onConfirm={confirmDelete}
    onCancel={() => {
      showDelete = false;
      pendingDeleteId = null;
    }}
  />
{/if}

<style>
  .product-management {
    width: 100%;
    max-width: 760px;
    margin: 0 auto;
    padding: 8px;
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 20px;
  }
  .head h2 {
    margin: 0;
    font-size: var(--font-size-2xl, 1.5rem);
    font-weight: 700;
    color: var(--theme-text, #fff);
  }
  .sub {
    margin: 4px 0 0;
    font-size: var(--font-size-compact, 0.78rem);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  .create {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 12px 18px;
    min-height: var(--min-touch-target, 44px);
    border: none;
    border-radius: 10px;
    background: linear-gradient(135deg, #6f8cff, #8b6cff);
    color: #fff;
    font-size: var(--font-size-sm, 0.875rem);
    font-weight: 700;
    cursor: pointer;
    white-space: nowrap;
  }

  .state {
    padding: 40px;
    text-align: center;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.55));
    border-radius: 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
  }
  .state.error {
    color: var(--semantic-error, #ff8a8a);
  }

  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .item {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 12px;
    border-radius: 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }
  .thumb {
    width: 44px;
    height: 60px;
    border-radius: 8px;
    overflow: hidden;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.05);
    color: rgba(255, 255, 255, 0.3);
  }
  .thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .meta {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .name {
    font-size: var(--font-size-sm, 0.95rem);
    font-weight: 600;
    color: var(--theme-text, #fff);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .tag {
    padding: 3px 8px;
    border-radius: 6px;
    font-size: var(--font-size-compact, 0.7rem);
    font-weight: 600;
    background: rgba(255, 255, 255, 0.08);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.7));
  }
  .tag.status.active {
    background: rgba(52, 211, 153, 0.18);
    color: #6ee7b7;
  }
  .tag.status.draft {
    background: rgba(251, 191, 36, 0.18);
    color: #fcd34d;
  }
  .tag.status.sold-out {
    background: rgba(239, 68, 68, 0.18);
    color: #fca5a5;
  }
  .price {
    font-size: var(--font-size-base, 1rem);
    font-weight: 700;
    color: var(--theme-accent, #8ba0ff);
    font-variant-numeric: tabular-nums;
  }
  .row-actions {
    display: flex;
    gap: 6px;
  }
  .icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--min-touch-target, 44px);
    height: var(--min-touch-target, 44px);
    border-radius: 8px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    color: var(--theme-text, #fff);
    cursor: pointer;
  }
  .icon.danger:hover {
    color: #ff8a8a;
    border-color: rgba(239, 68, 68, 0.5);
  }

  @media (max-width: 520px) {
    .head {
      flex-direction: column;
      align-items: stretch;
    }
    .price {
      display: none;
    }
  }
</style>
