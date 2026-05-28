<script lang="ts">
  import PictographRenderer from "$lib/shared/pictograph/shared/components/PictographRenderer.svelte";
  import { pictographPreparer } from "$lib/shared/pictograph/shared/services/implementations/PictographPreparer";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
  import type { PreparedPictographData } from "$lib/shared/pictograph/shared/domain/models/PreparedPictographData";

  let {
    data,
    pngFallback,
    size = "md",
    label,
    bordered = false,
    showGrid = true,
  }: {
    data?: PictographData | null;
    pngFallback?: string;
    size?: "sm" | "md" | "lg";
    label?: string;
    bordered?: boolean;
    showGrid?: boolean;
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
      .prepareSingle(data, { themeMode: "light" })
      .then((result) => {
        if (!cancelled) prepared = result;
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
