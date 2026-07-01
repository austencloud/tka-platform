<!-- DecideStep — first decision: Base movements (recommended) vs LOOPs, plus a
     "skip to the full gallery" escape below. -->
<script lang="ts">
  import OptionCard from "./OptionCard.svelte";
  import { TND_ELEMENTS } from "$lib/features/choreo-card/domain/tnd-element";

  interface Props {
    onBase: () => void;
    onLoop: () => void;
    onBrowseAll?: () => void;
  }
  let { onBase, onLoop, onBrowseAll }: Props = $props();
</script>

<div class="decide">
  <header class="intro">
    <h1>Where do you want to start?</h1>
    <p>Begin with Timing &amp; Direction, then see how it loops.</p>
  </header>

  <div class="cards">
    <OptionCard
      title="Timing &amp; Direction"
      description="The six families every sequence is built from."
      accentColor="#3568a0"
      recommended
      onclick={onBase}
      icon={baseArt}
    />
    <OptionCard
      title="LOOPs"
      description="How the base movements repeat and transform."
      accentColor="#6a4199"
      onclick={onLoop}
      icon={loopArt}
    />
  </div>

  {#if onBrowseAll}
    <button class="advanced" type="button" onclick={onBrowseAll}>
      Skip to the full gallery →
    </button>
  {/if}
</div>

{#snippet baseArt()}
  <div class="element-cluster">
    {#each TND_ELEMENTS as fam (fam.familyId)}
      <img src={fam.iconPath} alt="" width="30" height="30" />
    {/each}
  </div>
{/snippet}

{#snippet loopArt()}
  <i class="fas fa-arrows-rotate loop-glyph" aria-hidden="true"></i>
{/snippet}

<style>
  .decide {
    height: 100%;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: safe center;
    gap: 1.75rem;
    max-width: 760px;
    margin: 0 auto;
    padding: 2rem 1.25rem;
  }
  .intro { text-align: center; }
  .intro h1 { font-size: 1.9rem; font-weight: 800; margin: 0 0 0.5rem; }
  .intro p { color: var(--theme-text-muted, #9aa6b8); margin: 0; }
  .cards {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.25rem;
    width: 100%;
  }
  .element-cluster {
    display: flex;
    gap: 5px;
    align-items: center;
  }
  .element-cluster img { object-fit: contain; }
  .loop-glyph { font-size: 3rem; color: #b79ae0; }
  .advanced {
    background: transparent;
    border: 1px solid var(--theme-border, #2a3140);
    color: var(--theme-text, #e8edf6);
    padding: 0.6rem 1.2rem;
    border-radius: 999px;
    cursor: pointer;
    font-size: 0.95rem;
    transition: border-color 150ms ease, background-color 150ms ease;
  }
  .advanced:hover {
    border-color: var(--theme-accent, #6aa0ff);
    background: color-mix(in srgb, var(--theme-accent, #6aa0ff) 10%, transparent);
  }
  @media (max-width: 560px) {
    .cards { grid-template-columns: 1fr; }
  }
</style>
