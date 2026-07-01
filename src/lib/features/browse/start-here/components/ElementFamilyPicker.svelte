<!-- ElementFamilyPicker — six elemental TnD family tiles from TND_ELEMENTS. -->
<script lang="ts">
  import { TND_ELEMENTS } from "$lib/features/choreo-card/domain/tnd-element";

  interface Props {
    onSelect: (familyId: string) => void;
  }
  let { onSelect }: Props = $props();
</script>

<div class="picker">
  <header class="intro">
    <h2>Pick a base family</h2>
    <p>Each element is a way the two hands move in time and direction.</p>
  </header>
  <div class="grid">
    {#each TND_ELEMENTS as fam (fam.familyId)}
      <button
        class="tile"
        type="button"
        style="--accent: {fam.accentColor}"
        onclick={() => onSelect(fam.familyId)}
      >
        <img src={fam.iconPath} alt="" width="64" height="64" loading="eager" />
        <span class="name">{fam.name}</span>
        <span class="element">{fam.element}</span>
      </button>
    {/each}
  </div>
</div>

<style>
  .picker {
    height: 100%;
    overflow-y: auto;
    max-width: 860px;
    margin: 0 auto;
    padding: 1.5rem 1.25rem;
    display: flex;
    flex-direction: column;
    justify-content: safe center;
    gap: 1.5rem;
  }
  .intro { text-align: center; }
  .intro h2 { font-size: 1.5rem; font-weight: 800; margin: 0 0 0.4rem; }
  .intro p { color: var(--theme-text-muted, #9aa6b8); margin: 0; }
  .grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
  }
  .tile {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.4rem;
    padding: 1.25rem 0.75rem;
    min-height: 150px;
    border-radius: 16px;
    border: 2px solid color-mix(in srgb, var(--accent) 40%, transparent);
    background: color-mix(in srgb, var(--accent) 12%, var(--theme-surface, #11151f));
    color: var(--theme-text, #e8edf6);
    cursor: pointer;
    transition: border-color 150ms ease, transform 150ms ease;
  }
  .tile:hover { border-color: var(--accent); transform: translateY(-2px); }
  .tile:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
  .tile img {
    width: 64px;
    height: 64px;
    object-fit: contain;
  }
  .name { font-weight: 700; }
  .element {
    font-size: 0.8rem;
    text-transform: capitalize;
    color: var(--theme-text-muted, #9aa6b8);
  }
  @media (max-width: 560px) {
    .grid { grid-template-columns: repeat(2, 1fr); }
  }
  @media (prefers-reduced-motion: reduce) {
    .tile { transition: none; }
    .tile:hover { transform: none; }
  }
</style>
