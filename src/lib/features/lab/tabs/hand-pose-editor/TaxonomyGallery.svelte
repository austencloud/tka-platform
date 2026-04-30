<!--
  TaxonomyGallery.svelte - Browse all 35 Yale GRASP taxonomy poses.
  Grouped by opposition type. Click a card to load it into the editor.
-->
<script lang="ts">
  import taxonomyData from "$lib/shared/3d/data/grip-poses/yale-taxonomy-poses.json";

  interface TaxonomyGrasp {
    name: string;
    type: string;
    rotations: [number, number, number, number][];
  }

  interface Props {
    activePoseName: string;
    onselect: (grasp: TaxonomyGrasp) => void;
  }

  let { activePoseName, onselect }: Props = $props();

  const grasps = taxonomyData.grasps as TaxonomyGrasp[];

  // Group by opposition type
  const groups = $derived(() => {
    const map = new Map<string, TaxonomyGrasp[]>();
    for (const g of grasps) {
      const list = map.get(g.type) ?? [];
      list.push(g);
      map.set(g.type, list);
    }
    return map;
  });

  const groupLabels: Record<string, string> = {
    pad_opposition: "Pad Opposition",
    palm_opposition: "Palm Opposition",
    side_opposition: "Side Opposition",
    tka_specific: "TKA Specific",
  };

  const groupDescriptions: Record<string, string> = {
    pad_opposition: "Thumb pad vs fingertips (pinching)",
    palm_opposition: "Fingers wrap to palm (gripping)",
    side_opposition: "Thumb side vs finger side (lateral)",
    tka_specific: "Custom poses for prop spinning",
  };

  // Color coding by opposition type
  const groupColors: Record<string, string> = {
    pad_opposition: "#8b5cf6",
    palm_opposition: "#f59e0b",
    side_opposition: "#10b981",
    tka_specific: "#3b82f6",
  };
</script>

<div class="gallery">
  <div class="gallery-header">
    Yale GRASP Taxonomy ({grasps.length} poses)
  </div>

  <div class="gallery-content">
      {#each [...groups().entries()] as [type, poses]}
        <div class="group">
          <div class="group-header" style="border-color: {groupColors[type] ?? '#666'}">
            <span class="group-name">{groupLabels[type] ?? type}</span>
            <span class="group-desc">{groupDescriptions[type] ?? ""}</span>
          </div>
          <div class="group-grid">
            {#each poses as grasp}
              <button
                class="pose-card"
                class:active={activePoseName === grasp.name}
                style="--accent: {groupColors[type] ?? '#666'}"
                onclick={() => onselect(grasp)}
              >
                <span class="pose-name">{grasp.name}</span>
              </button>
            {/each}
          </div>
        </div>
      {/each}
    </div>
</div>

<style>
  .gallery {
    padding-top: 0;
  }

  .gallery-header {
    padding: 4px 0 8px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .gallery-content {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 6px;
  }

  .group-header {
    border-left: 3px solid;
    padding-left: 8px;
    margin-bottom: 6px;
  }

  .group-name {
    display: block;
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: var(--theme-text, #fff);
  }

  .group-desc {
    display: block;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
  }

  .group-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }

  .pose-card {
    min-height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px 10px;
    border-radius: 6px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: transparent;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-min, 14px);
    cursor: pointer;
    transition: all 0.15s ease;
    text-align: center;
  }

  .pose-card:hover {
    border-color: var(--accent);
    color: var(--theme-text, #fff);
    background: rgba(255, 255, 255, 0.04);
  }

  .pose-card.active {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 20%, transparent);
    color: var(--theme-text, #fff);
    font-weight: 600;
  }

  .pose-name {
    line-height: 1.2;
  }
</style>
