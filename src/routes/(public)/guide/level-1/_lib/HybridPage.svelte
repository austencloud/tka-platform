<script lang="ts">
  // A page where complex artwork stays embedded as an artboard PNG
  // but title and surrounding text are editable Svelte. Iterate by
  // replacing the embedded image with native components when ready.
  interface Props {
    pageNumber: number;
    title?: string;
    titleClass?: string;
    figureSrc?: string;
    figureAlt?: string;
    figureCrop?: 'top' | 'middle' | 'bottom' | 'full';
    figureMaxHeight?: string;
    intro?: import('svelte').Snippet;
    outro?: import('svelte').Snippet;
    children?: import('svelte').Snippet;
  }
  let {
    pageNumber,
    title,
    titleClass = '',
    figureSrc,
    figureAlt = '',
    figureCrop = 'full',
    figureMaxHeight,
    intro,
    outro,
    children,
  }: Props = $props();
</script>

<article class="hybrid-page" data-page={pageNumber}>
  {#if title}<h1 class="title {titleClass}">{title}</h1>{/if}
  {#if intro}<div class="intro">{@render intro()}</div>{/if}

  {#if children}
    <div class="body">{@render children()}</div>
  {/if}

  {#if figureSrc}
    <figure class="figure" data-crop={figureCrop}>
      <img src={figureSrc} alt={figureAlt} style:max-height={figureMaxHeight ?? 'none'} />
    </figure>
  {/if}

  {#if outro}<div class="outro">{@render outro()}</div>{/if}
</article>

<style>
  .hybrid-page {
    width: 8.5in;
    min-height: 11in;
    max-width: 100%;
    margin: 0 auto 2rem;
    padding: 0.6in 0.7in;
    background: white;
    color: #1a1a1a;
    box-shadow: 0 4px 24px rgba(0,0,0,0.12);
    box-sizing: border-box;
    font-family: 'Cormorant Garamond', Georgia, serif;
    font-size: 17px;
    line-height: 1.4;
  }
  .title {
    font-style: italic;
    font-weight: 500;
    font-size: 3rem;
    text-align: center;
    margin: 0 0 0.6rem;
  }
  .intro, .outro {
    text-align: center;
    margin: 0.4rem 0 0.8rem;
    line-height: 1.45;
  }
  .figure {
    margin: 0.8rem 0;
    text-align: center;
  }
  .figure img {
    max-width: 100%;
    height: auto;
  }
  .figure[data-crop="top"] img { object-position: top; }
  .figure[data-crop="middle"] img { object-position: center; }
  .figure[data-crop="bottom"] img { object-position: bottom; }
  .body { margin: 0.4rem 0; }
  :global(.hybrid-page p) { margin: 0 0 0.8em; }
  :global(.hybrid-page p.center) { text-align: center; }
  :global(.hybrid-page p.lead) { font-size: 1.1rem; text-align: center; }
  :global(.hybrid-page strong.red) { color: #c1272d; }
  :global(.hybrid-page strong.blue) { color: #1d3a86; }
  :global(.hybrid-page .red) { color: #c1272d; }
  :global(.hybrid-page .blue) { color: #1d3a86; }
  :global(.hybrid-page .dual) { color: #4ea7e8; }
  :global(.hybrid-page .shift) { color: #6c5ba8; }
  :global(.hybrid-page .cross) { color: #2e8540; }
  :global(.hybrid-page .dash) { color: #2e8540; }
  :global(.hybrid-page .static) { color: #d77a25; }
</style>
