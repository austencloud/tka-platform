<!--
  FusePairingTile — the Pairing slot on the header's recipe rail.

  Every other slot is a button that opens an editor. Pairing is the one recipe
  decision with a state in which there is nothing to edit, so the switch itself
  lives here: choosing Linked is what opens the rule editor, and choosing
  Separate is what puts it away. That is why the mode is not also a row inside
  the editor — a Separate path set has no rule, and a panel showing only a
  switch is a panel showing nothing.
-->
<script lang="ts">
  import { getFuseContext } from "../context/fuse-context";
  import { fuseRuleLabel } from "../domain/fuse-rule";
  import type { FuseMode } from "../state/fuse-state.svelte";
  import FuseModeBar from "./FuseModeBar.svelte";

  let {
    color,
    shadowColor,
    textColor = "white",
    disabled = false,
    onModeChange,
    onEditRule,
  }: {
    color: string;
    shadowColor: string;
    textColor?: string;
    disabled?: boolean;
    onModeChange: (mode: FuseMode) => void;
    onEditRule: () => void;
  } = $props();

  const { state: fuseState } = getFuseContext();
  const linked = $derived(fuseState.mode === "symmetry");
  const ruleLabel = $derived(fuseRuleLabel(fuseState.rule));
  const driverLabel = $derived(
    fuseState.driverSide === "blue" ? "Blue" : "Red"
  );
</script>

<div
  class="pairing-tile"
  role="group"
  aria-label="Pairing"
  style="--recipe-color: {color}; --recipe-shadow: {shadowColor}; --recipe-text: {textColor};"
>
  <div class="tile-head">
    <span class="tile-label">Pairing</span>

    <!-- Reserved either way, so switching modes never resizes the header. -->
    <span class="tile-trailing">
      {#if linked}
        <button
          type="button"
          class="rule-button"
          {disabled}
          onclick={onEditRule}
          aria-label="Edit the rule that rebuilds from {driverLabel}: {ruleLabel}"
        >
          <strong>{ruleLabel}</strong>
          <i class="fas fa-chevron-right" aria-hidden="true"></i>
        </button>
      {:else}
        <!-- The other tiles read LABEL / value; separate paths have no rule, so
             the value is the absence of one. -->
        <span class="tile-help">Independent</span>
      {/if}
    </span>
  </div>

  <FuseModeBar onSelect={onModeChange} />
</div>

<style>
  .pairing-tile {
    position: relative;
    display: grid;
    gap: 8px;
    align-content: center;
    width: 100%;
    min-width: 0;
    min-height: 3.75rem;
    padding: 8px clamp(9px, 0.65cqw, 14px);
    overflow: hidden;
    border: 1px solid var(--theme-stroke);
    border-radius: 14px;
    color: var(--recipe-text);
    background:
      linear-gradient(
        132deg,
        color-mix(in srgb, white 18%, transparent),
        transparent 42%
      ),
      var(--recipe-color);
    box-shadow:
      0 8px 18px hsl(var(--recipe-shadow) / 24%),
      inset 0 1px 0 color-mix(in srgb, white 18%, transparent);
  }

  .tile-head {
    position: relative;
    z-index: 1;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: clamp(7px, 0.55cqw, 11px);
    min-width: 0;
  }

  .tile-label {
    overflow: hidden;
    font-size: var(--font-size-compact, 12px);
    font-weight: 800;
    letter-spacing: 0.055em;
    opacity: 0.76;
    text-overflow: ellipsis;
    text-transform: uppercase;
    white-space: nowrap;
  }

  /* A fixed height so the rule button and the Separate copy occupy the same box:
     switching modes must not move the header, let alone the workspace under it. */
  .tile-trailing {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    height: 2rem;
    min-width: 0;
  }

  .rule-button {
    display: flex;
    align-items: center;
    gap: 7px;
    box-sizing: border-box;
    max-width: 100%;
    min-width: 0;
    height: 100%;
    padding: 4px 9px;
    border: 1px solid color-mix(in srgb, currentColor 34%, transparent);
    border-radius: 10px;
    color: inherit;
    background: color-mix(in srgb, black 16%, transparent);
    cursor: pointer;
    transition: border-color var(--duration-fast, 120ms) ease;
  }

  .rule-button:hover:not(:disabled) {
    border-color: color-mix(in srgb, white 62%, transparent);
  }

  .rule-button:focus-visible {
    outline: 3px solid var(--theme-text);
    outline-offset: 2px;
  }

  .rule-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .rule-button strong {
    overflow: hidden;
    font-size: var(--font-size-min, 14px);
    font-weight: 800;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .rule-button i {
    font-size: 11px;
    opacity: 0.76;
  }

  .tile-help {
    overflow: hidden;
    font-size: var(--font-size-compact, 12px);
    font-weight: 650;
    line-height: 2rem;
    opacity: 0.78;
    text-align: right;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* The switch is the tile's subject, so it spans the tile rather than sizing to
     its two words the way the header's compact copy does. */
  .pairing-tile :global(.fuse-mode-bar) {
    width: 100%;
  }

  @media (min-width: 2600px) and (min-height: 1400px) {
    .pairing-tile {
      min-height: 5rem;
      border-radius: 18px;
    }

    .tile-trailing {
      height: 2.6rem;
    }

    .tile-label {
      font-size: 0.8rem;
    }

    .rule-button strong {
      font-size: 1rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .rule-button {
      transition: none;
    }
  }
</style>
