<script lang="ts">
  /**
   * Placement Ghost
   *
   * Translucent 3D preview that follows the cursor during object placement.
   * Raycasts against scene surfaces to classify floor vs wall hits, snaps to
   * tile grid, orients wall objects to face outward, and signals valid/invalid
   * placement via color. Left-click on a valid surface calls onPlace; ESC cancels.
   * Right-click on a manually placed torch deletes it. Ctrl+Z undoes last placement.
   *
   * When the GLTF model is already cached (loaded by MuseumTorch3D), the ghost
   * clones that model and applies the translucent ghost material. Otherwise it
   * falls back to a simple box geometry.
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
    Group,
    type Intersection,
    type Object3D,
    type Mesh,
  } from "three";
  import type { PlaceableObjectDef } from "../../domain/placeable-object-registry";
  import { museum3dEditorState } from "../../state/museum-3d-editor-state.svelte";
  import { modelTemplateCache } from "../game/MuseumTorch3D.svelte";
  import { FIXTURE_REGISTRY } from "../../domain/fixture-registry";
  import { resolveScene, resolveCamera, resolveRenderer } from "../resolve-threlte-scene";


  const TILE_SIZE = 0.5;
  const UP = new Vector3(0, 1, 0);
  const FORWARD = new Vector3(0, 0, 1);
  const COLOR_VALID = new Color(0x22dd77);
  const COLOR_INVALID = new Color(0xdd3344);


  interface Props {
    def: PlaceableObjectDef;
    onPlace: (worldX: number, worldZ: number, yaw: number, wallFacing: string) => void;
    onDelete: (placementId: string) => void;
    onUndo: () => void;
  }

  const { def, onPlace, onDelete, onUndo }: Props = $props();

  // useThrelte() may return raw objects or CurrentWritable wrappers depending
  // on version. Use the ?.current ?? fallback pattern the codebase uses elsewhere.

  const threlteCtx = useThrelte();
  function getScene() { return resolveScene(threlteCtx); }
  function getCamera() { return resolveCamera(threlteCtx); }
  function getRenderer() { return resolveRenderer(threlteCtx); }


  let ghostX = $state(0);
  let ghostY = $state(0);
  let ghostZ = $state(0);
  let ghostQuat: [number, number, number, number] = $state([0, 0, 0, 1]);
  let valid = $state(false);
  let visible = $state(false);

  // ── Reusable Three.js objects (avoid per-frame allocation) ──

  const raycaster = new Raycaster();
  const pointer = new Vector2();
  const hitNormal = new Vector3();
  const hitPoint = new Vector3();
  const tempQuat = new Quaternion();


  const ghostMaterial = new MeshStandardMaterial({
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    color: COLOR_INVALID,
  });

  const ghostGeometry = new BoxGeometry(0.15, 0.3, 0.1);

  // ── GLTF ghost model (cloned from MuseumTorch3D's cache) ──

  let ghostModel = $state<Group | null>(null);

  function buildGhostFromCache(): Group | null {
    const wingTheme = def.wingTheme ?? 'cave';
    const config = FIXTURE_REGISTRY[wingTheme];
    const template = modelTemplateCache.get(config.modelPath);
    if (!template) return null;

    const clone = template.clone() as unknown as Group;
    clone.traverse((child) => {
      if ((child as Mesh).isMesh) {
        (child as Mesh).material = ghostMaterial;
      }
    });
    return clone;
  }

  // Attempt to build ghost model on mount and when def changes
  $effect(() => {
    // Read def.wingTheme to track changes
    const _theme = def.wingTheme;
    ghostModel = buildGhostFromCache();
  });


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


  function findManualPlacementId(obj: Object3D): string | null {
    let current: Object3D | null = obj;
    while (current) {
      const id = current.userData?.__manualPlacementId;
      if (id != null) return String(id);
      current = current.parent;
    }
    return null;
  }


  function snapToTileGrid(v: number): number {
    return Math.round(v / TILE_SIZE) * TILE_SIZE;
  }

  function snapToTileCenter(v: number): number {
    return Math.floor(v / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2;
  }


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


  function wallFacingFromNormal(n: Vector3): string {
    // Return Direction-compatible values matching museum-grid-types
    const ax = Math.abs(n.x);
    const az = Math.abs(n.z);
    if (ax > az) return n.x > 0 ? "east" : "west";
    return n.z > 0 ? "south" : "north";
  }


  let hoveredPlacementId: string | null = null;
  let hoveredObject: Object3D | null = null;


  let lastHitNormal = new Vector3();
  let lastSurface: "floor" | "wall" | "unknown" = "unknown";


  function onPointerMove(event: PointerEvent): void {
    const ren = getRenderer();
    if (!ren?.domElement) return;
    const domElement = ren.domElement;
    const rect = domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    const cam = getCamera();
    const scn = getScene();
    if (!cam || !scn) return;

    raycaster.setFromCamera(pointer, cam);
    const intersections = raycaster.intersectObjects(scn.children, true);
    const hit = filterIntersections(intersections);

    if (!hit || !hit.face) {
      valid = false;
      visible = false;
      museum3dEditorState.setGhostValid(false);
      ghostMaterial.color.copy(COLOR_INVALID);
      return;
    }

    visible = true;

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
        // Wall faces along X axis - snap Y and Z
        ghostX = hitPoint.x + hitNormal.x * def.wallOffset;
        ghostY = def.mountHeight;
        ghostZ = snapToTileGrid(hitPoint.z);
      } else {
        // Wall faces along Z axis - snap X and Y
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
      ghostQuat = [0, 0, 0, 1]; // Identity - face default direction
    } else {
      // Unknown surface - place at hit point, no snapping
      ghostX = hitPoint.x;
      ghostY = hitPoint.y;
      ghostZ = hitPoint.z;
      ghostQuat = [0, 0, 0, 1];
    }

    valid = isValid;
    museum3dEditorState.setGhostValid(isValid);
    ghostMaterial.color.copy(isValid ? COLOR_VALID : COLOR_INVALID);

    // Check if hovering a deletable manual placement (reuse existing raycast results)
    let newHoverId: string | null = null;
    for (const h of intersections) {
      if (isGhostOrGizmo(h.object)) continue;
      const id = findManualPlacementId(h.object);
      if (id) { newHoverId = id; break; }
    }

    if (newHoverId !== hoveredPlacementId) {
      // Clear old highlight
      if (hoveredObject) {
        hoveredObject.traverse((child) => {
          if ((child as any).isMesh && child.userData.__originalEmissive !== undefined) {
            (child as any).material.emissive?.setHex(child.userData.__originalEmissive);
            delete child.userData.__originalEmissive;
          }
        });
      }
      // Apply new highlight
      if (newHoverId && scn) {
        const group = scn.getObjectByName(`manual-placement-${newHoverId}`);
        if (group) {
          group.traverse((child: Object3D) => {
            if ((child as any).isMesh && (child as any).material?.emissive) {
              child.userData.__originalEmissive = (child as any).material.emissive.getHex();
              (child as any).material.emissive.setHex(0xff4444);
            }
          });
          hoveredObject = group;
        }
      } else {
        hoveredObject = null;
      }
      hoveredPlacementId = newHoverId;
    }

  }

  function onPointerDown(event: PointerEvent): void {
    if (event.button !== 0) return;

    // ALWAYS stop the camera controller from seeing clicks in placement mode,
    // even on invalid surfaces. Otherwise it switches to third-person + pointer lock.
    event.stopImmediatePropagation();
    event.preventDefault();

    if (!valid) return;

    const yaw = yawFromQuaternion(ghostQuat);
    const facing = lastSurface === "wall" ? wallFacingFromNormal(lastHitNormal) : "none";
    onPlace(ghostX, ghostZ, yaw, facing);
  }

  /** Block the click event from reaching the camera controller (which listens on "click") */
  function onClickCapture(event: MouseEvent): void {
    event.stopImmediatePropagation();
    event.preventDefault();
  }

  function onContextMenu(event: MouseEvent): void {
    event.preventDefault();

    const ren = getRenderer();
    if (!ren?.domElement) return;
    const rect = ren.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    const cam = getCamera();
    const scn = getScene();
    if (!cam || !scn) return;

    raycaster.setFromCamera(pointer, cam);
    const intersections = raycaster.intersectObjects(scn.children, true);

    // Walk through intersections looking for a manually placed object
    for (const hit of intersections) {
      const placementId = findManualPlacementId(hit.object);
      if (placementId) {
        onDelete(placementId);
        return;
      }
    }
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      museum3dEditorState.stopPlacement();
    }

    // Ctrl+Z / Cmd+Z to undo last placement
    if (event.key === "z" && (event.ctrlKey || event.metaKey) && !event.shiftKey) {
      event.preventDefault();
      onUndo();
    }
  }

  // ── Lifecycle: register and clean up DOM event listeners ──

  let domEl: HTMLCanvasElement | null = null;

  onMount(() => {
    const ren = getRenderer();
    domEl = ren?.domElement ?? null;
    if (!domEl) return;
    // Use capture phase so placement clicks fire BEFORE the camera controller.
    // Must intercept BOTH pointerdown AND click - the camera controller listens
    // on "click" (not pointerdown), and stopping pointerdown doesn't prevent click.
    domEl.addEventListener("pointermove", onPointerMove);
    domEl.addEventListener("pointerdown", onPointerDown, true);
    domEl.addEventListener("click", onClickCapture, true);
    domEl.addEventListener("contextmenu", onContextMenu, true);
    window.addEventListener("keydown", onKeyDown);
  });

  onDestroy(() => {
    // Clear any active hover highlight
    if (hoveredObject) {
      hoveredObject.traverse((child) => {
        if ((child as any).isMesh && child.userData.__originalEmissive !== undefined) {
          (child as any).material.emissive?.setHex(child.userData.__originalEmissive);
          delete child.userData.__originalEmissive;
        }
      });
      hoveredObject = null;
      hoveredPlacementId = null;
    }

    if (domEl) {
      domEl.removeEventListener("pointermove", onPointerMove);
      domEl.removeEventListener("pointerdown", onPointerDown, true);
      domEl.removeEventListener("click", onClickCapture, true);
      domEl.removeEventListener("contextmenu", onContextMenu, true);
    }
    window.removeEventListener("keydown", onKeyDown);
    ghostMaterial.dispose();
    ghostGeometry.dispose();
  });

  // ── Mark the ghost group so raycasting can skip it ──

  function onGhostCreate(ref: Object3D): void {
    ref.userData.__isPlacementGhost = true;
    ref.traverse((child) => {
      child.userData.__isPlacementGhost = true;
    });
  }
</script>

{#if visible}
  <T.Group
    oncreate={onGhostCreate}
    position={[ghostX, ghostY, ghostZ]}
    quaternion={ghostQuat}
  >
    {#if ghostModel}
      <T is={ghostModel} />
    {:else}
      <T.Mesh
        geometry={ghostGeometry}
        material={ghostMaterial}
        scale={[def.scale, def.scale, def.scale]}
      />
    {/if}
  </T.Group>
{/if}
