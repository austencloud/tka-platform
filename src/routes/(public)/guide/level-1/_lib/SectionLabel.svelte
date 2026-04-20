<script lang="ts">
  interface Props {
    glyph: string;
    name: string;
  }
  let { glyph, name }: Props = $props();
</script>

<div class="section-label">
  <div class="glyph">{glyph}</div>
  <div class="name">{name}</div>
</div>

<style>
  .section-label {
    text-align: center;
    margin: 0.5rem 0 0.4rem;
  }
  .glyph {
    font-family: 'Cormorant Garamond', Georgia, serif;
    font-size: 3rem;
    font-weight: 500;
    line-height: 1;
  }
  .name {
    font-family: 'Cormorant Garamond', Georgia, serif;
    font-size: 1.85rem;
    font-style: normal;
    margin-top: -0.2rem;
  }
</style>
