<script lang="ts">
  import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";
  import { BrowseFilterType } from "$lib/shared/persistence/domain/enums/filtering-enums";
  import { valueDisabled } from "../gallery-value-editor";
  import type {
    GalleryValueHeadSnippet,
    GalleryWorkspaceProps,
  } from "../gallery-workspace-types";

  type Props = Pick<
    GalleryWorkspaceProps,
    "catalog" | "stackHint" | "isValueApplied" | "onPickValue"
  > & { valueHead: GalleryValueHeadSnippet };

  let { catalog, stackHint, isValueApplied, onPickValue, valueHead }: Props =
    $props();
</script>

<div class="drill-screen screen-positions">
  {@render valueHead("Pick a start position", stackHint)}
  <div class="value-list">
    {#each catalog.positionValues as v (v.value)}
      {@const positionApplied =
        isValueApplied?.(BrowseFilterType.STARTING_POSITION, v.value) ?? false}
      <button
        class="length-row tall monument"
        class:value-applied={positionApplied}
        type="button"
        aria-pressed={isValueApplied ? positionApplied : undefined}
        disabled={valueDisabled(v.count, positionApplied)}
        onclick={() =>
          onPickValue(BrowseFilterType.STARTING_POSITION, v.value, v.label)}
      >
        <span class="value-pictograph" aria-hidden="true">
          {#if catalog.startPosPictographs.get(v.value)}
            <PictographContainer
              pictographData={catalog.startPosPictographs.get(v.value)}
              showTKA={false}
              showPositions={false}
              showTnD={false}
              showElemental={false}
            />
          {/if}
        </span>
        <span class="value-main">
          <span class="value-label">{v.label}</span>
          <span class="value-desc">{v.desc}</span>
          <span class="density-bar">
            <span
              class="density-fill"
              style:width="{(v.count / catalog.maxPositionCount) * 100}%"
            ></span>
          </span>
        </span>
        <span class="value-count">{v.count}</span>
      </button>
    {/each}
  </div>
</div>
