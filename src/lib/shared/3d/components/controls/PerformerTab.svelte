<script lang="ts">
  /**
   * PerformerTab
   *
   * Contents of the gear popover's "Performers" tab (renamed from "Avatar").
   * Shows:
   *   - Formation preset row (existing FormationSelector, with invalid
   *     presets grayed out for the current performer count)
   *   - Per-performer numeric controls (position X/Z, facing dial)
   *   - Remove button
   *
   * When scope is "All" (selectedPerformerIndex === null), per-performer
   * controls hide and only the formation row is active.
   */

  import FormationSelector from "./FormationSelector.svelte";
  import { getViewer3DContext } from "../../context/viewer-3d-context";
  import { PRESET_VALID_COUNTS, FORMATION_PRESET_INFO } from "../../config/formation-presets";
  import type { FormationPreset } from "../../domain/formation";

  const viewer3DState = getViewer3DContext();
  const selectedIndex = $derived(viewer3DState.selectedPerformerIndex);
  const performers = $derived(viewer3DState.performerManager.performers);
  const count = $derived(performers.length);

  // The selected performer (or null if scope is "All" or the index is bad).
  const selectedPerformer = $derived(
    selectedIndex === null ? null : performers[selectedIndex] ?? null
  );

  // FormationSelector requires a concrete FormationPreset for its `value`
  // prop. When the viewer's activeFormation is "manual", display "custom".
  const selectorValue = $derived<FormationPreset>(
    viewer3DState.activeFormation === "manual" ? "custom" : viewer3DState.activeFormation
  );

  // Presets that aren't compatible with the current count get grayed out.
  const disabledPresets = $derived(
    new Set<FormationPreset>(
      FORMATION_PRESET_INFO.filter(
        (info) => !PRESET_VALID_COUNTS[info.id]?.includes(count)
      ).map((info) => info.id)
    )
  );

  function handleFormationChange(preset: FormationPreset): void {
    viewer3DState.applyFormationFromUI(preset);
  }

  function handleRemove(): void {
    viewer3DState.removePerformerFromUI();
  }

  // Numeric nudge helpers. Each edit records a spatial entry (coalesced by
  // the 300ms window inside viewer-3d-state).
  const NUDGE_STEP = 0.25;

  function nudgeX(delta: number): void {
    if (!selectedPerformer) return;
    selectedPerformer.position.x += delta;
    viewer3DState.recordSpatialEdit();
  }

  function nudgeZ(delta: number): void {
    if (!selectedPerformer) return;
    selectedPerformer.position.z += delta;
    viewer3DState.recordSpatialEdit();
  }

  function nudgeFacing(deltaRadians: number): void {
    if (!selectedPerformer) return;
    selectedPerformer.setFacingAngle(selectedPerformer.facingAngle + deltaRadians);
    viewer3DState.recordSpatialEdit();
  }
</script>

<div class="performer-tab">
  <section class="formation-section">
    <h4 class="section-title">Formation</h4>
    <FormationSelector
      value={selectorValue}
      performerCount={count}
      disabledPresets={disabledPresets}
      onchange={handleFormationChange}
    />
  </section>

  {#if selectedPerformer}
    <section class="selected-section">
      <h4 class="section-title">Performer {(selectedIndex ?? 0) + 1}</h4>

      <div class="control-row">
        <span class="control-label">Position X</span>
        <div class="nudge-group">
          <button type="button" class="nudge-btn" onclick={() => nudgeX(-NUDGE_STEP)}>−</button>
          <span class="nudge-value">{selectedPerformer.position.x.toFixed(2)}</span>
          <button type="button" class="nudge-btn" onclick={() => nudgeX(NUDGE_STEP)}>+</button>
        </div>
      </div>

      <div class="control-row">
        <span class="control-label">Position Z</span>
        <div class="nudge-group">
          <button type="button" class="nudge-btn" onclick={() => nudgeZ(-NUDGE_STEP)}>−</button>
          <span class="nudge-value">{selectedPerformer.position.z.toFixed(2)}</span>
          <button type="button" class="nudge-btn" onclick={() => nudgeZ(NUDGE_STEP)}>+</button>
        </div>
      </div>

      <div class="control-row">
        <span class="control-label">Facing</span>
        <div class="nudge-group">
          <button type="button" class="nudge-btn" onclick={() => nudgeFacing(-Math.PI / 8)}>↶</button>
          <span class="nudge-value">{((selectedPerformer.facingAngle * 180) / Math.PI).toFixed(0)}°</span>
          <button type="button" class="nudge-btn" onclick={() => nudgeFacing(Math.PI / 8)}>↷</button>
        </div>
      </div>

      {#if count > 1}
        <button type="button" class="remove-btn" onclick={handleRemove}>
          Remove Performer
        </button>
      {/if}
    </section>
  {:else}
    <section class="all-section">
      <p class="scope-hint">
        All performers selected. Pick a single performer above to edit their position,
        facing, or remove them.
      </p>
    </section>
  {/if}
</div>

<style>
  .performer-tab {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 12px;
  }

  .section-title {
    margin: 0 0 8px;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: rgba(255, 255, 255, 0.6);
  }

  .control-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 6px 0;
  }

  .control-label {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.82);
  }

  .nudge-group {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .nudge-btn {
    width: 26px;
    height: 26px;
    border-radius: 13px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.85);
    cursor: pointer;
    font-size: 14px;
  }

  .nudge-btn:hover {
    background: rgba(255, 255, 255, 0.15);
  }

  .nudge-value {
    min-width: 56px;
    text-align: center;
    font-size: 13px;
    font-variant-numeric: tabular-nums;
    color: rgba(255, 255, 255, 0.95);
  }

  .remove-btn {
    margin-top: 8px;
    padding: 8px 12px;
    border-radius: 6px;
    border: 1px solid rgba(239, 68, 68, 0.45);
    background: rgba(239, 68, 68, 0.12);
    color: rgba(255, 180, 180, 0.95);
    cursor: pointer;
    font-size: 13px;
  }

  .remove-btn:hover {
    background: rgba(239, 68, 68, 0.22);
  }

  .scope-hint {
    margin: 0;
    font-size: 13px;
    color: rgba(255, 255, 255, 0.55);
    line-height: 1.4;
  }
</style>
