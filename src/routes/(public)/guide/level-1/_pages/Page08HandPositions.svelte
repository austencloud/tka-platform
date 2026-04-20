<script lang="ts">
  import PageFrame from '../_lib/PageFrame.svelte';
  import Pictograph from '../_lib/Pictograph.svelte';
  import Sequence from '../_lib/Sequence.svelte';
  import SectionLabel from '../_lib/SectionLabel.svelte';
  import Caption from '../_lib/Caption.svelte';

  const root = '/guide/level-1/images/hand-positions';
  const alpha = ['α1', 'α3', 'α5', 'α7'];
  const beta = ['β1', 'β3', 'β5', 'β7'];
  const gammaRow1 = ['Γ1', 'Γ3', 'Γ5', 'Γ7'];
  const gammaRow2 = ['Γ9', 'Γ11', 'Γ13', 'Γ15'];
</script>

<PageFrame pageNumber={8} title="Hand Positions">
  <p class="intro">
    There are multiple ways to combine two hand points to form a hand position.
    Positions can be rotated or mirrored.
    <strong><span class="red">Red&nbsp;=&nbsp;Right</span> and <span class="blue">Blue&nbsp;=&nbsp;Left</span>.</strong>
    <br />
    In The Kinetic Alphabet, our first three positions are called Alpha, Beta, and Gamma.
  </p>

  <section class="position-section">
    <SectionLabel glyph="α" name="Alpha" />
    <Sequence columns={4} gap="0">
      {#each alpha as id}
        <Pictograph src="{root}/{id}.png" alt="Alpha variation {id}" size="md" />
      {/each}
    </Sequence>
    <Caption>In Alpha, the hands occupy the points across from each other.</Caption>
  </section>

  <hr class="rule" />

  <section class="position-section">
    <SectionLabel glyph="β" name="Beta" />
    <Sequence columns={4} gap="0">
      {#each beta as id}
        <Pictograph src="{root}/{id}.png" alt="Beta variation {id}" size="md" />
      {/each}
    </Sequence>
    <Caption>In Beta, the hands occupy the same point.</Caption>
  </section>

  <hr class="rule" />

  <section class="position-section">
    <SectionLabel glyph="Γ" name="Gamma" />
    <Sequence columns={4} gap="0">
      {#each gammaRow1 as id}
        <Pictograph src="{root}/{id}.png" alt="Gamma variation {id}" size="md" />
      {/each}
    </Sequence>
    <Sequence columns={4} gap="0">
      {#each gammaRow2 as id}
        <Pictograph src="{root}/{id}.png" alt="Gamma variation {id}" size="md" />
      {/each}
    </Sequence>
    <Caption>In Gamma, the hands form a right angle.</Caption>
  </section>
</PageFrame>

<style>
  .intro {
    text-align: center;
    font-size: 1.05rem;
    margin: 0 0 1.4rem;
    line-height: 1.4;
  }
  .red { color: #c1272d; }
  .blue { color: #1d3a86; }

  .position-section {
    margin: 0.6rem 0 0.9rem;
  }

  .rule {
    border: none;
    border-top: 1.5px solid #1a1a1a;
    margin: 0.4rem 0 0.6rem;
  }
</style>
