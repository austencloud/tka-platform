<script lang="ts">
  import type { EvaluatedFrameLayer } from "$lib/shared/media-composition/services/frame-evaluator";
  import { getMediaCompositionContext } from "$lib/shared/media-composition/state/media-composition-context";
  import PostStudioMediaLayer from "./PostStudioMediaLayer.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import type { SequenceExportOptions } from "$lib/shared/render/domain/models/sequence-export-options";

  let {
    sequence,
    cardRenderOptions,
    durationLabel,
    onRootReady,
    onEditRegion,
  }: {
    sequence: SequenceData;
    cardRenderOptions?: Partial<SequenceExportOptions> | null;
    /** Output length, shown beside the format so the canvas needs no header. */
    durationLabel?: string;
    onRootReady?: (root: HTMLElement | null) => void;
    onEditRegion?: () => void;
  } = $props();

  let outputFrame = $state<HTMLElement | null>(null);

  $effect(() => {
    onRootReady?.(outputFrame);
    return () => onRootReady?.(null);
  });

  const composition = getMediaCompositionContext();
  let drag = $state<{
    pointerId: number;
    startX: number;
    startY: number;
    startTranslateX: number;
    startTranslateY: number;
    region: HTMLElement;
    moved: boolean;
  } | null>(null);
  let suppressClick = false;

  const orderedRegions = $derived(
    [...composition.regions].sort((left, right) => left.zIndex - right.zIndex)
  );

  function regionStyle(region: (typeof orderedRegions)[number]): string {
    return [
      `left:${region.x * 100}%`,
      `top:${region.y * 100}%`,
      `width:${region.width * 100}%`,
      `height:${region.height * 100}%`,
      `z-index:${region.zIndex + 1}`,
    ].join(";");
  }

  function selectRegion(regionId: string, roleKey: string | null): void {
    composition.selectRegion(regionId, roleKey);
    if (!roleKey) return;
    const binding = composition.bindingForRole(roleKey);
    if (binding?.status === "missing") composition.requestSource(roleKey);
  }

  function handleRegionClick(regionId: string, roleKey: string | null): void {
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    selectRegion(regionId, roleKey);
    const binding = roleKey ? composition.bindingForRole(roleKey) : null;
    if (binding?.status !== "missing") onEditRegion?.();
  }

  function beginDrag(
    event: PointerEvent,
    regionId: string,
    roleKey: string | null
  ): void {
    composition.selectRegion(regionId, roleKey);
    const binding = roleKey ? composition.bindingForRole(roleKey) : null;
    if (binding?.status === "missing" || !composition.selectedTransform) return;
    const region = event.currentTarget as HTMLElement;
    region.setPointerCapture(event.pointerId);
    drag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startTranslateX: composition.selectedTransform.translateX,
      startTranslateY: composition.selectedTransform.translateY,
      region,
      moved: false,
    };
  }

  function moveDrag(event: PointerEvent): void {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const bounds = drag.region.getBoundingClientRect();
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (Math.abs(deltaX) + Math.abs(deltaY) > 4) drag.moved = true;
    composition.setSelectedTransform({
      translateX: drag.startTranslateX + deltaX / bounds.width,
      translateY: drag.startTranslateY + deltaY / bounds.height,
    });
  }

  function endDrag(event: PointerEvent): void {
    if (!drag || event.pointerId !== drag.pointerId) return;
    suppressClick = drag.moved;
    if (drag.region.hasPointerCapture(event.pointerId)) {
      drag.region.releasePointerCapture(event.pointerId);
    }
    drag = null;
  }

  function layersForRegion(regionId: string): EvaluatedFrameLayer[] {
    return composition.frameLayers.filter(
      (layer) => layer.regionId === regionId
    );
  }

  function roleForLayers(
    regionId: string,
    layers: EvaluatedFrameLayer[]
  ): string | null {
    return (
      layers.reduce<EvaluatedFrameLayer | null>(
        (strongest, layer) =>
          !strongest || layer.opacity >= strongest.opacity ? layer : strongest,
        null
      )?.sourceRole ?? composition.roleForRegion(regionId)
    );
  }

  function hasReadyLayer(layers: EvaluatedFrameLayer[]): boolean {
    return layers.some((layer) => {
      const binding = composition.bindingForRole(layer.sourceRole);
      return (
        binding?.status === "ready" &&
        (Boolean(binding.previewUrl) ||
          binding.renderMode === "sequence-animation" ||
          binding.renderMode === "choreo-card")
      );
    });
  }

  function sourceIcon(kind: string): string {
    if (kind === "video") return "fa-solid fa-video";
    if (kind === "sequence-animation") return "fa-solid fa-person-running";
    if (kind === "choreo-card") return "fa-solid fa-table-cells-large";
    return "fa-solid fa-photo-film";
  }
</script>

<div class="preview-shell">
  <div
    class="output-frame"
    aria-label="9 by 16 post preview"
    bind:this={outputFrame}
  >
    {#each orderedRegions as region (region.id)}
      {@const layers = layersForRegion(region.id)}
      {@const roleKey = roleForLayers(region.id, layers)}
      {@const binding = roleKey ? composition.bindingForRole(roleKey) : null}
      {@const hasVisibleSource = hasReadyLayer(layers)}
      <button
        type="button"
        class="region"
        class:selected={composition.selectedRegion?.id === region.id}
        class:missing={!hasVisibleSource}
        style={regionStyle(region)}
        aria-pressed={composition.selectedRegion?.id === region.id}
        aria-label={`Edit ${region.label ?? "region"}${binding?.status === "missing" ? "; source missing" : ""}`}
        onpointerdown={(event) => beginDrag(event, region.id, roleKey)}
        onpointermove={moveDrag}
        onpointerup={endDrag}
        onpointercancel={endDrag}
        onclick={() => handleRegionClick(region.id, roleKey)}
      >
        {#each layers as layer (layer.clipId)}
          {@const layerBinding = composition.bindingForRole(layer.sourceRole)}
          {#if layerBinding?.status === "ready" && (layerBinding.previewUrl || layerBinding.renderMode === "sequence-animation" || layerBinding.renderMode === "choreo-card")}
            <span class="rendered-media" aria-hidden="true">
              <PostStudioMediaLayer
                binding={layerBinding}
                fit={region.fit}
                opacity={layer.opacity}
                sourceTimeSeconds={layer.sourceTimeSeconds}
                playing={composition.isPlaying}
                {sequence}
                {cardRenderOptions}
                sequencePosition={layer.sequencePosition}
                displayedBeatNumber={layer.displayedBeatNumber}
                clipId={layer.clipId}
                transform={layer.transform}
              />
            </span>
          {/if}
        {/each}
        {#if !hasVisibleSource}
          <span class="empty-source">
            <i
              class={binding?.status === "preparing"
                ? "fa-solid fa-circle-notch fa-spin"
                : sourceIcon(binding?.kind ?? "image")}
              aria-hidden="true"
            ></i>
            <strong>{binding?.label ?? region.label ?? "Source"}</strong>
            <span>
              {binding?.status === "preparing"
                ? "Preparing preview"
                : (binding?.missingMessage ?? "Click to choose a source")}
            </span>
          </span>
        {/if}
        <span class="region-name"
          >{region.label ?? binding?.label ?? "Region"}</span
        >
      </button>
    {/each}

    {#if composition.safeZonesVisible}
      <div class="instagram-chrome" aria-hidden="true">
        <div class="top-zone"></div>
        <div class="right-zone"></div>
        <div class="bottom-zone"></div>
        <div class="safe-frame"><span>Keep key details here</span></div>
      </div>
    {/if}
  </div>

  <div class="preview-meta">
    <span class="format">
      <i class="fa-solid fa-mobile-screen" aria-hidden="true"></i>
      9:16{#if durationLabel}<span class="duration"> · {durationLabel}</span
        >{/if}
    </span>
    <span class="edit-hint"
      ><i class="fa-solid fa-arrow-pointer" aria-hidden="true"></i> Select a region
      to edit</span
    >
  </div>
</div>

<style>
  .preview-shell {
    --preview-width: min(100%, calc((100cqb - 2.75rem) * 0.5625), 44rem);
    display: grid;
    align-content: center;
    justify-items: center;
    gap: 0.625rem;
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
  }

  .output-frame {
    position: relative;
    aspect-ratio: 9 / 16;
    width: var(--preview-width);
    height: auto;
    overflow: hidden;
    border: 1px solid
      color-mix(in srgb, var(--theme-stroke, #fff) 72%, transparent);
    border-radius: clamp(1rem, 2cqi, 1.75rem);
    background:
      radial-gradient(
        circle at 50% 12%,
        rgba(104, 81, 255, 0.13),
        transparent 38%
      ),
      #08080c;
    box-shadow:
      0 2rem 5rem rgba(0, 0, 0, 0.4),
      0 0 0 0.35rem rgba(255, 255, 255, 0.035);
    isolation: isolate;
  }

  .rendered-media {
    display: contents;
  }

  .region {
    position: absolute;
    display: grid;
    place-items: center;
    overflow: hidden;
    min-width: 0;
    min-height: 0;
    padding: 0;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 0;
    background: rgba(255, 255, 255, 0.025);
    color: var(--theme-text, #fff);
    cursor: pointer;
    touch-action: none;
    transition:
      border-color var(--duration-fast, 120ms) ease,
      box-shadow var(--duration-fast, 120ms) ease;
  }

  .region:hover,
  .region.selected {
    border-color: color-mix(in srgb, var(--theme-accent, #8b7cff) 85%, white);
    box-shadow: inset 0 0 0 1px var(--theme-accent, #8b7cff);
  }

  .region.selected:not(.missing) {
    cursor: move;
  }

  .region:focus-visible {
    outline: 3px solid var(--theme-accent, #8b7cff);
    outline-offset: -4px;
  }

  .empty-source {
    display: grid;
    justify-items: center;
    gap: 0.375rem;
    padding: 1rem;
    text-align: center;
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.68));
  }

  .empty-source i {
    display: grid;
    place-items: center;
    width: 2.75rem;
    height: 2.75rem;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.08);
    font-size: 1rem;
  }

  .empty-source strong {
    color: var(--theme-text, #fff);
    font-size: max(var(--font-size-min, 0.875rem), 0.875rem);
  }

  .empty-source span {
    max-width: 13rem;
    font-size: max(var(--font-size-compact, 0.75rem), 0.75rem);
    line-height: 1.35;
  }

  .region-name {
    position: absolute;
    top: 0.5rem;
    left: 0.5rem;
    padding: 0.28rem 0.5rem;
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 999px;
    background: rgba(5, 5, 9, 0.74);
    color: rgba(255, 255, 255, 0.86);
    font-size: max(var(--font-size-compact, 0.75rem), 0.75rem);
    line-height: 1;
  }

  .instagram-chrome,
  .instagram-chrome > div {
    position: absolute;
    pointer-events: none;
    z-index: 20;
  }

  .instagram-chrome {
    inset: 0;
  }

  .top-zone {
    inset: 0 0 auto;
    height: 12%;
    background: linear-gradient(180deg, rgba(255, 145, 77, 0.13), transparent);
  }

  .right-zone {
    inset: 12% 0 21% auto;
    width: 12%;
    background: linear-gradient(270deg, rgba(255, 145, 77, 0.14), transparent);
  }

  .bottom-zone {
    inset: auto 0 0;
    height: 21%;
    background: linear-gradient(0deg, rgba(255, 145, 77, 0.16), transparent);
  }

  .safe-frame {
    inset: 12% 12% 21% 7%;
    border: 1px dashed rgba(255, 200, 154, 0.7);
    border-radius: 0.4rem;
  }

  .safe-frame span {
    position: absolute;
    right: 0.35rem;
    bottom: 0.35rem;
    padding: 0.2rem 0.35rem;
    border-radius: 0.3rem;
    background: rgba(8, 8, 12, 0.72);
    color: rgba(255, 222, 196, 0.9);
    font-size: max(var(--font-size-compact, 0.75rem), 0.75rem);
  }

  .preview-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: var(--preview-width);
    gap: 1rem;
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.66));
    font-size: max(var(--font-size-compact, 0.75rem), 0.75rem);
  }

  .format {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    color: var(--theme-text, #fff);
  }

  /* Length changes as layouts and performances swap; tabular digits keep the
     edit hint from sliding when 5.0 becomes 17.0. */
  .duration {
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.66));
    font-variant-numeric: tabular-nums;
  }

  .edit-hint {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }

  @container post-studio (min-width: 84rem) {
    .preview-shell {
      --preview-width: min(100%, calc((100cqb - 3rem) * 0.5625), 44rem);
    }
  }

  @container post-studio (min-width: 105rem) {
    .preview-shell {
      --preview-width: min(100%, calc((100cqb - 3.25rem) * 0.5625), 56rem);
    }

    .region-name,
    .safe-frame span,
    .preview-meta {
      font-size: var(--studio-body-size, 1rem);
    }
  }

  @container post-studio (min-width: 180rem) {
    .preview-shell {
      --preview-width: min(100%, calc((100cqb - 3.75rem) * 0.5625), 68rem);
    }
  }

  @container post-studio (max-width: 70rem) {
    .preview-shell {
      --preview-width: min(100%, clamp(17rem, min(52cqi, 45dvh), 34rem));
    }
  }

  @container post-studio (max-width: 38rem) {
    .preview-shell {
      --preview-width: min(100%, min(19rem, 36dvh));
    }
  }

  @media (max-height: 40rem) {
    .preview-shell {
      --preview-width: min(100%, 7rem);
    }

    .preview-meta {
      display: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .region {
      transition: none;
    }
  }
</style>
