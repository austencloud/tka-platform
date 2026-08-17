<!--
  FusePairingTile — the Pairing slot on the header's recipe rail.

  Pairing is the one recipe decision with a state in which there is nothing to
  edit, so the switch itself lives here: choosing Linked is what opens the rule editor, and choosing
  Separate is what puts it away. That is why the mode is not also a row inside
  the editor — a Separate path set has no rule, and a panel showing only a
  switch is a panel showing nothing.
-->
<script lang="ts">
  import { getFuseContext } from "../context/fuse-context";
  import { fuseRuleLabel } from "../domain/fuse-rule";
  import type { FuseMode } from "../state/fuse-state.svelte";
  import FuseModeBar from "./FuseModeBar.svelte";
  import FuseRailTile from "./FuseRailTile.svelte";

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

<FuseRailTile label="Pairing" {color} {shadowColor} {textColor}>
  {#snippet trailing()}
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
  {/snippet}

  <div class="mode-slot">
    <FuseModeBar onSelect={onModeChange} />
  </div>
</FuseRailTile>

<style>
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
  .mode-slot {
    position: relative;
    z-index: 1;
    min-width: 0;
  }

  .mode-slot :global(.fuse-mode-bar) {
    width: 100%;
  }

  @media (min-width: 2600px) and (min-height: 1400px) {
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
