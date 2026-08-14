<!--
  One numeric editing interaction for dense creative tools: drag horizontally,
  click to type an exact value, or use the keyboard. Feature surfaces decide
  where it sits; this component owns the interaction and accessibility rules.
-->
<script lang="ts">
  interface Props {
    value: number;
    min: number;
    max: number;
    step: number;
    label: string;
    unit?: string;
    format?: (value: number) => string;
    showLabel?: boolean;
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
    showLabel = true,
    onchange,
  }: Props = $props();

  let editing = $state(false);
  let editValue = $state("");
  let inputRef = $state<HTMLInputElement | null>(null);
  let dragStartX = 0;
  let dragStartValue = 0;
  let activePointerId: number | null = null;
  let hasDragged = false;

  const precision = $derived(
    Math.max(0, String(step).split(".")[1]?.length ?? 0)
  );
  const displayValue = $derived(
    format ? format(value) : value.toFixed(precision)
  );

  function clamp(nextValue: number): number {
    return Math.max(min, Math.min(max, nextValue));
  }

  function commit(nextValue: number): void {
    if (!Number.isFinite(nextValue)) return;
    onchange(clamp(nextValue));
  }

  function beginEditing(): void {
    editing = true;
    editValue = String(Number(value.toFixed(Math.max(precision, 2))));
    requestAnimationFrame(() => inputRef?.select());
  }

  function handlePointerDown(event: PointerEvent): void {
    if (editing || event.button !== 0) return;
    const target = event.currentTarget as HTMLButtonElement;
    target.setPointerCapture(event.pointerId);
    activePointerId = event.pointerId;
    dragStartX = event.clientX;
    dragStartValue = value;
    hasDragged = false;
  }

  function handlePointerMove(event: PointerEvent): void {
    if (editing || activePointerId !== event.pointerId) return;
    const deltaX = event.clientX - dragStartX;
    if (Math.abs(deltaX) > 2) hasDragged = true;
    if (!hasDragged) return;
    const sensitivity = event.shiftKey ? step * 0.1 : step;
    commit(dragStartValue + deltaX * sensitivity);
  }

  function handlePointerUp(event: PointerEvent): void {
    if (editing || activePointerId !== event.pointerId) return;
    const target = event.currentTarget as HTMLButtonElement;
    if (target.hasPointerCapture(event.pointerId)) {
      target.releasePointerCapture(event.pointerId);
    }
    activePointerId = null;
    if (!hasDragged) beginEditing();
  }

  function handlePointerCancel(event: PointerEvent): void {
    if (activePointerId !== event.pointerId) return;
    activePointerId = null;
    hasDragged = false;
  }

  function handleWheel(event: WheelEvent): void {
    if (editing) return;
    event.preventDefault();
    const direction = event.deltaY > 0 ? -1 : 1;
    const multiplier = event.shiftKey ? 0.1 : 1;
    commit(value + direction * step * multiplier);
  }

  function commitEdit(): void {
    const parsed = Number.parseFloat(editValue);
    if (Number.isFinite(parsed)) commit(parsed);
    editing = false;
  }

  function handleInputKeydown(event: KeyboardEvent): void {
    if (event.key === "Enter") commitEdit();
    if (event.key === "Escape") editing = false;
  }

  function handleDisplayKeydown(event: KeyboardEvent): void {
    const fineStep = event.shiftKey ? step * 0.1 : step;
    const largeStep = step * 10;
    let nextValue: number | null = null;
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      nextValue = value - fineStep;
    } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      nextValue = value + fineStep;
    } else if (event.key === "PageDown") {
      nextValue = value - largeStep;
    } else if (event.key === "PageUp") {
      nextValue = value + largeStep;
    } else if (event.key === "Home") {
      nextValue = min;
    } else if (event.key === "End") {
      nextValue = max;
    } else if (event.key === "Enter") {
      beginEditing();
    }
    if (nextValue === null) return;
    event.preventDefault();
    commit(nextValue);
  }
</script>

<div class="scrubbable-number" class:without-label={!showLabel}>
  {#if showLabel}
    <span class="scrub-label">{label}</span>
  {/if}
  {#if editing}
    <input
      bind:this={inputRef}
      bind:value={editValue}
      class="scrub-input"
      type="number"
      inputmode="decimal"
      {min}
      {max}
      {step}
      aria-label={`Set ${label}`}
      onblur={commitEdit}
      onkeydown={handleInputKeydown}
    />
  {:else}
    <button
      type="button"
      class="scrub-display"
      aria-label={`${label}: ${displayValue}${unit}. Drag, press an arrow key, or enter an exact value.`}
      onpointerdown={handlePointerDown}
      onpointermove={handlePointerMove}
      onpointerup={handlePointerUp}
      onpointercancel={handlePointerCancel}
      onwheel={handleWheel}
      onkeydown={handleDisplayKeydown}
    >
      <span class="scrub-arrows" aria-hidden="true">◂</span>
      <span class="scrub-reading">{displayValue}{unit}</span>
      <span class="scrub-arrows" aria-hidden="true">▸</span>
    </button>
  {/if}
</div>

<style>
  .scrubbable-number {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm, 0.5rem);
    min-width: 0;
  }

  .scrubbable-number.without-label {
    justify-content: flex-end;
  }

  .scrub-label {
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact);
    white-space: nowrap;
    user-select: none;
  }

  .scrub-display,
  .scrub-input {
    box-sizing: border-box;
    min-width: 5rem;
    min-height: var(--min-touch-target, 2.75rem);
    padding: 0.35rem 0.5rem;
    border: 1px solid var(--theme-stroke);
    border-radius: var(--radius-2026-xs, 0.35rem);
    color: var(--theme-text);
    font: inherit;
    font-size: var(--font-size-compact);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    text-align: center;
  }

  .scrub-display {
    display: inline-grid;
    grid-template-columns: auto minmax(2.5rem, auto) auto;
    align-items: center;
    gap: 0.25rem;
    background: var(--theme-card-bg);
    cursor: ew-resize;
    touch-action: none;
    user-select: none;
  }

  .scrub-input {
    width: 5.5rem;
    background: var(--theme-panel-bg);
    border-color: var(--theme-accent);
    outline: none;
  }

  .scrub-arrows {
    color: var(--theme-text-dim);
    opacity: 0.7;
  }

  .scrub-reading {
    white-space: nowrap;
  }

  @media (hover: hover) and (pointer: fine) {
    .scrub-display:hover {
      border-color: var(--theme-accent);
      background: var(--theme-card-hover-bg);
    }

    .scrub-display:hover .scrub-arrows {
      color: var(--theme-accent);
      opacity: 1;
    }
  }

  .scrub-display:focus-visible,
  .scrub-input:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }
</style>
