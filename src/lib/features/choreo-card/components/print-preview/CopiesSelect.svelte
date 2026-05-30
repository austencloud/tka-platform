<script lang="ts">
  interface Props {
    value: number;
    onchange: (n: number) => void;
    presets?: number[];
  }

  let { value, onchange, presets = [1, 3, 6, 9, 12] }: Props = $props();

  const isCustom = $derived(!presets.includes(value));

  // Mirror the field to `value` only while it holds a custom (non-preset) count,
  // so picking a preset visually clears the field's active state.
  let customText = $state(String(value));
  $effect(() => {
    if (isCustom) customText = String(value);
  });

  function commitCustom() {
    const n = Math.max(1, Math.floor(Number(customText) || 1));
    customText = String(n);
    onchange(n);
  }

  function onCustomKey(e: KeyboardEvent) {
    if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
  }
</script>

<div class="copies-select" role="radiogroup" aria-label="Copies per card">
  {#each presets as p (p)}
    <button
      type="button"
      class="copies-option"
      class:active={value === p}
      role="radio"
      aria-checked={value === p}
      aria-label="{p} {p === 1 ? 'copy' : 'copies'} per card"
      onclick={() => onchange(p)}
    >
      {p}
    </button>
  {/each}
  <input
    class="copies-custom"
    class:active={isCustom}
    type="number"
    min="1"
    inputmode="numeric"
    aria-label="Custom copies per card"
    placeholder="…"
    bind:value={customText}
    onblur={commitCustom}
    onkeydown={onCustomKey}
  />
</div>

<style>
  .copies-select {
    display: flex;
    align-items: stretch;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    overflow: hidden;
  }

  .copies-option {
    min-width: 36px;
    min-height: 36px;
    padding: 6px 12px;
    font-size: var(--font-size-compact, 13px);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    background: transparent;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    border: none;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }

  .copies-option:not(:last-child),
  .copies-custom {
    border-right: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .copies-option.active {
    background: var(--theme-accent, #4a9eff);
    color: var(--theme-text, #fff);
  }

  .copies-option:hover:not(.active) {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    color: var(--theme-text, #fff);
  }

  .copies-custom {
    width: 56px;
    min-height: 36px;
    padding: 6px 8px;
    text-align: center;
    font-size: var(--font-size-compact, 13px);
    font-variant-numeric: tabular-nums;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    background: transparent;
    border-top: none;
    border-bottom: none;
    border-right: none;
    border-left: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    transition: background 0.15s, color 0.15s;
  }

  .copies-custom.active {
    background: var(--theme-accent, #4a9eff);
    color: var(--theme-text, #fff);
  }

  .copies-custom:focus {
    outline: none;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.08));
    color: var(--theme-text, #fff);
  }

  /* Strip the native spinner — TKA bans stepper controls. */
  .copies-custom::-webkit-outer-spin-button,
  .copies-custom::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  .copies-custom {
    -moz-appearance: textfield;
    appearance: textfield;
  }
</style>
