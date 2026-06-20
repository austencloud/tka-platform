<!--
  CompactPropDisplay.svelte - Compact prop display with inline controls

  Single mode: One row showing prop icon, name, and flip control (for buugengs)
  Cat Dog mode: Two rows (blue/red) each with icon, name, controls

  Read-only current-selection readout. Selection happens in the inline
  BentoPropGrid alongside it; this panel just reflects the active prop(s) and
  hosts the buugeng flip control.
-->
<script lang="ts">
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import { getPropTypeDisplayInfo } from "./prop-type-registry";
  import {
    hasBigVariant,
    isBigVariant,
  } from "$lib/shared/pictograph/prop/domain/prop-type-display-registry";
  // Canonical chirality-flippable set (buugeng family + trigeng) — asymmetric
  // props whose handedness can be mirrored.
  import { isBuugengFamilyProp } from "$lib/shared/pictograph/prop/domain/enums/prop-classification";
  import { t } from "$lib/shared/i18n/i18n.svelte.js";

  let {
    bluePropType,
    redPropType,
    catDogMode = false,
    blueBuugengFlipped = false,
    redBuugengFlipped = false,
    onToggleFlip,
    onToggleBig,
  } = $props<{
    bluePropType: PropType;
    redPropType: PropType;
    catDogMode?: boolean;
    blueBuugengFlipped?: boolean;
    redBuugengFlipped?: boolean;
    onToggleFlip?: (hand: "blue" | "red") => void;
    onToggleBig?: (hand: "blue" | "red") => void;
  }>();

  // Display info
  const blueInfo = $derived(getPropTypeDisplayInfo(bluePropType));
  const redInfo = $derived(getPropTypeDisplayInfo(redPropType));
  const blueIsBuugeng = $derived(isBuugengFamilyProp(bluePropType));
  const redIsBuugeng = $derived(isBuugengFamilyProp(redPropType));
  // Size modifier (standard ⇄ big)
  const blueHasBig = $derived(hasBigVariant(bluePropType));
  const redHasBig = $derived(hasBigVariant(redPropType));
  const blueIsBig = $derived(isBigVariant(bluePropType));
  const redIsBig = $derived(isBigVariant(redPropType));
</script>

<div class="compact-prop-display" class:dual={catDogMode}>
  <!-- Blue / Single prop row -->
  <div
    class="prop-row"
    class:blue={catDogMode}
    aria-label={catDogMode
      ? `${t("settings_left_hand")}: ${blueInfo.label}`
      : blueInfo.label}
  >
    {#if catDogMode}
      <span class="hand-indicator blue">
        <span class="hand-dot"></span>
      </span>
    {/if}

    <img
      src={blueInfo.image}
      alt=""
      class="prop-icon"
      class:flipped={blueIsBuugeng && blueBuugengFlipped}
    />

    <span class="prop-name">{blueInfo.label}</span>

    <span class="action-buttons">
      {#if blueHasBig}
        <button
          class="action-btn"
          class:active={blueIsBig}
          onclick={() => onToggleBig?.("blue")}
          aria-label="Toggle big size"
          aria-pressed={blueIsBig}
          title="Big version"
        >
          <i
            class="fas fa-up-right-and-down-left-from-center"
            aria-hidden="true"
          ></i>
        </button>
      {/if}
      {#if blueIsBuugeng}
        <button
          class="action-btn"
          class:active={blueBuugengFlipped}
          onclick={() => onToggleFlip?.("blue")}
          aria-label="Flip buugeng"
          aria-pressed={blueBuugengFlipped}
          title="Flip prop (asymmetric)"
        >
          <i class="fas fa-arrows-left-right" aria-hidden="true"></i>
        </button>
      {/if}
    </span>
  </div>

  <!-- Red prop row (Cat Dog mode only) -->
  {#if catDogMode}
    <div
      class="prop-row red"
      aria-label={`${t("settings_right_hand")}: ${redInfo.label}`}
    >
      <span class="hand-indicator red">
        <span class="hand-dot"></span>
      </span>

      <img
        src={redInfo.image}
        alt=""
        class="prop-icon"
        class:flipped={redIsBuugeng && redBuugengFlipped}
      />

      <span class="prop-name">{redInfo.label}</span>

      <span class="action-buttons">
        {#if redHasBig}
          <button
            class="action-btn"
            class:active={redIsBig}
            onclick={() => onToggleBig?.("red")}
            aria-label="Toggle big size"
            aria-pressed={redIsBig}
            title="Big version"
          >
            <i
              class="fas fa-up-right-and-down-left-from-center"
              aria-hidden="true"
            ></i>
          </button>
        {/if}
        {#if redIsBuugeng}
          <button
            class="action-btn"
            class:active={redBuugengFlipped}
            onclick={() => onToggleFlip?.("red")}
            aria-label="Flip buugeng"
            aria-pressed={redBuugengFlipped}
            title="Flip prop (asymmetric)"
          >
            <i class="fas fa-arrows-left-right" aria-hidden="true"></i>
          </button>
        {/if}
      </span>
    </div>
  {/if}
</div>

<style>
  .compact-prop-display {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  @media (min-width: 500px) {
    .compact-prop-display {
      gap: 10px;
    }
  }

  .prop-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: var(--theme-card-bg);
    border: 1.5px solid var(--theme-stroke);
    border-radius: 14px;
    min-height: 64px;
    -webkit-tap-highlight-color: transparent;
  }

  @media (min-width: 500px) {
    .prop-row {
      gap: 14px;
      padding: 14px 18px;
      border-radius: 14px;
      min-height: 72px;
    }
  }

  /* Hand-colored variants */
  .prop-row.blue {
    border-color: color-mix(in srgb, var(--prop-blue-text, #818cf8) 30%, transparent);
    background: color-mix(in srgb, var(--prop-blue-text, #818cf8) 6%, transparent);
  }

  .prop-row.red {
    border-color: color-mix(in srgb, var(--prop-red-text, #f87171) 30%, transparent);
    background: color-mix(in srgb, var(--prop-red-text, #f87171) 6%, transparent);
  }

  /* Hand indicator */
  .hand-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .hand-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }

  .hand-indicator.blue .hand-dot {
    background: var(--prop-blue-text, #818cf8);
    box-shadow: 0 0 6px color-mix(in srgb, var(--prop-blue-text, #818cf8) 50%, transparent);
  }

  .hand-indicator.red .hand-dot {
    background: var(--prop-red-text, #f87171);
    box-shadow: 0 0 6px color-mix(in srgb, var(--prop-red-text, #f87171) 50%, transparent);
  }

  /* Prop icon - responsive size */
  .prop-icon {
    width: 56px;
    height: 56px;
    object-fit: contain;
    filter: drop-shadow(0 1px 4px rgba(0, 0, 0, 0.3));
    flex-shrink: 0;
  }

  @media (min-width: 500px) {
    .prop-icon {
      width: 64px;
      height: 64px;
    }
  }

  .prop-icon.flipped {
    transform: scaleX(-1);
  }

  /* Color the icon for the red hand */
  .prop-row.red .prop-icon {
    filter: drop-shadow(0 1px 4px rgba(0, 0, 0, 0.3)) hue-rotate(125deg) saturate(1.2);
  }

  /* Prop name - fills row so the flip control sits at the right edge */
  .prop-name {
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
    color: var(--theme-text);
    flex: 1;
    min-width: 0;
  }

  @media (min-width: 500px) {
    .prop-name {
      font-size: 16px;
    }
  }

  /* Action buttons */
  .action-buttons {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
  }

  @media (min-width: 500px) {
    .action-buttons {
      gap: 6px;
    }
  }

  .action-btn {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 8px;
    color: var(--theme-text-dim);
    cursor: pointer;
    font-size: 13px;
    transition: all var(--duration-fast) ease;
  }

  @media (min-width: 500px) {
    .action-btn {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      font-size: 14px;
    }
  }

  .action-btn:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
    color: var(--theme-accent);
  }

  .action-btn.active {
    background: color-mix(in srgb, var(--theme-accent) 20%, transparent);
    border-color: var(--theme-accent);
    color: var(--theme-accent);
  }

  /* Focus states */
  .action-btn:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .action-btn {
      transition: none;
    }
  }
</style>
