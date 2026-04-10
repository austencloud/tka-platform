<!--
  ScrubValue.svelte — Figma-style drag-to-scrub number control.

  Hover: cursor becomes ew-resize.
  Drag left/right: value changes by step per pixel.
  Click without dragging: enters edit mode (type exact value).
  Scroll wheel: adjusts value by step.
-->
<script lang="ts">
  interface Props {
    value: number;
    min: number;
    max: number;
    step: number;
    label: string;
    unit?: string;
    /** Format the display value (default: round to nearest integer) */
    format?: (v: number) => string;
    onchange: (value: number) => void;
  }

  let {
    value,
    min,
    max,
    step,
    label,
    unit = "",
    format,
    onchange,
  }: Props = $props();

  let editing = $state(false);
  let editValue = $state("");
  let inputRef = $state<HTMLInputElement | null>(null);
  let dragStartX = 0;
  let dragStartValue = 0;
  let hasDragged = false;

  const displayValue = $derived(
    format ? format(value) : String(Math.round(value))
  );

  function clamp(v: number): number {
    return Math.max(min, Math.min(max, v));
  }

  function handlePointerDown(e: PointerEvent): void {
    if (editing) return;
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    dragStartX = e.clientX;
    dragStartValue = value;
    hasDragged = false;
  }

  function handlePointerMove(e: PointerEvent): void {
    if (editing) return;
    const target = e.currentTarget as HTMLElement;
    if (!target.hasPointerCapture(e.pointerId)) return;

    const dx = e.clientX - dragStartX;
    if (Math.abs(dx) > 2) hasDragged = true;

    if (hasDragged) {
      // Sensitivity: 1 step per pixel by default, hold shift for 10x precision
      const sensitivity = e.shiftKey ? step * 0.1 : step;
      const newValue = clamp(dragStartValue + dx * sensitivity);
      onchange(newValue);
    }
  }

  function handlePointerUp(e: PointerEvent): void {
    if (editing) return;
    const target = e.currentTarget as HTMLElement;
    target.releasePointerCapture(e.pointerId);

    if (!hasDragged) {
      // Click without drag: enter edit mode
      editing = true;
      editValue = format ? format(value) : String(Math.round(value * 100) / 100);
      // Focus the input after Svelte renders it
      requestAnimationFrame(() => {
        inputRef?.select();
      });
    }
  }

  function handleWheel(e: WheelEvent): void {
    if (editing) return;
    e.preventDefault();
    const direction = e.deltaY > 0 ? -1 : 1;
    const multiplier = e.shiftKey ? 0.1 : 1;
    onchange(clamp(value + direction * step * multiplier));
  }

  function commitEdit(): void {
    const parsed = parseFloat(editValue);
    if (!isNaN(parsed)) {
      onchange(clamp(parsed));
    }
    editing = false;
  }

  function handleKeyDown(e: KeyboardEvent): void {
    if (e.key === "Enter") {
      commitEdit();
    } else if (e.key === "Escape") {
      editing = false;
    }
  }
</script>

<div class="scrub-value">
  <span class="scrub-label">{label}</span>
  {#if editing}
    <input
      bind:this={inputRef}
      type="text"
      class="scrub-input"
      bind:value={editValue}
      onblur={commitEdit}
      onkeydown={handleKeyDown}
    />
  {:else}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <span
      class="scrub-display"
      onpointerdown={handlePointerDown}
      onpointermove={handlePointerMove}
      onpointerup={handlePointerUp}
      onwheel={handleWheel}
    >
      <span class="scrub-arrows" aria-hidden="true">&#x25C2;</span>
      {displayValue}{unit}
      <span class="scrub-arrows" aria-hidden="true">&#x25B8;</span>
    </span>
  {/if}
</div>

<style>
  .scrub-value {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .scrub-label {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-secondary, #94a3b8);
    white-space: nowrap;
    user-select: none;
  }

  .scrub-display {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--theme-text-primary, #e2e8f0);
    cursor: ew-resize;
    user-select: none;
    padding: 0.2rem 0.4rem;
    border-radius: 4px;
    border: 1px solid var(--theme-stroke, rgba(255 255 255 / 0.12));
    background: rgba(255 255 255 / 0.04);
    transition: border-color 0.15s, background 0.15s;
    min-width: 50px;
    text-align: center;
    touch-action: none;
    white-space: nowrap;
  }

  .scrub-arrows {
    font-size: 8px;
    color: var(--theme-text-secondary, #94a3b8);
    opacity: 0.5;
    transition: opacity 0.15s;
  }

  .scrub-display:hover {
    border-color: var(--theme-accent, #3b82f6);
    background: rgba(255 255 255 / 0.07);
  }

  .scrub-display:hover .scrub-arrows {
    opacity: 1;
  }

  .scrub-display:active {
    border-color: var(--theme-accent, #3b82f6);
    background: rgba(255 255 255 / 0.1);
  }

  .scrub-input {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--theme-text-primary, #e2e8f0);
    background: rgba(0 0 0 / 0.3);
    border: 1px solid var(--theme-accent, #3b82f6);
    border-radius: 4px;
    padding: 0.2rem 0.4rem;
    min-width: 50px;
    text-align: center;
    outline: none;
  }
</style>
