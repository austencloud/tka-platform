<script lang="ts">
  import PageFrame from '../_lib/PageFrame.svelte';
  import Pictograph from '../_lib/Pictograph.svelte';

  const root = '/guide/level-1/images/alpha-beta-words';
</script>

<PageFrame pageNumber={21} title="Letters">
  <p class="intro">
    Just like positions, each motion pictograph can be rotated, reflected, or color swapped.
    <br />
    Letters are organized on the page by end position, Alpha, Beta, then Gamma.
    <br />
    Let's look at each type individually.
  </p>

  <hr class="rule" />

  <h2 class="type-heading">
    <span class="type">Type 1 -</span>
    <span class="dual">Dual</span><span class="dash">-</span><span class="shift">Shift</span>
  </h2>

  <p class="prose">
    First we'll look at A, B, and C. Their handpath is <em>Split-Same</em> and they move from α→α:
  </p>

  <div class="labeled-grid">
    <div class="row-label">
      <div class="handpath">α→α</div>
      <div class="handpath-name"><em>Split-Same</em></div>
    </div>

    <div class="content">
      <div class="column-headers">
        <span><em>Pro</em></span>
        <span><em>Anti</em></span>
        <span><em>Hybrid</em></span>
      </div>
      <div class="pictograph-row bordered">
        <Pictograph src="{root}/A.png" alt="Letter A" size="lg" />
        <Pictograph src="{root}/B.png" alt="Letter B" size="lg" />
        <Pictograph src="{root}/C.png" alt="Letter C" size="lg" />
      </div>
    </div>
  </div>

  <p class="prose centered">
    Notice the pattern: <strong>Pro - Anti - Hybrid</strong>
    <br />
    This pattern helps you navigate/memorize the letters.
  </p>

  <p class="prose centered small-gap">
    If you only remember that A has prospins, you can infer that B has antispins.
    <br />
    If you only remember that B has antispins, you can infer that C is a hybrid.
    <br />
    <strong><em>If you memorize only one letter in each group, you know all of them.</em></strong>
  </p>

  <p class="prose centered">
    Next let's look at G, H, and I. Their handpaths are Tog-Same and they move from β→β:
  </p>

  <div class="labeled-grid">
    <div class="row-label">
      <div class="handpath">β→β</div>
      <div class="handpath-name"><em>Tog-Same</em></div>
    </div>

    <div class="content">
      <div class="column-headers">
        <span><em>Pro</em></span>
        <span><em>Anti</em></span>
        <span><em>Hybrid</em></span>
      </div>
      <div class="pictograph-row bordered">
        <Pictograph src="{root}/G.png" alt="Letter G" size="lg" />
        <Pictograph src="{root}/H.png" alt="Letter H" size="lg" />
        <Pictograph src="{root}/I.png" alt="Letter I" size="lg" />
      </div>
    </div>
  </div>

  <p class="prose centered">
    <strong>In hybrids like C and I, either hand can execute a prospin or antispin.</strong>
  </p>
  <p class="prose centered">
    Here, the <span class="red">right</span> is in pro and <span class="blue">left</span> in anti, but it's equally valid to swap this.
  </p>
</PageFrame>

<style>
  .intro {
    text-align: center;
    font-size: 1.05rem;
    margin: 0 0 0.6rem;
    line-height: 1.4;
  }

  .rule {
    border: none;
    border-top: 1.5px solid #1a1a1a;
    margin: 0.5rem 0 0.6rem;
  }

  .type-heading {
    text-align: center;
    font-size: 2.6rem;
    font-weight: 500;
    font-style: italic;
    margin: 0.4rem 0 0.6rem;
  }
  .type-heading .type { color: #1a1a1a; }
  .type-heading .dual { color: #4ea7e8; }
  .type-heading .dash { color: #4ea7e8; }
  .type-heading .shift { color: #6c5ba8; }

  .prose {
    font-size: 1.05rem;
    margin: 0.6rem 0;
    text-align: center;
  }
  .prose.centered { text-align: center; }
  .prose.small-gap { margin-top: 0.3rem; }

  .labeled-grid {
    display: grid;
    grid-template-columns: 110px 1fr;
    align-items: center;
    gap: 0.6rem;
    margin: 0.6rem 0;
  }

  .row-label {
    text-align: center;
  }
  .handpath {
    font-size: 1.5rem;
    font-weight: 500;
  }
  .handpath-name {
    font-size: 1.2rem;
  }

  .column-headers {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    text-align: center;
    font-size: 1.3rem;
    margin-bottom: 0.3rem;
  }

  .pictograph-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    align-items: center;
    justify-items: center;
  }
  .pictograph-row.bordered {
    border: 1.5px solid #1a1a1a;
  }
  .pictograph-row.bordered :global(.pictograph) {
    border-right: 1px solid #1a1a1a;
  }
  .pictograph-row.bordered :global(.pictograph:last-child) {
    border-right: none;
  }

  .red { color: #c1272d; font-weight: 600; }
  .blue { color: #1d3a86; font-weight: 600; }
</style>
