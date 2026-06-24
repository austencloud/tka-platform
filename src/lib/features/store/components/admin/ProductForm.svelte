<!--
  ProductForm — create/edit a shop product. Follows the admin AnnouncementForm
  pattern (list + form), uses SegmentedControl for the single-select type/status
  (chip-primitives rule — never a dropdown or checkbox). Saves to Firestore
  products/; the Stripe Price is attached later on publish (build phase).
-->
<script lang="ts">
  import SegmentedControl from "$lib/shared/3d/components/controls/SegmentedControl.svelte";
  import type {
    Product,
    ProductType,
    ProductStatus,
  } from "../../domain/models/product";
  import { createProduct, updateProduct, type ProductDraft } from "../../services/product-admin";
  import { uploadProductImage } from "../../services/product-image-uploader";

  interface Props {
    product?: Product | null;
    onSave: () => void;
    onCancel: () => void;
  }

  let { product = null, onSave, onCancel }: Props = $props();

  let name = $state(product?.name ?? "");
  let description = $state(product?.description ?? "");
  let type = $state<ProductType>(product?.type ?? "physical-deck");
  let status = $state<ProductStatus>(product?.status ?? "draft");
  let priceDollars = $state(product ? (product.price / 100).toFixed(2) : "");
  let cardCount = $state(product?.cardCount?.toString() ?? "");
  let deckId = $state(product?.deckId ?? "");
  let sortOrder = $state(product?.sortOrder?.toString() ?? "0");

  let coverImageUrl = $state(product?.coverImageUrl ?? "");
  let imageFile = $state<File | null>(null);
  let imagePreview = $state(product?.coverImageUrl ?? "");

  let isSaving = $state(false);
  let error = $state("");

  const typeOptions: { value: ProductType; label: string }[] = [
    { value: "physical-deck", label: "Deck" },
    { value: "sampler-pack", label: "Sampler" },
    { value: "digital", label: "Digital" },
    { value: "guide", label: "Guide" },
    { value: "material", label: "Material" },
  ];

  const statusOptions: { value: ProductStatus; label: string }[] = [
    { value: "draft", label: "Draft" },
    { value: "active", label: "Active" },
    { value: "sold-out", label: "Sold out" },
  ];

  const isDeckLike = $derived(type === "physical-deck" || type === "sampler-pack");

  function onPickImage(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    imageFile = file;
    if (file) imagePreview = URL.createObjectURL(file);
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    error = "";

    if (!name.trim()) {
      error = "Name is required.";
      return;
    }
    const priceNum = Number(priceDollars);
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      error = "Enter a valid price.";
      return;
    }

    isSaving = true;
    try {
      // Best-effort image upload. If Storage rules aren't in place yet, keep the
      // product without blocking the save and surface a soft note.
      let finalCover = coverImageUrl;
      if (imageFile) {
        try {
          finalCover = await uploadProductImage(imageFile, product?.id ?? "staging");
        } catch (err) {
          console.warn("[ProductForm] image upload failed, saving without it:", err);
        }
      }

      const draft: ProductDraft = {
        name: name.trim(),
        description: description.trim(),
        type,
        price: Math.round(priceNum * 100),
        stripePriceId: product?.stripePriceId ?? "",
        status,
        previewImageUrls: product?.previewImageUrls ?? [],
        sortOrder: Number(sortOrder) || 0,
        ...(isDeckLike && cardCount ? { cardCount: Number(cardCount) } : {}),
        ...(deckId.trim() ? { deckId: deckId.trim() } : {}),
        ...(finalCover ? { coverImageUrl: finalCover } : {}),
      };

      if (product) {
        await updateProduct(product.id, draft);
      } else {
        await createProduct(draft);
      }
      onSave();
    } catch (err) {
      console.error("[ProductForm] save failed:", err);
      error = "Save failed. Check you're signed in as an admin, then retry.";
    } finally {
      isSaving = false;
    }
  }
</script>

<div class="product-form">
  <div class="form-header">
    <h2>{product ? "Edit product" : "New product"}</h2>
    <button class="icon-btn" onclick={onCancel} aria-label="Close">
      <i class="fas fa-times" aria-hidden="true"></i>
    </button>
  </div>

  <form onsubmit={handleSubmit}>
    {#if error}
      <div class="error" role="alert">
        <i class="fas fa-exclamation-circle" aria-hidden="true"></i>{error}
      </div>
    {/if}

    <div class="row">
      <label class="lbl" for="p-name">Name</label>
      <input id="p-name" class="text-input" type="text" bind:value={name} placeholder="8-Count Quartered Rotated Loops" maxlength="80" />
    </div>

    <div class="row">
      <label class="lbl" for="p-desc">Description</label>
      <textarea id="p-desc" class="text-input" bind:value={description} rows="3" placeholder="What's in this product"></textarea>
    </div>

    <div class="row">
      <span class="lbl">Type</span>
      <SegmentedControl options={typeOptions} value={type} onchange={(v) => (type = v)} color="accent" size="sm" />
    </div>

    <div class="row">
      <span class="lbl">Status</span>
      <SegmentedControl options={statusOptions} value={status} onchange={(v) => (status = v)} color="accent" size="sm" />
      <span class="hint">Drafts are visible to you only. Active is what the public sees once the Shop launches.</span>
    </div>

    <div class="grid-2">
      <div class="row">
        <label class="lbl" for="p-price">Price (USD)</label>
        <input id="p-price" class="text-input" type="number" min="0" step="0.01" bind:value={priceDollars} placeholder="50.00" />
      </div>
      <div class="row">
        <label class="lbl" for="p-sort">Sort order</label>
        <input id="p-sort" class="text-input" type="number" step="1" bind:value={sortOrder} placeholder="0" />
      </div>
    </div>

    {#if isDeckLike}
      <div class="grid-2">
        <div class="row">
          <label class="lbl" for="p-cards">Card count</label>
          <input id="p-cards" class="text-input" type="number" min="0" step="1" bind:value={cardCount} placeholder="128" />
        </div>
        <div class="row">
          <label class="lbl" for="p-deck">Deck ID <span class="opt">(optional)</span></label>
          <input id="p-deck" class="text-input" type="text" bind:value={deckId} placeholder="decks/{'{'}id{'}'}" />
        </div>
      </div>
    {/if}

    <div class="row">
      <span class="lbl">Cover image</span>
      <div class="image-field">
        <div class="image-preview" class:empty={!imagePreview}>
          {#if imagePreview}
            <img src={imagePreview} alt="Product cover preview" />
          {:else}
            <i class="fas fa-image" aria-hidden="true"></i>
          {/if}
        </div>
        <label class="file-btn">
          <i class="fas fa-upload" aria-hidden="true"></i>
          <span>{imagePreview ? "Replace image" : "Choose image"}</span>
          <input type="file" accept="image/*" onchange={onPickImage} hidden />
        </label>
      </div>
    </div>

    <div class="stripe-note">
      <i class="fas fa-circle-info" aria-hidden="true"></i>
      Stripe price is created when you publish this product (pending the checkout wiring). Drafts save fine without it.
    </div>

    <div class="actions">
      <button type="button" class="btn ghost" onclick={onCancel}>Cancel</button>
      <button type="submit" class="btn primary" disabled={isSaving}>
        {#if isSaving}<i class="fas fa-spinner fa-spin" aria-hidden="true"></i>{/if}
        {product ? "Save changes" : "Create product"}
      </button>
    </div>
  </form>
</div>

<style>
  .product-form {
    width: 100%;
    max-width: 640px;
    margin: 0 auto;
  }

  .form-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 24px;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }
  .form-header h2 {
    margin: 0;
    font-size: var(--font-size-2xl, 1.5rem);
    font-weight: 700;
    color: var(--theme-text, #fff);
  }

  .icon-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: var(--min-touch-target, 44px);
    min-height: var(--min-touch-target, 44px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: 10px;
    color: var(--theme-text, #fff);
    cursor: pointer;
  }

  .error {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    margin-bottom: 18px;
    border-radius: 10px;
    background: color-mix(in srgb, var(--semantic-error, #ef4444) 18%, transparent);
    border: 1px solid var(--semantic-error, #ef4444);
    color: #ffd9d9;
    font-size: var(--font-size-sm, 0.875rem);
    font-weight: 600;
  }

  .row {
    margin-bottom: 18px;
  }
  .grid-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }
  @media (max-width: 520px) {
    .grid-2 {
      grid-template-columns: 1fr;
    }
  }

  .lbl {
    display: block;
    margin-bottom: 8px;
    font-size: var(--font-size-sm, 0.875rem);
    font-weight: 600;
    color: var(--theme-text, #fff);
  }
  .opt {
    font-weight: 500;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.45));
  }
  .hint {
    display: block;
    margin-top: 8px;
    font-size: var(--font-size-compact, 0.75rem);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  .text-input {
    width: 100%;
    padding: 12px 14px;
    min-height: var(--min-touch-target, 44px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.05));
    border: 2px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: 10px;
    color: var(--theme-text, #fff);
    font-size: var(--font-size-sm, 0.9rem);
    font-family: inherit;
    transition: border-color 0.2s ease;
    resize: vertical;
  }
  .text-input:focus {
    outline: none;
    border-color: var(--theme-accent, #8b6cff);
  }

  .image-field {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .image-preview {
    width: 88px;
    height: 120px;
    border-radius: 10px;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.05));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    flex-shrink: 0;
  }
  .image-preview.empty {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.3));
    font-size: 1.6rem;
  }
  .image-preview img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .file-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    min-height: var(--min-touch-target, 44px);
    border-radius: 10px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.14));
    color: var(--theme-text, #fff);
    font-size: var(--font-size-sm, 0.875rem);
    font-weight: 600;
    cursor: pointer;
  }

  .stripe-note {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 12px 14px;
    margin: 6px 0 22px;
    border-radius: 10px;
    background: rgba(111, 140, 255, 0.08);
    border: 1px solid rgba(111, 140, 255, 0.25);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.7));
    font-size: var(--font-size-compact, 0.78rem);
    line-height: 1.5;
  }
  .stripe-note i {
    color: #8ba0ff;
    margin-top: 2px;
  }

  .actions {
    display: flex;
    gap: 12px;
    padding-top: 16px;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }
  .btn {
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 14px 20px;
    min-height: var(--min-touch-target, 44px);
    border-radius: 10px;
    font-size: var(--font-size-sm, 0.9rem);
    font-weight: 700;
    cursor: pointer;
    border: 1px solid transparent;
  }
  .btn.ghost {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.05));
    border-color: var(--theme-stroke, rgba(255, 255, 255, 0.14));
    color: var(--theme-text, #fff);
  }
  .btn.primary {
    background: linear-gradient(135deg, #6f8cff, #8b6cff);
    color: #fff;
  }
  .btn.primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
</style>
