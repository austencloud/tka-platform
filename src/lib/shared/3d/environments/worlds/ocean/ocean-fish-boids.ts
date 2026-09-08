import {
  Group,
  Object3D,
  Vector3,
  type Camera,
  type InstancedMesh,
  type ShaderMaterial,
  type WebGLRenderer,
} from "three";
import {
  createFishComputeSystem,
  type FishComputeSystem,
  type FishFrameUniforms,
} from "../../scenes/ocean/runtime/fauna/fish/fish-compute";
import {
  createFishRenderSystem,
  type ExtractedModel,
} from "../../scenes/ocean/runtime/fauna/fish/fish-render";
import {
  ALL_SPECIES,
  RESIDENT_SPECIES,
  SpeciesRotationManager,
  type FishSpeciesConfig,
  type VisitorGroup,
} from "../../scenes/ocean/runtime/fauna/fish/fish-species";
import type { CursorRay } from "../../scenes/ocean/runtime/interaction/cursor-ray";

export type OceanFishWorldOffset =
  | readonly [number, number, number]
  | Readonly<{ x: number; y: number; z: number }>;

export interface OceanFishBoidsOptions {
  renderer: WebGLRenderer;
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
  groundY?: number;
  worldYOffset?: number;
  worldOffset?: OceanFishWorldOffset;
  fogColor?: string;
  fogNear?: number;
  fogFar?: number;
  ambient?: number;
}

export type OceanFishBoidsMode =
  | "loading"
  | "gpu"
  | "cpu"
  | "empty"
  | "failed"
  | "disposed";

export interface OceanFishBoidsWorld {
  object: Group;
  root: Group;
  ready: Promise<void>;
  readonly isReady: boolean;
  readonly mode: OceanFishBoidsMode;
  setCursorRay(cursorRay?: CursorRay): void;
  setGroundY(groundY: number): void;
  setWorldOffset(offset: OceanFishWorldOffset): void;
  update(deltaSeconds: number, camera: Camera): void;
  dispose(): void;
}

interface FishRotationController {
  readonly activeGroups: VisitorGroup[];
  tick(deltaSeconds: number): VisitorGroup | null;
}

export interface OceanFishBoidsDependencies {
  createComputeSystem: typeof createFishComputeSystem;
  createRenderSystem: typeof createFishRenderSystem;
  createRotationManager(
    maxSlots: number,
    residentCount: number
  ): FishRotationController;
  random(): number;
}

interface ActiveVisitorGroup {
  group: VisitorGroup;
  meshes: InstancedMesh[];
  materials: ShaderMaterial[];
}

interface PendingSpawn {
  group: VisitorGroup;
  speciesIndices: number[];
}

interface PendingDespawn {
  startIndex: number;
  count: number;
}

interface CPUFallbackPath {
  radius: number;
  height: number;
  speed: number;
  phase: number;
  yOscillation: number;
  yFrequency: number;
}

interface CPUFallbackAnimation {
  mesh: InstancedMesh;
  material: ShaderMaterial;
  dummy: Object3D;
  paths: CPUFallbackPath[];
  elapsed: number;
}

const DEFAULT_DEPENDENCIES: OceanFishBoidsDependencies = {
  createComputeSystem: createFishComputeSystem,
  createRenderSystem: createFishRenderSystem,
  createRotationManager(maxSlots, residentCount) {
    return new SpeciesRotationManager(maxSlots, residentCount);
  },
  random: Math.random,
};

function copyOffset(target: Vector3, offset: OceanFishWorldOffset): void {
  if ("x" in offset) {
    target.set(offset.x, offset.y, offset.z);
    return;
  }
  target.set(offset[0], offset[1], offset[2]);
}

export function createOceanFishBoids(
  options: OceanFishBoidsOptions,
  dependencies: Partial<OceanFishBoidsDependencies> = {}
): OceanFishBoidsWorld {
  const deps = { ...DEFAULT_DEPENDENCIES, ...dependencies };
  const targetSize = options.targetSize ?? 1;
  const swimHeight = options.swimHeight ?? [2, 7];
  const speed = options.speed ?? [0.5, 1.2];
  const stageRadius = options.stageRadius ?? 5;
  const boundRadius = options.boundRadius ?? 18;
  const currentStrength = options.currentStrength ?? 0.3;
  const scatterRadius = options.scatterRadius ?? 8.5;
  const scatterForce = options.scatterForce ?? 16;
  const scatterWaveSpeed = options.scatterWaveSpeed ?? 0.15;
  const perceptionAngle = options.perceptionAngle ?? 135;
  const halfSpeedTime = options.halfSpeedTime ?? 0.5;
  const modelBasePath = options.modelBasePath ?? "/models/ocean/pack/";

  const object = new Group();
  object.name = "OceanFishBoids";

  const worldOffset = new Vector3();
  copyOffset(
    worldOffset,
    options.worldOffset ?? [0, options.worldYOffset ?? 0, 0]
  );

  let groundY = options.groundY ?? 0;
  let cursorRay = options.cursorRay;
  let mode: OceanFishBoidsMode = "loading";
  let disposed = false;
  let elapsed = 0;
  const scatterStartTime = -1000;

  const cursorRayOrigin = new Vector3();
  const cursorRayDirection = new Vector3(0, 0, -1);
  const cameraRight = new Vector3(1, 0, 0);

  const renderSystem = deps.createRenderSystem();
  let computeSystem: FishComputeSystem | null = null;
  let rotationManager: FishRotationController | null = null;
  let fallbackMeshes: InstancedMesh[] = [];
  let fallbackAnimation: CPUFallbackAnimation | null = null;
  let activeVisitors: ActiveVisitorGroup[] = [];
  const pendingSpawns: PendingSpawn[] = [];
  const pendingDespawns: PendingDespawn[] = [];

  function applyHostLook(material: ShaderMaterial): void {
    material.uniforms.uWorldOffset?.value.copy(worldOffset);
    if (options.fogColor !== undefined) {
      material.uniforms.uFogColor?.value.set(options.fogColor);
    }
    if (options.fogNear !== undefined) {
      material.uniforms.uFogNear!.value = options.fogNear;
    }
    if (options.fogFar !== undefined) {
      material.uniforms.uFogFar!.value = options.fogFar;
    }
    if (options.ambient !== undefined) {
      material.uniforms.uAmbient!.value = options.ambient;
    }
  }

  function applyHostLookToAllMaterials(): void {
    for (const material of renderSystem.materials) applyHostLook(material);
    for (const mesh of fallbackMeshes) {
      const materials = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      for (const material of materials) {
        applyHostLook(material as ShaderMaterial);
      }
    }
  }

  function createFallbackAnimation(meshes: InstancedMesh[]): void {
    const mesh = meshes[0];
    if (!mesh) return;

    const paths = Array.from({ length: mesh.count }, (_, index) => ({
      radius: 8 + deps.random() * 10,
      height: groundY + 2 + deps.random() * 4,
      speed: 0.15 + deps.random() * 0.25,
      phase: (index / mesh.count) * Math.PI * 2,
      yOscillation: 0.3 + deps.random() * 0.5,
      yFrequency: 0.2 + deps.random() * 0.3,
    }));

    fallbackAnimation = {
      mesh,
      material: mesh.material as ShaderMaterial,
      dummy: new Object3D(),
      paths,
      elapsed: 0,
    };
  }

  function updateFallback(deltaSeconds: number): void {
    const animation = fallbackAnimation;
    if (!animation) return;

    animation.elapsed += deltaSeconds;
    animation.material.uniforms.uTime!.value = animation.elapsed;
    for (let index = 0; index < animation.paths.length; index++) {
      const path = animation.paths[index]!;
      const angle = animation.elapsed * path.speed + path.phase;
      const x = Math.cos(angle) * path.radius;
      const z = Math.sin(angle) * path.radius;
      const y =
        path.height +
        Math.sin(animation.elapsed * path.yFrequency) * path.yOscillation;
      animation.dummy.position.set(x, y, z);
      const nextAngle = angle + 0.1;
      animation.dummy.lookAt(
        Math.cos(nextAngle) * path.radius,
        y,
        Math.sin(nextAngle) * path.radius
      );
      animation.dummy.updateMatrix();
      animation.mesh.setMatrixAt(index, animation.dummy.matrix);
    }
    animation.mesh.instanceMatrix.needsUpdate = true;
    applyHostLook(animation.material);
  }

  function removeRenderMaterial(material: ShaderMaterial): void {
    const materialIndex = renderSystem.materials.indexOf(material);
    if (materialIndex < 0) return;
    renderSystem.materials.splice(materialIndex, 1);
    renderSystem.materialSizeMults.splice(materialIndex, 1);
  }

  function disposeVisitor(visitor: ActiveVisitorGroup): void {
    for (const material of visitor.materials) {
      removeRenderMaterial(material);
      material.dispose();
    }
    for (const mesh of visitor.meshes) {
      object.remove(mesh);
      mesh.geometry.dispose();
      mesh.dispose();
    }
  }

  function loadVisitor(group: VisitorGroup, speciesIndices: number[]): void {
    void renderSystem
      .loadModels(group.species, modelBasePath)
      .then((results) => {
        if (disposed || !computeSystem) return;

        const visitorMeshes: InstancedMesh[] = [];
        const visitorMaterials: ShaderMaterial[] = [];
        let slotOffset = group.slots.startIndex;

        for (
          let speciesIndex = 0;
          speciesIndex < group.species.length;
          speciesIndex++
        ) {
          const species = group.species[speciesIndex]!;
          const model = results[speciesIndex]?.model;
          if (!model) {
            slotOffset += species.instanceCount;
            continue;
          }

          const { mesh, material } = renderSystem.createVisitorMesh(
            species,
            model,
            slotOffset,
            species.instanceCount,
            computeSystem.texSize,
            targetSize,
            speed[1],
            computeSystem.positionTexture,
            computeSystem.velocityTexture,
            computeSystem.stateTexture
          );
          visitorMeshes.push(mesh);
          visitorMaterials.push(material);
          renderSystem.materials.push(material);
          renderSystem.materialSizeMults.push(species.sizeScale);
          applyHostLook(material);
          slotOffset += species.instanceCount;
        }

        if (visitorMeshes.length === 0) return;
        activeVisitors.push({
          group,
          meshes: visitorMeshes,
          materials: visitorMaterials,
        });
        pendingSpawns.push({ group, speciesIndices });
        object.add(...visitorMeshes);
      })
      .catch((error: unknown) => {
        if (!disposed) {
          console.error("[OceanFishBoids] Failed to load visitor fish:", error);
        }
      });
  }

  function processPendingSpawn(compute: FishComputeSystem): void {
    const spawn = pendingSpawns.shift();
    if (!spawn) {
      compute.posVar.material.uniforms.uSpawnCount!.value = 0;
      compute.velVar.material.uniforms.uSpawnCount!.value = 0;
      return;
    }

    const { group, speciesIndices } = spawn;
    const totalCount = Math.min(group.slots.count, 64);
    const positions = new Float32Array(totalCount * 4);
    const velocities = new Float32Array(totalCount * 4);
    const entryRadius = boundRadius * 0.85;
    const entryX = Math.cos(group.entryAngle) * entryRadius;
    const entryZ = Math.sin(group.entryAngle) * entryRadius;
    const exitDirectionX = Math.cos(group.exitAngle);
    const exitDirectionZ = Math.sin(group.exitAngle);
    const schoolCenters: Vector3[] = [];
    const trophicRoles = new Int32Array(group.species.length);

    let fishOffset = 0;
    for (
      let speciesIndex = 0;
      speciesIndex < group.species.length;
      speciesIndex++
    ) {
      const species = group.species[speciesIndex]!;
      const computeSpeciesIndex = speciesIndices[speciesIndex] ?? 0;
      schoolCenters.push(new Vector3(entryX, groundY + 4, entryZ));
      trophicRoles[speciesIndex] = species.trophicRole;

      for (
        let fishIndex = 0;
        fishIndex < species.instanceCount && fishOffset < totalCount;
        fishIndex++
      ) {
        const valueIndex = fishOffset * 4;
        positions[valueIndex] = entryX + (deps.random() - 0.5) * 3;
        positions[valueIndex + 1] = groundY + 3 + deps.random() * 3;
        positions[valueIndex + 2] = entryZ + (deps.random() - 0.5) * 3;
        positions[valueIndex + 3] = computeSpeciesIndex;

        const fishSpeed =
          species.speed[0] +
          deps.random() * (species.speed[1] - species.speed[0]);
        velocities[valueIndex] = exitDirectionX * fishSpeed;
        velocities[valueIndex + 1] = 0;
        velocities[valueIndex + 2] = exitDirectionZ * fishSpeed;
        velocities[valueIndex + 3] = 0.6 + deps.random() * 0.8;
        fishOffset++;
      }
    }

    compute.processSpawn(
      group.slots.startIndex,
      fishOffset,
      positions,
      velocities,
      speciesIndices,
      schoolCenters,
      trophicRoles
    );
  }

  function processPendingDespawn(compute: FishComputeSystem): void {
    const despawn = pendingDespawns.shift();
    if (despawn) {
      compute.processDespawn(despawn.startIndex, despawn.count);
    } else {
      compute.posVar.material.uniforms.uDespawnCount!.value = 0;
    }
  }

  function updateVisitors(
    deltaSeconds: number,
    compute: FishComputeSystem
  ): void {
    const manager = rotationManager;
    if (!manager) return;

    const newGroup = manager.tick(deltaSeconds);
    const currentSlots = new Set(
      manager.activeGroups.map((group) => group.slots.startIndex)
    );

    const retainedVisitors: ActiveVisitorGroup[] = [];
    for (const visitor of activeVisitors) {
      if (currentSlots.has(visitor.group.slots.startIndex)) {
        retainedVisitors.push(visitor);
        continue;
      }
      pendingDespawns.push({
        startIndex: visitor.group.slots.startIndex,
        count: visitor.group.slots.count,
      });
      disposeVisitor(visitor);
    }
    activeVisitors = retainedVisitors;

    if (!newGroup) return;
    const speciesIndices = newGroup.species.map((species) => {
      const allSpeciesIndex = ALL_SPECIES.indexOf(species);
      return allSpeciesIndex >= 0
        ? allSpeciesIndex
        : compute.loadedSpeciesCount;
    });
    loadVisitor(newGroup, speciesIndices);
  }

  function setGroundY(nextGroundY: number): void {
    if (disposed || nextGroundY === groundY) return;
    const delta = nextGroundY - groundY;
    groundY = nextGroundY;

    if (fallbackAnimation) {
      for (const path of fallbackAnimation.paths) path.height += delta;
    }

    const compute = computeSystem;
    if (!compute) return;
    compute.velVar.material.uniforms.uGroundY!.value = groundY;
    compute.posVar.material.uniforms.uFloorY!.value =
      groundY + Math.min(swimHeight[0] * 0.5, 0.6);
    compute.posVar.material.uniforms.uCeilingY!.value =
      groundY + swimHeight[1] + 1.5;
  }

  function setWorldOffset(nextOffset: OceanFishWorldOffset): void {
    if (disposed) return;
    copyOffset(worldOffset, nextOffset);
    applyHostLookToAllMaterials();
  }

  function update(deltaSeconds: number, camera: Camera): void {
    if (disposed) return;
    if (mode === "cpu") {
      updateFallback(deltaSeconds);
      return;
    }

    const compute = computeSystem;
    if (!compute || renderSystem.materials.length === 0) return;

    const delta = Math.min(deltaSeconds, 0.05);
    elapsed += delta;

    const matrixElements = camera.matrixWorld.elements;
    cameraRight
      .set(matrixElements[0], matrixElements[1], matrixElements[2])
      .normalize();

    const cursorActive = cursorRay?.active ?? false;
    if (cursorRay) {
      cursorRayOrigin.copy(cursorRay.origin).sub(worldOffset);
      cursorRayDirection.copy(cursorRay.dir);
    }

    processPendingSpawn(compute);
    processPendingDespawn(compute);
    updateVisitors(delta, compute);

    const frameUniforms: FishFrameUniforms = {
      delta,
      time: elapsed,
      groundY,
      currentStrength,
      perceptionAngle,
      scatterRadius,
      scatterForce,
      scatterWaveSpeed,
      scatterStartTime,
      cursorRayOrigin,
      cursorRayDir: cursorRayDirection,
      cursorActive,
      cameraRight,
    };
    compute.update(frameUniforms);

    renderSystem.updateTextures(
      compute.positionTexture!,
      compute.velocityTexture!,
      compute.stateTexture!,
      elapsed,
      targetSize
    );
    applyHostLookToAllMaterials();

    for (const visitor of activeVisitors) {
      for (const material of visitor.materials) {
        material.uniforms.tPosition!.value = compute.positionTexture;
        material.uniforms.tVelocity!.value = compute.velocityTexture;
        if (material.uniforms.tState) {
          material.uniforms.tState.value = compute.stateTexture;
        }
        material.uniforms.uTime!.value = elapsed;
        applyHostLook(material);
      }
    }
  }

  const ready = renderSystem
    .loadModels(RESIDENT_SPECIES, modelBasePath)
    .then((results) => {
      if (disposed) return;

      const loaded = results.filter(
        (
          result
        ): result is {
          species: FishSpeciesConfig;
          model: ExtractedModel;
        } => result.model !== null
      );
      if (loaded.length === 0) {
        mode = "empty";
        return;
      }

      const loadedWithIndex = loaded.map((result, speciesIndex) => ({
        species: result.species,
        model: result.model,
        speciesIndex,
      }));
      const compute = deps.createComputeSystem(
        options.renderer,
        {
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
          groundY,
        },
        loadedWithIndex
      );

      if (!compute) {
        fallbackMeshes = renderSystem.createCPUFallback(
          loaded,
          targetSize,
          groundY
        );
        object.add(...fallbackMeshes);
        createFallbackAnimation(fallbackMeshes);
        applyHostLookToAllMaterials();
        mode = "cpu";
        return;
      }

      computeSystem = compute;
      renderSystem.createResidentMeshes(
        loaded,
        compute.texSize,
        targetSize,
        speed[1],
        compute.positionTexture,
        compute.velocityTexture,
        compute.stateTexture
      );
      object.add(...renderSystem.meshes);
      applyHostLookToAllMaterials();
      rotationManager = deps.createRotationManager(
        compute.texSize * compute.texSize,
        compute.residentFishCount
      );
      mode = "gpu";
    })
    .catch((error: unknown) => {
      if (!disposed) mode = "failed";
      throw error;
    });

  return {
    object,
    root: object,
    ready,
    get isReady() {
      return mode === "gpu" || mode === "cpu" || mode === "empty";
    },
    get mode() {
      return mode;
    },
    setCursorRay(nextCursorRay) {
      if (!disposed) cursorRay = nextCursorRay;
    },
    setGroundY,
    setWorldOffset,
    update,
    dispose() {
      if (disposed) return;
      disposed = true;
      mode = "disposed";
      cursorRay = undefined;

      for (const visitor of activeVisitors) disposeVisitor(visitor);
      activeVisitors = [];
      pendingSpawns.length = 0;
      pendingDespawns.length = 0;

      for (const mesh of fallbackMeshes) {
        const materials = Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material];
        for (const material of materials) material.dispose();
        mesh.geometry.dispose();
        mesh.dispose();
      }
      fallbackMeshes = [];
      fallbackAnimation = null;

      computeSystem?.dispose();
      computeSystem = null;
      rotationManager = null;
      renderSystem.dispose();
      object.clear();
    },
  };
}
