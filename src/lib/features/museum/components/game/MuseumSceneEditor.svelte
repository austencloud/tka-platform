<script lang="ts">
  /**
   * Museum Scene Editor
   *
   * F2 toggles editor mode. OrbitControls for camera. Click to select objects.
   * TransformControls gizmo for transform. 1/2/3 for translate/rotate/scale.
   *
   * Uses OrbitControls (industry standard for 3D editors) + TransformControls
   * from @threlte/extras. TransformControls auto-pauses OrbitControls during drag.
   */
  import { useThrelte, useTask } from "@threlte/core";
  import { TransformControls } from "@threlte/extras";
  import { Raycaster, Vector2, Vector3, Euler, Mesh, type Object3D, type Camera } from "three";
  import { resolveScene, resolveCamera, resolveRenderer } from "../resolve-threlte-scene";

  const _tempVec2 = new Vector3();
  const _worldPos = new Vector3();
  import { onMount, onDestroy } from "svelte";
  import { museum3dEditorState } from "../../state/museum-3d-editor-state.svelte";
  import { museumEditorOverrides } from "../../state/museum-editor-overrides";

  interface Props {
    /** Called after any editor drag/undo/redo so the parent can sync grid data */
    onOverrideChanged?: () => void;
  }

  let { onOverrideChanged }: Props = $props();

  // ── Undo/Redo command stack ──
  interface TransformCommand {
    object: Object3D;
    beforePos: Vector3;
    beforeRot: Euler;
    beforeScale: Vector3;
    afterPos: Vector3;
    afterRot: Euler;
    afterScale: Vector3;
  }

  const undoStack: TransformCommand[] = [];
  const redoStack: TransformCommand[] = [];
  let dragStartPos: Vector3 | null = null;
  let dragStartRot: Euler | null = null;
  let dragStartScale: Vector3 | null = null;

  function captureBeforeDrag(obj: Object3D) {
    dragStartPos = obj.position.clone();
    dragStartRot = obj.rotation.clone();
    dragStartScale = obj.scale.clone();
  }

  /** Save position override for a named object after any transform change */
  function saveOverrideForObject(obj: Object3D) {
    if (!obj.name) return;
    obj.getWorldPosition(_worldPos);
    museumEditorOverrides.set(obj.name, {
      x: _worldPos.x,
      y: _worldPos.y,
      z: _worldPos.z,
    });
    // Notify parent so it can update grid data for interactions
    onOverrideChanged?.();
  }

  function captureAfterDrag(obj: Object3D) {
    if (!dragStartPos || !dragStartRot || !dragStartScale) return;
    undoStack.push({
      object: obj,
      beforePos: dragStartPos,
      beforeRot: dragStartRot,
      beforeScale: dragStartScale,
      afterPos: obj.position.clone(),
      afterRot: obj.rotation.clone(),
      afterScale: obj.scale.clone(),
    });
    redoStack.length = 0; // Clear redo stack on new action
    dragStartPos = null;
    dragStartRot = null;
    dragStartScale = null;

    // Persist the new position as an override
    saveOverrideForObject(obj);
  }

  function undo() {
    const cmd = undoStack.pop();
    if (!cmd) return;
    cmd.object.position.copy(cmd.beforePos);
    cmd.object.rotation.copy(cmd.beforeRot);
    cmd.object.scale.copy(cmd.beforeScale);
    redoStack.push(cmd);
    saveOverrideForObject(cmd.object);
  }

  function redo() {
    const cmd = redoStack.pop();
    if (!cmd) return;
    cmd.object.position.copy(cmd.afterPos);
    cmd.object.rotation.copy(cmd.afterRot);
    cmd.object.scale.copy(cmd.afterScale);
    undoStack.push(cmd);
    saveOverrideForObject(cmd.object);
  }

  const ctx = useThrelte();
  const getScene = () => resolveScene(ctx);
  const getCamera = (): Camera | null => resolveCamera(ctx);
  const getCanvas = (): HTMLCanvasElement | null => resolveRenderer(ctx)?.domElement ?? null;

  const raycaster = new Raycaster();
  const pointer = new Vector2();

  // Track whether TransformControls is actively dragging
  let gizmoDragging = false;

  function findClickedObject(event: PointerEvent): Object3D | null {
    const cam = getCamera();
    const scene = getScene();
    if (!cam || !scene) return null;

    const canvas = getCanvas();
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(pointer, cam);
    const intersects = raycaster.intersectObjects(scene.children, true);

    for (const hit of intersects) {
      // Skip gizmo meshes
      let isGizmo = false;
      let parent: Object3D | null = hit.object;
      while (parent) {
        if ((parent as any).isTransformControls
            || parent.type === "TransformControlsGizmo"
            || parent.type === "TransformControlsPlane") {
          isGizmo = true;
          break;
        }
        parent = parent.parent;
      }
      if (isGizmo) return null; // Click was on gizmo - don't change selection

      // Skip instanced meshes (walls, floors, ceilings)
      if ((hit.object as any).isInstancedMesh) continue;

      if (hit.object instanceof Mesh) {
        // Walk up the hierarchy to find a named root group
        let target: Object3D = hit.object;
        let walk: Object3D | null = hit.object;
        while (walk && walk.type !== "Scene") {
          if (walk.name && (
            walk.name.startsWith("plaque-") ||
            walk.name.startsWith("performer-station-") ||
            walk.name.startsWith("furniture-")
          )) {
            target = walk;
            break;
          }
          walk = walk.parent;
        }
        return target;
      }
    }
    return null;
  }

  function handlePointerDown(event: PointerEvent) {
    if (event.button !== 0) return; // Left click only
    if (gizmoDragging) return;
    // Don't interfere with placement mode - PlacementGhost handles clicks
    if (museum3dEditorState.placementDef) return;

    // Defer so TransformControls processes first
    requestAnimationFrame(() => {
      if (gizmoDragging) return;
      const obj = findClickedObject(event);
      if (obj) {
        museum3dEditorState.select(obj);
      } else {
        museum3dEditorState.deselect();
      }
    });
  }

  function handleDoubleClick(event: MouseEvent) {
    // Double-click: focus orbit on the clicked point (standard 3D editor behavior)
    const cam = getCamera();
    const scene = getScene();
    const canvas = getCanvas();
    if (!cam || !scene || !canvas) return;

    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(pointer, cam);
    const hits = raycaster.intersectObjects(scene.children, true);

    for (const hit of hits) {
      if ((hit.object as any).isInstancedMesh || (hit.object as any).isTransformControls) continue;
      // Focus orbit target on the hit point
      museum3dEditorState.focusOnPoint(hit.point.x, hit.point.y, hit.point.z);
      break;
    }
  }

  // ── WASD keyboard panning ──
  const panKeys = new Set<string>();
  const PAN_SPEED = 8; // units/sec

  function handleKeyDown(event: KeyboardEvent) {
    const key = event.key.toLowerCase();

    // Gizmo mode
    if (key === "1") { museum3dEditorState.setMode("translate"); return; }
    if (key === "2") { museum3dEditorState.setMode("rotate"); return; }
    if (key === "3") { museum3dEditorState.setMode("scale"); return; }
    if (key === "escape") { museum3dEditorState.deselect(); return; }

    // Ctrl+Z/Ctrl+Shift+Z undo/redo
    if ((event.ctrlKey || event.metaKey) && key === "z") {
      event.preventDefault();
      event.shiftKey ? redo() : undo();
      return;
    }

    // WASD + Q/E for panning
    if (["w", "a", "s", "d", "q", "e"].includes(key)) {
      panKeys.add(key);
      event.preventDefault();
      event.stopPropagation();
    }
    if (event.key === "Shift") panKeys.add("shift");
  }

  function handleKeyUp(event: KeyboardEvent) {
    panKeys.delete(event.key.toLowerCase());
    if (event.key === "Shift") panKeys.delete("shift");
  }

  // Each frame: pan the orbit target (and camera follows via OrbitControls)
  useTask((delta) => {
    if (panKeys.size === 0) return;
    const cam = getCamera();
    if (!cam) return;

    const speed = (panKeys.has("shift") ? PAN_SPEED * 3 : PAN_SPEED) * delta;
    const forward = (panKeys.has("w") ? 1 : 0) - (panKeys.has("s") ? 1 : 0);
    const strafe = (panKeys.has("d") ? 1 : 0) - (panKeys.has("a") ? 1 : 0);
    const vertical = (panKeys.has("e") ? 1 : 0) - (panKeys.has("q") ? 1 : 0);

    if (forward === 0 && strafe === 0 && vertical === 0) return;

    // Project camera's look direction onto the XZ plane for forward/right
    cam.getWorldDirection(_tempVec2);
    const fwdX = _tempVec2.x;
    const fwdZ = _tempVec2.z;
    const fwdLen = Math.sqrt(fwdX * fwdX + fwdZ * fwdZ) || 1;
    // Normalized forward on XZ
    const nfx = fwdX / fwdLen;
    const nfz = fwdZ / fwdLen;
    // Right = forward rotated 90° clockwise on XZ
    const nrx = -nfz;
    const nrz = nfx;

    const dx = (nfx * forward + nrx * strafe) * speed;
    const dz = (nfz * forward + nrz * strafe) * speed;
    const dy = vertical * speed;

    // Move both camera and orbit target together - OrbitControls maintains
    // the relative offset between camera and target automatically.
    cam.position.x += dx;
    cam.position.y += dy;
    cam.position.z += dz;
    museum3dEditorState.panTarget(dx, dy, dz);
  });

  onMount(() => {
    const canvas = getCanvas();
    if (canvas) {
      canvas.addEventListener("pointerdown", handlePointerDown);
      canvas.addEventListener("dblclick", handleDoubleClick);
    }
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    // Release pointer lock on entering editor mode
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
  });

  onDestroy(() => {
    const canvas = getCanvas();
    if (canvas) {
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("dblclick", handleDoubleClick);
    }
    window.removeEventListener("keydown", handleKeyDown);
    window.removeEventListener("keyup", handleKeyUp);
    museum3dEditorState.deselect();
  });
</script>

<!-- TransformControls: gizmo on selected object -->
{#if museum3dEditorState.selectedObject}
  <TransformControls
    object={museum3dEditorState.selectedObject}
    mode={museum3dEditorState.gizmoMode}
    translationSnap={0.5}
    rotationSnap={Math.PI / 12}
    scaleSnap={0.1}
    onmouseDown={() => {
      gizmoDragging = true;
      if (museum3dEditorState.selectedObject) {
        captureBeforeDrag(museum3dEditorState.selectedObject);
      }
    }}
    onmouseUp={() => {
      gizmoDragging = false;
      if (museum3dEditorState.selectedObject) {
        captureAfterDrag(museum3dEditorState.selectedObject);
      }
    }}
  />
{/if}
