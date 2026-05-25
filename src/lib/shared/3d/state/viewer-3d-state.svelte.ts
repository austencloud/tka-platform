/**
 * Viewer 3D State
 *
 * Top-level state factory for the 3D viewer feature.
 * Manages render mode (2D/3D), a single avatar instance, effect toggles,
 * and the last known camera snapshot.
 *
 * WebGL2 availability is detected once at factory creation time so callers
 * can gate "Enter 3D" before attempting any WebGL work.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
// propInterpolator / sequenceConverter are now module-level functions; no type imports needed
import type { CameraStateSnapshot } from "@austencloud/scene-3d";
import { getSceneUndoManager } from "../undo/getSceneUndoManager";
import type { DefaultsDomainSnapshot, PerformerPositionSnapshot, ViewerDomainSnapshot, VisibilityDomainSnapshot } from "../undo/scene-undo-types";
import { Plane, PlaneMode } from "@austencloud/scene-3d";
import type { AvatarInstanceState } from "./avatar-instance-state.svelte";
import { derivePlaneModeFromHands } from "./avatar-instance-state.svelte";
import type { DefaultPerformerSettings, CascadeCategory, EffectId } from "./performer-settings-types";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
import type { EffortId } from "$lib/shared/effort/domain/effort-types";
import { createPerformerManager, type PerformerManager } from "./performer-manager.svelte";
import { DEFAULT_AVATAR_ID } from "@austencloud/scene-3d";
import { STAGE } from "@austencloud/scene-3d";
import type { FormationPreset } from "@austencloud/scene-3d";
import { calculateFacingAngle } from "@austencloud/scene-3d";
import { PRESET_VALID_COUNTS, createFormationFromPreset } from "@austencloud/scene-3d";
import { isWebGL2Available } from "../capabilities/webgl-capabilities";
import { userProportionsState } from "@austencloud/scene-3d";
import { createCameraChoreographyState } from "$lib/shared/sequence-viewer/camera-choreography/state.svelte";
import { computeChoreographerShot, computeBehindPerformerShot } from "$lib/shared/sequence-viewer/camera-choreography/presets/shots";
import type { OceanVariant } from "../environments/domain/enums/environment-enums";


// ============================================
// Popover Stack
// ============================================

export type PopoverId = "formation" | "tempo" | "export" | "camera" | "planes" | "info" | "scene" | "effects" | "prop" | "effort" | "dev";

// ============================================
// Persistence
// ============================================

const STORAGE_KEY_MODE = "tka-viewer3d-renderMode";
const STORAGE_KEY_CAMERA = "tka-viewer3d-camera";
const STORAGE_KEY_VISIBLE_PLANES = "tka-viewer3d-visiblePlanes";
const STORAGE_KEY_PRESET = "tka-viewer3d-activePreset";
const STORAGE_KEY_CAM_PRESET = "tka-viewer3d-cameraPreset";
const STORAGE_KEY_NAV_MODE = "tka-viewer3d-navMode";
const STORAGE_KEY_GRID_LABELS = "tka-viewer3d-gridLabels";

export type ViewerNavMode = "orbit" | "fly" | "walk";

function loadPersistedNavMode(): ViewerNavMode {
  if (typeof localStorage === "undefined") return "orbit";
  try {
    const v = localStorage.getItem(STORAGE_KEY_NAV_MODE);
    return v === "fly" || v === "walk" ? v : "orbit";
  } catch {
    return "orbit";
  }
}

function persistNavMode(value: ViewerNavMode) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY_NAV_MODE, value);
  } catch {
    // Storage full or unavailable
  }
}

function loadPersistedDefaultProp(): PropType {
  if (typeof localStorage === "undefined") return PropType.STAFF;
  try {
    const v = localStorage.getItem(STORAGE_KEY_DEFAULT_PROP);
    if (v && Object.values(PropType).includes(v as PropType)) return v as PropType;
    return PropType.STAFF;
  } catch {
    return PropType.STAFF;
  }
}

function persistDefaultProp(prop: PropType) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY_DEFAULT_PROP, prop);
  } catch {}
}

// New multi-performer persistence keys (v2). The old
// STORAGE_KEY_VISIBLE_PLANES is migrated to the first entry of the new
// performers array on first load.
const STORAGE_KEY_PERFORMERS = "tka-viewer3d-performers";
const STORAGE_KEY_ACTIVE_FORMATION = "tka-viewer3d-activeFormation";
const STORAGE_KEY_SELECTED_INDEX = "tka-viewer3d-selectedIndex";
const STORAGE_KEY_DEFAULT_PROP = "tka-viewer3d-defaultProp";

interface StoredPerformerSnapshot {
  position: { x: number; z: number };
  facingAngle: number;
  customBluePlane: Plane;
  customRedPlane: Plane;
}

function loadPersistedMode(): "2d" | "3d" {
  if (typeof localStorage === "undefined") return "2d";
  try {
    const v = localStorage.getItem(STORAGE_KEY_MODE);
    return v === "3d" ? "3d" : "2d";
  } catch {
    return "2d";
  }
}

function persistMode(mode: "2d" | "3d") {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY_MODE, mode);
  } catch {
    // Storage full or unavailable
  }
}

function loadPersistedCamera(): CameraStateSnapshot | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CAMERA);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function persistCamera(snapshot: CameraStateSnapshot) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY_CAMERA, JSON.stringify(snapshot));
  } catch {
    // Storage full or unavailable
  }
}

// ============================================
// Plane Persistence
// ============================================

function loadPersistedPlanes(): Set<Plane> | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_VISIBLE_PLANES);
    if (!raw) return null;
    const arr = JSON.parse(raw) as string[];
    // Validate each entry is a known Plane value
    const validValues = new Set<string>(Object.values(Plane));
    const planes = arr.filter((v) => validValues.has(v)) as Plane[];
    return new Set(planes);
  } catch {
    return null;
  }
}

function persistPlanes(planes: Set<Plane>) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY_VISIBLE_PLANES, JSON.stringify([...planes]));
  } catch {
    // Storage full or unavailable
  }
}

function loadPersistedPerformers(): StoredPerformerSnapshot[] | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PERFORMERS);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed as StoredPerformerSnapshot[];
  } catch {
    return null;
  }
}

function persistPerformers(snapshots: StoredPerformerSnapshot[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY_PERFORMERS, JSON.stringify(snapshots));
  } catch {
    // Quota exceeded or unavailable
  }
}

function loadPersistedActiveFormation(): FormationPreset | "manual" | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ACTIVE_FORMATION);
    return raw as FormationPreset | "manual" | null;
  } catch {
    return null;
  }
}

function persistActiveFormation(value: FormationPreset | "manual"): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY_ACTIVE_FORMATION, value);
  } catch {
    // Quota exceeded or unavailable
  }
}

function loadPersistedSelectedIndex(): number | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SELECTED_INDEX);
    if (raw === null || raw === "null") return null;
    const n = parseInt(raw, 10);
    return Number.isNaN(n) ? null : n;
  } catch {
    return null;
  }
}

function persistSelectedIndex(value: number | null): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(
      STORAGE_KEY_SELECTED_INDEX,
      value === null ? "null" : String(value),
    );
  } catch {
    // Quota exceeded or unavailable
  }
}

/**
 * One-time migration: if the old single-avatar visiblePlanes key exists and
 * the new per-performer key does not, construct a single-performer snapshot
 * from the old data and save it to the new key. Delete the old key so the
 * migration never runs twice.
 */
function migrateLegacyPlanesIfNeeded(): void {
  if (typeof localStorage === "undefined") return;
  try {
    const hasNew = localStorage.getItem(STORAGE_KEY_PERFORMERS);
    if (hasNew) return;
    const hasOld = localStorage.getItem(STORAGE_KEY_VISIBLE_PLANES);
    if (!hasOld) return;

    const planes = JSON.parse(hasOld) as Plane[];
    const blue = planes[0] ?? Plane.WALL;
    const red = planes[1] ?? blue;
    const snapshots: StoredPerformerSnapshot[] = [
      {
        position: { x: 0, z: 0 },
        facingAngle: 0,
        customBluePlane: blue,
        customRedPlane: red,
      },
    ];
    localStorage.setItem(STORAGE_KEY_PERFORMERS, JSON.stringify(snapshots));
    localStorage.removeItem(STORAGE_KEY_VISIBLE_PLANES);
  } catch {
    // Migration is best-effort; fall back to fresh state on any failure.
  }
}

// ============================================
// Factory
// ============================================

export function createViewer3DState() {
  const sceneUndo = getSceneUndoManager();
  const _webgl2Available = isWebGL2Available();
  const _persistedMode = _webgl2Available ? loadPersistedMode() : "2d";
  const _persistedCamera = loadPersistedCamera();

  // Synchronously restore the last render mode from localStorage so that
  // closing and reopening the sequence drawer keeps the user in 3D if that's
  // where they were. The orchestrator still fires enter3D() once the sequence
  // is available so the primary performer gets its sequence data loaded.
  let renderMode = $state<"2d" | "3d">(_persistedMode);
  let showPerf = $state(false);

  const _persistedOceanVariant = (() => {
    try {
      return (localStorage.getItem("tka-viewer3d-oceanVariant") ?? "abyss") as OceanVariant;
    } catch { return "abyss" as OceanVariant; }
  })();
  let oceanVariant = $state<OceanVariant>(_persistedOceanVariant);

  // Exclusive popover stack: only one popover can be open at a time.
  // Used to prevent "popover stomping" where multiple rail popovers and the
  // header info chip could be open simultaneously.
  let _activePopover = $state<PopoverId | null>(null);

  function openPopover(id: PopoverId | null): void {
    _activePopover = id;
  }

  function closePopover(): void {
    _activePopover = null;
  }

  // Viewer-level default settings for the cascade system. Performers with
  // null overrides inherit from these defaults.
  const _defaultSettings = $state<DefaultPerformerSettings>({
    prop: loadPersistedDefaultProp(),
    effects: new Set<EffectId>(),
    effortId: "linear" as EffortId,
    planeMode: PlaneMode.WALL,
    customBluePlane: Plane.WALL,
    customRedPlane: Plane.WALL,
  });

  // Performer manager - single source of truth for multi-performer state.
  // The viewer passes its viewer-specific cap (8) while realm/museum/duet
  // keep their shared cap (4) by not passing maxPerformers at all.
  const performerManager: PerformerManager = createPerformerManager({
    initialAvatarId: DEFAULT_AVATAR_ID,
    maxPerformers: STAGE.MAX_VIEWER_PERFORMERS,
    getDefaults: () => _defaultSettings,
  });

  // Viewer-specific selection scope. Lives on top of PerformerManager so
  // realm/museum/duet keep their simpler index-only model. null = "All".
  let selectedPerformerIndex = $state<number | null>(null);

  // Whether prop size is linked (global) or per-performer.
  let propSizeLinked = $state(true);

  // Suppresses performer raycast picks while the user is orbiting the camera.
  // OrbitControls onstart/onend in Viewer3DCamera flip this flag so a drag
  // that ends near a performer's body doesn't accidentally select them.
  let isCameraDragging = $state(false);

  // Welcome animation: plays once per session on first 3D entry.
  // Fires on the next animation frame after registerSnapTo.
  let _hasPlayedWelcome = false;
  let _welcomeAnimationPending = false;

  // Gate for the performer persistence $effect. Stays false until enter3D()
  // finishes restoring from localStorage, preventing the effect from
  // overwriting the saved multi-performer state with an empty array before
  // restoration has a chance to run.
  let _performersPersistReady = false;

  /**
   * Return the set of performers that should receive scoped writes.
   * - null selection → every performer
   * - valid index   → single performer
   * - bad index     → empty (caller should no-op)
   */
  function scopedPerformers(): AvatarInstanceState[] {
    if (selectedPerformerIndex === null) return performerManager.performers;
    const p = performerManager.performers[selectedPerformerIndex];
    return p ? [p] : [];
  }

  /**
   * Set the current selection scope. Pass null for "All".
   * Out-of-bounds indices are allowed - scopedPerformers() will return []
   * so individual write helpers no-op cleanly.
   */
  function selectPerformerScope(index: number | null): void {
    selectedPerformerIndex = index;
    persistSelectedIndex(index);

    if (renderMode !== "3d" || !_snapToFn) return;
    const performers = performerManager.performers;
    if (performers.length === 0) return;

    if (index !== null) {
      const performer = performers[index];
      if (!performer) return;
      const shot = computeBehindPerformerShot(performer, stageGroundOffset);
      snapCameraTo(
        { x: shot.eye.x, y: shot.eye.y, z: shot.eye.z },
        { x: shot.target.x, y: shot.target.y, z: shot.target.z },
      );
    } else {
      const shot = computeChoreographerShot(performers, stageGroundOffset);
      snapCameraTo(
        { x: shot.eye.x, y: shot.eye.y, z: shot.eye.z },
        { x: shot.target.x, y: shot.target.y, z: shot.target.z },
      );
    }
  }

  /**
   * Toggle between linked (global) and unlinked (per-performer) prop sizing.
   *
   * Linked → Unlinked: stamps current global staffLengthCm onto every
   * performer that still has null (i.e. inheriting global).
   *
   * Unlinked → Linked: syncs global to the selected performer's value
   * (or performer 0 if "All" is selected), then clears all per-performer
   * overrides so everyone inherits the global again.
   */
  function togglePropSizeLink(): void {
    sceneUndo.withoutUndo(() => {
      if (propSizeLinked) {
        const globalCm = userProportionsState.staffLengthCm;
        for (const p of performerManager.performers) {
          if (p.settings.staffLengthCm === null) {
            p.setStaffLengthCm(globalCm);
          }
        }
        propSizeLinked = false;
      } else {
        const sourceIdx = selectedPerformerIndex ?? 0;
        const source = performerManager.performers[sourceIdx];
        if (source?.settings.staffLengthCm != null) {
          userProportionsState.setStaffLengthCm(source.settings.staffLengthCm);
        }
        for (const p of performerManager.performers) {
          p.setStaffLengthCm(null);
        }
        propSizeLinked = true;
      }
    });
  }

  // ============================================
  // Default Settings — Cascade Write Methods
  // ============================================

  function setDefaultProp(prop: PropType): void {
    sceneUndo.captureState("change-default-prop", `Default prop: ${prop}`);
    _defaultSettings.prop = prop;
    persistDefaultProp(prop);
    sceneUndo.commitState();
  }

  function setDefaultEffort(effortId: EffortId): void {
    sceneUndo.captureState("change-default-effort", `Default effort: ${effortId}`);
    _defaultSettings.effortId = effortId;
    sceneUndo.commitState();
  }

  function setDefaultEffects(effects: Set<EffectId>): void {
    sceneUndo.captureState("change-default-effects", "Default effects");
    _defaultSettings.effects = new Set(effects);
    sceneUndo.commitState();
  }

  function toggleDefaultEffect(effect: EffectId): void {
    sceneUndo.captureState("change-default-effects", `Toggle default ${effect}`);
    const next = new Set(_defaultSettings.effects);
    if (next.has(effect)) next.delete(effect);
    else next.add(effect);
    _defaultSettings.effects = next;
    sceneUndo.commitState();
  }

  function setDefaultPlaneMode(mode: PlaneMode): void {
    sceneUndo.captureState("change-default-planes", `Default plane mode: ${mode}`);
    _defaultSettings.planeMode = mode;
    sceneUndo.commitState();
  }

  function setDefaultHandPlane(hand: "blue" | "red", plane: Plane): void {
    sceneUndo.captureState("change-default-planes", `Default ${hand}: ${plane}`);
    if (hand === "blue") _defaultSettings.customBluePlane = plane;
    else _defaultSettings.customRedPlane = plane;
    _defaultSettings.planeMode = derivePlaneModeFromHands(
      _defaultSettings.customBluePlane,
      _defaultSettings.customRedPlane
    );
    sceneUndo.commitState();
  }

  // ============================================
  // Override Count & Bulk Reset
  // ============================================

  function overrideCountForCategory(cat: CascadeCategory): number {
    return performerManager.performers.filter(p => p.hasOverride[cat]).length;
  }

  function resetAllPerformersProp(): void {
    sceneUndo.captureState("reset-all-overrides", "Reset all prop overrides");
    sceneUndo.withoutUndo(() => {
      for (const p of performerManager.performers) p.resetProp();
    });
    sceneUndo.commitState();
  }

  function resetAllPerformersEffort(): void {
    sceneUndo.captureState("reset-all-overrides", "Reset all effort overrides");
    sceneUndo.withoutUndo(() => {
      for (const p of performerManager.performers) p.resetEffort();
    });
    sceneUndo.commitState();
  }

  function resetAllPerformersEffects(): void {
    sceneUndo.captureState("reset-all-overrides", "Reset all effect overrides");
    sceneUndo.withoutUndo(() => {
      for (const p of performerManager.performers) p.resetEffects();
    });
    sceneUndo.commitState();
  }

  function resetAllPerformersPlanes(): void {
    sceneUndo.captureState("reset-all-overrides", "Reset all plane overrides");
    sceneUndo.withoutUndo(() => {
      for (const p of performerManager.performers) p.resetPlanes();
    });
    sceneUndo.commitState();
  }

  /**
   * Fan-out: assign a hand plane on every performer in the current scope.
   * Used by the Planes tab when "All" is selected or a single performer is picked.
   */
  function setHandPlaneScoped(hand: "blue" | "red", plane: Plane): void {
    const targets = scopedPerformers();
    if (targets.length <= 1) {
      for (const p of targets) p.setHandPlane(hand, plane);
      return;
    }
    const beforeSnap = captureViewerSnapshot();
    sceneUndo.withoutUndo(() => {
      for (const p of targets) p.setHandPlane(hand, plane);
    });
    const afterSnap = captureViewerSnapshot();
    sceneUndo.pushSelfRestoringEntry("set-hand-plane", `All ${hand}: ${plane}`, {
      undo: () => restoreViewerSnapshot(beforeSnap),
      redo: () => restoreViewerSnapshot(afterSnap),
    });
  }

  /**
   * Fan-out: load a sequence onto every performer in the current scope.
   * The viewer's "change sequence for this performer" control routes here.
   */
  function loadSequenceScoped(sequenceData: SequenceData): void {
    _currentSequenceData = sequenceData;
    for (const p of scopedPerformers()) {
      p.loadSequence(sequenceData);
    }
  }

  // Track the most recently applied formation preset so undo snapshots can
  // record it. Starts as "manual" until the user picks a preset.
  let activeFormation = $state<FormationPreset | "manual">("manual");

  function captureViewerSnapshot(): ViewerDomainSnapshot {
    const performerSnapshots: PerformerPositionSnapshot[] = performerManager.performers.map((p) => ({
      id: p.id,
      position: { x: p.position.x, z: p.position.z },
      facingAngle: p.facingAngle,
      customBluePlane: p.customBluePlane,
      customRedPlane: p.customRedPlane,
    }));

    return structuredClone({
      performers: performerSnapshots,
      selectedPerformerIndex,
      activeFormation,
    });
  }

  function captureVisibilitySnapshot(): VisibilityDomainSnapshot {
    return structuredClone({
      visiblePlanes: new Set(visiblePlanes),
      showGridLabels,
    });
  }

  function restoreViewerSnapshot(snap: ViewerDomainSnapshot): void {
    while (performerManager.performers.length < snap.performers.length) {
      performerManager.addPerformer();
    }
    while (performerManager.performers.length > snap.performers.length) {
      performerManager.removePerformer();
    }

    snap.performers.forEach((ps, i) => {
      const p = performerManager.performers[i];
      if (!p) return;
      p.position.x = ps.position.x;
      p.position.z = ps.position.z;
      p.setFacingAngle(ps.facingAngle);
      p.setHandPlane("blue", ps.customBluePlane);
      p.setHandPlane("red", ps.customRedPlane);
      if (_currentSequenceData && !p.totalSteps) {
        p.loadSequence(_currentSequenceData);
      }
    });

    activeFormation = snap.activeFormation;
    selectedPerformerIndex = snap.selectedPerformerIndex;
  }

  function restoreVisibilitySnapshot(snap: VisibilityDomainSnapshot): void {
    visiblePlanes = new Set(snap.visiblePlanes);
    showGridLabels = snap.showGridLabels;
    persistPlanes(visiblePlanes);
  }

  function spawnPerformerFromUI(): void {
    if (performerManager.performers.length >= STAGE.MAX_VIEWER_PERFORMERS) return;

    sceneUndo.captureState("spawn-performer", "Add performer");

    const sourceIndex = selectedPerformerIndex ?? 0;
    const source = performerManager.performers[sourceIndex];

    performerManager.addPerformer();

    const newIndex = performerManager.performers.length - 1;
    const newPerf = performerManager.performers[newIndex];
    sceneUndo.withoutUndo(() => {
      if (newPerf && source && source !== newPerf) {
        newPerf.setHandPlane("blue", source.customBluePlane);
        newPerf.setHandPlane("red", source.customRedPlane);
      }
      if (newPerf && _currentSequenceData) {
        newPerf.loadSequence(_currentSequenceData);
      }
    });

    selectedPerformerIndex = newIndex;
    sceneUndo.commitState();
  }

  function removePerformerFromUI(): void {
    if (performerManager.performers.length <= 1) return;

    sceneUndo.captureState("remove-performer", "Remove performer");

    const removedIndex = performerManager.performers.length - 1;
    performerManager.removePerformer();

    if (selectedPerformerIndex !== null && selectedPerformerIndex >= removedIndex) {
      selectedPerformerIndex = Math.max(0, removedIndex - 1);
    }

    sceneUndo.commitState();
  }

  function applyFormationFromUI(preset: FormationPreset): void {
    const count = performerManager.performers.length;
    if (!PRESET_VALID_COUNTS[preset]?.includes(count)) return;

    const beforeSnap = captureViewerSnapshot();

    performerManager.transitionToFormation(preset, 500);
    activeFormation = preset;

    const targetFormation = createFormationFromPreset(preset, count);
    const afterPerformers: PerformerPositionSnapshot[] = performerManager.performers.map((p, i) => {
      const slot = targetFormation.slots.find((s) => s.index === i);
      const facing = slot ? calculateFacingAngle(slot, targetFormation) : p.facingAngle;
      return {
        id: p.id,
        position: slot ? { x: slot.position.x, z: slot.position.z } : { x: p.position.x, z: p.position.z },
        facingAngle: facing,
        customBluePlane: p.customBluePlane,
        customRedPlane: p.customRedPlane,
      };
    });
    const afterSnap: ViewerDomainSnapshot = {
      performers: afterPerformers,
      selectedPerformerIndex,
      activeFormation: preset,
    };

    sceneUndo.pushSelfRestoringEntry("apply-formation", `Formation: ${preset}`, {
      undo: () => restoreViewerSnapshot(beforeSnap),
      redo: () => restoreViewerSnapshot(afterSnap),
    });
  }

  let _spatialBeforeSnapshot: ViewerDomainSnapshot | null = null;

  function beginSpatialEdit(): void {
    if (sceneUndo.isUndoDisabled) return;
    if (!_spatialBeforeSnapshot) {
      _spatialBeforeSnapshot = captureViewerSnapshot();
    }
  }

  function endSpatialEdit(): void {
    if (sceneUndo.isUndoDisabled || !_spatialBeforeSnapshot) return;
    const before = _spatialBeforeSnapshot;
    const after = captureViewerSnapshot();
    sceneUndo.pushSelfRestoringEntryCoalescing("spatial-edit", "Move performer", {
      undo: () => restoreViewerSnapshot(before),
      redo: () => restoreViewerSnapshot(after),
    }, "spatial-edit", 300);
    _spatialBeforeSnapshot = null;
  }

  sceneUndo.registerDomain("viewer", {
    capture: captureViewerSnapshot,
    restore: restoreViewerSnapshot,
  });

  sceneUndo.registerDomain("visibility", {
    capture: captureVisibilitySnapshot,
    restore: restoreVisibilitySnapshot,
  });

  function captureDefaultsSnapshot(): DefaultsDomainSnapshot {
    return {
      prop: _defaultSettings.prop,
      effects: new Set(_defaultSettings.effects),
      effortId: _defaultSettings.effortId,
      planeMode: _defaultSettings.planeMode,
      customBluePlane: _defaultSettings.customBluePlane,
      customRedPlane: _defaultSettings.customRedPlane,
    };
  }

  function restoreDefaultsSnapshot(snap: DefaultsDomainSnapshot): void {
    _defaultSettings.prop = snap.prop;
    _defaultSettings.effects = new Set(snap.effects);
    _defaultSettings.effortId = snap.effortId;
    _defaultSettings.planeMode = snap.planeMode;
    _defaultSettings.customBluePlane = snap.customBluePlane;
    _defaultSettings.customRedPlane = snap.customRedPlane;
  }

  sceneUndo.registerDomain("defaults", {
    capture: captureDefaultsSnapshot,
    restore: restoreDefaultsSnapshot,
  });

  function undo(): string | null {
    const result = sceneUndo.undo();
    return result?.description ?? null;
  }

  function redo(): string | null {
    const result = sceneUndo.redo();
    return result?.description ?? null;
  }

  let _currentSequenceData = $state<SequenceData | null>(null);

  const effectToggles = $state<Record<string, boolean>>({
    fire: false,
    led: false,
    trails: false,
    charcoal: false,
  });
  let cameraSnapshot = $state<CameraStateSnapshot | null>(null);
  let navMode = $state<ViewerNavMode>(loadPersistedNavMode());
  let activePreset = $state<string | null>((() => {
    if (typeof localStorage === "undefined") return "behind";
    try { return localStorage.getItem(STORAGE_KEY_PRESET) || "behind"; } catch { return "behind"; }
  })());
  let activeCameraPreset = $state<string>((() => {
    if (typeof localStorage === "undefined") return "main";
    try { return localStorage.getItem(STORAGE_KEY_CAM_PRESET) || "main"; } catch { return "main"; }
  })());
  // visiblePlanes: which grid planes are currently shown. Empty set = grid hidden.
  // On first visit, default to null (no planes shown). When the user enables the
  // grid for the first time, we auto-select only the planes the sequence uses.
  let visiblePlanes = $state<Set<Plane>>(loadPersistedPlanes() ?? new Set());
  let showGridLabels = $state<boolean>((() => {
    if (typeof localStorage === "undefined") return false;
    try {
      const v = localStorage.getItem(STORAGE_KEY_GRID_LABELS);
      return v === "true";
    } catch { return false; }
  })());
  let webglCanvas = $state<HTMLCanvasElement | null>(null);
  let stageGroundOffset = $state(0);

  // Threlte scene internals - registered by Viewer3DScene so the offline
  // exporter can drive rendering without coupling to Threlte's reactive layer.
  let threlteRenderer = $state<unknown>(null);
  let threlteScene = $state<unknown>(null);
  let threlteCamera = $state<unknown>(null);
  // runFrame drives Threlte's full pipeline synchronously: every useTask
  // callback (puppet loop, IK, effects, render) runs in one call. The
  // offline exporter uses this to render at CPU speed, decoupled from the
  // display refresh rate.
  let threlteRunFrame = $state<((timeMs: number) => void) | null>(null);
  // Pause/resume the native rAF animation loop. During offline export the
  // loop is paused so manual runFrame calls aren't racing with rAF renders.
  let threltePauseAutoLoop = $state<(() => void) | null>(null);
  let threlteResumeAutoLoop = $state<(() => void) | null>(null);

  // Pause the Threlte render loop when in 2D mode so the hidden 3D canvas
  // doesn't eat CPU/GPU time and stutter the active 2D animation.
  let _loopPausedFor2D = false;
  $effect(() => {
    if (renderMode === '2d' && threltePauseAutoLoop && !isExporting) {
      threltePauseAutoLoop();
      _loopPausedFor2D = true;
    } else if (renderMode === '3d' && threlteResumeAutoLoop && _loopPausedFor2D) {
      threlteResumeAutoLoop();
      _loopPausedFor2D = false;
    }
  });

  // When true, the puppet loop in Viewer3DScene skips performer state updates
  // so the offline exporter can drive performers deterministically. IK and
  // effects still run normally during advance().
  let isExporting = $state(false);
  // During offline export, the exporter sets this to the desired animation
  // step each frame. The puppet loop reads it instead of the component prop
  // `currentStep`, keeping the state distribution inside useTask where
  // Svelte's $derived chain resolves correctly.
  let exportCurrentStep = $state<number | null>(null);

  // Legacy - kept for any remaining references but no longer used for gating.
  let autoRenderEnabled = $state(true);

  // Camera choreography sub-state - tracks the preset selected in the
  // Export popover. The recording driver that consumes this lands in
  // Phase 1 of the camera-choreography plan.
  const cameraChoreography = createCameraChoreographyState();

  // Callback slot for the effect orchestrator's per-frame update function.
  // Registered by EffectOrchestrator3D via $effect, called by the offline
  // exporter with a deterministic dt each frame.
  let updateEffectsCallback = $state<((dt: number) => void) | null>(null);

  // Camera snap callback - registered by Viewer3DCamera, called by Viewer3DViewPresets
  let _snapToFn: ((position: { x: number; y: number; z: number }, target: { x: number; y: number; z: number }, spherical?: { azimuth: number; polar: number }, animate?: boolean) => void) | null = null;

  // When a hand is newly assigned to a non-wall plane, auto-add that
  // plane to visiblePlanes as a one-time convenience. Uses a tracking
  // set so toggling the plane off afterward is respected — the effect
  // won't re-add a plane the user explicitly hid.
  let _lastSeenBlue = $state<Plane | null>(null);
  let _lastSeenRed = $state<Plane | null>(null);

  $effect(() => {
    const primary = performerManager.performers[0];
    if (!primary) return;
    const blue = primary.customBluePlane;
    const red = primary.customRedPlane;

    let changed = false;
    const next = new Set(visiblePlanes);

    if (blue !== _lastSeenBlue) {
      _lastSeenBlue = blue;
      if (blue !== Plane.WALL && !next.has(blue)) {
        next.add(blue);
        changed = true;
      }
    }
    if (red !== _lastSeenRed) {
      _lastSeenRed = red;
      if (red !== Plane.WALL && !next.has(red)) {
        next.add(red);
        changed = true;
      }
    }

    if (changed) {
      visiblePlanes = next;
      persistPlanes(visiblePlanes);
    }
  });

  // ---------------------------------------------------------------
  // Persistence effects - serialize state to localStorage reactively.
  // ---------------------------------------------------------------

  // Serialize the performer array whenever performer count, position,
  // facing angle, or hand planes change. The rune tracker re-runs this
  // on any write reached through the expression below.
  $effect(() => {
    const snapshots: StoredPerformerSnapshot[] = performerManager.performers.map((p) => ({
      position: { x: p.position.x, z: p.position.z },
      facingAngle: p.facingAngle,
      customBluePlane: p.customBluePlane,
      customRedPlane: p.customRedPlane,
    }));
    if (!_performersPersistReady) return;
    persistPerformers(snapshots);
  });

  // Persist active formation preset.
  $effect(() => {
    persistActiveFormation(activeFormation);
  });

  // Persist which performer is currently selected (null = "All").
  $effect(() => {
    persistSelectedIndex(selectedPerformerIndex);
  });

  /**
   * Switch to 3D render mode and load a sequence for the viewer avatar.
   * No-ops silently when WebGL2 is unavailable so callers don't need to
   * guard every call site - they should just check webgl2Available before
   * showing the "Enter 3D" button.
   */
  function enter3D(sequenceData: SequenceData) {
    if (!_webgl2Available) return;

    // One-time migration of the deprecated visiblePlanes key. Idempotent -
    // returns immediately once the new key exists.
    migrateLegacyPlanesIfNeeded();

    // Initialize the manager on first entry.
    if (performerManager.performers.length === 0) {
      performerManager.initialize();
    }

    // Restore persisted performers, if any. Each additional snapshot beyond
    // the first one spawns a new performer via the manager so the count
    // matches the saved state before we overwrite their fields.
    const persisted = loadPersistedPerformers();
    if (persisted && persisted.length > 0) {
      while (performerManager.performers.length < persisted.length) {
        performerManager.addPerformer();
      }
      sceneUndo.withoutUndo(() => {
        persisted.forEach((snap, i) => {
          const p = performerManager.performers[i];
          if (!p) return;
          p.position.x = snap.position.x;
          p.position.z = snap.position.z;
          p.setFacingAngle(snap.facingAngle);
          p.setHandPlane("blue", snap.customBluePlane);
          p.setHandPlane("red", snap.customRedPlane);
        });
      });
    }

    // Load sequence onto every restored performer. (v1: all performers
    // share the same source sequence; per-performer offsets come later.)
    _currentSequenceData = sequenceData;
    for (const p of performerManager.performers) {
      p.loadSequence(sequenceData);
    }

    // Restore viewer-level state.
    const savedFormation = loadPersistedActiveFormation();
    if (savedFormation) activeFormation = savedFormation;
    const savedSelection = loadPersistedSelectedIndex();
    selectedPerformerIndex = savedSelection;

    renderMode = "3d";
    persistMode("3d");

    // Now that restoration is complete, let the persistence $effect write
    // future changes back to localStorage.
    _performersPersistReady = true;

    // Queue welcome animation on first 3D entry this session.
    // The snap executes when Viewer3DCamera registers its snapTo callback.
    if (!_hasPlayedWelcome) {
      _welcomeAnimationPending = true;
      _hasPlayedWelcome = true;
    }
  }

  /**
   * Return to 2D render mode (avatar instance is kept alive to avoid
   * re-allocating WebGL resources if the user flips back).
   */
  function exit3D() {
    renderMode = "2d";
    persistMode("2d");
  }

  /**
   * Toggle a named visual effect on or off.
   * Unknown effect names are added automatically with an initial `true` value.
   */
  function toggleEffect(name: string) {
    effectToggles[name] = !effectToggles[name];
  }

  /**
   * Record the latest camera snapshot so descendant components (e.g. the
   * mini-map or a screenshot tool) can read camera state without coupling
   * directly to Three.js objects.
   */
  function updateCameraSnapshot(snapshot: CameraStateSnapshot) {
    cameraSnapshot = snapshot;
    persistCamera(snapshot);
  }

  /**
   * Release all resources held by the avatar instance.
   * Call when the viewer component is unmounted.
   */
  function dispose() {
    performerManager.destroy();
  }

  function _fireWelcome(): void {
    if (!_welcomeAnimationPending || !_snapToFn) return;
    _welcomeAnimationPending = false;
    const performers = performerManager.performers;
    if (performers.length === 0) return;
    const shot = computeChoreographerShot(performers, stageGroundOffset);
    snapCameraTo(
      { x: shot.eye.x, y: shot.eye.y, z: shot.eye.z },
      { x: shot.target.x, y: shot.target.y, z: shot.target.z },
    );
  }

  /**
   * Register the snap-to callback from Viewer3DCamera so preset buttons
   * can animate the camera without direct coupling to Three.js objects.
   */
  function registerSnapTo(
    fn: (position: { x: number; y: number; z: number }, target: { x: number; y: number; z: number }, spherical?: { azimuth: number; polar: number }, animate?: boolean) => void
  ) {
    _snapToFn = fn;
    if (_welcomeAnimationPending) {
      requestAnimationFrame(() => _fireWelcome());
    }
  }

  /**
   * Animate the camera to a new position/target. No-ops if the camera
   * hasn't registered its snap callback yet.
   */
  function snapCameraTo(
    position: { x: number; y: number; z: number },
    target: { x: number; y: number; z: number },
    spherical?: { azimuth: number; polar: number },
    animate: boolean = true,
  ) {
    _snapToFn?.(position, target, spherical, animate);
  }

  return {
    get webgl2Available() {
      return _webgl2Available;
    },
    get preferredMode() {
      return _persistedMode;
    },
    get persistedCamera() {
      return cameraSnapshot ?? _persistedCamera;
    },
    get renderMode() {
      return renderMode;
    },
    get oceanVariant() {
      return oceanVariant;
    },
    setOceanVariant(v: OceanVariant) {
      oceanVariant = v;
      try { localStorage.setItem("tka-viewer3d-oceanVariant", v); } catch {}
    },
    get activePopover() {
      return _activePopover;
    },
    openPopover,
    closePopover,
    get performerManager() {
      return performerManager;
    },
    get selectedPerformerIndex() {
      return selectedPerformerIndex;
    },
    get isCameraDragging() {
      return isCameraDragging;
    },
    setCameraDragging(value: boolean) {
      isCameraDragging = value;
    },
    get navMode(): ViewerNavMode {
      return navMode;
    },
    setNavMode(value: ViewerNavMode) {
      navMode = value;
      persistNavMode(value);
    },
    scopedPerformers,
    selectPerformerScope,
    get propSizeLinked() {
      return propSizeLinked;
    },
    togglePropSizeLink,
    setHandPlaneScoped,
    loadSequenceScoped,
    get canUndo() {
      return sceneUndo.canUndo;
    },
    get canRedo() {
      return sceneUndo.canRedo;
    },
    get activeFormation() {
      return activeFormation;
    },
    spawnPerformerFromUI,
    removePerformerFromUI,
    applyFormationFromUI,
    beginSpatialEdit,
    endSpatialEdit,
    sceneUndo,
    undo,
    redo,
    // Default settings cascade
    get defaultSettings() { return _defaultSettings; },
    setDefaultProp,
    setDefaultEffort,
    setDefaultEffects,
    toggleDefaultEffect,
    setDefaultPlaneMode,
    setDefaultHandPlane,
    overrideCountForCategory,
    resetAllPerformersProp,
    resetAllPerformersEffort,
    resetAllPerformersEffects,
    resetAllPerformersPlanes,
    get effectToggles() {
      return effectToggles;
    },
    get cameraSnapshot() {
      return cameraSnapshot;
    },
    get visiblePlanes() {
      return visiblePlanes;
    },
    get showGrid() {
      return visiblePlanes.size > 0;
    },
    get showGridLabels() {
      return showGridLabels;
    },
    toggleGridLabels() {
      sceneUndo.captureState("toggle-grid-labels", "Toggle grid labels");
      showGridLabels = !showGridLabels;
      try { localStorage.setItem(STORAGE_KEY_GRID_LABELS, String(showGridLabels)); } catch {}
      sceneUndo.commitState();
    },
    get activePreset() {
      return activePreset;
    },
    setActivePreset(id: string | null) {
      activePreset = id;
      try { localStorage.setItem(STORAGE_KEY_PRESET, id ?? ""); } catch { /* ignore */ }
    },
    get activeCameraPreset() {
      return activeCameraPreset;
    },
    setActiveCameraPreset(id: string) {
      activeCameraPreset = id;
      try { localStorage.setItem(STORAGE_KEY_CAM_PRESET, id); } catch { /* ignore */ }
    },
    /**
     * Toggle a single grid plane on or off.
     */
    togglePlane(plane: Plane) {
      sceneUndo.captureState("toggle-plane-visibility", `Toggle ${plane} plane`);
      const next = new Set(visiblePlanes);
      if (next.has(plane)) next.delete(plane);
      else next.add(plane);
      visiblePlanes = next;
      persistPlanes(visiblePlanes);
      sceneUndo.commitState();
    },
    /**
     * Show all three grid planes at once.
     */
    showAllPlanes() {
      visiblePlanes = new Set([Plane.WALL, Plane.WHEEL, Plane.FLOOR]);
      persistPlanes(visiblePlanes);
    },
    /**
     * Hide all grid planes.
     */
    hideAllPlanes() {
      visiblePlanes = new Set();
      persistPlanes(visiblePlanes);
    },
    /**
     * Toggle between "all planes visible" and "no planes visible".
     * When turning on for the first time (or after hide-all), defaults to
     * wall-only since all current sequences use the wall plane.
     */
    toggleGrid(_sequenceData?: SequenceData | null) {
      if (visiblePlanes.size > 0) {
        // Already showing something - turn off everything
        visiblePlanes = new Set();
      } else {
        // Turn on - show only the planes the sequence actually uses.
        // Currently every sequence uses the wall plane, so we default to that.
        // When multi-plane sequences exist, read sequenceData.gridMode here.
        const defaultPlane = Plane.WALL;
        visiblePlanes = new Set([defaultPlane]);
      }
      persistPlanes(visiblePlanes);
    },
    get webglCanvas() {
      return webglCanvas;
    },
    setWebglCanvas(canvas: HTMLCanvasElement | null) {
      webglCanvas = canvas;
    },
    get stageGroundOffset() {
      return stageGroundOffset;
    },
    setStageGroundOffset(v: number) {
      stageGroundOffset = v;
    },
    // Threlte scene internals for offline export
    get threlteRenderer() {
      return threlteRenderer;
    },
    get threlteScene() {
      return threlteScene;
    },
    get threlteCamera() {
      return threlteCamera;
    },
    /**
     * Register Threlte internals from Viewer3DScene so the offline exporter
     * can drive the full render pipeline synchronously.
     */
    registerThrelteInternals(refs: {
      renderer: unknown;
      scene: unknown;
      camera: unknown;
      runFrame: (timeMs: number) => void;
      pauseAutoLoop: () => void;
      resumeAutoLoop: () => void;
    }) {
      threlteRenderer = refs.renderer;
      threlteScene = refs.scene;
      threlteCamera = refs.camera;
      threlteRunFrame = refs.runFrame;
      threltePauseAutoLoop = refs.pauseAutoLoop;
      threlteResumeAutoLoop = refs.resumeAutoLoop;
    },
    get threlteRunFrame() {
      return threlteRunFrame;
    },
    get threltePauseAutoLoop() {
      return threltePauseAutoLoop;
    },
    get threlteResumeAutoLoop() {
      return threlteResumeAutoLoop;
    },
    get isExporting() {
      return isExporting;
    },
    set isExporting(value: boolean) {
      isExporting = value;
    },
    get exportCurrentStep() {
      return exportCurrentStep;
    },
    set exportCurrentStep(value: number | null) {
      exportCurrentStep = value;
    },
    get autoRenderEnabled() {
      return autoRenderEnabled;
    },
    pauseAutoRender() {
      autoRenderEnabled = false;
    },
    resumeAutoRender() {
      autoRenderEnabled = true;
    },
    get updateEffects() {
      return updateEffectsCallback;
    },
    set updateEffects(fn: ((dt: number) => void) | null) {
      updateEffectsCallback = fn;
    },
    get cameraChoreography() {
      return cameraChoreography;
    },
    get showPerf() {
      return showPerf;
    },
    togglePerf() {
      showPerf = !showPerf;
    },
    enter3D,
    exit3D,
    toggleEffect,
    updateCameraSnapshot,
    registerSnapTo,
    snapCameraTo,
    dispose,
  };
}
