<script lang="ts">
  interface Annotation {
    blanks: number;
    perfect: boolean;
  }

  interface Props {
    value: number;
    onchange: (n: number) => void;
    presets?: number[];
    /** Optional per-count waste readout. When provided, each chip shows a tiny
     *  badge ("fit" for zero-blank, else the blank count) and the custom field
     *  shows the live blanks for whatever is typed. */
    annotate?: (n: number) => Annotation | null;
  }

  let { value, onchange, presets = [1, 3, 6, 9, 12], annotate }: Props = $props();

  const isCustom = $derived(!presets.includes(value));

  let customText = $state(String(value));
  $effect(() => {
    if (isCustom) customText = String(value);
  });

  // The single "best" count: smallest preset that fills every sheet (zero waste).
  // Only this chip wears the FITS badge — a perfect fit can be true for several
  // counts, but flagging the smallest keeps one clear, legible "use this" marker
  // instead of a row of tiny duplicate badges.
  const bestFit = $derived.by(() => {
    if (!annotate) return null;
    for (const p of [...presets].sort((a, b) => a - b)) {
      if (annotate(p)?.perfect) return p;
    }
    return null;
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
    {@const a = annotate?.(p)}
    <button
      type="button"
      class="copies-option"
      class:active={value === p}
      class:perfect={p === bestFit}
      role="radio"
      aria-checked={value === p}
      aria-label="{p} {p === 1 ? 'copy' : 'copies'} per card{a ? (a.perfect ? ', fills every sheet' : `, ${a.blanks} blank cells`) : ''}"
      title={a ? (a.perfect ? "Fills every sheet — no wasted cards" : `${a.blanks} blank cells`) : undefined}
      onclick={() => onchange(p)}
    >
      <span class="copies-num">{p}</span>
      {#if p === bestFit}<span class="copies-badge">fits</span>{/if}
    </button>
  {/each}
  <div class="copies-custom-wrap" class:active={isCustom}>
    <input
      class="copies-custom"
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
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    min-width: 40px;
    min-height: 40px;
    padding: 4px 10px;
    background: transparent;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    border: none;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }

  .copies-option:not(:last-child),
  .copies-custom-wrap {
    border-right: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .copies-num {
    font-size: var(--font-size-compact, 13px);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    line-height: 1.1;
  }

  .copies-badge {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    opacity: 0.85;
    line-height: 1.1;
  }

  .copies-option.active {
    background: var(--theme-accent, #4a9eff);
    color: var(--theme-text, #fff);
  }

  /* Perfect-fit chips get a subtle green tint when not selected. */
  .copies-option.perfect:not(.active) .copies-badge {
    color: #4ade80;
    opacity: 1;
  }

  .copies-option:hover:not(.active) {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    color: var(--theme-text, #fff);
  }

  .copies-custom-wrap {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    border-left: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .copies-custom-wrap.active {
    background: var(--theme-accent, #4a9eff);
  }

  .copies-custom {
    width: 56px;
    min-height: 40px;
    padding: 4px 6px;
    text-align: center;
    font-size: var(--font-size-compact, 13px);
    font-variant-numeric: tabular-nums;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    background: transparent;
    border: none;
    transition: color 0.15s;
  }

  .copies-custom-wrap.active .copies-custom {
    color: var(--theme-text, #fff);
  }

  .copies-custom:focus {
    outline: none;
  }

  .copies-custom-wrap:focus-within {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.08));
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
