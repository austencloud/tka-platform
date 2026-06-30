<!-- DecideStep — the first decision: Base movements (recommended) vs LOOPs. -->
<script lang="ts">
  import OptionCard from "./OptionCard.svelte";

  interface Props {
    onBase: () => void;
    onLoop: () => void;
  }
  let { onBase, onLoop }: Props = $props();
</script>

<div class="decide">
  <header class="intro">
    <h1>Where do you want to start?</h1>
    <p>Begin with the base movements, then see how they loop.</p>
  </header>
  <div class="cards">
    <OptionCard
      title="Base movements"
      description="The foundation — six families of timing and direction."
      accentColor="#3568a0"
      recommended
      onclick={onBase}
    />
    <OptionCard
      title="LOOPs"
      description="How the base movements repeat and transform."
      accentColor="#6a4199"
      onclick={onLoop}
    />
  </div>
</div>

<style>
  .decide {
    display: flex;
    flex-direction: column;
    gap: 2rem;
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
  }
  @media (max-width: 560px) {
    .cards { grid-template-columns: 1fr; }
  }
</style>
