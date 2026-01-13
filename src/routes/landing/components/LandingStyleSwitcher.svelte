<script lang="ts">
  type LandingStyle = "current" | "amplified" | "metallic" | "nightsky";

  interface Props {
    style?: LandingStyle;
    onStyleChange?: (style: LandingStyle) => void;
  }

  let { style = "current", onStyleChange }: Props = $props();

  const styles: { id: LandingStyle; label: string; desc: string }[] = [
    { id: "current", label: "Current", desc: "Subtle grays" },
    { id: "amplified", label: "Amplified", desc: "Boosted colors" },
    { id: "metallic", label: "Metallic", desc: "Bold blue/red" },
    { id: "nightsky", label: "Night Sky", desc: "Animated stars" },
  ];

  function selectStyle(id: LandingStyle) {
    onStyleChange?.(id);
  }
</script>

<div class="style-switcher">
  <span class="label">Style:</span>
  <div class="options">
    {#each styles as s}
      <button
        class="option"
        class:active={style === s.id}
        onclick={() => selectStyle(s.id)}
        title={s.desc}
      >
        {s.label}
      </button>
    {/each}
  </div>
</div>

<style>
  .style-switcher {
    position: fixed;
    top: 16px;
    right: 16px;
    z-index: 9999;
    display: flex;
    align-items: center;
    gap: 12px;
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(8px);
    padding: 8px 16px;
    border-radius: 24px;
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  .label {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.6);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .options {
    display: flex;
    gap: 4px;
  }

  .option {
    padding: 6px 12px;
    border: none;
    background: transparent;
    color: rgba(255, 255, 255, 0.6);
    font-size: 13px;
    border-radius: 16px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .option:hover {
    color: white;
    background: rgba(255, 255, 255, 0.1);
  }

  .option.active {
    color: white;
    background: rgba(99, 102, 241, 0.6);
  }
</style>
