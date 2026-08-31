<script lang="ts">
  interface Props {
    blue: string;
    red: string;
    blueLabel?: string;
    redLabel?: string;
    onchange: (hand: "blue" | "red", value: string) => void;
  }

  let {
    blue,
    red,
    blueLabel = "Left prop",
    redLabel = "Right prop",
    onchange,
  }: Props = $props();

  let blueInput: HTMLInputElement | undefined = $state();
  let redInput: HTMLInputElement | undefined = $state();

  const entries = $derived([
    { hand: "blue" as const, label: blueLabel, value: blue, input: blueInput },
    { hand: "red" as const, label: redLabel, value: red, input: redInput },
  ]);
</script>

<div class="color-pair" aria-label="Prop colors">
  <span
    class="pair-preview"
    style:background={`linear-gradient(90deg, ${blue}, ${red})`}
    aria-hidden="true"
  ></span>
  <div class="pair-controls">
    {#each entries as entry (entry.hand)}
      <button
        type="button"
        class="color-control"
        style:--color={entry.value}
        aria-label={`Edit ${entry.label}, ${entry.value.toUpperCase()}`}
        onclick={() => entry.input?.click()}
      >
        <span class="color-swatch" aria-hidden="true">
          <i class="fas fa-eye-dropper"></i>
        </span>
        <span class="color-meta">
          <span class="color-label">{entry.label}</span>
          <span class="color-value">{entry.value.toUpperCase()}</span>
        </span>
      </button>
    {/each}
    <input
      bind:this={blueInput}
      class="native-color"
      type="color"
      value={blue}
      tabindex="-1"
      aria-hidden="true"
      oninput={(event) =>
        onchange("blue", (event.currentTarget as HTMLInputElement).value)}
    />
    <input
      bind:this={redInput}
      class="native-color"
      type="color"
      value={red}
      tabindex="-1"
      aria-hidden="true"
      oninput={(event) =>
        onchange("red", (event.currentTarget as HTMLInputElement).value)}
    />
  </div>
</div>

<style>
  .color-pair {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
    container: color-pair / inline-size;
  }

  .pair-preview {
    display: block;
    width: 100%;
    height: 14px;
    border-radius: 999px;
    box-shadow:
      inset 0 0 0 1px rgba(255, 255, 255, 0.12),
      0 2px 8px rgba(0, 0, 0, 0.35);
  }

  .pair-controls {
    position: relative;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .color-control {
    min-width: 0;
    min-height: 52px;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: 12px;
    background: color-mix(
      in srgb,
      var(--theme-card-bg, rgba(255, 255, 255, 0.04)) 70%,
      transparent
    );
    color: var(--theme-text, #fff);
    cursor: pointer;
    overflow: hidden;
    -webkit-tap-highlight-color: transparent;
    transition:
      border-color var(--transition-fast, 150ms),
      box-shadow var(--transition-fast, 150ms);
  }

  .color-control:hover {
    border-color: color-mix(
      in srgb,
      var(--color) 50%,
      var(--theme-stroke, rgba(255, 255, 255, 0.2))
    );
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--color) 40%, transparent);
  }

  .color-control:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--color) 70%, white);
    outline-offset: 2px;
  }

  .color-swatch {
    flex: 0 0 auto;
    width: 34px;
    height: 34px;
    display: grid;
    place-items: center;
    border-radius: 9px;
    background: var(--color);
    box-shadow:
      inset 0 0 0 1px rgba(255, 255, 255, 0.25),
      0 2px 6px color-mix(in srgb, var(--color) 45%, transparent);
    color: rgba(255, 255, 255, 0.95);
    font-size: 12px;
  }

  .color-swatch i {
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.6));
  }

  .color-meta {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
    text-align: left;
  }

  .color-label {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.68));
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
  }

  .color-value {
    color: var(--theme-text, #fff);
    font-family: ui-monospace, "SF Mono", monospace;
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
    letter-spacing: 0.02em;
  }

  .native-color {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    border: 0;
    opacity: 0;
    pointer-events: none;
  }

  @container (max-width: 19rem) {
    .pair-controls {
      grid-template-columns: 1fr;
    }
  }
</style>
