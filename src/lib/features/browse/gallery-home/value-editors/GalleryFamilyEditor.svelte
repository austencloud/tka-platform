<script lang="ts">
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";
  import type {
    GalleryValueHeadSnippet,
    GalleryWorkspaceProps,
  } from "../gallery-workspace-types";

  type Props = Pick<
    GalleryWorkspaceProps,
    | "catalog"
    | "activeFamilyValues"
    | "onToggleFamily"
    | "familyConnective"
    | "onFamilyConnectiveChange"
    | "onPickFamily"
  > & { valueHead: GalleryValueHeadSnippet };

  let {
    catalog,
    activeFamilyValues,
    onToggleFamily,
    familyConnective,
    onFamilyConnectiveChange,
    onPickFamily,
    valueHead,
  }: Props = $props();
</script>

{#snippet familyConnectiveControl()}
  <SegmentedControl
    size="sm"
    density="compact"
    color="accent"
    ariaLabel="How selected families combine"
    options={[
      { value: "any", label: "Match any" },
      { value: "all", label: "Match all" },
    ]}
    value={familyConnective}
    onchange={(v) => onFamilyConnectiveChange?.(v)}
  />
{/snippet}

<div class="drill-screen screen-family">
  {@render valueHead(
    "Pick a Timing & Direction family",
    onToggleFamily
      ? familyConnective === "all"
        ? "Tap several — sequences need every family."
        : "Tap several — sequences match any family."
      : undefined,
    onFamilyConnectiveChange ? familyConnectiveControl : undefined
  )}
  <div class="value-list">
    {#each catalog.familyValues as v (v.value)}
      {@const isOn = activeFamilyValues?.has(v.value) ?? false}
      <button
        class="length-row tall family-row monument tinted"
        class:loop-active={isOn}
        style:--row-color={v.color}
        type="button"
        aria-label={`${v.label}, ${v.count} sequences`}
        aria-pressed={onToggleFamily ? isOn : undefined}
        disabled={Boolean(onToggleFamily) && v.count === 0 && !isOn}
        onclick={() => onPickFamily(v)}
      >
        <img
          class="value-img family-icon"
          src={v.icon}
          alt=""
          width="44"
          height="44"
          loading="eager"
        />
        <span class="value-main">
          <span class="value-label">{v.label}</span>
          <span class="density-bar">
            <span
              class="density-fill"
              style:width="{(v.count / catalog.maxFamilyCount) * 100}%"
              style:background={v.color}
            ></span>
          </span>
        </span>
        <span class="value-count">{v.count}</span>
        {#if onToggleFamily}
          <span class="loop-check" class:on={isOn} aria-hidden="true">
            <i class="fas fa-check"></i>
          </span>
        {/if}
      </button>
    {/each}
  </div>
</div>
