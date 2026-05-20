<script lang="ts">
  /**
   * Generic Scene Editor
   *
   * Universal editor shell for any scene using the Scene Composer system.
   * Extracted from MuseumSceneEditor — replaces hardcoded museum state with
   * generic ComposerEditorState and prefix-walking with userData.composerId.
   *
   * Placed inside a <Canvas>. Click to select, TransformControls gizmo for
   * transform, 1/2/3 for translate/rotate/scale, WASD+QE for panning,
   * Ctrl+Z/Ctrl+Shift+Z for undo/redo, Delete to remove, Ctrl+S to save.
   */
  import { useThrelte, useTask } from "@threlte/core";
  import { TransformControls } from "@threlte/extras";
  import { Raycaster, Vector2, Vector3, type Object3D, type Camera } from "three";
  import { onMount, onDestroy } from "svelte";
  import type { ComposerEditorState } from "./composer-editor-state.svelte";
  import type { Command } from "./command-stack.svelte";

  interface Props {
    editorState: ComposerEditorState;
    onSave?: () => void;
  }

  const { editorState, onSave }: Props = $props();

  const _tempVec = new Vector3();
  const _worldPos = new Vector3();

  let dragStartPos: Vector3 | null = null;
  let dragStartRot = $state<{ x: number; y: number; z: number } | null>(null);
  let dragStartScale: Vector3 | null = null;

  function captureBeforeDrag(obj: Object3D) {
    dragStartPos = obj.position.clone();
    dragStartRot = { x: obj.rotation.x, y: obj.rotation.y, z: obj.rotation.z };
    dragStartScale = obj.scale.clone();
  }

  function captureAfterDrag(obj: Object3D) {
    if (!dragStartPos || !dragStartRot || !dragStartScale) return;

    const beforePos = dragStartPos.clone();
    const beforeRotX = dragStartRot.x;
    const beforeRotY = dragStartRot.y;
    const beforeRotZ = dragStartRot.z;
    const beforeScale = dragStartScale.clone();
    const afterPos = obj.position.clone();
    const afterRotX = obj.rotation.x;
    const afterRotY = obj.rotation.y;
    const afterRotZ = obj.rotation.z;
    const afterScale = obj.scale.clone();
    const target = obj;

    const composerId = findComposerId(obj);

    const cmd: Command = {
      label: `Move ${composerId ?? "object"}`,
      execute() {
        target.position.copy(afterPos);
        target.rotation.set(afterRotX, afterRotY, afterRotZ);
        target.scale.copy(afterScale);
        if (composerId) syncPlacementFromObject(composerId, target);
      },
      undo() {
        target.position.copy(beforePos);
        target.rotation.set(beforeRotX, beforeRotY, beforeRotZ);
        target.scale.copy(beforeScale);
        if (composerId) syncPlacementFromObject(composerId, target);
      },
    };

    editorState.commands.execute(cmd);
    dragStartPos = null;
    dragStartRot = null;
    dragStartScale = null;
  }

  function syncPlacementFromObject(id: string, obj: Object3D) {
    obj.getWorldPosition(_worldPos);
    editorState.updatePlacement(id, {
      position: [_worldPos.x, _worldPos.y, _worldPos.z],
      rotation: [obj.quaternion.x, obj.quaternion.y, obj.quaternion.z, obj.quaternion.w],
      scale: [obj.scale.x, obj.scale.y, obj.scale.z],
    });
  }

  function findComposerId(obj: Object3D): string | null {
    let current: Object3D | null = obj;
    while (current) {
      if (current.userData?.composerId) return current.userData.composerId as string;
      current = current.parent;
    }
    return null;
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
        if (
          (parent as any).isTransformControls ||
          parent.type === "TransformControlsGizmo" ||
          parent.type === "TransformControlsPlane"
        ) {
          isGizmo = true;
          break;
        }
        parent = parent.parent;
      }
      if (isGizmo) return null;

      // Skip instanced meshes (walls, floors, ceilings)
      if ((hit.object as any).isInstancedMesh) continue;

      // Walk up hierarchy looking for userData.composerId
      let target: Object3D = hit.object;
      let walk: Object3D | null = hit.object;
      while (walk && walk.type !== "Scene") {
        if (walk.userData?.composerId) {
          target = walk;
          break;
        }
        walk = walk.parent;
      }

      if (target.userData?.composerId) return target;
    }
    return null;
  }

  function handlePointerDown(event: PointerEvent) {
    if (event.button !== 0) return;
    if (gizmoDragging) return;
    if (editorState.activeCatalogItem) return;

    requestAnimationFrame(() => {
      if (gizmoDragging) return;
      const obj = findClickedObject(event);
      if (obj) {
        editorState.select(obj);
      } else {
        editorState.deselect();
      }
    });
  }

  function handleDoubleClick(event: MouseEvent) {
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
      if ((hit.object as any).isInstancedMesh || (hit.object as any).isTransformControls)
        continue;
      editorState.focusOnPoint(hit.point.x, hit.point.y, hit.point.z);
      break;
    }
  }

  // ── WASD keyboard panning ──
  const panKeys = new Set<string>();
  const PAN_SPEED = 8;

  function handleKeyDown(event: KeyboardEvent) {
    const key = event.key.toLowerCase();

    // Gizmo mode
    if (key === "1") {
      editorState.setGizmoMode("translate");
      return;
    }
    if (key === "2") {
      editorState.setGizmoMode("rotate");
      return;
    }
    if (key === "3") {
      editorState.setGizmoMode("scale");
      return;
    }
    if (key === "escape") {
      editorState.deselect();
      editorState.stopPlacement();
      return;
    }

    // Delete selected object
    if (key === "delete" || key === "backspace") {
      const sel = editorState.selectedObject;
      if (sel) {
        const id = findComposerId(sel);
        if (id) {
          const placement = editorState.placements.find((p) => p.id === id);
          if (placement) {
            const cmd: Command = {
              label: `Delete ${placement.objectKey}`,
              execute() {
                editorState.removePlacement(id);
                sel.visible = false;
              },
              undo() {
                editorState.addPlacement(placement);
                sel.visible = true;
              },
            };
            editorState.commands.execute(cmd);
            editorState.deselect();
          }
        }
      }
      return;
    }

    // Ctrl+Z / Ctrl+Shift+Z undo/redo
    if ((event.ctrlKey || event.metaKey) && key === "z") {
      event.preventDefault();
      event.shiftKey ? editorState.commands.redo() : editorState.commands.undo();
      return;
    }

    // Ctrl+S save
    if ((event.ctrlKey || event.metaKey) && key === "s") {
      event.preventDefault();
      onSave?.();
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

  // Each frame: pan the orbit target (camera follows via OrbitControls)
  useTask((delta) => {
    if (panKeys.size === 0) return;
    const cam = getCamera();
    if (!cam) return;

    const speed = (panKeys.has("shift") ? PAN_SPEED * 3 : PAN_SPEED) * delta;
    const forward = (panKeys.has("w") ? 1 : 0) - (panKeys.has("s") ? 1 : 0);
    const strafe = (panKeys.has("d") ? 1 : 0) - (panKeys.has("a") ? 1 : 0);
    const vertical = (panKeys.has("e") ? 1 : 0) - (panKeys.has("q") ? 1 : 0);
    if (forward === 0 && strafe === 0 && vertical === 0) return;

    cam.getWorldDirection(_tempVec);
    const fwdLen = Math.sqrt(_tempVec.x ** 2 + _tempVec.z ** 2) || 1;
    const nfx = _tempVec.x / fwdLen;
    const nfz = _tempVec.z / fwdLen;
    const nrx = -nfz;
    const nrz = nfx;

    const dx = (nfx * forward + nrx * strafe) * speed;
    const dz = (nfz * forward + nrz * strafe) * speed;
    const dy = vertical * speed;

    cam.position.x += dx;
    cam.position.y += dy;
    cam.position.z += dz;
    editorState.panTarget(dx, dy, dz);
  });

  onMount(() => {
    const canvas = getCanvas();
    if (canvas) {
      canvas.addEventListener("pointerdown", handlePointerDown);
      canvas.addEventListener("dblclick", handleDoubleClick);
    }
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    if (document.pointerLockElement) document.exitPointerLock();
  });

  onDestroy(() => {
    const canvas = getCanvas();
    if (canvas) {
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("dblclick", handleDoubleClick);
    }
    window.removeEventListener("keydown", handleKeyDown);
    window.removeEventListener("keyup", handleKeyUp);
    editorState.deselect();
  });
</script>

{#if editorState.selectedObject}
  <TransformControls
    object={editorState.selectedObject}
    mode={editorState.gizmoMode}
    translationSnap={0.5}
    rotationSnap={Math.PI / 12}
    scaleSnap={0.1}
    onmouseDown={() => {
      gizmoDragging = true;
      if (editorState.selectedObject) captureBeforeDrag(editorState.selectedObject);
    }}
    onmouseUp={() => {
      gizmoDragging = false;
      if (editorState.selectedObject) captureAfterDrag(editorState.selectedObject);
    }}
  />
{/if}
