<script lang="ts">
  import { useThrelte, useTask } from "@threlte/core";
  import { TransformControls } from "@threlte/extras";
  import { Vector3, Color, type Object3D, type Camera } from "three";
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

  // ── Gizmo drag → undo/redo commands ──

  let dragStartPos: Vector3 | null = null;
  let dragStartRot = $state<{ x: number; y: number; z: number } | null>(null);
  let dragStartScale: Vector3 | null = null;
  let gizmoDragging = false;

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

  // ── Hover highlight ──

  const HOVER_EMISSIVE = new Color(0x444444);
  const ZERO_EMISSIVE = new Color(0x000000);
  let hoveredGroup: Object3D | null = null;

  function setHoverHighlight(obj: Object3D | null) {
    if (hoveredGroup === obj) return;
    if (hoveredGroup) {
      hoveredGroup.traverse((child) => {
        const m = child as any;
        if (m.isMesh && m.material?.emissive) {
          m.material.emissive.copy(ZERO_EMISSIVE);
        }
      });
    }
    hoveredGroup = obj;
    if (obj) {
      obj.traverse((child) => {
        const m = child as any;
        if (m.isMesh && m.material?.emissive) {
          m.material.emissive.copy(HOVER_EMISSIVE);
        }
      });
    }
    const canvas = (renderer as any)?.current?.domElement ?? (renderer as any)?.domElement;
    if (canvas) canvas.style.cursor = obj ? "pointer" : "";
  }

  export function handlePointerEnter(group: Object3D) {
    if (editorState.activeCatalogItem || gizmoDragging) return;
    setHoverHighlight(group);
  }

  export function handlePointerLeave() {
    if (gizmoDragging) return;
    setHoverHighlight(null);
  }

  export function handleClick(group: Object3D) {
    if (editorState.activeCatalogItem) return;
    setHoverHighlight(null);
    editorState.select(group);
  }

  export function handleMissedClick() {
    if (editorState.activeCatalogItem) return;
    editorState.deselect();
  }

  // ── Camera + WASD panning ──

  const { camera, renderer } = useThrelte();
  const getCamera = (): Camera | null => {
    const c = (camera as any).current ?? camera;
    return c?.isCamera ? c : null;
  };

  const panKeys = new Set<string>();
  const PAN_SPEED = 8;

  function handleKeyDown(event: KeyboardEvent) {
    const key = event.key.toLowerCase();

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

    if ((event.ctrlKey || event.metaKey) && key === "z") {
      event.preventDefault();
      event.shiftKey ? editorState.commands.redo() : editorState.commands.undo();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && key === "s") {
      event.preventDefault();
      onSave?.();
      return;
    }

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
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    if (document.pointerLockElement) document.exitPointerLock();
  });

  onDestroy(() => {
    window.removeEventListener("keydown", handleKeyDown);
    window.removeEventListener("keyup", handleKeyUp);
    setHoverHighlight(null);
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
