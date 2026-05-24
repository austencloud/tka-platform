<script lang="ts">
  import { AVATAR_DEFINITIONS, type AvatarId } from "@austencloud/scene-3d";
  import { Popover } from "bits-ui";
  import { scale } from "svelte/transition";
  import { backOut, cubicOut } from "svelte/easing";
  import { getViewer3DContext } from "../../context/viewer-3d-context";
  import { getPerformerColor } from "../../constants/performer-colors";
  import PerformerPropSizeSlider from "./PerformerPropSizeSlider.svelte";
  import EffortPalette from "$lib/shared/phrase-effort-lab/components/EffortPalette.svelte";
  import EffectsSettingsPanel from "./EffectsSettingsPanel.svelte";
  import PlanesPopover from "../PlanesPopover.svelte";
  import {
    getBasePropType,
    getAllVariations,
    getPropTypeDisplayInfo,
    isPropActive,
    getBasePropsByCategory,
    PROP_CATEGORIES,
  } from "$lib/shared/pictograph/prop/domain/PropTypeDisplayRegistry";
  import PropCompositionPreview from "$lib/shared/pictograph/prop/components/PropCompositionPreview.svelte";
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import type { EffortId } from "$lib/shared/effort/domain/effort-types";

  const viewer = getViewer3DContext();
  const selectedIndex = $derived(viewer.selectedPerformerIndex);
  const performer = $derived(
    selectedIndex !== null
      ? (viewer.performerManager.performers[selectedIndex] ?? null)
      : null,
  );

  const performerColor = $derived(selectedIndex !== null ? getPerformerColor(selectedIndex) : "#6b7280");
  const badgeLabel = $derived(selectedIndex !== null ? `P${selectedIndex + 1}` : "");
  const canRemove = $derived(viewer.performerManager.performers.length > 1);

  const avatarDef = $derived(
    AVATAR_DEFINITIONS.find((a) => a.id === performer?.avatarModelId) ?? AVATAR_DEFINITIONS[0],
  );
  const avatarInitials = $derived(
    avatarDef ? avatarDef.name.slice(0, 2).toUpperCase() : "?",
  );

  const sequence = $derived(performer?.loadedSequence ?? null);
  const sequenceWord = $derived(sequence?.word ?? sequence?.name ?? null);
  const sequenceBeats = $derived(sequence?.steps?.length ?? null);
  const sequenceLabel = $derived(
    sequenceWord && sequenceBeats !== null
      ? `${sequenceWord} · ${sequenceBeats} beats`
      : sequenceWord ?? (sequenceBeats !== null ? `${sequenceBeats} beats` : null),
  );

  let avatarPickerOpen = $state(false);

  function pickAvatar(id: AvatarId) {
    performer?.setAvatarModel(id);
    avatarPickerOpen = false;
  }

  // Prop type selection (mirrors PropPopover logic)
  const currentProp = $derived(
    performer?.effectiveProp ?? viewer.defaultSettings.prop,
  );
  const propCategories = $derived(getBasePropsByCategory());
  const selectedBase = $derived(getBasePropType(currentProp));
  let expandedFamily = $state<PropType | null>(null);
  const familyVariants = $derived(
    expandedFamily ? getAllVariations(expandedFamily).filter(isPropActive) : [],
  );

  function handleFamilyClick(base: PropType) {
    const activeVariants = getAllVariations(base).filter(isPropActive);
    if (activeVariants.length <= 1) {
      performer?.setProp(base);
      expandedFamily = null;
    } else {
      expandedFamily = base;
    }
  }

  function handleVariantClick(variant: PropType) {
    performer?.setProp(variant);
  }

  // Effort selection
  const currentEffort = $derived(
    performer?.effectiveEffortId ?? viewer.defaultSettings.effortId,
  );

  function handleEffortSelect(effortId: EffortId) {
    performer?.setEffort(effortId);
  }
</script>

{#if performer !== null && selectedIndex !== null}
  <div class="hub-detail" style:--performer-color={performerColor} style:--pop-accent={performerColor}>

    <!-- Identity -->
    <div class="col col-identity">
      <div class="identity-header">
        <div class="avatar-circle" aria-hidden="true">
          <span class="avatar-initials">{avatarInitials}</span>
        </div>
        <div class="identity-text">
          <span class="performer-name">{avatarDef?.name ?? "—"}</span>
          <span class="badge" style:background-color={performerColor}>{badgeLabel}</span>
        </div>
      </div>

      <div class="identity-actions">
        <Popover.Root bind:open={avatarPickerOpen}>
          <Popover.Trigger>
            {#snippet child({ props })}
              <button
                {...props}
                class="action-btn"
                aria-expanded={avatarPickerOpen}
              >
                <i class="fas fa-exchange-alt" aria-hidden="true"></i>
                <span>Avatar</span>
              </button>
            {/snippet}
          </Popover.Trigger>
          <Popover.Content
            side="top"
            sideOffset={8}
            align="start"
            avoidCollisions={true}
            collisionPadding={12}
            forceMount
          >
            {#snippet child({ open, wrapperProps, props })}
              <div {...wrapperProps}>
                {#if open}
                  <div
                    {...props}
                    class="avatar-popover"
                    style:--pop-color={performerColor}
                    in:scale={{ duration: 200, start: 0.92, opacity: 0, easing: backOut }}
                    out:scale={{ duration: 140, start: 0.95, opacity: 0, easing: cubicOut }}
                  >
                    <div class="avatar-pop-accent"></div>
                    <div class="avatar-pop-header">Select Avatar</div>
                    <div class="avatar-grid" role="radiogroup" aria-label="Select avatar">
                      {#each AVATAR_DEFINITIONS as def (def.id)}
                        <button
                          class="avatar-card"
                          class:selected={performer.avatarModelId === def.id}
                          role="radio"
                          aria-checked={performer.avatarModelId === def.id}
                          onclick={() => pickAvatar(def.id as AvatarId)}
                          title={def.description}
                        >
                          <i class="fas {def.icon ?? 'fa-user'}" aria-hidden="true"></i>
                          <span class="avatar-card-name">{def.name}</span>
                        </button>
                      {/each}
                    </div>
                  </div>
                {/if}
              </div>
            {/snippet}
          </Popover.Content>
        </Popover.Root>

        {#if canRemove}
          <button class="action-btn danger" onclick={() => viewer.removePerformerFromUI()}>
            <i class="fas fa-trash-alt" aria-hidden="true"></i>
            <span>Remove</span>
          </button>
        {/if}
      </div>
    </div>

    <!-- Sequence -->
    <div class="col col-sequence">
      <div class="col-header">Sequence</div>
      {#if sequenceWord}
        <div class="seq-word">{sequenceWord}</div>
      {/if}
      {#if sequenceBeats !== null}
        <div class="seq-meta">{sequenceBeats} beats</div>
      {/if}
      {#if !sequenceWord && sequenceBeats === null}
        <div class="seq-meta dim">No sequence loaded</div>
      {/if}
    </div>

    <!-- Prop -->
    <div class="col col-prop">
      <div class="col-header">Prop</div>
      <div class="prop-grid">
        {#each PROP_CATEGORIES as cat}
          {@const bases = propCategories.get(cat.id) ?? []}
          {#each bases as base}
            {@const info = getPropTypeDisplayInfo(base)}
            {@const isSelected = expandedFamily !== null ? expandedFamily === base : selectedBase === base}
            <button
              class="prop-tile"
              class:selected={isSelected}
              aria-pressed={isSelected}
              aria-label={info.label}
              title={info.label}
              onclick={() => handleFamilyClick(base)}
            >
              <div class="tile-icon">
                <PropCompositionPreview propType={base} size={32} darkBackground />
              </div>
            </button>
          {/each}
        {/each}
      </div>

      {#if expandedFamily && familyVariants.length > 1}
        <div class="variant-strip">
          <span class="variant-header">{getPropTypeDisplayInfo(expandedFamily).label} Variants</span>
          <div class="variant-row">
            {#each familyVariants as variant}
              {@const vInfo = getPropTypeDisplayInfo(variant)}
              <button
                class="variant-chip"
                class:active={currentProp === variant}
                onclick={() => handleVariantClick(variant)}
              >
                <div class="variant-icon">
                  <PropCompositionPreview propType={variant} size={26} darkBackground />
                </div>
                <span class="variant-name">{vInfo.label}</span>
              </button>
            {/each}
          </div>
        </div>
      {/if}

      <PerformerPropSizeSlider {performer} />
    </div>

    <!-- Planes -->
    <div class="col col-planes">
      <div class="col-header">Planes</div>
      <div class="planes-wrap">
        <PlanesPopover />
      </div>
    </div>

    <!-- Effort -->
    <div class="col col-effort">
      <div class="col-header">Effort</div>
      <div class="effort-wrap">
        <EffortPalette selectedEffort={currentEffort} onSelect={handleEffortSelect} />
      </div>
    </div>

    <!-- Effects -->
    <div class="col col-effects">
      <div class="col-header">Effects</div>
      <div class="effects-wrap">
        <EffectsSettingsPanel {performer} />
      </div>
    </div>

  </div>
{/if}

<style>
  .hub-detail {
    display: flex;
    flex-direction: row;
    align-items: stretch;
    min-height: 0;
  }

  .col {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px 18px;
  }

  .col + .col {
    border-left: 1px solid rgba(255, 255, 255, 0.08);
  }

  .col-identity {
    width: 170px;
    flex-shrink: 0;
  }

  .col-sequence {
    width: 130px;
    flex-shrink: 0;
  }

  .col-prop {
    width: 380px;
    flex-shrink: 0;
  }

  .col-planes {
    width: 200px;
    flex-shrink: 0;
  }

  .col-effort {
    width: 320px;
    flex-shrink: 0;
  }

  .col-effects {
    flex: 1;
    min-width: 420px;
  }

  .col-header {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.5);
    line-height: 1;
  }

  /* Identity */
  .identity-header {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .avatar-circle {
    width: 42px;
    height: 42px;
    border-radius: 10px;
    border: 2px solid var(--performer-color, rgba(255, 255, 255, 0.3));
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    background: color-mix(in srgb, var(--performer-color, rgba(255,255,255,0.1)) 14%, transparent);
  }

  .avatar-initials {
    font-size: 14px;
    font-weight: 800;
    color: var(--performer-color, rgba(255, 255, 255, 0.7));
    letter-spacing: 0.04em;
    line-height: 1;
  }

  .identity-text {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
    flex: 1;
  }

  .performer-name {
    font-size: 14px;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.95);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.2;
  }

  .badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 2px 7px;
    border-radius: 5px;
    font-size: 10px;
    font-weight: 800;
    color: rgba(0, 0, 0, 0.85);
    letter-spacing: 0.04em;
    line-height: 1;
    width: fit-content;
  }

  .identity-actions {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .action-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    background: rgba(255, 255, 255, 0.04);
    color: rgba(255, 255, 255, 0.65);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 140ms ease;
    width: 100%;
    justify-content: center;
    min-height: 36px;
  }

  .action-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.25);
    color: rgba(255, 255, 255, 0.9);
  }

  .action-btn[aria-expanded="true"] {
    background: color-mix(in srgb, var(--performer-color) 14%, transparent);
    border-color: color-mix(in srgb, var(--performer-color) 40%, transparent);
    color: var(--performer-color);
  }

  .action-btn i {
    font-size: 12px;
  }

  .action-btn.danger {
    border-color: rgba(220, 50, 50, 0.3);
    background: rgba(220, 50, 50, 0.08);
    color: rgba(220, 80, 80, 0.8);
  }

  .action-btn.danger:hover {
    background: rgba(220, 50, 50, 0.18);
    border-color: rgba(220, 50, 50, 0.5);
    color: rgba(240, 80, 80, 1);
  }

  /* Sequence */
  .seq-word {
    font-size: 16px;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.9);
    line-height: 1.2;
    word-break: break-word;
  }

  .seq-meta {
    font-size: 12px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.5);
    line-height: 1.3;
  }

  .seq-meta.dim {
    font-style: italic;
    color: rgba(255, 255, 255, 0.3);
  }

  .avatar-popover {
    width: 320px;
    border-radius: 16px;
    background: color-mix(in srgb, var(--pop-color) 6%, #0c0e16);
    border: 1px solid color-mix(in srgb, var(--pop-color) 35%, transparent);
    box-shadow:
      0 12px 48px rgba(0, 0, 0, 0.7),
      0 0 24px color-mix(in srgb, var(--pop-color) 15%, transparent);
    overflow: hidden;
    padding: 12px;
  }

  .avatar-pop-accent {
    height: 3px;
    margin: -12px -12px 10px;
    background: linear-gradient(90deg, var(--pop-color), color-mix(in srgb, var(--pop-color) 40%, transparent));
    border-radius: 16px 16px 0 0;
  }

  .avatar-pop-header {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: color-mix(in srgb, var(--pop-color) 70%, rgba(255, 255, 255, 0.7));
    padding: 0 4px 10px;
  }

  .avatar-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
  }

  .avatar-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 8px 4px;
    min-height: 56px;
    background: rgba(255, 255, 255, 0.04);
    border: 1.5px solid transparent;
    border-radius: 10px;
    color: rgba(255, 255, 255, 0.6);
    cursor: pointer;
    transition: all 140ms ease;
  }

  .avatar-card:hover {
    background: color-mix(in srgb, var(--pop-color) 10%, transparent);
    border-color: color-mix(in srgb, var(--pop-color) 25%, transparent);
    color: white;
  }

  .avatar-card.selected {
    background: color-mix(in srgb, var(--pop-color) 20%, transparent);
    border-color: color-mix(in srgb, var(--pop-color) 50%, transparent);
    color: var(--pop-color);
    box-shadow: 0 0 10px color-mix(in srgb, var(--pop-color) 20%, transparent);
  }

  .avatar-card i {
    font-size: 16px;
  }

  .avatar-card-name {
    font-size: 10px;
    font-weight: 600;
    text-align: center;
    line-height: 1.2;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }

  /* Prop grid — flat flow */
  .prop-grid {
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    gap: 5px;
  }

  .prop-tile {
    width: 100%;
    aspect-ratio: 1;
    background: rgba(0, 0, 0, 0.3);
    border: 1.5px solid rgba(255, 255, 255, 0.15);
    border-radius: 10px;
    cursor: pointer;
    transition: all 160ms cubic-bezier(0.2, 0, 0.13, 1.5);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
  }

  .prop-tile:hover {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.35);
    transform: scale(1.05);
  }

  .prop-tile.selected {
    border-color: var(--pop-accent);
    border-width: 2px;
    background: color-mix(in srgb, var(--pop-accent) 15%, rgba(0, 0, 0, 0.3));
    box-shadow: 0 0 12px color-mix(in srgb, var(--pop-accent) 30%, transparent);
  }

  .tile-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
  }

  .variant-strip {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  .variant-header {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: rgba(255, 255, 255, 0.45);
  }

  .variant-row {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }

  .variant-chip {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 4px 10px 4px 4px;
    background: rgba(0, 0, 0, 0.3);
    border: 1.5px solid rgba(255, 255, 255, 0.15);
    border-radius: 8px;
    cursor: pointer;
    transition: all 150ms;
    color: rgba(255, 255, 255, 0.7);
    font-size: 11px;
    font-weight: 600;
  }

  .variant-chip:hover {
    border-color: rgba(255, 255, 255, 0.35);
    color: white;
  }

  .variant-chip.active {
    border-color: var(--pop-accent);
    border-width: 2px;
    background: color-mix(in srgb, var(--pop-accent) 15%, rgba(0, 0, 0, 0.3));
    color: white;
    box-shadow: 0 0 10px color-mix(in srgb, var(--pop-accent) 25%, transparent);
  }

  .variant-icon {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .variant-name {
    white-space: nowrap;
  }

  /* Planes */
  .planes-wrap :global(.plane-matrix) {
    gap: 6px;
  }

  .planes-wrap :global(.cascade-badge) {
    display: none;
  }

  /* Effort — 4 columns × 2 rows */
  .effort-wrap {
    --theme-stroke: rgba(255, 255, 255, 0.1);
    --theme-card-bg: rgba(255, 255, 255, 0.04);
    --theme-text-dim: rgba(255, 255, 255, 0.55);
    --theme-text: white;
    --min-touch-target: 40px;
  }

  .effort-wrap :global(.effort-palette) {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
  }

  .effort-wrap :global(.palette-btn) {
    min-width: 0;
  }

  /* Effects — 6 columns for compact height */
  .effects-wrap {
    --theme-card-bg: transparent;
    --theme-panel-bg: rgba(255, 255, 255, 0.04);
    --theme-stroke: rgba(255, 255, 255, 0.1);
    --theme-stroke-strong: rgba(255, 255, 255, 0.2);
    --theme-text: white;
    --theme-text-dim: rgba(255, 255, 255, 0.55);
    --min-touch-target: 40px;
  }

  .effects-wrap :global(.effects-settings) {
    padding: 0;
    background: transparent;
    border: none;
  }

  .effects-wrap :global(h3) {
    display: none;
  }

  .effects-wrap :global(.effect-chips) {
    grid-template-columns: repeat(6, 1fr);
  }
</style>
