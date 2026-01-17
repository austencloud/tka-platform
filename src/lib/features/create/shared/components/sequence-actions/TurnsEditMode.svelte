<!--
  TurnsEditMode.svelte

  The "Turns" tab content - allows editing turns and rotation for a selected beat.
  Uses PropControlPair for consistent blue/red card layout.
  Also provides quick access to prop type selection and chirality toggle.
-->
<script lang="ts">
  import {
    MotionColor,
    RotationDirection,
  } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import { isBuugengFamilyProp } from "$lib/shared/pictograph/prop/domain/enums/PropClassification";
  import { getPropTypeDisplayInfo } from "$lib/shared/settings/components/tabs/prop-type/PropTypeRegistry";
  import {
    getSettings,
    updateSettings,
  } from "$lib/shared/application/state/app-state.svelte";
  import PropControlPair from "./PropControlPair.svelte";
  import PropTurnsControl from "./PropTurnsControl.svelte";

  interface Props {
    hasSelection: boolean;
    blueTurns: number | "fl";
    redTurns: number | "fl";
    blueRotation: RotationDirection;
    redRotation: RotationDirection;
    showBlueRotation: boolean;
    showRedRotation: boolean;
    stacked?: boolean;
    onTurnsChange: (color: MotionColor, delta: number) => void;
    onRotationChange: (
      color: MotionColor,
      direction: RotationDirection
    ) => void;
    onOpenPropSheet?: (color: "blue" | "red") => void;
  }

  let {
    hasSelection,
    blueTurns,
    redTurns,
    blueRotation,
    redRotation,
    showBlueRotation,
    showRedRotation,
    stacked = false,
    onTurnsChange,
    onRotationChange,
    onOpenPropSheet,
  }: Props = $props();

  // Get current prop types from settings
  const settings = $derived(getSettings());
  const bluePropType = $derived(settings.bluePropType ?? PropType.STAFF);
  const redPropType = $derived(settings.redPropType ?? PropType.STAFF);

  // Check if current props are Buugeng family (for chirality toggle)
  const blueIsBuugeng = $derived(isBuugengFamilyProp(bluePropType));
  const redIsBuugeng = $derived(isBuugengFamilyProp(redPropType));

  // Current chirality state
  const blueBuugengFlipped = $derived(settings.blueBuugengFlipped ?? false);
  const redBuugengFlipped = $derived(settings.redBuugengFlipped ?? false);

  // Get prop display info
  const blueDisplayInfo = $derived(getPropTypeDisplayInfo(bluePropType));
  const redDisplayInfo = $derived(getPropTypeDisplayInfo(redPropType));

  // Handlers
  function toggleBlueChirality() {
    updateSettings({ blueBuugengFlipped: !blueBuugengFlipped });
  }

  function toggleRedChirality() {
    updateSettings({ redBuugengFlipped: !redBuugengFlipped });
  }
</script>

{#if !hasSelection}
  <div class="empty-state">
    <i class="fas fa-hand-pointer" aria-hidden="true"></i>
    <p>Tap a beat in the sequence to edit its turns</p>
  </div>
{:else}
  <PropControlPair {stacked}>
    {#snippet blueContent()}
      <PropTurnsControl
        color="blue"
        turns={blueTurns}
        rotationDirection={blueRotation}
        showRotation={showBlueRotation}
        onTurnsChange={(delta) => onTurnsChange(MotionColor.BLUE, delta)}
        onRotationChange={(dir) => onRotationChange(MotionColor.BLUE, dir)}
      />
      <!-- Prop type row -->
      <div class="prop-type-row blue">
        <button
          class="prop-type-btn"
          onclick={() => onOpenPropSheet?.("blue")}
          aria-label="Change blue prop type"
        >
          <img
            src={blueDisplayInfo.image}
            alt={blueDisplayInfo.label}
            class="prop-icon"
          />
          <span class="prop-name">{blueDisplayInfo.label}</span>
          <i class="fas fa-chevron-right" aria-hidden="true"></i>
        </button>
        {#if blueIsBuugeng}
          <button
            class="chirality-btn"
            class:flipped={blueBuugengFlipped}
            onclick={toggleBlueChirality}
            aria-label="Flip blue buugeng chirality"
            title={blueBuugengFlipped ? "Flipped" : "Normal"}
          >
            <i class="fas fa-arrows-left-right" aria-hidden="true"></i>
          </button>
        {/if}
      </div>
    {/snippet}
    {#snippet redContent()}
      <PropTurnsControl
        color="red"
        turns={redTurns}
        rotationDirection={redRotation}
        showRotation={showRedRotation}
        onTurnsChange={(delta) => onTurnsChange(MotionColor.RED, delta)}
        onRotationChange={(dir) => onRotationChange(MotionColor.RED, dir)}
      />
      <!-- Prop type row -->
      <div class="prop-type-row red">
        <button
          class="prop-type-btn"
          onclick={() => onOpenPropSheet?.("red")}
          aria-label="Change red prop type"
        >
          <img
            src={redDisplayInfo.image}
            alt={redDisplayInfo.label}
            class="prop-icon"
          />
          <span class="prop-name">{redDisplayInfo.label}</span>
          <i class="fas fa-chevron-right" aria-hidden="true"></i>
        </button>
        {#if redIsBuugeng}
          <button
            class="chirality-btn"
            class:flipped={redBuugengFlipped}
            onclick={toggleRedChirality}
            aria-label="Flip red buugeng chirality"
            title={redBuugengFlipped ? "Flipped" : "Normal"}
          >
            <i class="fas fa-arrows-left-right" aria-hidden="true"></i>
          </button>
        {/if}
      </div>
    {/snippet}
  </PropControlPair>
{/if}


<style>
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 32px 16px;
    color: rgba(255, 255, 255, 0.4);
    text-align: center;
  }

  .empty-state i {
    font-size: 2rem;
    opacity: 0.5;
  }

  .empty-state p {
    font-size: 0.9rem;
    margin: 0;
  }

  /* ============================================================================
     PROP TYPE ROW - Shows current prop with selection + chirality toggle
     ============================================================================ */

  .prop-type-row {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    margin-top: 4px;
    padding-top: 8px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  .prop-type-btn {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    border-radius: 8px;
    border: 1px solid;
    cursor: pointer;
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    transition: all var(--duration-fast) ease;
  }

  .prop-type-btn .prop-icon {
    width: 20px;
    height: 20px;
    object-fit: contain;
  }

  .prop-type-btn .prop-name {
    flex: 1;
    text-align: left;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .prop-type-btn .fa-chevron-right {
    font-size: 0.65rem;
    opacity: 0.5;
  }

  /* Blue prop type button */
  .prop-type-row.blue .prop-type-btn {
    background: rgba(59, 130, 246, 0.15);
    border-color: rgba(59, 130, 246, 0.3);
    color: rgba(255, 255, 255, 0.9);
  }

  .prop-type-row.blue .prop-type-btn:hover {
    background: rgba(59, 130, 246, 0.25);
    border-color: rgba(59, 130, 246, 0.5);
  }

  /* Red prop type button */
  .prop-type-row.red .prop-type-btn {
    background: rgba(239, 68, 68, 0.15);
    border-color: rgba(239, 68, 68, 0.3);
    color: rgba(255, 255, 255, 0.9);
  }

  .prop-type-row.red .prop-type-btn:hover {
    background: rgba(239, 68, 68, 0.25);
    border-color: rgba(239, 68, 68, 0.5);
  }

  /* ============================================================================
     CHIRALITY BUTTON - Flip for Buugeng family
     ============================================================================ */

  .chirality-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 8px;
    border: 1px solid;
    cursor: pointer;
    font-size: 0.85rem;
    transition: all var(--duration-fast) ease;
    flex-shrink: 0;
  }

  /* Blue chirality button */
  .prop-type-row.blue .chirality-btn {
    background: rgba(59, 130, 246, 0.15);
    border-color: rgba(59, 130, 246, 0.3);
    color: rgba(59, 130, 246, 0.7);
  }

  .prop-type-row.blue .chirality-btn:hover {
    background: rgba(59, 130, 246, 0.25);
    border-color: rgba(59, 130, 246, 0.5);
    color: var(--semantic-info);
  }

  .prop-type-row.blue .chirality-btn.flipped {
    background: rgba(59, 130, 246, 0.3);
    border-color: rgba(59, 130, 246, 0.6);
    color: var(--semantic-info);
    box-shadow: 0 2px 8px rgba(59, 130, 246, 0.25);
  }

  /* Red chirality button */
  .prop-type-row.red .chirality-btn {
    background: rgba(239, 68, 68, 0.15);
    border-color: rgba(239, 68, 68, 0.3);
    color: rgba(239, 68, 68, 0.7);
  }

  .prop-type-row.red .chirality-btn:hover {
    background: rgba(239, 68, 68, 0.25);
    border-color: rgba(239, 68, 68, 0.5);
    color: var(--semantic-error);
  }

  .prop-type-row.red .chirality-btn.flipped {
    background: rgba(239, 68, 68, 0.3);
    border-color: rgba(239, 68, 68, 0.6);
    color: var(--semantic-error);
    box-shadow: 0 2px 8px rgba(239, 68, 68, 0.25);
  }

  @media (prefers-reduced-motion: reduce) {
    .prop-type-btn,
    .chirality-btn {
      transition: none;
    }
  }
</style>
