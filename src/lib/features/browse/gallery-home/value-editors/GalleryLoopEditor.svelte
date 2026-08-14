<script lang="ts">
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";
  import type {
    GalleryValueHeadSnippet,
    GalleryWorkspaceProps,
  } from "../gallery-workspace-types";

  type Props = Pick<
    GalleryWorkspaceProps,
    | "catalog"
    | "activeLoopValues"
    | "onToggleLoop"
    | "loopConnective"
    | "onLoopConnectiveChange"
    | "onPickLoop"
  > & { valueHead: GalleryValueHeadSnippet };

  let {
    catalog,
    activeLoopValues,
    onToggleLoop,
    loopConnective,
    onLoopConnectiveChange,
    onPickLoop,
    valueHead,
  }: Props = $props();
</script>

{#snippet loopConnectiveControl()}
  <SegmentedControl
    size="sm"
    color="accent"
    ariaLabel="How selected LOOPs combine"
    options={[
      { value: "any", label: "Match any" },
      { value: "all", label: "Match all" },
    ]}
    value={loopConnective}
    onchange={(v) => onLoopConnectiveChange?.(v)}
  />
{/snippet}

<div class="drill-screen screen-loop">
  {@render valueHead(
    "Pick a LOOP type",
    onToggleLoop
      ? loopConnective === "all"
        ? "Tap several. Sequences need every one of them."
        : "Tap several. Sequences match any of them."
      : undefined,
    onLoopConnectiveChange ? loopConnectiveControl : undefined
  )}
  <div class="value-list">
    {#each catalog.loopValues as v (v.value)}
      {@const isOn = activeLoopValues?.has(v.value) ?? false}
      <button
        class="length-row tall monument tinted"
        class:loop-active={isOn}
        style:--row-color={v.color}
        type="button"
        aria-pressed={onToggleLoop ? isOn : undefined}
        disabled={Boolean(onToggleLoop) && v.count === 0 && !isOn}
        onclick={() => onPickLoop(v)}
      >
        <span class="loop-icon" style:color={v.color} aria-hidden="true">
          <i class="fas {v.icon}"></i>
        </span>
        <span class="value-main">
          <span class="value-label">{v.label}</span>
          <span class="value-desc">{v.desc}</span>
          <span class="density-bar">
            <span
              class="density-fill"
              style:width="{(v.count / catalog.maxLoopCount) * 100}%"
              style:background={v.color}
            ></span>
          </span>
        </span>
        <span class="value-count">{v.count}</span>
        <!-- Slot reserved either way — appearing check must not shift the row. -->
        {#if onToggleLoop}
          <span class="loop-check" class:on={isOn} aria-hidden="true">
            <i class="fas fa-check"></i>
          </span>
        {/if}
      </button>
    {/each}
  </div>
</div>
