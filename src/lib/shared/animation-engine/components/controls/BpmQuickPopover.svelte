<!--
  BpmQuickPopover.svelte

  Content-only BPM setter for a popover: common presets, an exact typed entry,
  and tap-tempo. Positioning + dismissal are the caller's job (wrap it in a
  bits-ui Popover.Content, as PracticeBar does). Emits onBpmChange on every
  pick/commit/tap; onClose fires after a one-shot pick (preset) so the caller can
  close. Reused so the "tap the BPM, set any value" UX is one component, not a
  third hand-rolled copy of the inline popovers in TempoControl / BpmChips.
-->
<script lang="ts">
  import {
    PLAYBACK_MIN_BPM,
    PLAYBACK_MAX_BPM,
  } from "$lib/shared/animation-engine/domain/constants/timing";

  const PRESETS = [15, 30, 60, 90, 120, 150] as const;
  const TAP_TIMEOUT_MS = 2000;
  const MAX_TAP_HISTORY = 8;

  interface Props {
    bpm: number;
    min?: number;
    max?: number;
    onBpmChange: (bpm: number) => void;
    /** Fires after a one-shot pick (preset chip) so the caller can close. */
    onClose?: () => void;
  }

  let { bpm, min = PLAYBACK_MIN_BPM, max = PLAYBACK_MAX_BPM, onBpmChange, onClose }: Props = $props();

  function clamp(v: number): number {
    return Math.max(min, Math.min(max, v));
  }

  // Typed exact entry — a local draft committed on Enter / blur / Set, so a
  // partial number ("1" while typing "120") never clamps the live tempo.
  let draft = $state(String(bpm));
  let editing = $state(false);
  // Resync the field when the tempo changes from outside (preset, tap, steppers)
  // unless the user is mid-edit.
  $effect(() => {
    const next = String(bpm);
    if (!editing) draft = next;
  });

  function commitDraft() {
    const n = Number.parseInt(draft, 10);
    if (Number.isFinite(n)) {
      const c = clamp(n);
      draft = String(c);
      if (c !== bpm) onBpmChange(c);
    } else {
      draft = String(bpm);
    }
    editing = false;
  }

  function pickPreset(v: number) {
    const c = clamp(v);
    if (c !== bpm) onBpmChange(c);
    onClose?.();
  }

  // Tap-tempo: average the last few intervals into a BPM. Keeps the popover open.
  let tapTimes: number[] = $state([]);
  let tapTimeout: ReturnType<typeof setTimeout> | null = null;
  let isTapping = $derived(tapTimes.length > 0);

  function handleTap() {
    const now = Date.now();
    if (tapTimeout !== null) clearTimeout(tapTimeout);
    tapTimes = [...tapTimes, now].slice(-MAX_TAP_HISTORY);

    if (tapTimes.length >= 2) {
      const intervals: number[] = [];
      for (let i = 1; i < tapTimes.length; i++) {
        const cur = tapTimes[i];
        const prev = tapTimes[i - 1];
        if (cur !== undefined && prev !== undefined) intervals.push(cur - prev);
      }
      const avg = intervals.reduce((s, v) => s + v, 0) / intervals.length;
      if (avg > 0) onBpmChange(clamp(Math.round(60000 / avg)));
    }

    tapTimeout = setTimeout(() => (tapTimes = []), TAP_TIMEOUT_MS);
  }

  $effect(() => () => {
    if (tapTimeout !== null) clearTimeout(tapTimeout);
  });
</script>

<div class="bpm-quick" role="group" aria-label="Set tempo">
  <div class="bq-presets">
    {#each PRESETS as preset}
      <button
        type="button"
        class="bq-preset"
        class:active={bpm === preset}
        onclick={() => pickPreset(preset)}
        aria-label={`Set tempo to ${preset} BPM`}
        aria-pressed={bpm === preset}
      >
        {preset}
      </button>
    {/each}
  </div>

  <div class="bq-exact">
    <label class="bq-exact-label" for="bq-exact-input">Exact</label>
    <input
      id="bq-exact-input"
      class="bq-exact-input"
      type="number"
      inputmode="numeric"
      {min}
      {max}
      bind:value={draft}
      onfocus={() => (editing = true)}
      oninput={() => (editing = true)}
      onblur={commitDraft}
      onkeydown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commitDraft();
        }
      }}
      aria-label="Exact tempo in BPM"
    />
    <span class="bq-exact-unit">BPM</span>
    <button type="button" class="bq-set" onclick={commitDraft}>Set</button>
  </div>

  <button
    type="button"
    class="bq-tap"
    class:tapping={isTapping}
    onclick={handleTap}
    aria-label="Tap to set tempo"
  >
    <i class="fas fa-hand-pointer" aria-hidden="true"></i>
    <span>{isTapping ? `Tap · ${tapTimes.length}` : "Tap tempo"}</span>
  </button>
</div>

<style>
  .bpm-quick {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 240px;
    padding: 14px;
    background: var(--theme-panel-bg, #0c0e16);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: 16px;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.55);
  }

  .bq-presets {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  .bq-preset {
    min-height: var(--min-touch-target, 44px);
    padding: 8px 6px;
    border-radius: 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.05));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    cursor: pointer;
    transition: all var(--duration-fast, 150ms) ease;
    -webkit-tap-highlight-color: transparent;
  }
  .bq-preset:active {
    transform: scale(0.96);
  }
  .bq-preset.active {
    background: color-mix(in srgb, var(--theme-accent, #8b5cf6) 28%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent, #8b5cf6) 55%, transparent);
    color: color-mix(in srgb, var(--theme-accent, #c4b5fd) 82%, white);
  }
  @media (hover: hover) and (pointer: fine) {
    .bq-preset:hover:not(.active) {
      background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.1));
      color: var(--theme-text, #fff);
    }
  }
  .bq-preset:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .bq-exact {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .bq-exact-label {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.55));
  }
  .bq-exact-input {
    flex: 1;
    min-width: 0;
    height: var(--min-touch-target, 44px);
    padding: 0 10px;
    border-radius: 10px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.14));
    color: var(--theme-text, #fff);
    font-size: 1.05rem;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    text-align: center;
  }
  /* Hide native spinners — the presets + Set cover stepping. */
  .bq-exact-input::-webkit-outer-spin-button,
  .bq-exact-input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  .bq-exact-input {
    -moz-appearance: textfield;
    appearance: textfield;
  }
  .bq-exact-input:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 1px;
    border-color: color-mix(in srgb, var(--theme-accent, #8b5cf6) 55%, transparent);
  }
  .bq-exact-unit {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }
  .bq-set {
    height: var(--min-touch-target, 44px);
    padding: 0 14px;
    border-radius: 10px;
    background: color-mix(in srgb, var(--theme-accent, #8b5cf6) 22%, transparent);
    border: 1.5px solid color-mix(in srgb, var(--theme-accent, #8b5cf6) 50%, transparent);
    color: color-mix(in srgb, var(--theme-accent, #c4b5fd) 85%, white);
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    cursor: pointer;
    transition: all var(--duration-fast, 150ms) ease;
    -webkit-tap-highlight-color: transparent;
  }
  .bq-set:active {
    transform: scale(0.96);
  }
  .bq-set:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .bq-tap {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: var(--min-touch-target, 44px);
    padding: 10px 14px;
    border-radius: 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.05));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.72));
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
    cursor: pointer;
    transition: all var(--duration-fast, 150ms) ease;
    -webkit-tap-highlight-color: transparent;
  }
  .bq-tap.tapping {
    background: color-mix(in srgb, var(--theme-accent, #8b5cf6) 20%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent, #8b5cf6) 50%, transparent);
    color: color-mix(in srgb, var(--theme-accent, #c4b5fd) 82%, white);
  }
  @media (hover: hover) and (pointer: fine) {
    .bq-tap:hover {
      background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.1));
      color: var(--theme-text, #fff);
    }
  }
  .bq-tap:active {
    transform: scale(0.98);
  }
  .bq-tap:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .bq-preset,
    .bq-set,
    .bq-tap {
      transition: none;
    }
    .bq-preset:active,
    .bq-set:active,
    .bq-tap:active {
      transform: none;
    }
  }
</style>
