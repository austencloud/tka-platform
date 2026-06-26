<script lang="ts">
  import GuideSection from "../../_components/GuideSection.svelte";
  import GuideDiagram from "../../_components/GuideDiagram.svelte";
</script>

<GuideSection id="codex-type-1-2" title="Double Staff Codex">
  <p>
    Just like positions, each motion pictograph can be rotated, reflected, or color swapped.
    Letters are organized on the page by end position, Alpha, Beta, then Gamma.
    Let's look at each type individually.
  </p>

  <h3 class="type-dual-shift">Type 1: Dual-Shift</h3>
  <div class="codex-grid codex-grid--type1">
    {#each ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V"] as letter}
      <figure class="codex-cell">
        <img
          src="/guide/level-1/images/double-staff-codex/{letter}.webp"
          alt="Letter {letter}"
          loading="lazy"
        />
        <figcaption>{letter}</figcaption>
      </figure>
    {/each}
  </div>

  <h3 class="type-shift">Type 2: Shift</h3>
  <div class="codex-grid codex-grid--type2">
    {#each ["W", "X", "Y", "Z", "Σ", "Δ", "θ", "Ω"] as letter}
      <figure class="codex-cell">
        <img
          src="/guide/level-1/images/double-staff-codex/{letter}.webp"
          alt="Letter {letter}"
          loading="lazy"
        />
        <figcaption>{letter}</figcaption>
      </figure>
    {/each}
  </div>
</GuideSection>

<style>
  .codex-grid {
    display: grid;
    gap: 0.75rem;
    margin: 1.5rem 0;
    justify-items: center;
  }

  .codex-grid--type1 {
    grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
  }

  .codex-grid--type2 {
    grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
  }

  .codex-cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    margin: 0;
  }

  .codex-cell img {
    width: 90px;
    height: 90px;
    object-fit: contain;
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    background: #fff;
  }

  .codex-cell figcaption {
    font-size: 0.85rem;
    font-weight: 600;
    color: #444;
    text-align: center;
  }

  @media (prefers-color-scheme: dark) {
    .codex-cell img {
      background: #1a1a1a;
      border-color: #333;
    }
  }
</style>
