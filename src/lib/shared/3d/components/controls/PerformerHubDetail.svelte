<script lang="ts">
  /**
   * PerformerHubDetail
   *
   * Three-column horizontal detail band rendered when a performer is selected.
   * Sits inside the PerformerHub shell, to the right of PerformerSpine.
   * Parent provides the glass background — this component has no background.
   *
   * Columns:
   *  1. Identity — avatar circle, name, sequence label, badge, avatar picker
   *  2. Controls — PerformerPropSizeSlider
   *  3. Effects  — 4-column chip grid for per-performer effect toggles
   */

  import { AVATAR_DEFINITIONS, type AvatarId } from "@austencloud/scene-3d";
  import { EFFECTS } from "$lib/shared/animation-engine/components/effects-panel/effect-registry";
  import { getViewer3DContext } from "../../context/viewer-3d-context";
  import { getPerformerColor } from "../../constants/performer-colors";
  import type { EffectId } from "../../state/performer-settings-types";
  import PerformerPropSizeSlider from "./PerformerPropSizeSlider.svelte";

  // ────────────────────────────────────────────────────────────────
  // State
  // ────────────────────────────────────────────────────────────────

  const viewer = getViewer3DContext();
  const selectedIndex = $derived(viewer.selectedPerformerIndex);
  const performer = $derived(
    selectedIndex !== null
      ? (viewer.performerManager.performers[selectedIndex] ?? null)
      : null,
  );

  // Identity derivations
  const performerColor = $derived(selectedIndex !== null ? getPerformerColor(selectedIndex) : "#6b7280");
  const badgeLabel = $derived(selectedIndex !== null ? `P${selectedIndex + 1}` : "");

  const avatarDef = $derived(
    AVATAR_DEFINITIONS.find((a) => a.id === performer?.avatarModelId) ?? AVATAR_DEFINITIONS[0],
  );
  const avatarInitials = $derived(
    avatarDef ? avatarDef.name.slice(0, 2).toUpperCase() : "?",
  );

  const sequence = $derived(performer?.loadedSequence ?? null);
  const sequenceWord = $derived(
    sequence?.word ?? sequence?.name ?? null,
  );
  const sequenceBeats = $derived(
    sequence?.steps?.length ?? null,
  );
  const sequenceLabel = $derived(
    sequenceWord && sequenceBeats !== null
      ? `${sequenceWord} · ${sequenceBeats} beats`
      : sequenceWord ?? (sequenceBeats !== null ? `${sequenceBeats} beats` : null),
  );

  // Avatar picker toggle
  let showAvatarPicker = $state(false);

  function pickAvatar(id: AvatarId) {
    performer?.setAvatarModel(id);
    showAvatarPicker = false;
  }

  // ────────────────────────────────────────────────────────────────
  // Effects grid — only EffectId-compatible effects shown
  // ────────────────────────────────────────────────────────────────

  // EffectId union: trails | fire | charcoal | led | electricity | sparkles | motion | bloom
  // Registry id "zap" maps to EffectId "electricity".
  // "echo", "water", "bubbles", "petals", "smoke", "ink", "frost", "silk", "pulse" are hidden.

  type EffectChip = { effectId: EffectId; label: string; icon: string; color: string };

  function toEffectId(registryId: string): EffectId | null {
    if (registryId === "zap") return "electricity";
    const valid: EffectId[] = ["trails", "fire", "charcoal", "led", "sparkles", "bloom"];
    return (valid as string[]).includes(registryId) ? (registryId as EffectId) : null;
  }

  const effectChips: EffectChip[] = [
    ...EFFECTS.flatMap((e) => {
      const id = toEffectId(e.id);
      if (!id) return [];
      return [{
        effectId: id,
        label: e.id === "zap" ? "Zap" : e.label,
        icon: e.icon.replace(/^fa-/, ""),
        color: e.color,
      }];
    }),
    // Motion appended last per spec
    { effectId: "motion", label: "Motion", icon: "wind", color: "#22d3ee" },
  ];
</script>

{#if performer !== null && selectedIndex !== null}
  <div class="hub-detail" style:--performer-color={performerColor}>

    <!-- ── Column 1: Identity ────────────────────────────────────── -->
    <div class="col col-identity">

      <div class="identity-row">
        <!-- Avatar circle -->
        <div
          class="avatar-circle"
          style:border-color={performerColor}
          aria-hidden="true"
        >
          <span class="avatar-initials">{avatarInitials}</span>
        </div>

        <div class="identity-text">
          <span class="performer-name">{avatarDef?.name ?? "—"}</span>
          {#if sequenceLabel}
            <span class="sequence-label">{sequenceLabel}</span>
          {:else}
            <span class="sequence-label no-seq">No sequence</span>
          {/if}
        </div>

        <!-- Badge -->
        <span class="badge" style:background-color={performerColor}>{badgeLabel}</span>
      </div>

      <!-- Change avatar button -->
      <button
        class="change-avatar-btn"
        aria-expanded={showAvatarPicker}
        onclick={() => (showAvatarPicker = !showAvatarPicker)}
      >
        <i class="fas fa-exchange-alt" aria-hidden="true"></i>
        <span>Change Avatar</span>
      </button>

      <!-- Inline avatar picker -->
      {#if showAvatarPicker}
        <div class="avatar-picker" role="radiogroup" aria-label="Select avatar">
          {#each AVATAR_DEFINITIONS as def (def.id)}
            <button
              class="avatar-option"
              class:selected={performer.avatarModelId === def.id}
              role="radio"
              aria-checked={performer.avatarModelId === def.id}
              onclick={() => pickAvatar(def.id as AvatarId)}
              title={def.description}
            >
              <i class="fas {def.icon ?? 'fa-user'}" aria-hidden="true"></i>
              <span class="avatar-option-name">{def.name}</span>
            </button>
          {/each}
        </div>
      {/if}
    </div>

    <!-- ── Column 2: Controls ────────────────────────────────────── -->
    <div class="col col-controls">
      <div class="col-header">Controls</div>
      <PerformerPropSizeSlider {performer} />
    </div>

    <!-- ── Column 3: Effects ─────────────────────────────────────── -->
    <div class="col col-effects">
      <div class="col-header">Effects</div>
      <div class="effects-grid">
        {#each effectChips as chip (chip.effectId)}
          {@const active = performer.effectiveEffects.has(chip.effectId)}
          <button
            class="effect-chip"
            class:active
            style:--eff-color={chip.color}
            aria-pressed={active}
            aria-label="{chip.label} effect"
            onclick={() => performer.toggleEffect(chip.effectId)}
          >
            <i class="fas fa-{chip.icon}" aria-hidden="true"></i>
            <span class="chip-label">{chip.label}</span>
          </button>
        {/each}
      </div>
    </div>

  </div>
{/if}

<style>
  /* ── Layout ─────────────────────────────────────────────── */
  .hub-detail {
    display: flex;
    flex-direction: row;
    align-items: stretch;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    min-height: 0;
  }

  .col {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px 16px;
  }

  /* Column separators */
  .col + .col {
    border-left: 1px solid rgba(255, 255, 255, 0.08);
  }

  /* Fixed widths for identity + controls; effects takes remaining space */
  .col-identity {
    width: 160px;
    flex-shrink: 0;
  }

  .col-controls {
    width: 160px;
    flex-shrink: 0;
  }

  .col-effects {
    flex: 1;
    min-width: 0;
  }

  /* ── Column header ───────────────────────────────────────── */
  .col-header {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.35);
    line-height: 1;
  }

  /* ── Identity column ─────────────────────────────────────── */
  .identity-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .avatar-circle {
    width: 40px;
    height: 44px;
    border-radius: 8px;
    border: 2px solid var(--performer-color, rgba(255, 255, 255, 0.3));
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    background: color-mix(in srgb, var(--performer-color, rgba(255,255,255,0.1)) 12%, transparent);
  }

  .avatar-initials {
    font-size: 12px;
    font-weight: 800;
    color: var(--performer-color, rgba(255, 255, 255, 0.7));
    letter-spacing: 0.04em;
    line-height: 1;
  }

  .identity-text {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
    flex: 1;
  }

  .performer-name {
    font-size: 12px;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.9);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.2;
  }

  .sequence-label {
    font-size: 10px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.45);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.2;
  }

  .sequence-label.no-seq {
    font-style: italic;
    color: rgba(255, 255, 255, 0.25);
  }

  .badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 2px 6px;
    border-radius: 5px;
    font-size: 10px;
    font-weight: 800;
    color: rgba(0, 0, 0, 0.85);
    letter-spacing: 0.04em;
    flex-shrink: 0;
    line-height: 1;
    align-self: flex-start;
  }

  /* ── Change Avatar button ────────────────────────────────── */
  .change-avatar-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: transparent;
    color: rgba(255, 255, 255, 0.55);
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: background 140ms, border-color 140ms, color 140ms;
    width: 100%;
    justify-content: center;
  }

  .change-avatar-btn:hover {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.18);
    color: rgba(255, 255, 255, 0.85);
  }

  .change-avatar-btn[aria-expanded="true"] {
    background: color-mix(in srgb, var(--performer-color) 14%, transparent);
    border-color: color-mix(in srgb, var(--performer-color) 40%, transparent);
    color: var(--performer-color);
  }

  .change-avatar-btn i {
    font-size: 11px;
  }

  /* ── Avatar picker ───────────────────────────────────────── */
  .avatar-picker {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .avatar-option {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 5px 8px;
    border-radius: 7px;
    border: 1px solid transparent;
    background: transparent;
    color: rgba(255, 255, 255, 0.55);
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    transition: background 120ms, color 120ms, border-color 120ms;
    text-align: left;
    width: 100%;
  }

  .avatar-option:hover {
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.85);
  }

  .avatar-option.selected {
    background: color-mix(in srgb, var(--performer-color) 15%, transparent);
    border-color: color-mix(in srgb, var(--performer-color) 40%, transparent);
    color: var(--performer-color);
  }

  .avatar-option i {
    font-size: 12px;
    width: 14px;
    text-align: center;
    flex-shrink: 0;
  }

  .avatar-option-name {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* ── Effects grid ────────────────────────────────────────── */
  .effects-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
  }

  .effect-chip {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    min-height: 44px;
    padding: 6px 4px;
    border-radius: 9px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: transparent;
    color: rgba(255, 255, 255, 0.45);
    cursor: pointer;
    transition: background 140ms, border-color 140ms, color 140ms;
  }

  .effect-chip i {
    font-size: 13px;
    transition: color 140ms;
  }

  .chip-label {
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.03em;
    line-height: 1;
    text-align: center;
  }

  .effect-chip:hover {
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.75);
    border-color: rgba(255, 255, 255, 0.18);
  }

  .effect-chip.active {
    background: color-mix(in srgb, var(--eff-color) 20%, transparent);
    border-color: color-mix(in srgb, var(--eff-color) 60%, transparent);
    color: rgba(255, 255, 255, 0.9);
  }

  .effect-chip.active i {
    color: var(--eff-color);
  }
</style>
