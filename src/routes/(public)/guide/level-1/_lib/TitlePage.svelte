<script lang="ts">
  interface Props {
    pageNumber: number;
    section: string;
    parts: string[];
  }
  let { pageNumber, section, parts }: Props = $props();
</script>

<article class="title-page" data-page={pageNumber}>
  <div class="section-num">{section}</div>
  <div class="parts">
    {#each parts as part}
      <div class="part">{part}</div>
    {/each}
  </div>
</article>

<style>
  .title-page {
    width: 8.5in;
    min-height: 11in;
    max-width: 100%;
    margin: 0 auto 2rem;
    padding: 0;
    background: white;
    color: #1a1a1a;
    box-shadow: 0 4px 24px rgba(0,0,0,0.12);
    box-sizing: border-box;
    font-family: 'Cormorant Garamond', Georgia, serif;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
  }
  .section-num {
    font-size: 6rem;
    font-style: italic;
    font-weight: 500;
    line-height: 1;
  }
  .parts {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.4rem;
  }
  .part {
    font-size: 4rem;
    font-style: italic;
    font-weight: 500;
    line-height: 1.05;
  }
</style>
