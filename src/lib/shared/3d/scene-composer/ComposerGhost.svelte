<script lang="ts">
  import { T, useThrelte } from "@threlte/core";
  import { onMount, onDestroy } from "svelte";
  import {
    Raycaster,
    Vector2,
    Vector3,
    Quaternion,
    MeshStandardMaterial,
    BoxGeometry,
    SphereGeometry,
    CylinderGeometry,
    ConeGeometry,
    Color,
    type Intersection,
    type Object3D,
    type Mesh,
  } from "three";
  import type { ObjectDefinition } from "../procedural-engine/objects/object-catalog";
  import type { SurfaceRules, ComposerPlacement, PlacementConstraints, ExclusionZone } from "./types";

  interface Props {
    definition: ObjectDefinition;
    surfaceRules: SurfaceRules;
    constraints?: PlacementConstraints;
    existingPlacements: ComposerPlacement[];
    onPlace: (placement: ComposerPlacement) => void;
    onCancel: () => void;
  }

  const {
    definition,
    surfaceRules,
    constraints,
    existingPlacements,
    onPlace,
    onCancel,
  }: Props = $props();

  const UP = new Vector3(0, 1, 0);
  const COLOR_VALID = new Color(0x22dd77);
  const COLOR_INVALID = new Color(0xdd3344);

  const threlteCtx = useThrelte();
  function getScene() { return (threlteCtx as any).scene?.current ?? (threlteCtx as any).scene; }
  function getCamera() { return (threlteCtx as any).camera?.current ?? (threlteCtx as any).camera; }
  function getRenderer() { return (threlteCtx as any).renderer?.current ?? (threlteCtx as any).renderer; }

  let ghostX = $state(0);
  let ghostY = $state(0);
  let ghostZ = $state(0);
  let ghostQuat: [number, number, number, number] = $state([0, 0, 0, 1]);
  let valid = $state(false);
  let visible = $state(false);

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

  const geometries: Record<string, any> = {
    box: new BoxGeometry(1, 1, 1).translate(0, 0.5, 0),
    sphere: new SphereGeometry(0.5, 16, 12).translate(0, 0.5, 0),
    cylinder: new CylinderGeometry(0.5, 0.5, 1, 16).translate(0, 0.5, 0),
    cone: new ConeGeometry(0.5, 1, 16).translate(0, 0.5, 0),
    flag: new BoxGeometry(0.05, 1, 0.5).translate(0, 0.5, 0),
  };

  const ghostGeometry = $derived(
    geometries[definition.fallbackGeometry] ?? geometries.box
  );

  function isGhostMesh(obj: Object3D): boolean {
    let current: Object3D | null = obj;
    while (current) {
      if (current.userData?.__isComposerGhost) return true;
      const type = current.type ?? "";
      if (
        type === "TransformControlsGizmo" ||
        type === "TransformControlsPlane"
      ) return true;
      current = current.parent;
    }
    return false;
  }

  function filterIntersections(hits: Intersection[]): Intersection | null {
    for (const hit of hits) {
      if (isGhostMesh(hit.object)) continue;
      if (!surfaceRules.isSurface(hit.object as Mesh)) continue;
      return hit;
    }
    return null;
  }

  function snapToGrid(v: number, gridSize: number): number {
    return Math.round(v / gridSize) * gridSize;
  }

  function isInExclusionZone(
    x: number, y: number, z: number,
    zones?: ExclusionZone[],
  ): boolean {
    if (!zones) return false;
    for (const zone of zones) {
      const dx = x - zone.center[0];
      const dy = y - zone.center[1];
      const dz = z - zone.center[2];
      if (dx * dx + dy * dy + dz * dz < zone.radius * zone.radius) return true;
    }
    return false;
  }

  function onPointerMove(event: PointerEvent): void {
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
    const hit = filterIntersections(intersections);

    if (!hit || !hit.face) {
      valid = false;
      visible = false;
      ghostMaterial.color.copy(COLOR_INVALID);
      return;
    }

    visible = true;
    hitPoint.copy(hit.point);

    hitNormal.copy(hit.face.normal).transformDirection(hit.object.matrixWorld);

    let px = hitPoint.x;
    let py = hitPoint.y + surfaceRules.surfaceOffset + (definition.defaultHeight ?? 0);
    let pz = hitPoint.z;

    if (surfaceRules.gridSize) {
      px = snapToGrid(px, surfaceRules.gridSize);
      pz = snapToGrid(pz, surfaceRules.gridSize);
    }

    ghostX = px;
    ghostY = py;
    ghostZ = pz;

    if (surfaceRules.orientationMode === "upright") {
      ghostQuat = [0, 0, 0, 1];
    } else if (surfaceRules.orientationMode === "surface-normal") {
      tempQuat.setFromUnitVectors(UP, hitNormal);
      ghostQuat = [tempQuat.x, tempQuat.y, tempQuat.z, tempQuat.w];
    } else if (surfaceRules.orientationMode === "custom" && surfaceRules.orientFromNormal) {
      const q = surfaceRules.orientFromNormal(hitNormal);
      ghostQuat = [q.x, q.y, q.z, q.w];
    }

    let isValid = true;

    if (isInExclusionZone(px, py, pz, constraints?.exclusionZones)) {
      isValid = false;
    }

    if (constraints?.maxObjects && existingPlacements.length >= constraints.maxObjects) {
      isValid = false;
    }

    if (constraints?.validate) {
      const draftPlacement: ComposerPlacement = {
        id: "draft",
        objectKey: definition.key,
        position: [px, py, pz],
        rotation: [...ghostQuat],
        scale: [1, 1, 1],
      };
      const err = constraints.validate(draftPlacement, existingPlacements);
      if (err) isValid = false;
    }

    valid = isValid;
    ghostMaterial.color.copy(isValid ? COLOR_VALID : COLOR_INVALID);
  }

  function onPointerDown(event: PointerEvent): void {
    if (event.button !== 0) return;
    event.stopImmediatePropagation();
    event.preventDefault();
    if (!valid) return;

    const placement: ComposerPlacement = {
      id: crypto.randomUUID(),
      objectKey: definition.key,
      position: [ghostX, ghostY, ghostZ],
      rotation: [...ghostQuat],
      scale: [1, 1, 1],
    };
    onPlace(placement);
  }

  function onClickCapture(event: MouseEvent): void {
    event.stopImmediatePropagation();
    event.preventDefault();
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.key === "Escape") onCancel();
  }

  let domEl: HTMLCanvasElement | null = null;

  onMount(() => {
    const ren = getRenderer();
    domEl = ren?.domElement ?? null;
    if (!domEl) return;
    domEl.addEventListener("pointermove", onPointerMove);
    domEl.addEventListener("pointerdown", onPointerDown, true);
    domEl.addEventListener("click", onClickCapture, true);
    window.addEventListener("keydown", onKeyDown);
  });

  onDestroy(() => {
    if (domEl) {
      domEl.removeEventListener("pointermove", onPointerMove);
      domEl.removeEventListener("pointerdown", onPointerDown, true);
      domEl.removeEventListener("click", onClickCapture, true);
    }
    window.removeEventListener("keydown", onKeyDown);
    ghostMaterial.dispose();
    Object.values(geometries).forEach((g: any) => g.dispose());
  });

  function onGhostCreate(ref: Object3D): void {
    ref.userData.__isComposerGhost = true;
    ref.traverse((child) => {
      child.userData.__isComposerGhost = true;
    });
  }
</script>

{#if visible}
  <T.Group
    oncreate={onGhostCreate}
    position={[ghostX, ghostY, ghostZ]}
    quaternion={ghostQuat}
  >
    <T.Mesh
      geometry={ghostGeometry}
      material={ghostMaterial}
      scale={[definition.defaultScale, definition.defaultScale, definition.defaultScale]}
    />
  </T.Group>
{/if}
