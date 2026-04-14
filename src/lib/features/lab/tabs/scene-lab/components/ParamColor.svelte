<script lang="ts">
  /**
   * ParamColor
   *
   * Labeled color picker + hex text input for scene param colors.
   */

  interface Props {
    label: string;
    value: string;
    onChange: (next: string) => void;
  }

  let { label, value, onChange }: Props = $props();
</script>

<div class="param-color">
  <span class="label">{label}</span>
  <div class="controls">
    <input
      type="color"
      {value}
      oninput={(e) => onChange(e.currentTarget.value)}
    />
    <input
      type="text"
      {value}
      onchange={(e) => {
        const v = e.currentTarget.value.trim();
        if (/^#[0-9a-fA-F]{6}$/.test(v)) onChange(v);
      }}
    />
  </div>
</div>

<style>
  .param-color {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 4px 0;
  }

  .label {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    font-weight: 500;
  }

  .controls {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  input[type="color"] {
    width: 32px;
    height: 24px;
    padding: 0;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: 4px;
    background: transparent;
    cursor: pointer;
  }

  input[type="color"]::-webkit-color-swatch-wrapper {
    padding: 2px;
  }

  input[type="color"]::-webkit-color-swatch {
    border: none;
    border-radius: 2px;
  }

  input[type="text"] {
    width: 72px;
    padding: 4px 6px;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 6px;
    color: var(--theme-text, white);
    font-size: var(--font-size-compact, 12px);
    font-family: ui-monospace, "SF Mono", monospace;
    text-align: center;
  }

  input[type="text"]:focus {
    outline: none;
    border-color: var(--theme-accent, #38bdf8);
  }
</style>
