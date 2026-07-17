<script lang="ts">
  /**
   * The "one beat, written down" proof beside the what-is-TKA answer: a real
   * pictograph from the same CSV data the app runs on. Dynamic-imported by
   * the FAQ host (FaqInterview) as the section scrolls near, so it costs the
   * landing bundle nothing.
   */
  import { onMount } from "svelte";
  import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import { getIntroPictograph } from "../faq/faq-pictographs";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";

  let { caption = "One beat of a real sequence, written down." }: { caption?: string } = $props();

  let data = $state<PictographData | null>(null);
  let settled = $state(false);

  onMount(async () => {
    data = await getIntroPictograph();
    settled = true;
  });
</script>

<!-- Frame is a fixed square reserved before the async prepare resolves, so the
     pictograph popping in never reflows the accordion (no-layout-shift). If the
     data genuinely fails to load, the whole figure collapses once, cleanly. -->
{#if !settled || data}
  <figure class="faq-demo">
    <div class="frame">
      {#if data}
        <PictographContainer
          pictographData={data}
          gridMode={GridMode.DIAMOND}
          showGrid={true}
          showTKA={true}
          showReversals={false}
          showPositions={false}
          showHandPoints={true}
          darkMode={true}
          disableTransitions={true}
        />
      {/if}
    </div>
    <figcaption>{caption}</figcaption>
  </figure>
{/if}

<style>
  .faq-demo {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    margin: 0;
  }

  .frame {
    width: 180px;
    aspect-ratio: 1;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: 12px;
    overflow: hidden;
  }

  figcaption {
    font-size: 0.82rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    text-align: center;
  }

  /* Phone tier: a touch larger so the beat reads at arm's length. */
  @media (max-width: 600px) {
    .frame {
      width: 200px;
    }
  }

  /* 4K tier: scale the artifact with the type around it. */
  @media (min-width: 2200px) {
    .frame {
      width: 230px;
    }

    figcaption {
      font-size: 0.95rem;
    }
  }
</style>
