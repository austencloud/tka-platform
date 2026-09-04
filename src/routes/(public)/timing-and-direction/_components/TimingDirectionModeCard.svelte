<script lang="ts">
  import { TND_BY_FAMILY } from "$lib/features/choreo-card/domain/tnd-element";
  import type { TimingDirectionArticle } from "../_data/timing-direction-articles";

  let {
    article,
    compact = false,
  }: {
    article: TimingDirectionArticle;
    compact?: boolean;
  } = $props();

  const element = $derived(TND_BY_FAMILY[article.familyId]);
</script>

<a
  class="mode-card"
  class:compact
  href={`/timing-and-direction/${article.slug}`}
  style:--mode-accent={element?.accentColor}
>
  {#if element}
    <img class="element-icon" src={element.iconPath} alt="" />
  {/if}
  <span class="mode-copy">
    <span class="mode-code">{article.code}</span>
    <strong>{article.name}</strong>
    <small>{article.phase} phase · {article.direction} direction</small>
  </span>
  <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
</a>

<style>
  .mode-card {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.85rem;
    min-height: 7.5rem;
    padding: 1rem 1.1rem;
    color: var(--theme-text);
    text-decoration: none;
    border: 1px solid
      color-mix(in oklch, var(--mode-accent) 30%, var(--theme-stroke));
    border-radius: var(--radius-lg, 0.75rem);
    background: color-mix(
      in oklch,
      var(--mode-accent) 8%,
      var(--theme-card-bg)
    );
  }

  .mode-card:hover {
    border-color: color-mix(
      in oklch,
      var(--mode-accent) 64%,
      var(--theme-stroke-strong)
    );
    background: color-mix(
      in oklch,
      var(--mode-accent) 13%,
      var(--theme-card-bg)
    );
  }

  .mode-card:focus-visible {
    outline: 2px solid var(--mode-accent);
    outline-offset: 3px;
  }

  .element-icon {
    width: 2.65rem;
    height: 2.65rem;
    object-fit: contain;
  }

  .mode-copy {
    display: grid;
    gap: 0.22rem;
    min-width: 0;
  }

  .mode-code {
    color: color-mix(in oklch, var(--mode-accent) 72%, var(--theme-text));
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 800;
    letter-spacing: 0.12em;
  }

  strong {
    font-size: var(--font-size-base, 1rem);
    line-height: 1.2;
  }

  small {
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact, 0.75rem);
    line-height: 1.35;
  }

  i {
    color: var(--mode-accent);
  }

  .mode-card.compact {
    min-height: 6rem;
    padding: 0.8rem 0.9rem;
  }

  .compact .element-icon {
    width: 2.15rem;
    height: 2.15rem;
  }
</style>
