<script lang="ts">
  import { T, useTask, useThrelte } from '@threlte/core';
  import { InstancedMesh, ShaderMaterial, Vector3, Object3D } from 'three';
  import { userProportionsState } from '@austencloud/scene-3d';
  import {
    RESIDENT_SPECIES,
    ALL_SPECIES,
    SpeciesRotationManager,
    type VisitorGroup,
    type FishSpeciesConfig,
  } from './fish-species';
  import { createFishComputeSystem, type FishComputeSystem, type FishFrameUniforms } from './fish-compute';
  import { createFishRenderSystem, type FishRenderSystem, type ExtractedModel } from './fish-render';
  import type { CursorRay } from '../../interaction/OceanInteraction.svelte';


  interface Props {
    targetSize?: number;
    swimHeight?: [number, number];
    speed?: [number, number];
    stageRadius?: number;
    boundRadius?: number;
    currentStrength?: number;
    scatterRadius?: number;
    scatterForce?: number;
    scatterWaveSpeed?: number;
    perceptionAngle?: number;
    halfSpeedTime?: number;
    cursorRay?: CursorRay;
    modelBasePath?: string;
    worldYOffset?: number;
    /**
     * Where the school sits in the world. The boids simulate around their own
     * origin and the vertex shader skips modelMatrix entirely, so a parent
     * <T.Group> does NOT move them — this prop is the only way to place a
     * school anywhere but the world origin.
     */
    worldOffset?: [number, number, number];
    /**
     * The fish fragment shader carries its OWN fog, tuned for a stage you
     * stand in front of: everything past 25 m is solid #1a3040. In a corridor
     * that is a school of black silhouettes. A host with its own atmosphere
     * passes its values here so the fish sit in the same air as everything
     * else.
     */
    fogColor?: string;
    fogNear?: number;
    fogFar?: number;
    ambient?: number;
  }

  let {
    targetSize = 1.0,
    swimHeight = [2, 7] as [number, number],
    speed = [0.5, 1.2] as [number, number],
    stageRadius = 5,
    boundRadius = 18,
    currentStrength = 0.3,
    scatterRadius = 8.5,
    scatterForce = 16.0,
    scatterWaveSpeed = 0.15,
    perceptionAngle = 135,
    halfSpeedTime = 0.5,
    cursorRay,
    modelBasePath = '/models/ocean/pack/',
    worldYOffset = 0,
    worldOffset,
    fogColor,
    fogNear,
    fogFar,
    ambient,
  }: Props = $props();

  const offset = $derived(
    new Vector3(...(worldOffset ?? [0, worldYOffset, 0])),
  );

  /**
   * The seabed, in the boids' own local space. Everything vertical hangs off
   * this: the swimHeight band, the floor steer, and the hard clamp in
   * boid-position.glsl.
   *
   * `userProportionsState.groundY` is the AVATAR's ground, which tracks the
   * performer's proportions and is not zero (it measured -1.56 during the
   * traverse review). The ocean stage gets away with using it because its stage
   * and its avatar share a floor. A consumer that passes `worldOffset` does not:
   * it has already put the seabed at offset.y, so local zero IS the seabed, and
   * borrowing the avatar's ground pushed the clamp 0.96 m UNDERGROUND — which is
   * exactly where 21 of 87 fish were found, piled on it.
   */
  const groundY = $derived(worldOffset ? 0 : userProportionsState.groundY);
  const { renderer, camera } = useThrelte();


  let meshes = $state<InstancedMesh[]>([]);
  let gpuFailed = $state(false);
  let fallbackMeshes = $state<InstancedMesh[]>([]);
  let scatterStartTime = -1000;

  let computeSystem: FishComputeSystem | null = null;
  let renderSystem: FishRenderSystem | null = null;
  let rotationManager: SpeciesRotationManager | null = null;

  interface ActiveVisitorGroup {
    group: VisitorGroup;
    meshes: InstancedMesh[];
    materials: ShaderMaterial[];
    speciesIndices: number[];
  }

  let activeVisitors: ActiveVisitorGroup[] = [];
  let pendingSpawns: { group: VisitorGroup; speciesIdx: number[] }[] = [];
  let pendingDespawns: { startIndex: number; count: number }[] = [];


  $effect(() => {
    const gy = groundY;
    const gl = (renderer as any)?.current ?? renderer;
    if (!gl) return;

    const render = createFishRenderSystem();
    renderSystem = render;
    let cancelled = false;

    render.loadModels(RESIDENT_SPECIES, modelBasePath).then((results) => {
      if (cancelled) return;

      const loaded = results.filter(
        (r): r is { species: FishSpeciesConfig; model: ExtractedModel } => r.model !== null,
      );
      if (loaded.length === 0) return;

      const loadedWithIndex = loaded.map((r, i) => ({
        species: r.species,
        model: r.model,
        speciesIndex: i,
      }));

      const compute = createFishComputeSystem(gl, {
        targetSize,
        swimHeight,
        speed,
        stageRadius,
        boundRadius,
        currentStrength,
        scatterRadius,
        scatterForce,
        scatterWaveSpeed,
        perceptionAngle,
        halfSpeedTime,
        groundY: gy,
      }, loadedWithIndex);

      if (!compute) {
        gpuFailed = true;
        fallbackMeshes = render.createCPUFallback(loaded, targetSize, gy);
        initCPUFallbackAnimation(fallbackMeshes, gy);
        return;
      }

      computeSystem = compute;

      render.createResidentMeshes(
        loaded,
        compute.texSize,
        targetSize,
        speed[1],
        compute.positionTexture,
        compute.velocityTexture,
        compute.stateTexture,
      );

      meshes = [...render.meshes];
      rotationManager = new SpeciesRotationManager(compute.texSize * compute.texSize, compute.residentFishCount);
    });

    return () => {
      cancelled = true;
      // Dispose fallback meshes
      for (const m of fallbackMeshes) {
        (m.material as ShaderMaterial).dispose();
        m.geometry.dispose();
        m.dispose();
      }
      fallbackMeshes = [];
      gpuFailed = false;

      // Dispose visitors
      for (const v of activeVisitors) {
        for (const mat of v.materials) mat.dispose();
        for (const m of v.meshes) { m.geometry.dispose(); m.dispose(); }
      }
      activeVisitors = [];
      pendingSpawns = [];
      pendingDespawns = [];

      // Dispose core systems
      if (computeSystem) { computeSystem.dispose(); computeSystem = null; }
      if (renderSystem) { renderSystem.dispose(); renderSystem = null; }
      rotationManager = null;
      meshes = [];
    };
  });

  // ── CPU fallback animation ────────────────────────────────────────────

  function initCPUFallbackAnimation(fbMeshes: InstancedMesh[], gy: number) {
    if (fbMeshes.length === 0) return;
    const mesh = fbMeshes[0]!;
    const mat = mesh.material as ShaderMaterial;
    const count = mesh.count;

    const dummy = new Object3D();
    const paths = Array.from({ length: count }, (_, i) => ({
      radius: 8 + Math.random() * 10,
      height: gy + 2 + Math.random() * 4,
      speed: 0.15 + Math.random() * 0.25,
      phase: (i / count) * Math.PI * 2,
      yOsc: 0.3 + Math.random() * 0.5,
      yFreq: 0.2 + Math.random() * 0.3,
    }));

    let fbElapsed = 0;
    useTask((delta) => {
      fbElapsed += delta;
      mat.uniforms.uTime!.value = fbElapsed;
      for (let i = 0; i < count; i++) {
        const p = paths[i]!;
        const angle = fbElapsed * p.speed + p.phase;
        const x = Math.cos(angle) * p.radius;
        const z = Math.sin(angle) * p.radius;
        const y = p.height + Math.sin(fbElapsed * p.yFreq) * p.yOsc;
        dummy.position.set(x, y, z);
        const nextAngle = angle + 0.1;
        dummy.lookAt(
          Math.cos(nextAngle) * p.radius,
          y,
          Math.sin(nextAngle) * p.radius,
        );
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    });
  }

  /** Push the caller's placement and atmosphere onto a fish material. */
  function applyHostLook(mat: ShaderMaterial): void {
    mat.uniforms.uWorldOffset?.value.copy(offset);
    if (fogColor !== undefined) mat.uniforms.uFogColor?.value.set(fogColor);
    if (fogNear !== undefined) mat.uniforms.uFogNear!.value = fogNear;
    if (fogFar !== undefined) mat.uniforms.uFogFar!.value = fogFar;
    if (ambient !== undefined) mat.uniforms.uAmbient!.value = ambient;
  }


  let elapsed = 0;
  const cursorRayOrigin = new Vector3();
  const cursorRayDir = new Vector3(0, 0, -1);

  useTask((delta) => {
    if (!computeSystem || !renderSystem || renderSystem.materials.length === 0) return;

    const dt = Math.min(delta, 0.05);
    elapsed += dt;

    // Camera right vector for state shader
    const cameraRight = new Vector3(1, 0, 0);
    const cam = (camera as any)?.current ?? camera;
    if (cam && cam.matrixWorld) {
      const e = cam.matrixWorld.elements;
      cameraRight.set(e[0], e[1], e[2]).normalize();
    }

    const cursorActive = cursorRay?.active ?? false;
    if (cursorRay) {
      cursorRayOrigin.copy(cursorRay.origin).sub(offset);
      cursorRayDir.copy(cursorRay.dir);
    }

    if (pendingSpawns.length > 0) {
      const spawn = pendingSpawns.shift()!;
      const { group, speciesIdx } = spawn;
      const { slots, entryAngle, exitAngle } = group;
      const totalCount = Math.min(slots.count, 64);

      const posData = new Float32Array(totalCount * 4);
      const velData = new Float32Array(totalCount * 4);

      const entryR = boundRadius * 0.85;
      const entryX = Math.cos(entryAngle) * entryR;
      const entryZ = Math.sin(entryAngle) * entryR;
      const exitDirX = Math.cos(exitAngle);
      const exitDirZ = Math.sin(exitAngle);

      const gy = groundY;
      const schoolCenters: Vector3[] = [];
      const trophicRoles = new Int32Array(group.species.length);

      let offset = 0;
      for (let si = 0; si < group.species.length; si++) {
        const sp = group.species[si]!;
        const spIdx = speciesIdx[si] ?? 0;
        schoolCenters.push(new Vector3(entryX, gy + 4, entryZ));
        trophicRoles[si] = sp.trophicRole;
        for (let j = 0; j < sp.instanceCount && offset < totalCount; j++) {
          const idx = offset * 4;
          posData[idx + 0] = entryX + (Math.random() - 0.5) * 3;
          posData[idx + 1] = gy + 3 + Math.random() * 3;
          posData[idx + 2] = entryZ + (Math.random() - 0.5) * 3;
          posData[idx + 3] = spIdx;

          const spd = sp.speed[0] + Math.random() * (sp.speed[1] - sp.speed[0]);
          velData[idx + 0] = exitDirX * spd;
          velData[idx + 1] = 0;
          velData[idx + 2] = exitDirZ * spd;
          velData[idx + 3] = 0.6 + Math.random() * 0.8;
          offset++;
        }
      }

      computeSystem.processSpawn(
        slots.startIndex,
        offset,
        posData,
        velData,
        speciesIdx,
        schoolCenters,
        trophicRoles,
      );
    } else {
      const posUni = computeSystem.posVar.material.uniforms;
      const velUni = computeSystem.velVar.material.uniforms;
      posUni.uSpawnCount!.value = 0;
      velUni.uSpawnCount!.value = 0;
    }

    if (pendingDespawns.length > 0) {
      const despawn = pendingDespawns.shift()!;
      computeSystem.processDespawn(despawn.startIndex, despawn.count);
    } else {
      computeSystem.posVar.material.uniforms.uDespawnCount!.value = 0;
    }

    if (rotationManager) {
      const newGroup = rotationManager.tick(dt);

      // Detect despawned groups — remove from scene + queue sentinel write
      const currentSlots = new Set(rotationManager.activeGroups.map((g) => g.slots.startIndex));
      const removedMeshSet = new Set<InstancedMesh>();
      const removedMatSet = new Set<ShaderMaterial>();
      for (const v of activeVisitors) {
        if (!currentSlots.has(v.group.slots.startIndex)) {
          pendingDespawns.push({ startIndex: v.group.slots.startIndex, count: v.group.slots.count });
          for (const mat of v.materials) { mat.dispose(); removedMatSet.add(mat); }
          for (const m of v.meshes) { m.geometry.dispose(); m.dispose(); removedMeshSet.add(m); }
        }
      }
      if (removedMeshSet.size > 0) {
        renderSystem.meshes = renderSystem.meshes.filter((m) => !removedMeshSet.has(m));
        renderSystem.materials = renderSystem.materials.filter((m) => !removedMatSet.has(m));
        meshes = meshes.filter((m) => !removedMeshSet.has(m));
      }
      activeVisitors = activeVisitors.filter((v) => currentSlots.has(v.group.slots.startIndex));

      // Handle new spawn
      if (newGroup) {
        const speciesIdx = newGroup.species.map((sp) => {
          const allIdx = ALL_SPECIES.indexOf(sp);
          return allIdx >= 0 ? allIdx : computeSystem!.loadedSpeciesCount;
        });

        renderSystem!.loadModels(newGroup.species, modelBasePath).then((results) => {
          const models = results.map((r) => r.model);
          if (!computeSystem || !renderSystem) return;
          const visitorMeshes: InstancedMesh[] = [];
          const visitorMats: ShaderMaterial[] = [];

          let slotOffset = newGroup.slots.startIndex;
          for (let si = 0; si < newGroup.species.length; si++) {
            const sp = newGroup.species[si]!;
            const model = models[si];
            if (!model) { slotOffset += sp.instanceCount; continue; }

            const { mesh, material } = renderSystem.createVisitorMesh(
              sp, model, slotOffset, sp.instanceCount,
              computeSystem.texSize, targetSize, speed[1],
              computeSystem.positionTexture,
              computeSystem.velocityTexture,
              computeSystem.stateTexture,
            );
            visitorMeshes.push(mesh);
            visitorMats.push(material);
            renderSystem.materials.push(material);
            renderSystem.materialSizeMults.push(sp.sizeScale);
            slotOffset += sp.instanceCount;
          }

          if (visitorMeshes.length > 0) {
            activeVisitors.push({
              group: newGroup,
              meshes: visitorMeshes,
              materials: visitorMats,
              speciesIndices: speciesIdx,
            });
            pendingSpawns.push({ group: newGroup, speciesIdx });
            meshes = [...meshes, ...visitorMeshes];
          }
        });
      }
    }

    const frameUniforms: FishFrameUniforms = {
      delta: dt,
      time: elapsed,
      groundY,
      currentStrength,
      perceptionAngle,
      scatterRadius,
      scatterForce,
      scatterWaveSpeed,
      scatterStartTime,
      cursorRayOrigin,
      cursorRayDir,
      cursorActive,
      cameraRight,
    };

    computeSystem.update(frameUniforms);

    renderSystem.updateTextures(
      computeSystem.positionTexture!,
      computeSystem.velocityTexture!,
      computeSystem.stateTexture!,
      elapsed,
      targetSize,
    );

    for (const mat of renderSystem.materials) applyHostLook(mat);

    // Also update visitor materials
    for (const v of activeVisitors) {
      for (const mat of v.materials) {
        mat.uniforms.tPosition!.value = computeSystem.positionTexture;
        mat.uniforms.tVelocity!.value = computeSystem.velocityTexture;
        if (mat.uniforms.tState) mat.uniforms.tState.value = computeSystem.stateTexture;
        mat.uniforms.uTime!.value = elapsed;
        applyHostLook(mat);
      }
    }
  });
</script>

{#each meshes as mesh (mesh.id)}
  <T is={mesh} />
{/each}
{#each fallbackMeshes as mesh (mesh.id)}
  <T is={mesh} />
{/each}
