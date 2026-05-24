<script lang="ts">
  import { useThrelte } from "@threlte/core";
  import { onMount } from "svelte";
  import { Raycaster, Vector2 } from "three";
  import type { Object3D, Intersection } from "three";

  const { renderer, camera, scene } = useThrelte();

  const raycaster = new Raycaster();
  const ndc = new Vector2();

  function getModelName(obj: Object3D): string {
    let current: Object3D | null = obj;
    const names: string[] = [];
    while (current) {
      if (current.name) names.unshift(current.name);
      if (current.userData?.name) names.unshift(current.userData.name);
      current = current.parent;
    }
    return names.filter(Boolean).join(" > ") || "(unnamed)";
  }

  function getMaterialInfo(hit: Intersection): string {
    const mesh = hit.object as any;
    if (!mesh.material) return "no material";
    const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    const color = mat.color ? "#" + mat.color.getHexString() : "none";
    const emissive = mat.emissive ? "#" + mat.emissive.getHexString() : "none";
    return `type=${mat.type} color=${color} emissive=${emissive}`;
  }

  function onClick(event: MouseEvent) {
    const gl = (renderer as any)?.current ?? renderer;
    const cam = (camera as any)?.current ?? camera;
    const sc = (scene as any)?.current ?? scene;
    const el = gl?.domElement as HTMLCanvasElement | undefined;
    if (!el || !cam || !sc) return;

    const rect = el.getBoundingClientRect();
    ndc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(ndc, cam);
    const hits = raycaster.intersectObjects(sc.children, true);

    if (hits.length === 0) {
      console.log("[OceanInspect] No hit");
      return;
    }

    const hit = hits[0]!;
    const obj = hit.object;
    const pos = hit.point;

    console.log(
      `%c[OceanInspect] CLICKED`,
      "background: #0066ff; color: white; padding: 2px 6px; border-radius: 3px;",
      `\n  Object: ${obj.name || obj.type}`,
      `\n  Hierarchy: ${getModelName(obj)}`,
      `\n  Material: ${getMaterialInfo(hit)}`,
      `\n  World pos: (${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)})`,
      `\n  Object type: ${obj.type}`,
      `\n  UUID: ${obj.uuid.substring(0, 8)}`,
    );
  }

  onMount(() => {
    const gl = (renderer as any)?.current ?? renderer;
    const el = gl?.domElement as HTMLCanvasElement | undefined;
    if (!el) return;
    el.addEventListener("click", onClick);
    console.log("[OceanInspect] Click-to-identify active");
    return () => el.removeEventListener("click", onClick);
  });
</script>
