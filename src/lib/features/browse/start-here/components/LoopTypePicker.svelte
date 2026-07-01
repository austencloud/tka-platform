<!-- LoopTypePicker — five teachable LOOP transformation types as OptionCards. -->
<script lang="ts">
  import OptionCard from "./OptionCard.svelte";

  interface LoopOption {
    type: string;
    title: string;
    description: string;
    accent: string;
  }
  const OPTIONS: LoopOption[] = [
    { type: "rotated", title: "Rotated", description: "Positions keep turning the same way.", accent: "#ffde17" },
    { type: "mirrored", title: "Mirrored", description: "Left and right swap across the vertical.", accent: "#3568a0" },
    { type: "swapped", title: "Swapped", description: "Blue and red hands trade roles.", accent: "#f2673a" },
    { type: "inverted", title: "Inverted", description: "Pro and anti motions flip.", accent: "#75A874" },
    { type: "flipped", title: "Flipped", description: "Top and bottom swap across the horizontal.", accent: "#6a4199" },
  ];

  interface Props {
    onSelect: (type: string) => void;
  }
  let { onSelect }: Props = $props();
</script>

<div class="picker">
  <header class="intro">
    <h2>Pick a LOOP type</h2>
    <p>Each is a way a base movement repeats and transforms.</p>
  </header>
  <div class="grid">
    {#each OPTIONS as o (o.type)}
      <OptionCard
        title={o.title}
        description={o.description}
        accentColor={o.accent}
        onclick={() => onSelect(o.type)}
      />
    {/each}
  </div>
</div>

<style>
  .picker {
    height: 100%;
    overflow-y: auto;
    max-width: 920px;
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
  @media (max-width: 560px) {
    .grid { grid-template-columns: 1fr 1fr; }
  }
</style>
