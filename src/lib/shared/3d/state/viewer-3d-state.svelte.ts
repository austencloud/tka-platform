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

import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
// propInterpolator / sequenceConverter are now module-level functions; no type imports needed
import type { CameraStateSnapshot } from "@austencloud/scene-3d";
import { getSceneUndoManager } from "../undo/get-scene-undo-manager";
import type {
  DefaultsDomainSnapshot,
  PerformerPositionSnapshot,
  ViewerDomainSnapshot,
  VisibilityDomainSnapshot,
} from "../undo/scene-undo-types";
import { Plane, PlaneMode } from "@austencloud/scene-3d";
import type { AvatarInstanceState } from "./avatar-instance-state.svelte";
import { derivePlaneModeFromHands } from "./avatar-instance-state.svelte";
import type {
  DefaultPerformerSettings,
  CascadeCategory,
} from "./performer-settings-types";
import type { EffectType } from "$lib/shared/effects/domain/effects-config";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import type { EffortId } from "$lib/shared/effort/domain/effort-types";
import {
  createPerformerManager,
  type PerformerManager,
} from "./performer-manager.svelte";
import { DEFAULT_AVATAR_ID } from "@austencloud/scene-3d";
import { STAGE } from "@austencloud/scene-3d";
import type { FormationPreset } from "@austencloud/scene-3d";
import { calculateFacingAngle } from "@austencloud/scene-3d";
import {
  PRESET_VALID_COUNTS,
  createFormationFromPreset,
} from "@austencloud/scene-3d";
import { isWebGL2Available } from "../capabilities/webgl-capabilities";
import { fits3DViewportNow } from "../capabilities/viewport-3d-gate.svelte";
import { userProportionsState } from "@austencloud/scene-3d";
import { createCameraChoreographyState } from "$lib/shared/sequence-viewer/camera-choreography/state.svelte";
import {
  computeChoreographerShot,
  type PerformerShotSubject,
} from "$lib/shared/sequence-viewer/camera-choreography/presets/shots";
import type { OceanVariant } from "../environments/domain/enums/environment-enums";
import type { TimedTransition } from "../camera/transitions";
import {
  DEFAULT_SCENE_ENVIRONMENT_ID,
  normalizeSceneEnvironmentId,
  type SceneEnvironmentId,
} from "../environments/domain/scene-environment";
import {
  resolveInitialDefaultProp,
  resolvePlainOpenPerformerSettings,
} from "../domain/plain-open-policy";

// ============================================
// Popover Stack
// ============================================

export type PopoverId =
  | "formation"
  | "tempo"
  | "export"
  | "camera"
  | "planes"
  | "info"
  | "scene"
  | "effects"
  | "prop"
  | "effort"
  | "dev";

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
const STORAGE_KEY_EFFECT_TOGGLES = "tka-viewer3d-effectToggles";
const STORAGE_KEY_OCEAN_VARIANT = "tka-viewer3d-oceanVariant";
const STORAGE_KEY_ENVIRONMENT = "tka-viewer3d-environment";

export type ViewerNavMode = "orbit" | "fly" | "walk";

type CameraSnapTo = (
  position: { x: number; y: number; z: number },
  target: { x: number; y: number; z: number },
  spherical?: { azimuth: number; polar: number },
  animate?: boolean,
  transitionTiming?: TimedTransition
) => void;

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

/** Narrow an untrusted string (seed JSON, app settings) to a real PropType. */
function asPropType(value: string | null | undefined): PropType | null {
  if (!value) return null;
  return Object.values(PropType).includes(value as PropType)
    ? (value as PropType)
    : null;
}

function loadPersistedDefaultProp(): PropType {
  if (typeof localStorage === "undefined") return PropType.STAFF;
  try {
    const v = localStorage.getItem(STORAGE_KEY_DEFAULT_PROP);
    if (v && Object.values(PropType).includes(v as PropType))
      return v as PropType;
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

/** Per-performer cascade overrides; null = inherit the viewer default. */
// Mirrored structurally by domain/plain-open-policy.ts — keep field policy in sync when adding fields.
export interface StoredPerformerSettings {
  prop: string | null;
  effortId: string | null;
  effect: string | null;
  staffLengthCm: number | null;
}

export interface StoredPerformerSnapshot {
  position: { x: number; z: number };
  facingAngle: number;
  customBluePlane: Plane;
  customRedPlane: Plane;
  /** User-assigned display name; absent/null = inherit the avatar model's name. */
  name?: string | null;
  /** Cascade overrides; absent = no overrides (pre-v2 snapshots). */
  settings?: StoredPerformerSettings;
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

function loadPersistedEnvironment(
  firstUseEnvironment: SceneEnvironmentId
): SceneEnvironmentId {
  if (typeof localStorage === "undefined") return firstUseEnvironment;
  try {
    const stored = localStorage.getItem(STORAGE_KEY_ENVIRONMENT);
    const environmentId = normalizeSceneEnvironmentId(
      stored,
      firstUseEnvironment
    );

    // The old viewer followed the app background forever. The first viewer
    // opened after this migration remembers that look once, then owns it.
    if (stored !== environmentId) {
      localStorage.setItem(STORAGE_KEY_ENVIRONMENT, environmentId);
    }
    return environmentId;
  } catch {
    return firstUseEnvironment;
  }
}

function persistEnvironment(environmentId: SceneEnvironmentId): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY_ENVIRONMENT, environmentId);
  } catch {
    // Storage full or unavailable.
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
    localStorage.setItem(
      STORAGE_KEY_VISIBLE_PLANES,
      JSON.stringify([...planes])
    );
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
      value === null ? "null" : String(value)
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

const DEFAULT_EFFECT_TOGGLES: Record<string, boolean> = {
  fire: false,
  led: false,
  trails: false,
  charcoal: false,
};

function loadPersistedEffectToggles(): Record<string, boolean> {
  if (typeof localStorage === "undefined") return { ...DEFAULT_EFFECT_TOGGLES };
  try {
    const raw = localStorage.getItem(STORAGE_KEY_EFFECT_TOGGLES);
    if (!raw) return { ...DEFAULT_EFFECT_TOGGLES };
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ...DEFAULT_EFFECT_TOGGLES };
    }
    const toggles = { ...DEFAULT_EFFECT_TOGGLES };
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === "boolean") toggles[k] = v;
    }
    return toggles;
  } catch {
    return { ...DEFAULT_EFFECT_TOGGLES };
  }
}

function persistEffectToggles(toggles: Record<string, boolean>): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY_EFFECT_TOGGLES, JSON.stringify(toggles));
  } catch {
    // Quota exceeded or unavailable
  }
}

// ============================================
// Factory
// ============================================

/**
 * The module-level writers, captured so a seeded instance can shadow each name
 * with a no-op inside the factory without self-referencing (a local
 * `const persistCamera = persistCamera` would be a TDZ error). Call sites stay
 * untouched and route through whichever binding their instance installed.
 */
const WRITERS = {
  navMode: persistNavMode,
  defaultProp: persistDefaultProp,
  mode: persistMode,
  camera: persistCamera,
  planes: persistPlanes,
  performers: persistPerformers,
  activeFormation: persistActiveFormation,
  selectedIndex: persistSelectedIndex,
  effectToggles: persistEffectToggles,
} as const;

/**
 * Optional construction seed. Every field present here is used INSTEAD OF the
 * matching localStorage key, and nothing is written back — so a seeded viewer
 * is fully self-contained.
 *
 * This exists because the only way to reproduce a saved 3D scene used to be
 * `applyScene3DLook`: write the user's localStorage, then let a fresh mount
 * read it. That works for one viewer and is destructive by construction — it
 * overwrites settings the user chose, which is why every caller had to pair it
 * with `captureSettingsCheckpoint` and an Undo toast. It also cannot support
 * two viewers at once: localStorage is a single global slot, so two mounts
 * seeding concurrently both read whichever wrote last.
 *
 * A gallery of live scene previews needs neither of those properties, hence
 * the argument. `applyScene3DLook` is untouched and still correct for the
 * "make my whole app look like this" gesture.
 */
export interface Viewer3DStateSeed extends Partial<Viewer3DPersistConfig> {
  /** Force the initial render mode, bypassing the persisted one. A preview
   *  always wants "3d" regardless of where the user left the real viewer. */
  renderMode?: "2d" | "3d";
  /** Legacy v1/v2 saved-scene field. `environmentId` is canonical. */
  backgroundType?: string;
  /**
   * Orbit the camera around its target continuously, for as long as the viewer
   * is mounted. A gallery tile is watched, not driven, so it wants motion that
   * never ends and never depends on playback.
   *
   * This is deliberately NOT the `auto-orbit` camera preset. That preset is a
   * choreography shot: it targets the primary performer, runs exactly one
   * revolution across the sequence duration, and only advances while the
   * choreography driver is ticking — so a tile showing a saved LOOK with no
   * performance would never move at all.
   */
  autoOrbit?: boolean;
  /** Revolution speed when `autoOrbit` is on. Three.js OrbitControls units:
   *  ~6deg/sec per unit. Default 2.0 (a full turn in ~30s). */
  autoOrbitSpeed?: number;
  /**
   * Scene-feature toggles (ocean flora, torches, …) for THIS viewer. Unseeded,
   * Viewer3DCanvas builds its feature state from the shared
   * `tka-scene-features` key. Seeded, that key is ignored in both directions.
   */
  sceneFeatures?: Record<string, boolean>;
}

export interface Viewer3DStateOptions {
  /** Used only when this user has never chosen a 3D environment. */
  firstUseEnvironment?: SceneEnvironmentId;
  /**
   * The app's current prop (settings.bluePropType). A PLAIN open re-seeds prop
   * identity from this instead of the persisted viewer prop, so users stop
   * being ambushed by a stale saved prop. A preset-sourced open ignores it.
   */
  appDefaultProp?: string | null;
}

function buildViewer3DState(
  seed?: Viewer3DStateSeed,
  options: Viewer3DStateOptions = {}
) {
  const sceneUndo = getSceneUndoManager();
  const _webgl2Available = isWebGL2Available();
  /** A seeded field wins over storage; `undefined` means "not seeded". */
  const seeded = <T>(value: T | undefined, fromStorage: () => T): T =>
    value !== undefined ? value : fromStorage();

  /**
   * A seeded viewer is a self-contained preview, so it reads its own config and
   * writes NOTHING back. Without this, mounting a saved-scene tile would stomp
   * the real viewer's keys: `enter3D` persists mode, and an orbit gesture (or
   * `snapCameraTo`) persists the camera — exactly the destructiveness the seed
   * argument exists to remove. Each writer below shadows its module-level
   * namesake for this instance only; call sites are unchanged.
   */
  const persistent = seed === undefined;
  /**
   * Should restored performer settings be applied verbatim? Three cases:
   *
   * 1. Seeded preview (tiles, demos) — ALWAYS verbatim. A seed is the whole
   *    point: it renders exactly the saved look, so nothing is stripped.
   * 2. Persistent host that opted into prop-follow (passed `appDefaultProp`) —
   *    the one-shot intent decides. Present = preset-sourced open, verbatim;
   *    absent = plain open, prop identity re-seeds from the app prop.
   * 3. Persistent host that did NOT opt in (e.g. /coven) — verbatim, the
   *    pre-feature behavior. Crucially it does NOT consume the marker, so a
   *    pending preset intent survives for the host it was written for.
   */
  const _restoreVerbatim =
    persistent && options.appDefaultProp !== undefined
      ? consumeViewer3DPresetIntent()
      : true;
  const seededEnvironment = seed?.environmentId ?? seed?.backgroundType;
  let environmentId = $state<SceneEnvironmentId>(
    seededEnvironment !== undefined
      ? normalizeSceneEnvironmentId(seededEnvironment)
      : loadPersistedEnvironment(
          options.firstUseEnvironment ?? DEFAULT_SCENE_ENVIRONMENT_ID
        )
  );
  const noop = () => {};
  const persistNavMode = persistent ? WRITERS.navMode : noop;
  const persistDefaultProp = persistent ? WRITERS.defaultProp : noop;
  const persistMode = persistent ? WRITERS.mode : noop;
  const persistCamera = persistent ? WRITERS.camera : noop;
  const persistPlanes = persistent ? WRITERS.planes : noop;
  const persistPerformers = persistent ? WRITERS.performers : noop;
  const persistActiveFormation = persistent ? WRITERS.activeFormation : noop;
  const persistSelectedIndex = persistent ? WRITERS.selectedIndex : noop;
  const persistEffectToggles = persistent ? WRITERS.effectToggles : noop;
  const persistSceneEnvironment = persistent ? persistEnvironment : noop;
  /** The four keys written inline rather than through a `persist*` helper. */
  const writeKey = (key: string, value: string) => {
    if (!persistent) return;
    try {
      localStorage.setItem(key, value);
    } catch {
      // Quota exceeded or unavailable.
    }
  };
  // Start in 2D on viewports too small to host 3D even if '3d' was persisted from
  // a larger screen — avoids briefly mounting the 3D overlay before the
  // orchestrator's fits3D guard corrects it. Non-mutating: storage keeps '3d', so
  // unfolding restores 3D.
  const _persistedMode = seeded(seed?.renderMode, () =>
    _webgl2Available && fits3DViewportNow() ? loadPersistedMode() : "2d"
  );
  const _persistedCamera = seeded(seed?.camera, loadPersistedCamera);

  // Synchronously restore the last render mode from localStorage so that
  // closing and reopening the sequence drawer keeps the user in 3D if that's
  // where they were. The orchestrator still fires enter3D() once the sequence
  // is available so the primary performer gets its sequence data loaded.
  let renderMode = $state<"2d" | "3d">(_persistedMode);
  let showPerf = $state(false);

  const _persistedOceanVariant = seeded(
    seed?.oceanVariant as OceanVariant | undefined,
    () => {
      try {
        return (localStorage.getItem(STORAGE_KEY_OCEAN_VARIANT) ??
          "abyss") as OceanVariant;
      } catch {
        return "abyss" as OceanVariant;
      }
    }
  );
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
    // Seeded prop arrives as a bare string (Viewer3DPersistConfig's shape, and
    // what Firestore stores), so `asPropType` validates before trusting it —
    // an unknown value falls through rather than poisoning the cascade.
    // Falling through: a plain open follows the app prop, while a verbatim open
    // (preset-sourced, or a host that never opted in) keeps the persisted
    // viewer prop, which applyScene3DLook just wrote for the preset case.
    prop:
      asPropType(seed?.defaultProp) ??
      (resolveInitialDefaultProp({
        presetSourced: _restoreVerbatim,
        appProp: asPropType(options.appDefaultProp),
        persistedProp: loadPersistedDefaultProp(),
      }) as PropType),
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

  function currentViewportAspect(): number {
    return typeof window === "undefined"
      ? 1
      : window.innerWidth / window.innerHeight;
  }

  /**
   * Keep the complete cast in view after a cast or formation edit. The shot is
   * calculated from the destination slots, so the camera arrives with the
   * performers instead of correcting itself after their movement finishes.
   */
  function framePerformerGroup(
    performers: readonly PerformerShotSubject[]
  ): void {
    if (renderMode !== "3d" || !_snapToFn || performers.length === 0) return;
    const shot = computeChoreographerShot(
      performers,
      stageGroundOffset,
      currentViewportAspect()
    );
    snapCameraTo(
      { x: shot.eye.x, y: shot.eye.y, z: shot.eye.z },
      { x: shot.target.x, y: shot.target.y, z: shot.target.z },
      undefined,
      true,
      performerManager.formationTransitionTiming ?? undefined
    );
  }

  /**
   * Refit the complete cast after the viewer gives real width to a dock. The
   * calculated shot supplies the distance and group center, while the live
   * camera supplies its direction. Opening controls therefore keeps the angle
   * the user chose instead of snapping them back to a canned viewpoint.
   */
  function frameAllPerformers(
    viewportAspect = currentViewportAspect(),
    preserveViewingDirection = true
  ): void {
    const performers = performerManager.performers;
    if (renderMode !== "3d" || !_snapToFn || performers.length === 0) return;

    const shot = computeChoreographerShot(
      performers,
      stageGroundOffset,
      viewportAspect
    );
    const target = shot.target;
    let position = shot.eye;

    const liveCamera = cameraSnapshot ?? _persistedCamera;
    if (preserveViewingDirection && liveCamera) {
      const dx = liveCamera.position.x - liveCamera.target.x;
      const dy = liveCamera.position.y - liveCamera.target.y;
      const dz = liveCamera.position.z - liveCamera.target.z;
      const currentDistance = Math.hypot(dx, dy, dz);
      const requiredDistance = Math.hypot(
        shot.eye.x - shot.target.x,
        shot.eye.y - shot.target.y,
        shot.eye.z - shot.target.z
      );

      if (
        Number.isFinite(currentDistance) &&
        currentDistance > 0.001 &&
        Number.isFinite(requiredDistance)
      ) {
        position = {
          x: target.x + (dx / currentDistance) * requiredDistance,
          y: target.y + (dy / currentDistance) * requiredDistance,
          z: target.z + (dz / currentDistance) * requiredDistance,
        };
      }
    }

    snapCameraTo(
      { x: position.x, y: position.y, z: position.z },
      { x: target.x, y: target.y, z: target.z }
    );
  }

  /**
   * Set the current selection scope. Pass null for "All".
   * Out-of-bounds indices are allowed - scopedPerformers() will return []
   * so individual write helpers no-op cleanly.
   */
  function selectPerformerScope(index: number | null): void {
    selectedPerformerIndex = index;
    persistSelectedIndex(index);

    // Selecting a performer changes who the controls affect; it should not
    // discard the camera angle the user chose while watching the formation.
    // The light and ground ring in Viewer3DScene make the active performer
    // visible without moving the view. Returning to All still restores the
    // group overview promised by that control.
    if (index !== null || renderMode !== "3d" || !_snapToFn) return;
    const performers = performerManager.performers;
    if (performers.length === 0) return;

    const shot = computeChoreographerShot(
      performers,
      stageGroundOffset,
      currentViewportAspect()
    );
    snapCameraTo(
      { x: shot.eye.x, y: shot.eye.y, z: shot.eye.z },
      { x: shot.target.x, y: shot.target.y, z: shot.target.z }
    );
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
    sceneUndo.captureState(
      "change-default-effort",
      `Default effort: ${effortId}`
    );
    _defaultSettings.effortId = effortId;
    sceneUndo.commitState();
  }

  function setDefaultPlaneMode(mode: PlaneMode): void {
    sceneUndo.captureState(
      "change-default-planes",
      `Default plane mode: ${mode}`
    );
    _defaultSettings.planeMode = mode;
    sceneUndo.commitState();
  }

  function setDefaultHandPlane(hand: "blue" | "red", plane: Plane): void {
    sceneUndo.captureState(
      "change-default-planes",
      `Default ${hand}: ${plane}`
    );
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
    return performerManager.performers.filter((p) => p.hasOverride[cat]).length;
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
    sceneUndo.pushSelfRestoringEntry(
      "set-hand-plane",
      `All ${hand}: ${plane}`,
      {
        undo: () => restoreViewerSnapshot(beforeSnap),
        redo: () => restoreViewerSnapshot(afterSnap),
      }
    );
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
    const performerSnapshots: PerformerPositionSnapshot[] =
      performerManager.performers.map((p) => ({
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

    performerManager.cancelFormationTransition();

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
    framePerformerGroup(snap.performers);
  }

  function restoreVisibilitySnapshot(snap: VisibilityDomainSnapshot): void {
    visiblePlanes = new Set(snap.visiblePlanes);
    showGridLabels = snap.showGridLabels;
    persistPlanes(visiblePlanes);
  }

  function spawnPerformerFromUI(): void {
    if (performerManager.performers.length >= STAGE.MAX_VIEWER_PERFORMERS)
      return;

    sceneUndo.captureState("spawn-performer", "Add performer");

    const sourceIndex = selectedPerformerIndex ?? 0;
    const source = performerManager.performers[sourceIndex];

    const layoutTargets = performerManager.addPerformer();

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
    if (layoutTargets) framePerformerGroup(layoutTargets);
  }

  function removePerformerFromUI(): void {
    if (performerManager.performers.length <= 1) return;

    sceneUndo.captureState("remove-performer", "Remove performer");

    const removedIndex =
      selectedPerformerIndex ?? performerManager.performers.length - 1;
    const layoutTargets = performerManager.removePerformer(removedIndex);
    selectedPerformerIndex = Math.min(
      removedIndex,
      performerManager.performers.length - 1
    );

    sceneUndo.commitState();
    if (layoutTargets) framePerformerGroup(layoutTargets);
  }

  function applyFormationFromUI(preset: FormationPreset): void {
    const count = performerManager.performers.length;
    if (!PRESET_VALID_COUNTS[preset]?.includes(count)) return;

    const beforeSnap = captureViewerSnapshot();

    performerManager.transitionToFormation(preset, 500);
    activeFormation = preset;

    const targetFormation = createFormationFromPreset(preset, count);
    const afterPerformers: PerformerPositionSnapshot[] =
      performerManager.performers.map((p, i) => {
        const slot = targetFormation.slots.find((s) => s.index === i);
        const facing = slot
          ? calculateFacingAngle(slot, targetFormation)
          : p.facingAngle;
        return {
          id: p.id,
          position: slot
            ? { x: slot.position.x, z: slot.position.z }
            : { x: p.position.x, z: p.position.z },
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

    sceneUndo.pushSelfRestoringEntry(
      "apply-formation",
      `Formation: ${preset}`,
      {
        undo: () => restoreViewerSnapshot(beforeSnap),
        redo: () => restoreViewerSnapshot(afterSnap),
      }
    );
    framePerformerGroup(afterPerformers);
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
    sceneUndo.pushSelfRestoringEntryCoalescing(
      "spatial-edit",
      "Move performer",
      {
        undo: () => restoreViewerSnapshot(before),
        redo: () => restoreViewerSnapshot(after),
      },
      "spatial-edit",
      300
    );
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
      effortId: _defaultSettings.effortId,
      planeMode: _defaultSettings.planeMode,
      customBluePlane: _defaultSettings.customBluePlane,
      customRedPlane: _defaultSettings.customRedPlane,
    };
  }

  function restoreDefaultsSnapshot(snap: DefaultsDomainSnapshot): void {
    _defaultSettings.prop = snap.prop;
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

  const effectToggles = $state<Record<string, boolean>>(
    seeded(seed?.effectToggles, loadPersistedEffectToggles)
  );
  let cameraSnapshot = $state<CameraStateSnapshot | null>(null);
  let navMode = $state<ViewerNavMode>(
    seeded(seed?.navMode, loadPersistedNavMode)
  );
  let activePreset = $state<string | null>(
    (() => {
      if (typeof localStorage === "undefined") return "behind";
      try {
        return localStorage.getItem(STORAGE_KEY_PRESET) || "behind";
      } catch {
        return "behind";
      }
    })()
  );
  let activeCameraPreset = $state<string>(
    (() => {
      if (typeof localStorage === "undefined") return "main";
      try {
        return localStorage.getItem(STORAGE_KEY_CAM_PRESET) || "main";
      } catch {
        return "main";
      }
    })()
  );
  // visiblePlanes: which grid planes are currently shown. Empty set = grid hidden.
  // On first visit, default to null (no planes shown). When the user enables the
  // grid for the first time, we auto-select only the planes the sequence uses.
  let visiblePlanes = $state<Set<Plane>>(loadPersistedPlanes() ?? new Set());
  let showGridLabels = $state<boolean>(
    (() => {
      if (typeof localStorage === "undefined") return false;
      try {
        const v = localStorage.getItem(STORAGE_KEY_GRID_LABELS);
        return v === "true";
      } catch {
        return false;
      }
    })()
  );
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
    if (renderMode === "2d" && threltePauseAutoLoop && !isExporting) {
      threltePauseAutoLoop();
      _loopPausedFor2D = true;
    } else if (
      renderMode === "3d" &&
      threlteResumeAutoLoop &&
      _loopPausedFor2D
    ) {
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
  let _snapToFn: CameraSnapTo | null = null;

  // ---------------------------------------------------------------
  // Persistence effects - serialize state to localStorage reactively.
  // ---------------------------------------------------------------

  // Serialize the performer array whenever performer count, position,
  // facing angle, or hand planes change. The rune tracker re-runs this
  // on any write reached through the expression below.
  $effect(() => {
    const snapshots: StoredPerformerSnapshot[] =
      performerManager.performers.map((p) => ({
        position: { x: p.position.x, z: p.position.z },
        facingAngle: p.facingAngle,
        customBluePlane: p.customBluePlane,
        customRedPlane: p.customRedPlane,
        name: p.displayName,
        settings: {
          prop: p.settings.prop,
          effortId: p.settings.effortId,
          effect: p.settings.effect,
          staffLengthCm: p.settings.staffLengthCm,
        },
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
   * Switch to 3D render mode, optionally loading choreography onto the stage.
   * Scene-authoring surfaces can enter without a sequence so the environment,
   * performers, and camera remain usable while the shot is being assembled.
   * No-ops silently when WebGL2 is unavailable so callers don't need to guard
   * every call site.
   */
  function enter3D(sequenceData: SequenceData | null = null) {
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
    const persisted = seeded(seed?.performers, loadPersistedPerformers);
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
          p.setDisplayName(snap.name ?? null);
          // On a plain open the per-performer prop AND staffLengthCm overrides
          // are stripped, so the performer inherits _defaultSettings.prop —
          // which points at the app prop — at the app's own size. Effort and
          // effect overrides survive either way. A verbatim open (seeded,
          // preset-sourced, or non-opted-in host) keeps all four.
          const settings = resolvePlainOpenPerformerSettings(
            snap.settings,
            _restoreVerbatim
          );
          if (settings) {
            if (settings.prop !== null) p.setProp(settings.prop as PropType);
            if (settings.effortId !== null)
              p.setEffort(settings.effortId as EffortId);
            if (settings.effect !== null)
              p.setEffect(settings.effect as EffectType);
            if (settings.staffLengthCm !== null)
              p.setStaffLengthCm(settings.staffLengthCm);
          }
        });
      });
    }

    // Load or clear choreography on every restored performer. (v1: all
    // performers share the same source sequence; per-performer offsets come
    // later.) An empty 3D workspace still owns a neutral performer so camera
    // and environment controls have a concrete stage to frame.
    _currentSequenceData = sequenceData;
    for (const p of performerManager.performers) {
      if (sequenceData) p.loadSequence(sequenceData);
      else p.clearSequence();
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

    // Queue welcome framing only when there is no camera to restore. A saved
    // pose belongs to the user and must win across refreshes and HMR remounts.
    // The snap executes when Viewer3DCamera registers its callback.
    if (!_hasPlayedWelcome && !_persistedCamera) {
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
    persistEffectToggles({ ...effectToggles });
  }

  /**
   * Snapshot every persistable knob of this viewer state as one typed config.
   * This is the single capture point for save-a-3D-scene (and any future
   * "reproduce this viewer" feature) — the inverse of writeViewer3DConfig.
   */
  function serialize(): Viewer3DPersistConfig {
    return {
      environmentId,
      camera: cameraSnapshot ?? _persistedCamera,
      performers: performerManager.performers.map((p) => ({
        position: { x: p.position.x, z: p.position.z },
        facingAngle: p.facingAngle,
        customBluePlane: p.customBluePlane,
        customRedPlane: p.customRedPlane,
        name: p.displayName ?? null,
        settings: {
          prop: p.settings.prop,
          effortId: p.settings.effortId,
          effect: p.settings.effect,
          staffLengthCm: p.settings.staffLengthCm,
        },
      })),
      selectedPerformerIndex,
      activeFormation,
      defaultProp: String(_defaultSettings.prop),
      oceanVariant: String(oceanVariant),
      navMode,
      activePreset,
      activeCameraPreset,
      showGridLabels,
      visiblePlanes: [...visiblePlanes].map(String),
      effectToggles: { ...effectToggles },
    };
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
    const shot = computeChoreographerShot(
      performers,
      stageGroundOffset,
      currentViewportAspect()
    );
    snapCameraTo(
      { x: shot.eye.x, y: shot.eye.y, z: shot.eye.z },
      { x: shot.target.x, y: shot.target.y, z: shot.target.z }
    );
  }

  /**
   * Register the snap-to callback from Viewer3DCamera so preset buttons
   * can animate the camera without direct coupling to Three.js objects.
   */
  function registerSnapTo(fn: CameraSnapTo) {
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
    transitionTiming?: TimedTransition
  ) {
    _snapToFn?.(position, target, spherical, animate, transitionTiming);
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
    /** Environment rendered inside this viewer. */
    get environmentId(): SceneEnvironmentId {
      return environmentId;
    },
    setEnvironmentId(value: SceneEnvironmentId | string): void {
      const next = normalizeSceneEnvironmentId(value, environmentId);
      if (next === environmentId) return;
      environmentId = next;
      persistSceneEnvironment(next);
    },
    /**
     * Compatibility for older preview harnesses. Production controls use
     * `environmentId` and `setEnvironmentId` for every viewer.
     */
    get seededBackgroundType(): string | null {
      return persistent ? null : environmentId;
    },
    setSeededBackgroundType(value: string): boolean {
      if (persistent) return false;
      environmentId = normalizeSceneEnvironmentId(value, environmentId);
      return true;
    },
    /**
     * Whether this viewer orbits its camera on its own, and how fast. Unseeded
     * viewers never do — the real viewer's camera belongs to the user.
     */
    get seededAutoOrbit(): boolean {
      return seed?.autoOrbit ?? false;
    },
    get seededAutoOrbitSpeed(): number {
      return seed?.autoOrbitSpeed ?? 2.0;
    },
    /** Scene-feature toggles this viewer owns; `null` = use the shared key. */
    get seededSceneFeatures(): Record<string, boolean> | null {
      return seed?.sceneFeatures ?? null;
    },
    setOceanVariant(v: OceanVariant) {
      oceanVariant = v;
      writeKey(STORAGE_KEY_OCEAN_VARIANT, v);
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
    frameAllPerformers,
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
    get defaultSettings() {
      return _defaultSettings;
    },
    setDefaultProp,
    setDefaultEffort,
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
      writeKey(STORAGE_KEY_GRID_LABELS, String(showGridLabels));
      sceneUndo.commitState();
    },
    get activePreset() {
      return activePreset;
    },
    setActivePreset(id: string | null) {
      activePreset = id;
      writeKey(STORAGE_KEY_PRESET, id ?? "");
    },
    get activeCameraPreset() {
      return activeCameraPreset;
    },
    setActiveCameraPreset(id: string) {
      activeCameraPreset = id;
      writeKey(STORAGE_KEY_CAM_PRESET, id);
    },
    /**
     * Toggle a single grid plane on or off.
     */
    togglePlane(plane: Plane) {
      sceneUndo.captureState(
        "toggle-plane-visibility",
        `Toggle ${plane} plane`
      );
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
    get currentSequenceData() {
      return _currentSequenceData;
    },
    serialize,
    enter3D,
    exit3D,
    toggleEffect,
    updateCameraSnapshot,
    registerSnapTo,
    snapCameraTo,
    dispose,
  };
}

export type Viewer3DState = ReturnType<typeof buildViewer3DState>;

export function createViewer3DState(
  seed?: Viewer3DStateSeed,
  options?: Viewer3DStateOptions
): Viewer3DState {
  return buildViewer3DState(seed, options);
}

/**
 * One-shot marker that the NEXT viewer mount was seeded by a saved preset
 * (applyScene3DLook). Consumed at construct; without it, a plain open
 * re-seeds prop identity from the app prop (domain/plain-open-policy.ts).
 * Same pattern as SCENE_BPM_INTENT_KEY.
 */
export const VIEWER3D_PRESET_INTENT_KEY = "tka-viewer3d-preset-intent";

export function markViewer3DPresetIntent(): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(VIEWER3D_PRESET_INTENT_KEY, "1");
  } catch {
    // Quota/unavailable — worst case the next open follows the app prop.
  }
}

function consumeViewer3DPresetIntent(): boolean {
  if (typeof sessionStorage === "undefined") return false;
  try {
    const present = sessionStorage.getItem(VIEWER3D_PRESET_INTENT_KEY) === "1";
    sessionStorage.removeItem(VIEWER3D_PRESET_INTENT_KEY);
    return present;
  } catch {
    // Unreadable storage downgrades a preset open to a plain one. Acceptable:
    // the same failure already cost us the persisted keys the preset wrote, so
    // there is no verbatim look left to restore anyway.
    return false;
  }
}

/**
 * Serializable subset of viewer-3d-state that is backed by the scattered
 * `tka-viewer3d-*` localStorage keys. The save-a-3D-scene feature captures this
 * from the live state and re-seeds it before opening a fresh viewer (which reads
 * these keys at construct / enter3D time) — the same "seed then mount" pattern
 * open-tunnel-in-viewer uses. Kept in this module so it can reach the private
 * STORAGE_KEY_* constants.
 */
export interface Viewer3DPersistConfig {
  environmentId: SceneEnvironmentId;
  camera: CameraStateSnapshot | null;
  performers: StoredPerformerSnapshot[];
  selectedPerformerIndex: number | null;
  activeFormation: FormationPreset | "manual";
  defaultProp: string;
  oceanVariant: string;
  navMode: ViewerNavMode;
  activePreset: string | null;
  activeCameraPreset: string;
  showGridLabels: boolean;
  visiblePlanes: string[];
  /** Named visual-effect toggles (fire/led/trails/…). Optional for configs
   *  captured before effect persistence existed. */
  effectToggles?: Record<string, boolean>;
}

/**
 * Seed the localStorage keys a freshly-constructed viewer-3d-state reads, plus
 * force render mode to "3d". Only PROVIDED fields are written — omit a field to
 * leave the user's current persisted value alone (this is how the packing-list
 * group mask applies selectively). Best-effort per key so a single quota
 * failure doesn't abort the rest. Call BEFORE mounting the viewer.
 */
export function writeViewer3DConfig(
  config: Partial<Viewer3DPersistConfig>
): void {
  if (typeof localStorage === "undefined") return;
  const set = (key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Quota exceeded / unavailable — skip this key, keep going.
    }
  };
  set(STORAGE_KEY_MODE, "3d");
  if (config.environmentId !== undefined)
    set(STORAGE_KEY_ENVIRONMENT, config.environmentId);
  if (config.camera) set(STORAGE_KEY_CAMERA, JSON.stringify(config.camera));
  if (config.performers)
    set(STORAGE_KEY_PERFORMERS, JSON.stringify(config.performers));
  if (config.activeFormation !== undefined)
    set(STORAGE_KEY_ACTIVE_FORMATION, config.activeFormation);
  if (config.selectedPerformerIndex !== undefined) {
    set(
      STORAGE_KEY_SELECTED_INDEX,
      config.selectedPerformerIndex === null
        ? "null"
        : String(config.selectedPerformerIndex)
    );
  }
  if (config.defaultProp !== undefined)
    set(STORAGE_KEY_DEFAULT_PROP, config.defaultProp);
  if (config.oceanVariant !== undefined)
    set(STORAGE_KEY_OCEAN_VARIANT, config.oceanVariant);
  if (config.navMode !== undefined) set(STORAGE_KEY_NAV_MODE, config.navMode);
  if (config.activePreset !== undefined)
    set(STORAGE_KEY_PRESET, config.activePreset ?? "");
  if (config.activeCameraPreset !== undefined)
    set(STORAGE_KEY_CAM_PRESET, config.activeCameraPreset);
  if (config.showGridLabels !== undefined)
    set(STORAGE_KEY_GRID_LABELS, String(config.showGridLabels));
  if (config.visiblePlanes)
    set(STORAGE_KEY_VISIBLE_PLANES, JSON.stringify(config.visiblePlanes));
  if (config.effectToggles) {
    set(STORAGE_KEY_EFFECT_TOGGLES, JSON.stringify(config.effectToggles));
  }
}
