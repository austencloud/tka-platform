<script lang="ts">
  import { onMount } from "svelte";
  import type { TreeCategory } from "$lib/shared/background/firefly-forest/services/TreeSilhouetteImageLoader";

  interface Props {
    selectedCategory: TreeCategory | "all";
    onCategoryChange: (category: TreeCategory | "all") => void;
  }

  let { selectedCategory, onCategoryChange }: Props = $props();

  // Tree image counts per category (from TreeSilhouetteImageLoader)
  const TREE_COUNTS: Record<TreeCategory, number> = {
    pine: 12,
    fir: 5,
    spruce: 4,
    oak: 12,
    maple: 12,
    poplar: 6,
    willow: 13,
    dead: 18,
  };

  const CATEGORIES: TreeCategory[] = ["pine", "fir", "spruce", "oak", "maple", "poplar", "willow", "dead"];
  const BASE_PATH = "/images/trees/curated";

  interface TreeImageInfo {
    category: TreeCategory;
    index: number;
    filename: string;
    path: string;
  }

  // Generate list of all tree images
  function getAllImages(): TreeImageInfo[] {
    const images: TreeImageInfo[] = [];
    for (const category of CATEGORIES) {
      const count = TREE_COUNTS[category];
      for (let i = 1; i <= count; i++) {
        const paddedIndex = String(i).padStart(2, "0");
        const filename = `${category}_${paddedIndex}.png`;
        images.push({
          category,
          index: i,
          filename,
          path: `${BASE_PATH}/${filename}`,
        });
      }
    }
    return images;
  }

  const allImages = getAllImages();

  // Filter images by selected category
  let displayedImages = $derived(
    selectedCategory === "all"
      ? allImages
      : allImages.filter((img) => img.category === selectedCategory)
  );

  // Group images by category for "all" view
  let groupedImages = $derived(() => {
    if (selectedCategory !== "all") return null;
    const groups: Record<TreeCategory, TreeImageInfo[]> = {} as Record<TreeCategory, TreeImageInfo[]>;
    for (const category of CATEGORIES) {
      groups[category] = allImages.filter((img) => img.category === category);
    }
    return groups;
  });

  // Total count
  const totalCount = allImages.length;
</script>

<div class="tree-image-gallery">
  <!-- Category Filter -->
  <div class="category-filter">
    <button
      class="category-btn"
      class:active={selectedCategory === "all"}
      onclick={() => onCategoryChange("all")}
    >
      All ({totalCount})
    </button>
    {#each CATEGORIES as category}
      <button
        class="category-btn"
        class:active={selectedCategory === category}
        onclick={() => onCategoryChange(category)}
      >
        {category.charAt(0).toUpperCase() + category.slice(1)} ({TREE_COUNTS[category]})
      </button>
    {/each}
  </div>

  <!-- Image Grid -->
  <div class="gallery-scroll">
    {#if selectedCategory === "all"}
      <!-- Grouped view -->
      {#each CATEGORIES as category}
        <div class="category-section">
          <h3 class="category-header">
            {category.charAt(0).toUpperCase() + category.slice(1)}
            <span class="count">({TREE_COUNTS[category]})</span>
          </h3>
          <div class="image-grid">
            {#each allImages.filter((img) => img.category === category) as image}
              <div class="image-card">
                <div class="image-wrapper">
                  <img src={image.path} alt={image.filename} loading="lazy" />
                </div>
                <span class="image-label">{image.filename}</span>
              </div>
            {/each}
          </div>
        </div>
      {/each}
    {:else}
      <!-- Single category view -->
      <div class="image-grid large">
        {#each displayedImages as image}
          <div class="image-card">
            <div class="image-wrapper">
              <img src={image.path} alt={image.filename} loading="lazy" />
            </div>
            <span class="image-label">{image.filename}</span>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .tree-image-gallery {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #1a1a2e;
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.06);
    overflow: hidden;
  }

  .category-filter {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 16px;
    background: rgba(0, 0, 0, 0.3);
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .category-btn {
    padding: 8px 14px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    color: #9ca3af;
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .category-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #ffffff;
  }

  .category-btn.active {
    background: linear-gradient(135deg, rgba(132, 204, 22, 0.3), rgba(163, 230, 53, 0.3));
    border-color: rgba(163, 230, 53, 0.5);
    color: #a3e635;
  }

  .gallery-scroll {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
  }

  .gallery-scroll::-webkit-scrollbar { width: 8px; }
  .gallery-scroll::-webkit-scrollbar-track { background: var(--scrollbar-track, transparent); }
  .gallery-scroll::-webkit-scrollbar-thumb { background: var(--scrollbar-thumb, rgba(255, 255, 255, 0.2)); border-radius: 4px; }
  .gallery-scroll::-webkit-scrollbar-thumb:hover { background: var(--scrollbar-thumb-hover, rgba(255, 255, 255, 0.35)); }

  .category-section {
    margin-bottom: 24px;
  }

  .category-header {
    margin: 0 0 12px 0;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    font-size: 1rem;
    font-weight: 600;
    color: #a3e635;
  }

  .category-header .count {
    font-weight: 400;
    color: #6b7280;
    font-size: 0.875rem;
  }

  .image-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 12px;
  }

  .image-grid.large {
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 16px;
  }

  .image-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 8px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 10px;
    transition: all 0.2s ease;
  }

  .image-card:hover {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.12);
    transform: translateY(-2px);
  }

  .image-wrapper {
    width: 100%;
    aspect-ratio: 1 / 1.5;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(to bottom, #1e3a5f 0%, #0d1f33 100%);
    border-radius: 6px;
    overflow: hidden;
  }

  .image-wrapper img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    /* Invert the black silhouette so it's visible against dark background */
    filter: invert(1);
    opacity: 0.9;
  }

  .image-label {
    margin-top: 6px;
    font-size: 0.65rem;
    font-family: monospace;
    color: #6b7280;
    text-align: center;
    word-break: break-all;
  }

  @media (max-width: 600px) {
    .image-grid {
      grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
    }

    .image-grid.large {
      grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    }
  }
</style>
