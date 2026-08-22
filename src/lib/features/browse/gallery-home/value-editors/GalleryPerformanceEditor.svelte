<script lang="ts">
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

<div class="drill-screen screen-performance">
  {@render valueHead(
    "Performances in these results",
    "Counts include every filter already applied. Tap several to match any."
  )}
  <div class="value-list">
    {#each catalog.performanceValues as v (v.value)}
      {@const applied = isValueApplied?.(v.type, v.value) ?? false}
      <button
        class="length-row tall monument"
        class:value-applied={applied}
        type="button"
        aria-pressed={isValueApplied ? applied : undefined}
        disabled={valueDisabled(v.count, applied)}
        onclick={() => onPickValue(v.type, v.value, v.label)}
      >
        <span class="loop-icon" aria-hidden="true">
          <i class="fas {v.icon}"></i>
        </span>
        <span class="value-main">
          <span class="value-label">{v.label}</span>
          <span class="value-desc">
            {v.count} in these results
            {#if v.count !== v.overallCount}
              · {v.overallCount} overall
            {/if}
          </span>
          <span class="density-bar">
            <span
              class="density-fill"
              style:width="{(v.count / catalog.maxPerformanceCount) * 100}%"
            ></span>
          </span>
        </span>
        <span class="value-count">{v.count}</span>
      </button>
    {/each}
  </div>
</div>
