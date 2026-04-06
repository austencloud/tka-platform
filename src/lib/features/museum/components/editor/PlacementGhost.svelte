<script lang="ts">
  /**
   * Placement Ghost
   *
   * Translucent 3D preview that follows the cursor during object placement.
   * Raycasts against scene surfaces to classify floor vs wall hits, snaps to
   * tile grid, orients wall objects to face outward, and signals valid/invalid
   * placement via color. Left-click on a valid surface calls onPlace; ESC cancels.
   */
  import { T, useThrelte } from "@threlte/core";
  import { onMount, onDestroy } from "svelte";
  import {
    Raycaster,
    Vector2,
    Vector3,
    Quaternion,
    MeshStandardMaterial,
    BoxGeometry,
    Color,
    type Intersection,
    type Object3D,
  } from "three";
  import type { PlaceableObjectDef } from "../../domain/placeable-object-registry";
  import { museum3dEditorState } from "../../state/museum-3d-editor-state.svelte";

  // ── Constants ──

  const TILE_SIZE = 0.5;
  const UP = new Vector3(0, 1, 0);
  const FORWARD = new Vector3(0, 0, 1);
  const COLOR_VALID = new Color(0x22dd77);
  const COLOR_INVALID = new Color(0xdd3344);

  // ── Props ──

  interface Props {
    def: PlaceableObjectDef;
    onPlace: (worldX: number, worldZ: number, yaw: number, wallFacing: string) => void;
  }

  const { def, onPlace }: Props = $props();

  // ── Threlte context ──

  const { scene, camera, renderer } = useThrelte();

  // ── Ghost state ──

  let ghostX = $state(0);
  let ghostY = $state(0);
  let ghostZ = $state(0);
  let ghostQuat: [number, number, number, number] = $state([0, 0, 0, 1]);
  let valid = $state(false);
  let ghostMesh: Object3D | null = null;

  // ── Reusable Three.js objects (avoid per-frame allocation) ──

  const raycaster = new Raycaster();
  const pointer = new Vector2();
  const hitNormal = new Vector3();
  const hitPoint = new Vector3();
  const tempQuat = new Quaternion();

  // ── Material & geometry ──

  const ghostMaterial = new MeshStandardMaterial({
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    color: COLOR_INVALID,
  });

  const ghostGeometry = new BoxGeometry(0.15, 0.3, 0.1);

  // ── Surface classification ──

  function classifySurface(normal: Vector3): "floor" | "wall" | "unknown" {
    const dot = normal.dot(UP);
    if (dot > 0.7) return "floor";
    if (dot < 0.3) return "wall";
    return "unknown";
  }

  function surfaceMatchesDef(surface: "floor" | "wall" | "unknown"): boolean {
    if (def.surface === "wall") return surface === "wall";
    if (def.surface === "floor") return surface === "floor";
    // floor_against_wall accepts either
    if (def.surface === "floor_against_wall") return surface === "floor" || surface === "wall";
    return false;
  }

  // ── Ancestry checks (skip ghost mesh + gizmo meshes during raycast) ──

  function isGhostOrGizmo(obj: Object3D): boolean {
    let current: Object3D | null = obj;
    while (current) {
      const ud = current.userData as Record<string, unknown>;
      if (ud.__isPlacementGhost) return true;
      if (ud.isTransformControls) return true;

      // Three.js TransformControls sets type/name on its sub-objects
      const name = current.name ?? "";
      const type = current.type ?? "";
      if (
        type === "TransformControlsGizmo" ||
        type === "TransformControlsPlane" ||
        name === "TransformControlsGizmo" ||
        name === "TransformControlsPlane"
      ) {
        return true;
      }

      current = current.parent;
    }
    return false;
  }

  function filterIntersections(intersections: Intersection[]): Intersection | null {
    for (const hit of intersections) {
      if (!isGhostOrGizmo(hit.object)) return hit;
    }
    return null;
  }

  // ── Snap helpers ──

  function snapToTileGrid(v: number): number {
    return Math.round(v / TILE_SIZE) * TILE_SIZE;
  }

  function snapToTileCenter(v: number): number {
    return Math.floor(v / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2;
  }

  // ── Wall orientation ──

  function computeWallQuaternion(worldNormal: Vector3): [number, number, number, number] {
    // Handle anti-parallel edge case (FORWARD and worldNormal are exactly opposite)
    const dot = FORWARD.dot(worldNormal);
    if (dot < -0.999) {
      // 180-degree rotation around UP
      tempQuat.setFromAxisAngle(UP, Math.PI);
    } else {
      tempQuat.setFromUnitVectors(FORWARD, worldNormal);
    }
    return [tempQuat.x, tempQuat.y, tempQuat.z, tempQuat.w];
  }

  function yawFromQuaternion(q: [number, number, number, number]): number {
    // Extract Y-axis rotation from quaternion
    tempQuat.set(q[0], q[1], q[2], q[3]);
    const v = new Vector3(0, 0, 1).applyQuaternion(tempQuat);
    return Math.atan2(v.x, v.z);
  }

  // ── Wall facing direction string ──

  function wallFacingFromNormal(n: Vector3): string {
    const ax = Math.abs(n.x);
    const az = Math.abs(n.z);
    if (ax > az) return n.x > 0 ? "+x" : "-x";
    return n.z > 0 ? "+z" : "-z";
  }

  // ── Stored hit data for click handler ──

  let lastHitNormal = new Vector3();
  let lastSurface: "floor" | "wall" | "unknown" = "unknown";

  // ── Event handlers ──

  function onPointerMove(event: PointerEvent): void {
    const domElement = renderer.current.domElement;
    const rect = domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    const cam = camera.current;
    if (!cam) return;

    raycaster.setFromCamera(pointer, cam);
    const intersections = raycaster.intersectObjects(scene.current.children, true);
    const hit = filterIntersections(intersections);

    if (!hit || !hit.face) {
      valid = false;
      museum3dEditorState.setGhostValid(false);
      ghostMaterial.color.copy(COLOR_INVALID);
      return;
    }

    // Transform face normal to world space
    hitNormal.copy(hit.face.normal);
    hit.object.localToWorld(hitNormal.add(hit.object.position));
    hitNormal.sub(hit.object.getWorldPosition(new Vector3())).normalize();

    // Actually, the correct way: apply the object's world rotation to the face normal
    hitNormal.copy(hit.face.normal).transformDirection(hit.object.matrixWorld);

    hitPoint.copy(hit.point);
    const surface = classifySurface(hitNormal);
    const isValid = surfaceMatchesDef(surface);

    lastHitNormal.copy(hitNormal);
    lastSurface = surface;

    if (surface === "wall" && (def.surface === "wall" || def.surface === "floor_against_wall")) {
      // Wall snapping: snap tangent axes to grid, offset from wall by wallOffset
      // Project hit point onto wall plane, snap the tangent components
      const absX = Math.abs(hitNormal.x);
      const absZ = Math.abs(hitNormal.z);

      if (absX > absZ) {
        // Wall faces along X axis — snap Y and Z
        ghostX = hitPoint.x + hitNormal.x * def.wallOffset;
        ghostY = def.mountHeight;
        ghostZ = snapToTileGrid(hitPoint.z);
      } else {
        // Wall faces along Z axis — snap X and Y
        ghostX = snapToTileGrid(hitPoint.x);
        ghostY = def.mountHeight;
        ghostZ = hitPoint.z + hitNormal.z * def.wallOffset;
      }

      ghostQuat = computeWallQuaternion(hitNormal);
    } else if (surface === "floor") {
      // Floor snapping: snap XZ to tile center, Y = 0
      ghostX = snapToTileCenter(hitPoint.x);
      ghostY = 0;
      ghostZ = snapToTileCenter(hitPoint.z);
      ghostQuat = [0, 0, 0, 1]; // Identity — face default direction
    } else {
      // Unknown surface — place at hit point, no snapping
      ghostX = hitPoint.x;
      ghostY = hitPoint.y;
      ghostZ = hitPoint.z;
      ghostQuat = [0, 0, 0, 1];
    }

    valid = isValid;
    museum3dEditorState.setGhostValid(isValid);
    ghostMaterial.color.copy(isValid ? COLOR_VALID : COLOR_INVALID);
  }

  function onPointerDown(event: PointerEvent): void {
    // Left-click only
    if (event.button !== 0) return;
    if (!valid) return;

    const yaw = yawFromQuaternion(ghostQuat);
    const facing = lastSurface === "wall" ? wallFacingFromNormal(lastHitNormal) : "none";
    onPlace(ghostX, ghostZ, yaw, facing);
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      museum3dEditorState.stopPlacement();
    }
  }

  // ── Lifecycle: register and clean up DOM event listeners ──

  onMount(() => {
    const domElement = renderer.current.domElement;
    domElement.addEventListener("pointermove", onPointerMove);
    domElement.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
  });

  onDestroy(() => {
    const domElement = renderer.current.domElement;
    domElement.removeEventListener("pointermove", onPointerMove);
    domElement.removeEventListener("pointerdown", onPointerDown);
    window.removeEventListener("keydown", onKeyDown);
    ghostMaterial.dispose();
    ghostGeometry.dispose();
  });

  // ── Mark the ghost mesh so raycasting can skip it ──

  function onGhostCreate(ref: Object3D): void {
    ghostMesh = ref;
    ref.userData.__isPlacementGhost = true;
    // Also mark all descendants
    ref.traverse((child) => {
      child.userData.__isPlacementGhost = true;
    });
  }
</script>

<T.Mesh
  oncreate={onGhostCreate}
  geometry={ghostGeometry}
  material={ghostMaterial}
  position={[ghostX, ghostY, ghostZ]}
  quaternion={ghostQuat}
  scale={[def.scale, def.scale, def.scale]}
/>
