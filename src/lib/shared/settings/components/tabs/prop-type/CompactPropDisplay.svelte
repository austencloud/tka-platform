<!--
  CompactPropDisplay.svelte - Compact prop display with inline controls

  Single mode: One row showing prop icon, name, and flip control (for buugengs)
  Cat Dog mode: Two rows (blue/red) each with icon, name, controls

  Tapping the prop opens the selection sheet where all variations are visible.
-->
<script lang="ts">
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import { getPropTypeDisplayInfo } from "./prop-type-registry";
  import { t } from "$lib/shared/i18n/i18n.svelte.js";

  // Buugeng family - asymmetric props that can be flipped
  const BUUGENG_FAMILY = new Set([
    PropType.BUUGENG,
    PropType.BIGBUUGENG,
    PropType.FRACTALGENG,
  ]);

  let {
    bluePropType,
    redPropType,
    catDogMode = false,
    blueBuugengFlipped = false,
    redBuugengFlipped = false,
    onOpenSheet,
    onToggleFlip,
  } = $props<{
    bluePropType: PropType;
    redPropType: PropType;
    catDogMode?: boolean;
    blueBuugengFlipped?: boolean;
    redBuugengFlipped?: boolean;
    onOpenSheet?: (hand: "blue" | "red") => void;
    onToggleFlip?: (hand: "blue" | "red") => void;
  }>();

  // Display info
  const blueInfo = $derived(getPropTypeDisplayInfo(bluePropType));
  const redInfo = $derived(getPropTypeDisplayInfo(redPropType));
  const blueIsBuugeng = $derived(BUUGENG_FAMILY.has(bluePropType));
  const redIsBuugeng = $derived(BUUGENG_FAMILY.has(redPropType));
</script>

<div class="compact-prop-display" class:dual={catDogMode}>
  <!-- Blue / Single prop row -->
  <div
    class="prop-row"
    class:blue={catDogMode}
    onclick={() => onOpenSheet?.("blue")}
    role="button"
    tabindex="0"
    onkeydown={(e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onOpenSheet?.("blue");
      }
    }}
    aria-label={catDogMode
      ? `${t("settings_left_hand")}: ${blueInfo.label}. Tap to change.`
      : `${blueInfo.label}. Tap to change.`}
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

    <span class="change-affordance">
      <i class="fas fa-chevron-right" aria-hidden="true"></i>
    </span>

    <span class="action-buttons">
      {#if blueIsBuugeng}
        <button
          class="action-btn"
          class:active={blueBuugengFlipped}
          onclick={(e) => {
            e.stopPropagation();
            onToggleFlip?.("blue");
          }}
          aria-label="Flip buugeng"
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
      onclick={() => onOpenSheet?.("red")}
      role="button"
      tabindex="0"
      onkeydown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpenSheet?.("red");
        }
      }}
      aria-label={`${t("settings_right_hand")}: ${redInfo.label}. Tap to change.`}
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

      <span class="change-affordance">
        <i class="fas fa-chevron-right" aria-hidden="true"></i>
      </span>

      <span class="action-buttons">
        {#if redIsBuugeng}
          <button
            class="action-btn"
            class:active={redBuugengFlipped}
            onclick={(e) => {
              e.stopPropagation();
              onToggleFlip?.("red");
            }}
            aria-label="Flip buugeng"
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
    cursor: pointer;
    transition: all var(--duration-fast) ease;
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

  .prop-row:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
  }

  .prop-row:active {
    transform: scale(0.99);
  }

  /* Hand-colored variants */
  .prop-row.blue {
    border-color: color-mix(in srgb, var(--prop-blue-text, #818cf8) 30%, transparent);
    background: color-mix(in srgb, var(--prop-blue-text, #818cf8) 6%, transparent);
  }

  .prop-row.blue:hover {
    border-color: color-mix(in srgb, var(--prop-blue-text, #818cf8) 50%, transparent);
    background: color-mix(in srgb, var(--prop-blue-text, #818cf8) 12%, transparent);
  }

  .prop-row.red {
    border-color: color-mix(in srgb, var(--prop-red-text, #f87171) 30%, transparent);
    background: color-mix(in srgb, var(--prop-red-text, #f87171) 6%, transparent);
  }

  .prop-row.red:hover {
    border-color: color-mix(in srgb, var(--prop-red-text, #f87171) 50%, transparent);
    background: color-mix(in srgb, var(--prop-red-text, #f87171) 12%, transparent);
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

  /* Prop name */
  .prop-name {
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
    color: var(--theme-text);
    flex-shrink: 0;
  }

  @media (min-width: 500px) {
    .prop-name {
      font-size: 16px;
    }
  }

  /* Chevron affordance */
  .change-affordance {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    color: var(--theme-text-dim);
    opacity: 0.5;
    font-size: 14px;
    transition: opacity var(--duration-fast) ease, transform var(--duration-fast) ease;
  }

  .prop-row:hover .change-affordance {
    opacity: 0.8;
    transform: translateX(2px);
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
  .prop-row:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  .action-btn:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .prop-row,
    .action-btn,
    .change-affordance {
      transition: none;
    }

    .prop-row:active {
      transform: none;
    }

    .prop-row:hover .change-affordance {
      transform: none;
    }
  }
</style>
