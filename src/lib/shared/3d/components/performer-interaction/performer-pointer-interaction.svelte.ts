import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
import type CameraControls from "camera-controls";
import {
  Camera,
  Object3D,
  Plane,
  Raycaster,
  Triangle,
  Vector2,
  Vector3,
  type Intersection,
  type Material,
} from "three";

export const POINTER_DRAG_THRESHOLD_PX = 8;
export const TOUCH_HOLD_MS = 250;
export const TOUCH_MOVE_TOLERANCE_PX = 5;
export const MIN_TOUCH_TARGET_PX = 44;
export const PERFORMER_CLEARANCE_METRES = 0.5;
const GRAZING_RAY_EPSILON = 0.001;
const TOUCH_FALLBACK_PICK_HEIGHT_METRES = 1;
const EIGHT_DIRECTION_STEP_RADIANS = Math.PI / 4;
const POSITION_EPSILON = 1e-10;

export type PointerIntent = "click" | "drag";
export type TouchIntent = "tap" | "drag" | "camera";

export interface Point2 {
  x: number;
  y: number;
}

export interface StagePosition {
  x: number;
  z: number;
}

export interface StageBounds {
  width: number;
  depth: number;
  zOffset?: number;
}

export function isWithinMinimumTouchTarget(
  pointer: Point2,
  projectedCenter: Point2,
  minimumSizePx = MIN_TOUCH_TARGET_PX
): boolean {
  return (
    Math.hypot(pointer.x - projectedCenter.x, pointer.y - projectedCenter.y) <=
    minimumSizePx / 2
  );
}

export function getPointerIntent(
  start: Point2,
  current: Point2
): PointerIntent {
  return Math.hypot(current.x - start.x, current.y - start.y) >
    POINTER_DRAG_THRESHOLD_PX
    ? "drag"
    : "click";
}

export function resolveTouchIntent(input: {
  selected: boolean;
  heldMs: number;
  travelPx: number;
}): TouchIntent {
  if (input.selected && input.travelPx > TOUCH_MOVE_TOLERANCE_PX) return "drag";
  if (!input.selected && input.travelPx > TOUCH_MOVE_TOLERANCE_PX)
    return "camera";
  if (!input.selected && input.heldMs >= TOUCH_HOLD_MS) return "drag";
  return "tap";
}

export function intersectHorizontalPlane(
  origin: { x: number; y: number; z: number },
  direction: { x: number; y: number; z: number },
  planeY: number,
  grabOffset: StagePosition
): StagePosition | null {
  if (Math.abs(direction.y) < GRAZING_RAY_EPSILON) return null;
  const distance = (planeY - origin.y) / direction.y;
  if (distance < 0) return null;
  return {
    x: origin.x + direction.x * distance + grabOffset.x,
    z: origin.z + direction.z * distance + grabOffset.z,
  };
}

export function clampPerformerPosition(
  position: StagePosition,
  bounds: StageBounds,
  clearance = PERFORMER_CLEARANCE_METRES
): StagePosition {
  const halfWidth = Math.max(0, bounds.width / 2 - clearance);
  const halfDepth = Math.max(0, bounds.depth / 2 - clearance);
  const centerZ = bounds.zOffset ?? 0;
  return {
    x: Math.max(-halfWidth, Math.min(halfWidth, position.x)),
    z: Math.max(centerZ - halfDepth, Math.min(centerZ + halfDepth, position.z)),
  };
}

export function snapStagePositionToEightDirections(
  origin: StagePosition,
  target: StagePosition
): StagePosition {
  const deltaX = target.x - origin.x;
  const deltaZ = target.z - origin.z;
  if (Math.hypot(deltaX, deltaZ) < POSITION_EPSILON) return { ...origin };

  const snappedAngle =
    Math.round(Math.atan2(deltaZ, deltaX) / EIGHT_DIRECTION_STEP_RADIANS) *
    EIGHT_DIRECTION_STEP_RADIANS;
  const directionX = cleanPositionValue(Math.cos(snappedAngle));
  const directionZ = cleanPositionValue(Math.sin(snappedAngle));
  const projectedDistance = Math.max(
    0,
    deltaX * directionX + deltaZ * directionZ
  );

  return {
    x: cleanPositionValue(origin.x + directionX * projectedDistance),
    z: cleanPositionValue(origin.z + directionZ * projectedDistance),
  };
}

export function resolvePerformerDragPosition(
  start: StagePosition,
  target: StagePosition,
  bounds: StageBounds,
  constrainToEightDirections: boolean,
  clearance = PERFORMER_CLEARANCE_METRES
): StagePosition {
  if (!constrainToEightDirections)
    return clampPerformerPosition(target, bounds, clearance);

  const origin = clampPerformerPosition(start, bounds, clearance);
  const snapped = snapStagePositionToEightDirections(origin, target);
  const deltaX = snapped.x - origin.x;
  const deltaZ = snapped.z - origin.z;
  const halfWidth = Math.max(0, bounds.width / 2 - clearance);
  const halfDepth = Math.max(0, bounds.depth / 2 - clearance);
  const centerZ = bounds.zOffset ?? 0;
  const minX = -halfWidth;
  const maxX = halfWidth;
  const minZ = centerZ - halfDepth;
  const maxZ = centerZ + halfDepth;
  let scale = 1;

  if (deltaX > POSITION_EPSILON)
    scale = Math.min(scale, (maxX - origin.x) / deltaX);
  else if (deltaX < -POSITION_EPSILON)
    scale = Math.min(scale, (minX - origin.x) / deltaX);
  if (deltaZ > POSITION_EPSILON)
    scale = Math.min(scale, (maxZ - origin.z) / deltaZ);
  else if (deltaZ < -POSITION_EPSILON)
    scale = Math.min(scale, (minZ - origin.z) / deltaZ);

  const boundedScale = Math.max(0, Math.min(1, scale));
  return {
    x: cleanPositionValue(origin.x + deltaX * boundedScale),
    z: cleanPositionValue(origin.z + deltaZ * boundedScale),
  };
}

function cleanPositionValue(value: number): number {
  return Math.abs(value) < POSITION_EPSILON ? 0 : value;
}

export function resolveCameraRelativeNudge(
  key: string,
  cameraAzimuth: number,
  distance: number
): StagePosition | null {
  const forward = Math.round(cameraAzimuth / (Math.PI / 2)) * (Math.PI / 2);
  const fx = -Math.sin(forward);
  const fz = -Math.cos(forward);
  const rx = Math.cos(forward);
  const rz = -Math.sin(forward);
  const clean = (value: number) => (Math.abs(value) < 1e-10 ? 0 : value);
  if (key === "ArrowUp")
    return { x: clean(fx * distance), z: clean(fz * distance) };
  if (key === "ArrowDown")
    return { x: clean(-fx * distance), z: clean(-fz * distance) };
  if (key === "ArrowRight")
    return { x: clean(rx * distance), z: clean(rz * distance) };
  if (key === "ArrowLeft")
    return { x: clean(-rx * distance), z: clean(-rz * distance) };
  return null;
}

interface PerformerPositionSource {
  position: StagePosition;
}

interface InteractionViewer {
  selectedPerformerIndex: number | null;
  isCameraDragging: boolean;
  performerManager: {
    performers: PerformerPositionSource[];
    handleDrag(index: number, position: StagePosition): void;
  };
  selectPerformerScope(index: number | null): void;
  beginSpatialEdit(): void;
  endSpatialEdit(): void;
  cancelSpatialEdit(): void;
  markFormationCustom(): void;
  cameraChoreography: { controls: CameraControls | null };
}

interface InteractionOptions {
  canvas: HTMLCanvasElement;
  camera: () => Camera | null;
  viewer: InteractionViewer;
  groundY: () => number;
  stageBounds: () => StageBounds;
  onHintDismissed?: () => void;
}

interface SurfaceTriangleAnchor {
  a: number;
  b: number;
  c: number;
  barycentric: Vector3;
}

interface VisualSurfaceAnchor {
  object: Object3D;
  localPoint: Vector3;
  triangle: SurfaceTriangleAnchor | null;
}

interface PressedPointer {
  pointerId: number;
  pointerType: string;
  performerIndex: number;
  start: Point2;
  startedAt: number;
  startPosition: StagePosition;
  dragPlaneY: number;
  grabOffset: StagePosition;
  anchorSource: "visual" | "proxy" | "touch";
  visualAnchor: VisualSurfaceAnchor | null;
}

interface PerformerHit {
  performerIndex: number;
  dragPlaneY: number;
  anchorSource: "visual" | "proxy" | "touch";
  visualAnchor: VisualSurfaceAnchor | null;
}

export interface PerformerDragDiagnostic {
  performerIndex: number;
  anchorSource: PressedPointer["anchorSource"];
  pointer: Point2;
  projectedAnchor: Point2;
  errorPx: number;
}

export function createPerformerPointerInteraction(options: InteractionOptions) {
  const raycaster = new Raycaster();
  const pointer = new Vector2();
  const anchorVertexA = new Vector3();
  const anchorVertexB = new Vector3();
  const anchorVertexC = new Vector3();
  const anchorLocalPoint = new Vector3();
  const pickTargets = new Set<Object3D>();
  const visualPickTargets = new Map<number, Object3D>();
  const activePointers = new Set<number>();
  let pressed = $state<PressedPointer | null>(null);
  let hoveredIndex = $state<number | null>(null);
  let draggingIndex = $state<number | null>(null);
  let announcement = $state("");
  let emptyPress = $state<{ pointerId: number; start: Point2 } | null>(null);
  let holdTimer: ReturnType<typeof setTimeout> | null = null;
  let diagnosticFrame: number | null = null;
  let cameraWasEnabled = true;

  function setRayFromEvent(event: PointerEvent): boolean {
    const camera = options.camera();
    if (!camera) return false;
    const rect = options.canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    raycaster.setFromCamera(pointer, camera);
    return true;
  }

  function performerIndexFromObject(object: Object3D | null): number | null {
    let current = object;
    while (current) {
      if (typeof current.userData.performerIndex === "number") {
        return current.userData.performerIndex as number;
      }
      current = current.parent;
    }
    return null;
  }

  function screenSpaceTouchFallback(event: PointerEvent): number | null {
    if (event.pointerType !== "touch") return null;
    const camera = options.camera();
    if (!camera) return null;
    const rect = options.canvas.getBoundingClientRect();
    let nearest: { index: number; distance: number } | null = null;
    options.viewer.performerManager.performers.forEach((performer, index) => {
      const projected = new Vector3(
        performer.position.x,
        options.groundY() + TOUCH_FALLBACK_PICK_HEIGHT_METRES,
        performer.position.z
      ).project(camera);
      const x = rect.left + ((projected.x + 1) * rect.width) / 2;
      const y = rect.top + ((1 - projected.y) * rect.height) / 2;
      const distance = Math.hypot(event.clientX - x, event.clientY - y);
      if (
        isWithinMinimumTouchTarget(
          { x: event.clientX, y: event.clientY },
          { x, y }
        ) &&
        (!nearest || distance < nearest.distance)
      )
        nearest = { index, distance };
    });
    return nearest?.index ?? null;
  }

  function coarseHitFromCurrentRay(event: PointerEvent): PerformerHit | null {
    const hit = raycaster.intersectObjects([...pickTargets], false)[0];
    const performerIndex = performerIndexFromObject(hit?.object ?? null);
    if (hit && performerIndex !== null)
      return {
        performerIndex,
        dragPlaneY: hit.point.y,
        anchorSource: "proxy",
        visualAnchor: null,
      };

    const touchIndex = screenSpaceTouchFallback(event);
    return touchIndex === null
      ? null
      : {
          performerIndex: touchIndex,
          dragPlaneY: options.groundY() + TOUCH_FALLBACK_PICK_HEIGHT_METRES,
          anchorSource: "touch",
          visualAnchor: null,
        };
  }

  function isRenderedMesh(
    hit: Intersection<Object3D>,
    root: Object3D
  ): boolean {
    const { object } = hit;
    let current: Object3D | null = object;
    while (current) {
      if (!current.visible) return false;
      if (current === root) break;
      current = current.parent;
    }
    if (current !== root) return false;

    const mesh = object as Object3D & {
      isMesh?: boolean;
      material?: Material | Material[];
    };
    if (!mesh.isMesh || !mesh.material) return false;
    const material = Array.isArray(mesh.material)
      ? mesh.material[hit.face?.materialIndex ?? 0]
      : mesh.material;
    return Boolean(
      material?.visible &&
      material.colorWrite &&
      (!material.transparent || material.opacity > 0.001)
    );
  }

  function createVisualSurfaceAnchor(
    hit: Intersection<Object3D>
  ): VisualSurfaceAnchor {
    const localPoint = hit.object.worldToLocal(hit.point.clone());
    const mesh = hit.object as Object3D & {
      getVertexPosition?: (index: number, target: Vector3) => Vector3;
    };
    if (!hit.face || !mesh.getVertexPosition)
      return { object: hit.object, localPoint, triangle: null };

    mesh.getVertexPosition(hit.face.a, anchorVertexA);
    mesh.getVertexPosition(hit.face.b, anchorVertexB);
    mesh.getVertexPosition(hit.face.c, anchorVertexC);
    const barycentric = Triangle.getBarycoord(
      localPoint,
      anchorVertexA,
      anchorVertexB,
      anchorVertexC,
      new Vector3()
    );
    return {
      object: hit.object,
      localPoint,
      triangle: barycentric
        ? {
            a: hit.face.a,
            b: hit.face.b,
            c: hit.face.c,
            barycentric,
          }
        : null,
    };
  }

  function getVisualAnchorWorldPoint(anchor: VisualSurfaceAnchor): Vector3 {
    const mesh = anchor.object as Object3D & {
      getVertexPosition?: (index: number, target: Vector3) => Vector3;
    };
    if (anchor.triangle && mesh.getVertexPosition) {
      mesh.getVertexPosition(anchor.triangle.a, anchorVertexA);
      mesh.getVertexPosition(anchor.triangle.b, anchorVertexB);
      mesh.getVertexPosition(anchor.triangle.c, anchorVertexC);
      anchorLocalPoint
        .set(0, 0, 0)
        .addScaledVector(anchorVertexA, anchor.triangle.barycentric.x)
        .addScaledVector(anchorVertexB, anchor.triangle.barycentric.y)
        .addScaledVector(anchorVertexC, anchor.triangle.barycentric.z);
    } else {
      anchorLocalPoint.copy(anchor.localPoint);
    }
    anchor.object.updateWorldMatrix(true, false);
    return anchor.object.localToWorld(anchorLocalPoint);
  }

  function visualHitFromCurrentRay(): PerformerHit | null {
    const hits = raycaster.intersectObjects(
      [...visualPickTargets.values()],
      true
    );
    for (const hit of hits) {
      const performerIndex = performerIndexFromObject(hit.object);
      if (performerIndex === null) continue;
      const root = visualPickTargets.get(performerIndex);
      if (!root || !isRenderedMesh(hit, root)) continue;
      return {
        performerIndex,
        dragPlaneY: hit.point.y,
        anchorSource: "visual",
        visualAnchor: createVisualSurfaceAnchor(hit),
      };
    }
    return null;
  }

  function hitTest(event: PointerEvent): PerformerHit | null {
    if (!setRayFromEvent(event)) return null;
    return coarseHitFromCurrentRay(event);
  }

  function pressHitTest(event: PointerEvent): PerformerHit | null {
    if (!setRayFromEvent(event)) return null;
    // The capsule makes acquisition forgiving, but it is not the thing the
    // user sees. A single precise pick at press time gives the visible knee,
    // hand, or prop the same direct-manipulation contract as the cursor.
    return visualHitFromCurrentRay() ?? coarseHitFromCurrentRay(event);
  }

  function dragTarget(): StagePosition | null {
    if (!pressed) return null;
    if (pressed.visualAnchor) {
      const performer =
        options.viewer.performerManager.performers[pressed.performerIndex];
      if (performer) {
        const anchorWorld = getVisualAnchorWorldPoint(pressed.visualAnchor);
        return intersectHorizontalPlane(
          raycaster.ray.origin,
          raycaster.ray.direction,
          anchorWorld.y,
          {
            x: performer.position.x - anchorWorld.x,
            z: performer.position.z - anchorWorld.z,
          }
        );
      }
    }
    return intersectHorizontalPlane(
      raycaster.ray.origin,
      raycaster.ray.direction,
      pressed.dragPlaneY,
      pressed.grabOffset
    );
  }

  function clearHoldTimer(): void {
    if (holdTimer) clearTimeout(holdTimer);
    holdTimer = null;
  }

  function scheduleDragDiagnostic(
    event: PointerEvent,
    pointerPress: PressedPointer
  ): void {
    if (!import.meta.env.DEV || !pointerPress.visualAnchor) return;
    if (diagnosticFrame !== null) cancelAnimationFrame(diagnosticFrame);
    const pointerPosition = { x: event.clientX, y: event.clientY };
    const { performerIndex, anchorSource } = pointerPress;
    const visualAnchor = pointerPress.visualAnchor;
    diagnosticFrame = requestAnimationFrame(() => {
      diagnosticFrame = null;
      const camera = options.camera();
      if (!camera) return;
      const projected = getVisualAnchorWorldPoint(visualAnchor).project(camera);
      const rect = options.canvas.getBoundingClientRect();
      const projectedAnchor = {
        x: rect.left + ((projected.x + 1) * rect.width) / 2,
        y: rect.top + ((1 - projected.y) * rect.height) / 2,
      };
      const detail: PerformerDragDiagnostic = {
        performerIndex,
        anchorSource,
        pointer: pointerPosition,
        projectedAnchor,
        errorPx: Math.hypot(
          pointerPosition.x - projectedAnchor.x,
          pointerPosition.y - projectedAnchor.y
        ),
      };
      options.canvas.dataset.performerDragAnchorSource = anchorSource;
      options.canvas.dataset.performerDragErrorPx = detail.errorPx.toFixed(3);
      options.canvas.dataset.performerDragPointer = `${pointerPosition.x.toFixed(1)},${pointerPosition.y.toFixed(1)}`;
      options.canvas.dataset.performerDragProjectedAnchor = `${projectedAnchor.x.toFixed(1)},${projectedAnchor.y.toFixed(1)}`;
      window.dispatchEvent(
        new CustomEvent<PerformerDragDiagnostic>(
          "tka-performer-drag-diagnostic",
          { detail }
        )
      );
    });
  }

  function startDrag(): void {
    if (!pressed || draggingIndex !== null) return;
    clearHoldTimer();
    draggingIndex = pressed.performerIndex;
    options.viewer.selectPerformerScope(pressed.performerIndex);
    options.viewer.beginSpatialEdit();
    const controls = options.viewer.cameraChoreography.controls;
    if (controls) {
      cameraWasEnabled = controls.enabled;
      controls.enabled = false;
    }
    options.canvas.style.cursor = "grabbing";
    options.onHintDismissed?.();
  }

  function cancelDrag(): void {
    clearHoldTimer();
    if (pressed && draggingIndex !== null) {
      options.viewer.performerManager.handleDrag(
        pressed.performerIndex,
        pressed.startPosition
      );
      options.viewer.cancelSpatialEdit();
    }
    finishPointer(false);
  }

  function finishPointer(commit: boolean): void {
    clearHoldTimer();
    if (draggingIndex !== null && commit) {
      options.viewer.markFormationCustom();
      options.viewer.endSpatialEdit();
    }
    const controls = options.viewer.cameraChoreography.controls;
    if (controls) controls.enabled = cameraWasEnabled;
    const pointerId = pressed?.pointerId;
    draggingIndex = null;
    pressed = null;
    if (pointerId !== undefined && options.canvas.hasPointerCapture(pointerId))
      options.canvas.releasePointerCapture(pointerId);
    options.canvas.style.cursor = hoveredIndex === null ? "" : "grab";
  }

  function onPointerDown(event: PointerEvent): void {
    activePointers.add(event.pointerId);
    if (activePointers.size > 1) {
      cancelDrag();
      return;
    }
    if (options.viewer.isCameraDragging) return;
    const hit = pressHitTest(event);
    if (hit === null) {
      emptyPress = {
        pointerId: event.pointerId,
        start: { x: event.clientX, y: event.clientY },
      };
      return;
    }
    const { performerIndex } = hit;
    const performer =
      options.viewer.performerManager.performers[performerIndex];
    if (!performer) return;
    const dragPoint = intersectHorizontalPlane(
      raycaster.ray.origin,
      raycaster.ray.direction,
      hit.dragPlaneY,
      { x: 0, z: 0 }
    );
    pressed = {
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      performerIndex,
      start: { x: event.clientX, y: event.clientY },
      startedAt: performance.now(),
      startPosition: { ...performer.position },
      dragPlaneY: hit.dragPlaneY,
      grabOffset: dragPoint
        ? {
            x: performer.position.x - dragPoint.x,
            z: performer.position.z - dragPoint.z,
          }
        : { x: 0, z: 0 },
      anchorSource: hit.anchorSource,
      visualAnchor: hit.visualAnchor,
    };
    if (import.meta.env.DEV)
      options.canvas.dataset.performerDragAnchorSource = hit.anchorSource;
    options.canvas.setPointerCapture(event.pointerId);
    if (event.pointerType !== "touch") {
      // Orbit controls listen on this same canvas in the bubble phase; this
      // handler runs first (capture phase). A mouse press on a performer is
      // select-or-drag, never a camera orbit, so the press must not reach
      // the controls — otherwise controlstart flags a camera drag and every
      // subsequent guard in this interaction sees it. Touch keeps
      // propagating: an unselected touch that moves is a camera pan.
      event.stopImmediatePropagation();
    }
    if (
      event.pointerType === "touch" &&
      options.viewer.selectedPerformerIndex !== performerIndex
    ) {
      holdTimer = setTimeout(() => {
        if (pressed?.pointerId === event.pointerId) {
          getHapticFeedback().trigger("selection");
          startDrag();
        }
      }, TOUCH_HOLD_MS);
    }
  }

  function onPointerMove(event: PointerEvent): void {
    if (pressed?.pointerId === event.pointerId) {
      if (!setRayFromEvent(event)) return;
      const travel = Math.hypot(
        event.clientX - pressed.start.x,
        event.clientY - pressed.start.y
      );
      if (pressed.pointerType === "touch") {
        const intent = resolveTouchIntent({
          selected:
            options.viewer.selectedPerformerIndex === pressed.performerIndex,
          heldMs: performance.now() - pressed.startedAt,
          travelPx: travel,
        });
        if (intent === "camera") {
          finishPointer(false);
          return;
        }
        if (intent === "drag") startDrag();
      } else if (
        getPointerIntent(pressed.start, {
          x: event.clientX,
          y: event.clientY,
        }) === "drag"
      ) {
        startDrag();
      }
      if (draggingIndex !== null) {
        event.preventDefault();
        const target = dragTarget();
        if (target && pressed) {
          const pointerPress = pressed;
          options.viewer.performerManager.handleDrag(
            draggingIndex,
            resolvePerformerDragPosition(
              pressed.startPosition,
              target,
              options.stageBounds(),
              event.shiftKey
            )
          );
          scheduleDragDiagnostic(event, pointerPress);
        }
      }
      return;
    }
    if (options.viewer.isCameraDragging || activePointers.size > 0) return;
    const next = hitTest(event)?.performerIndex ?? null;
    if (next !== hoveredIndex) {
      hoveredIndex = next;
      options.canvas.style.cursor = next === null ? "" : "grab";
    }
  }

  function onPointerUp(event: PointerEvent): void {
    activePointers.delete(event.pointerId);
    if (emptyPress?.pointerId === event.pointerId) {
      if (
        getPointerIntent(emptyPress.start, {
          x: event.clientX,
          y: event.clientY,
        }) === "click" &&
        !options.viewer.isCameraDragging
      ) {
        options.viewer.selectPerformerScope(null);
      }
      emptyPress = null;
      return;
    }
    if (pressed?.pointerId !== event.pointerId) return;
    if (draggingIndex !== null) finishPointer(true);
    else {
      options.viewer.selectPerformerScope(pressed.performerIndex);
      announcement = `Performer ${pressed.performerIndex + 1} selected`;
      window.dispatchEvent(
        new CustomEvent("tka-performer-interaction-announcement", {
          detail: announcement,
        })
      );
      options.onHintDismissed?.();
      finishPointer(false);
    }
  }

  function onPointerCancel(event: PointerEvent): void {
    activePointers.delete(event.pointerId);
    if (emptyPress?.pointerId === event.pointerId) emptyPress = null;
    if (pressed?.pointerId === event.pointerId) cancelDrag();
  }

  function onPointerLeave(): void {
    if (!pressed) {
      hoveredIndex = null;
      options.canvas.style.cursor = "";
    }
  }

  function onKeyDown(event: KeyboardEvent): void {
    const selected = options.viewer.selectedPerformerIndex;
    if (event.key === "Escape") {
      if (draggingIndex !== null) cancelDrag();
      else if (selected !== null) options.viewer.selectPerformerScope(null);
      else return;
      // Consumed: cancel-drag and deselect must not also reach the viewer
      // shell's Escape handler, which closes the whole viewer.
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (selected === null) return;
    const distance = event.altKey ? 0.05 : event.shiftKey ? 1 : 0.25;
    const controls = options.viewer.cameraChoreography.controls;
    const delta = resolveCameraRelativeNudge(
      event.key,
      controls?.azimuthAngle ?? 0,
      distance
    );
    if (!delta) return;
    const performer = options.viewer.performerManager.performers[selected];
    if (!performer) return;
    event.preventDefault();
    options.viewer.beginSpatialEdit();
    const next = clampPerformerPosition(
      { x: performer.position.x + delta.x, z: performer.position.z + delta.z },
      options.stageBounds()
    );
    options.viewer.performerManager.handleDrag(selected, next);
    options.viewer.markFormationCustom();
    options.viewer.endSpatialEdit();
    announcement = `Performer ${selected + 1} moved to ${next.x.toFixed(2)}, ${next.z.toFixed(2)}`;
    window.dispatchEvent(
      new CustomEvent("tka-performer-interaction-announcement", {
        detail: announcement,
      })
    );
  }

  function attach(): () => void {
    options.canvas.style.touchAction = "none";
    // Capture phase so this runs before the orbit controls' bubble-phase
    // pointerdown on the same canvas — otherwise controlstart fires first
    // and the camera-drag guard rejects every performer press.
    options.canvas.addEventListener("pointerdown", onPointerDown, {
      capture: true,
    });
    options.canvas.addEventListener("pointermove", onPointerMove);
    options.canvas.addEventListener("pointerup", onPointerUp);
    options.canvas.addEventListener("pointercancel", onPointerCancel);
    options.canvas.addEventListener("lostpointercapture", onPointerCancel);
    options.canvas.addEventListener("pointerleave", onPointerLeave);
    options.canvas.addEventListener("keydown", onKeyDown);
    return () => {
      clearHoldTimer();
      if (diagnosticFrame !== null) cancelAnimationFrame(diagnosticFrame);
      options.canvas.removeEventListener("pointerdown", onPointerDown, {
        capture: true,
      });
      options.canvas.removeEventListener("pointermove", onPointerMove);
      options.canvas.removeEventListener("pointerup", onPointerUp);
      options.canvas.removeEventListener("pointercancel", onPointerCancel);
      options.canvas.removeEventListener("lostpointercapture", onPointerCancel);
      options.canvas.removeEventListener("pointerleave", onPointerLeave);
      options.canvas.removeEventListener("keydown", onKeyDown);
      options.canvas.style.cursor = "";
    };
  }

  return {
    get hoveredIndex() {
      return hoveredIndex;
    },
    get draggingIndex() {
      return draggingIndex;
    },
    get announcement() {
      return announcement;
    },
    registerPickTarget(object: Object3D): () => void {
      pickTargets.add(object);
      return () => pickTargets.delete(object);
    },
    registerVisualPickTarget(
      performerIndex: number,
      object: Object3D
    ): () => void {
      visualPickTargets.set(performerIndex, object);
      return () => {
        if (visualPickTargets.get(performerIndex) === object)
          visualPickTargets.delete(performerIndex);
      };
    },
    attach,
  };
}

export type PerformerPointerInteraction = ReturnType<
  typeof createPerformerPointerInteraction
>;
