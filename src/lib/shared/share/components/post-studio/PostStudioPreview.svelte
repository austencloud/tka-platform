<script lang="ts">
  import type { EvaluatedFrameLayer } from "$lib/shared/media-composition/services/frame-evaluator";
  import { getMediaCompositionContext } from "$lib/shared/media-composition/state/media-composition-context";
  import PostStudioMediaLayer from "./PostStudioMediaLayer.svelte";
  import OverflowMenu from "$lib/shared/ui/components/OverflowMenu.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import type { SequenceExportOptions } from "$lib/shared/render/domain/models/sequence-export-options";
  import {
    POST_STUDIO_SOURCES,
    POST_STUDIO_SOURCE_ORDER,
    type PostStudioRoleKey,
  } from "$lib/shared/media-composition/domain/post-studio-presets";
  import type { PostStudioSlotId } from "$lib/shared/media-composition/domain/post-studio-slots";

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
      // Same rule the layer itself renders by: everything except
      // `external-media` draws from the sequence and needs no file. Listing the
      // modes by name here meant every new source type shipped with its own
      // slot both drawing the media AND telling the user it was missing.
      return (
        binding?.status === "ready" &&
        (Boolean(binding.previewUrl) || binding.renderMode !== "external-media")
      );
    });
  }

  function sourceIcon(kind: string): string {
    if (kind === "video") return "fa-solid fa-video";
    if (kind === "sequence-animation") return "fa-solid fa-person-running";
    if (kind === "choreo-card") return "fa-solid fa-table-cells-large";
    if (kind === "tunnel") return "fa-solid fa-circle-notch";
    if (kind === "scene-3d") return "fa-solid fa-cube";
    if (kind === "mandala") return "fa-solid fa-asterisk";
    return "fa-solid fa-photo-film";
  }

  const ROLE_ICON: Record<PostStudioRoleKey, string> = {
    "sequence-animation": "fa-solid fa-person-running",
    "performance-video": "fa-solid fa-video",
    "choreo-card": "fa-solid fa-table-cells-large",
    "sequence-tunnel": "fa-solid fa-circle-notch",
    "sequence-scene-3d": "fa-solid fa-cube",
    "sequence-mandala": "fa-solid fa-asterisk",
  };

  function isSlot(regionId: string): regionId is PostStudioSlotId {
    return regionId === "top" || regionId === "bottom";
  }

  /**
   * The whole source list for one slot, plus Remove. This is the entire
   * "choose what goes here" interaction — it replaced a rail of layout
   * templates and a rail of sources, neither of which could express a pairing
   * the four presets did not already contain.
   */
  function sourceMenuItems(slot: PostStudioSlotId, current: string | null) {
    const canRemove = composition.regions.length > 1;
    const items = POST_STUDIO_SOURCE_ORDER.map((roleKey) => {
      const source = POST_STUDIO_SOURCES[roleKey];
      const blocked = !composition.slotAccepts(slot, roleKey);
      return {
        label: source.label,
        icon: ROLE_ICON[roleKey],
        selected: current === roleKey,
        disabled: blocked,
        hint: blocked ? "Already in the other slot" : undefined,
        action: () => composition.setSlotSource(slot, roleKey),
      };
    });

    return canRemove
      ? [
          ...items,
          {
            label: "Remove",
            icon: "fa-solid fa-trash-can",
            variant: "danger" as const,
            action: () => composition.clearSlot(slot),
          },
        ]
      : items;
  }

  /**
   * Delete on a selected slot is what Austen went looking for and did not find.
   * It lives on the region surface rather than the document so it cannot fire
   * while a text field elsewhere in the studio has focus.
   */
  function handleRegionKeydown(event: KeyboardEvent, regionId: string): void {
    if (event.key !== "Delete" && event.key !== "Backspace") return;
    if (!isSlot(regionId) || composition.regions.length < 2) return;
    event.preventDefault();
    composition.clearSlot(regionId);
  }

  const canSwap = $derived(
    composition.regions.length === 2 &&
      composition.regions.every((region) => isSlot(region.id))
  );

  /** The seam between the two slots, as a percentage from the top. */
  const seamPercent = $derived(
    (composition.regions.find((region) => region.id === "bottom")?.y ?? 0.5) *
      100
  );

  const emptySlot = $derived<PostStudioSlotId | null>(
    composition.regions.length === 1 && isSlot(composition.regions[0]!.id)
      ? composition.regions[0]!.id === "top"
        ? "bottom"
        : "top"
      : null
  );
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
      <!-- The slot chip is a menu trigger, so it cannot nest inside the drag
           surface — a button in a button is invalid and the inner one would
           never receive its own clicks. They are siblings in a positioned
           wrapper instead, both independently focusable. -->
      <div
        class="region"
        class:selected={composition.selectedRegion?.id === region.id}
        class:missing={!hasVisibleSource}
        style={regionStyle(region)}
      >
        <button
          type="button"
          class="region-surface"
          aria-pressed={composition.selectedRegion?.id === region.id}
          aria-label={`Edit ${region.label ?? "region"}${binding?.status === "missing" ? "; source missing" : ""}`}
          onpointerdown={(event) => beginDrag(event, region.id, roleKey)}
          onpointermove={moveDrag}
          onpointerup={endDrag}
          onpointercancel={endDrag}
          onkeydown={(event) => handleRegionKeydown(event, region.id)}
          onclick={() => handleRegionClick(region.id, roleKey)}
        >
          {#each layers as layer (layer.clipId)}
            {@const layerBinding = composition.bindingForRole(layer.sourceRole)}
            {#if layerBinding?.status === "ready" && (layerBinding.previewUrl || layerBinding.renderMode !== "external-media")}
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
        </button>

        {#if isSlot(region.id)}
          {@const slot = region.id}
          <div class="region-chip">
            <OverflowMenu
              items={sourceMenuItems(slot, roleKey)}
              placement="bottom"
              align="left"
              triggerClass="chip-trigger"
              ariaLabel={`${region.label ?? "Slot"} source; change or remove`}
            >
              {#snippet trigger()}
                <i class={ROLE_ICON[roleKey as PostStudioRoleKey]} aria-hidden="true"
                ></i>
                <span>{region.label ?? "Slot"}</span>
                <i class="fa-solid fa-chevron-down caret" aria-hidden="true"></i>
              {/snippet}
            </OverflowMenu>
          </div>
        {/if}
      </div>
    {/each}

    {#if canSwap}
      <button
        type="button"
        class="seam-swap"
        style={`top:${seamPercent}%`}
        onclick={() => composition.swapSlots()}
        aria-label="Swap the top and bottom slots"
        title="Swap slots"
      >
        <i class="fa-solid fa-arrow-up-arrow-down" aria-hidden="true"></i>
      </button>
    {/if}

    {#if emptySlot}
      <!-- The collapsed state is a genuine full-frame single, so there is no
           empty box to click. The affordance rides the edge the new slot would
           appear on instead. -->
      <div class="add-slot" class:at-top={emptySlot === "top"}>
        <OverflowMenu
          items={sourceMenuItems(emptySlot, null)}
          placement={emptySlot === "top" ? "bottom" : "top"}
          align="left"
          triggerClass="chip-trigger add-trigger"
          ariaLabel={`Add a ${emptySlot} slot`}
        >
          {#snippet trigger()}
            <i class="fa-solid fa-plus" aria-hidden="true"></i>
            <span>Add {emptySlot} slot</span>
          {/snippet}
        </OverflowMenu>
      </div>
    {/if}

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
    overflow: hidden;
    min-width: 0;
    min-height: 0;
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: var(--theme-text, #fff);
    transition:
      border-color var(--duration-fast, 120ms) ease,
      box-shadow var(--duration-fast, 120ms) ease;
  }

  .region-surface {
    display: grid;
    place-items: center;
    width: 100%;
    height: 100%;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: rgba(255, 255, 255, 0.025);
    color: inherit;
    cursor: pointer;
    touch-action: none;
  }

  /* Selection marks the WHOLE slot — a ring, never a bar down one edge. The
     slot is the thing selected, so the whole thing says so. */
  .region:hover,
  .region.selected {
    border-color: color-mix(in srgb, var(--theme-accent, #8b7cff) 85%, white);
    box-shadow: inset 0 0 0 2px var(--theme-accent, #8b7cff);
  }

  .region.selected:not(.missing) .region-surface {
    cursor: move;
  }

  .region-surface:focus-visible {
    outline: 3px solid var(--theme-accent, #8b7cff);
    outline-offset: -4px;
  }

  .region-chip {
    position: absolute;
    top: 0.5rem;
    left: 0.5rem;
    z-index: 21;
  }

  /* Shared by the slot chip and the add-slot chip, both of which are triggers
     inside OverflowMenu rather than plain buttons. */
  .region-chip :global(.chip-trigger),
  .add-slot :global(.chip-trigger) {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    min-height: 2rem;
    padding: 0.3rem 0.6rem;
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-radius: 999px;
    background: rgba(5, 5, 9, 0.82);
    color: rgba(255, 255, 255, 0.9);
    font-size: max(var(--font-size-compact, 0.75rem), 0.75rem);
    line-height: 1;
    cursor: pointer;
    transition:
      border-color var(--duration-fast, 120ms) ease,
      background var(--duration-fast, 120ms) ease;
  }

  .region-chip :global(.chip-trigger:hover),
  .add-slot :global(.chip-trigger:hover) {
    border-color: var(--theme-accent, #8b7cff);
    background: rgba(5, 5, 9, 0.94);
  }

  .region-chip :global(.chip-trigger:focus-visible),
  .add-slot :global(.chip-trigger:focus-visible) {
    outline: 2px solid var(--theme-accent, #8b7cff);
    outline-offset: 2px;
  }

  .region-chip :global(.caret) {
    font-size: 0.62em;
    opacity: 0.65;
  }

  /* Straddles the seam so it reads as belonging to both slots rather than to
     whichever one happens to sit behind it — but on the right edge, not the
     centre: the slot chips are top-left in each region, and at a 240px-wide
     frame a centred swap lands on top of the lower one. */
  .seam-swap {
    position: absolute;
    right: 0.5rem;
    z-index: 22;
    display: grid;
    place-items: center;
    width: 2.25rem;
    height: 2.25rem;
    translate: 0 -50%;
    border: 1px solid
      color-mix(in srgb, var(--theme-accent, #8b7cff) 70%, transparent);
    border-radius: 999px;
    /* It floats over whatever the two slots happen to be showing, which at 9:16
       is usually dark video. A 20%-white hairline on near-black vanished into
       it; the accent edge plus an opaque ground is what makes it a control. */
    background: #0b0b12;
    box-shadow: 0 0 0 3px rgba(5, 5, 9, 0.7);
    color: var(--theme-accent, #8b7cff);
    cursor: pointer;
    transition:
      border-color var(--duration-fast, 120ms) ease,
      background var(--duration-fast, 120ms) ease,
      color var(--duration-fast, 120ms) ease;
  }

  .seam-swap:hover {
    border-color: var(--theme-accent, #8b7cff);
    background: var(--theme-accent, #8b7cff);
    color: #0b0b12;
  }

  .seam-swap:focus-visible {
    outline: 2px solid var(--theme-accent, #8b7cff);
    outline-offset: 2px;
  }

  .add-slot {
    position: absolute;
    bottom: 0.75rem;
    left: 50%;
    z-index: 22;
    translate: -50% 0;
  }

  .add-slot.at-top {
    top: 0.75rem;
    bottom: auto;
  }

  .add-slot :global(.add-trigger) {
    border-style: dashed;
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

  @container post-studio (min-width: 84rem) {
    .preview-shell {
      --preview-width: min(100%, calc((100cqb - 3rem) * 0.5625), 44rem);
    }
  }

  @container post-studio (min-width: 105rem) {
    .preview-shell {
      --preview-width: min(100%, calc((100cqb - 3.25rem) * 0.5625), 56rem);
    }

    .safe-frame span,
    .preview-meta {
      font-size: var(--studio-body-size, 1rem);
    }

    .region-chip :global(.chip-trigger),
    .add-slot :global(.chip-trigger) {
      min-height: var(--studio-control-height, 2.5rem);
      padding-inline: 0.85rem;
      font-size: var(--studio-body-size, 1rem);
    }

    .seam-swap {
      width: var(--studio-control-height, 2.75rem);
      height: var(--studio-control-height, 2.75rem);
    }
  }

  @container post-studio (min-width: 180rem) {
    .preview-shell {
      --preview-width: min(100%, calc((100cqb - 3.75rem) * 0.5625), 68rem);
    }
  }

  /* Wide-and-short (a folded Fold in landscape) starves the 9:16 frame down to
     ~112px, where a chip carrying its source name is wider than the whole
     preview. The name drops to the trigger's aria-label and the glyph carries
     it — the caret still says "this opens something". */
  @container post-studio-stage (max-height: 22rem) {
    .region-chip :global(.chip-trigger span),
    .add-slot :global(.chip-trigger span) {
      display: none;
    }

    .seam-swap {
      width: 1.75rem;
      height: 1.75rem;
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
