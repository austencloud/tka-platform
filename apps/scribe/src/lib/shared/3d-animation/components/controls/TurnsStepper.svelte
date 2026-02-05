<script lang="ts">
  /**
   * TurnsStepper - Touch-friendly stepper for turn counts
   * Uses --theme-* and --prop-* CSS variables for consistent theming.
   * Supports 0, 0.5, 1, 1.5, 2, etc.
   */

  interface Props {
    /** Current value */
    value: number;
    /** Callback when value changes */
    onchange: (value: number) => void;
    /** Minimum value */
    min?: number;
    /** Maximum value */
    max?: number;
    /** Step increment */
    step?: number;
    /** Label */
    label?: string;
    /** Prop color for accent */
    color?: "blue" | "red";
  }

  let {
    value,
    onchange,
    min = 0,
    max = 4,
    step = 0.5,
    label = "Turns",
    color = "blue",
  }: Props = $props();

  function decrement() {
    const newValue = Math.max(min, value - step);
    onchange(newValue);
  }

  function increment() {
    const newValue = Math.min(max, value + step);
    onchange(newValue);
  }

  // Format display value
  const displayValue = $derived(
    value === 0
      ? "0"
      : value === Math.floor(value)
        ? value.toString()
        : value.toFixed(1)
  );
</script>

<div class="stepper" class:blue={color === "blue"} class:red={color === "red"}>
  <span class="label">{label}</span>

  <div class="controls">
    <button
      type="button"
      class="btn minus"
      onclick={decrement}
      disabled={value <= min}
      aria-label="Decrease turns"
    >
      <i class="fas fa-minus" aria-hidden="true"></i>
    </button>

    <span class="value">{displayValue}</span>

    <button
      type="button"
      class="btn plus"
      onclick={increment}
      disabled={value >= max}
      aria-label="Increase turns"
    >
      <i class="fas fa-plus" aria-hidden="true"></i>
    </button>
  </div>
</div>

<style>
  .stepper {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
  }

  .label {
    font-size: var(--font-size-compact, 0.75rem);
    text-transform: uppercase;
    color: var(--theme-text-dim);
    letter-spacing: 0.05em;
  }

  .controls {
    display: flex;
    align-items: center;
    gap: 2px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 8px;
    padding: 3px;
  }

  .btn {
    width: 48px; /* WCAG AAA touch target */
    height: 48px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--theme-card-hover-bg);
    border: none;
    border-radius: 8px;
    color: var(--theme-text);
    cursor: pointer;
    transition: all var(--duration-fast);
  }

  .blue .btn:hover:not(:disabled) {
    background: var(--prop-blue);
  }

  .red .btn:hover:not(:disabled) {
    background: var(--prop-red);
  }

  .btn:active:not(:disabled) {
    transform: scale(0.95);
  }

  .btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .btn i {
    font-size: var(--font-size-sm, 0.875rem);
  }

  .value {
    min-width: 2rem;
    text-align: center;
    font-size: var(--font-size-lg, 1.125rem);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--theme-text);
  }
</style>
