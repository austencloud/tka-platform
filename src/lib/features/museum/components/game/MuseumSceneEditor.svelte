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
  import { useThrelte } from "@threlte/core";
  import { TransformControls } from "@threlte/extras";
  import { Raycaster, Vector2, Vector3, Euler, Mesh, type Object3D, type Camera } from "three";
  import { onMount, onDestroy } from "svelte";
  import { museum3dEditorState } from "../../state/museum-3d-editor-state.svelte";

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
  }

  function undo() {
    const cmd = undoStack.pop();
    if (!cmd) return;
    cmd.object.position.copy(cmd.beforePos);
    cmd.object.rotation.copy(cmd.beforeRot);
    cmd.object.scale.copy(cmd.beforeScale);
    redoStack.push(cmd);
  }

  function redo() {
    const cmd = redoStack.pop();
    if (!cmd) return;
    cmd.object.position.copy(cmd.afterPos);
    cmd.object.rotation.copy(cmd.afterRot);
    cmd.object.scale.copy(cmd.afterScale);
    undoStack.push(cmd);
  }

  const ctx = useThrelte();
  const getScene = () => (ctx.scene as any)?.current ?? ctx.scene;
  const getCamera = (): Camera | null => {
    const c = (ctx.camera as any)?.current ?? ctx.camera;
    return c?.isCamera ? c : null;
  };
  const getCanvas = (): HTMLCanvasElement | null => {
    const r = (ctx.renderer as any)?.current ?? ctx.renderer;
    return r?.domElement ?? null;
  };

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
      if (isGizmo) return null; // Click was on gizmo — don't change selection

      // Skip instanced meshes (walls, floors, ceilings)
      if ((hit.object as any).isInstancedMesh) continue;

      if (hit.object instanceof Mesh) {
        // Walk up to find a parent Group (plaque group, performer group, etc.)
        let target: Object3D = hit.object;
        if (target.parent && target.parent.type === "Group"
            && target.parent.parent?.type !== "Scene") {
          target = target.parent;
        }
        return target;
      }
    }
    return null;
  }

  function handlePointerDown(event: PointerEvent) {
    if (event.button !== 0) return; // Left click only
    if (gizmoDragging) return;

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

  function handleKeyDown(event: KeyboardEvent) {
    const key = event.key;
    if (key === "1") museum3dEditorState.setMode("translate");
    if (key === "2") museum3dEditorState.setMode("rotate");
    if (key === "3") museum3dEditorState.setMode("scale");
    if (key === "Escape") museum3dEditorState.deselect();

    // Ctrl+Z = undo, Ctrl+Shift+Z = redo
    if ((event.ctrlKey || event.metaKey) && key === "z") {
      event.preventDefault();
      if (event.shiftKey) {
        redo();
      } else {
        undo();
      }
    }
  }

  onMount(() => {
    const canvas = getCanvas();
    if (canvas) {
      canvas.addEventListener("pointerdown", handlePointerDown);
      canvas.addEventListener("dblclick", handleDoubleClick);
    }
    window.addEventListener("keydown", handleKeyDown);

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
