<script lang="ts">
  import PictographRenderer from "$lib/shared/pictograph/shared/components/PictographRenderer.svelte";
  import { pictographPreparer } from "$lib/shared/pictograph/shared/services/pictograph-preparer";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
  import type { PreparedPictographData } from "$lib/shared/pictograph/shared/domain/models/prepared-pictograph-data";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";

  let {
    data,
    pngFallback,
    size = "md",
    label,
    bordered = false,
    showGrid = true,
    showArrows = true,
    propType,
  }: {
    data?: PictographData | null;
    pngFallback?: string;
    size?: "sm" | "md" | "lg";
    label?: string;
    bordered?: boolean;
    showGrid?: boolean;
    showArrows?: boolean;
    propType?: PropType;
  } = $props();

  let prepared: PreparedPictographData | null = $state(null);
  let wrapperEl: HTMLElement | undefined = $state();
  let isVisible = $state(false);

  $effect(() => {
    if (!wrapperEl) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          isVisible = true;
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(wrapperEl);
    return () => observer.disconnect();
  });

  $effect(() => {
    if (!data || !isVisible) {
      prepared = null;
      return;
    }
    let cancelled = false;
    pictographPreparer
      .prepareSingle(data, {
        themeMode: "light",
        ...(propType ? { bluePropType: propType, redPropType: propType } : {}),
      })
      .then((result) => {
        if (cancelled) return;
        const prep = result._prepared;
        if (prep) {
          const tweakedArrows = showArrows
            ? { arrowPositions: prep.arrowPositions, arrowAssets: prep.arrowAssets, arrowMirroring: prep.arrowMirroring }
            : { arrowPositions: {}, arrowAssets: {}, arrowMirroring: {} };

          const tweakedPropAssets = { ...prep.propAssets };
          if (propType === PropType.HAND && tweakedPropAssets.red) {
            const [w] = tweakedPropAssets.red.viewBox.split(" ").map(Number);
            tweakedPropAssets.red = {
              ...tweakedPropAssets.red,
              imageSrc: `<g transform="translate(${w},0) scale(-1,1)">${tweakedPropAssets.red.imageSrc}</g>`,
            };
          }

          prepared = {
            ...result,
            _prepared: { ...prep, ...tweakedArrows, propAssets: tweakedPropAssets },
          };
        } else {
          prepared = result;
        }
      });
    return () => {
      cancelled = true;
    };
  });
</script>

<div bind:this={wrapperEl} class="guide-pictograph size-{size}" class:bordered>
  <div class="pictograph-wrapper">
    {#if prepared}
      <PictographRenderer
        pictograph={prepared}
        {showGrid}
        showTKA={true}
        showReversals={false}
        showTnD={false}
        showElemental={false}
        showPositions={false}
        showNonRadialPoints={false}
        blueMotionVisible={true}
        redMotionVisible={true}
      />
    {:else if pngFallback}
      <img class="fallback-img" src={pngFallback} alt={label ?? "pictograph"} loading="lazy" />
      {#if import.meta.env.DEV}
        <span class="fallback-badge">PNG</span>
      {/if}
    {/if}
  </div>
  {#if label}
    <span class="pictograph-label">{label}</span>
  {/if}
</div>

<style>
  .guide-pictograph {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }

  .pictograph-wrapper {
    width: 100%;
    aspect-ratio: 1;
  }

  .guide-pictograph.size-sm .pictograph-wrapper {
    max-width: 140px;
  }

  .guide-pictograph.size-md .pictograph-wrapper {
    max-width: 200px;
  }

  .guide-pictograph.size-lg .pictograph-wrapper {
    max-width: 280px;
  }

  .guide-pictograph.bordered .pictograph-wrapper {
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 8px;
    overflow: hidden;
  }

  .pictograph-label {
    font-size: 0.8rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    text-align: center;
  }

  .fallback-img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .fallback-badge {
    position: absolute;
    top: 4px;
    right: 4px;
    font-size: 0.6rem;
    padding: 1px 4px;
    background: rgba(255, 165, 0, 0.8);
    border-radius: 3px;
    color: black;
    font-weight: 600;
  }
</style>
