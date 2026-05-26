import {
  WebGPURenderer,
  StorageBufferAttribute,
} from "three/webgpu";
import {
  Fn,
  float,
  vec3,
  instanceIndex,
  storage,
  uniform,
  sin,
  floor,
  fract,
  mix,
  max,
  min,
  clamp,
  normalize,
} from "three/tsl";
import type {
  TerrainComputeConfig,
  GPUChunkResult,
  GPUVegetationData,
  ChunkGenerateRequest,
} from "./terrain-compute-types";
import { DEFAULT_TERRAIN_CONFIG } from "./terrain-compute-types";
import {
  getBiomeType,
  BIOME_CHARACTERISTICS,
  biomeTypeToLegacy,
  DEFAULT_BIOME_CONFIG,
} from "../biome-system";
import { SeededNoise } from "../seed-generator";
import {
  generateVegetationScatter,
  toLegacyFormat,
  type TerrainSample,
} from "../vegetation-scatter";
import { buildTerrainGeometry, addSkirtGeometry } from "../terrain-mesh-builder";
import { generateChunkCPU } from "../terrain-cpu-generator";

export async function isWebGPUAvailable(): Promise<boolean> {
  if (!navigator.gpu) return false;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    return adapter !== null;
  } catch {
    return false;
  }
}

export class TerrainComputeGenerator {
  private renderer: WebGPURenderer | null = null;
  private config: TerrainComputeConfig;
  private isInitialized = false;
  private initPromise: Promise<boolean> | null = null;

  private heightBuffer: StorageBufferAttribute | null = null;
  private normalBuffer: StorageBufferAttribute | null = null;
  private colorBuffer: StorageBufferAttribute | null = null;

  private noise: SeededNoise | null = null;

  private chunkOriginX = uniform(0);
  private chunkOriginZ = uniform(0);
  private worldSeed = uniform(12345);
  private resolution = uniform(33);
  private chunkSize = uniform(32);

  constructor(config: Partial<TerrainComputeConfig> = {}) {
    this.config = { ...DEFAULT_TERRAIN_CONFIG, ...config };
    this.noise = new SeededNoise(12345);
  }

  async init(): Promise<boolean> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = this.doInit();
    return this.initPromise;
  }

  private async doInit(): Promise<boolean> {
    const gpuAvailable = await isWebGPUAvailable();
    if (!gpuAvailable) {
      return false;
    }

    try {
      this.renderer = new WebGPURenderer({ antialias: false });
      await this.renderer.init();

      const maxVertices = this.config.resolution * this.config.resolution;
      this.heightBuffer = new StorageBufferAttribute(
        new Float32Array(maxVertices),
        1
      );
      this.normalBuffer = new StorageBufferAttribute(
        new Float32Array(maxVertices * 3),
        3
      );
      this.colorBuffer = new StorageBufferAttribute(
        new Float32Array(maxVertices * 3),
        3
      );

      this.isInitialized = true;
      return true;
    } catch (error) {
      console.warn("[TerrainCompute] GPU init failed:", error);
      return false;
    }
  }

  async generateChunk(request: ChunkGenerateRequest): Promise<GPUChunkResult> {
    const { chunkX, chunkZ, lod } = request;

    const effectiveRes = Math.max(
      4,
      Math.floor(this.config.resolution / Math.pow(2, lod))
    );

    if (this.isInitialized && this.renderer) {
      try {
        return await this.generateChunkGPU(chunkX, chunkZ, effectiveRes, lod);
      } catch (error) {
        console.warn("[TerrainCompute] GPU generation failed, falling back:", error);
      }
    }

    return generateChunkCPU(chunkX, chunkZ, effectiveRes, lod, this.config, this.noise!);
  }

  private async generateChunkGPU(
    chunkX: number,
    chunkZ: number,
    resolution: number,
    lod: number
  ): Promise<GPUChunkResult> {
    if (!this.renderer || !this.heightBuffer || !this.normalBuffer || !this.colorBuffer) {
      throw new Error("GPU not initialized");
    }

    const vertexCount = resolution * resolution;
    const originX = chunkX * this.config.chunkSize;
    const originZ = chunkZ * this.config.chunkSize;

    this.chunkOriginX.value = originX;
    this.chunkOriginZ.value = originZ;
    this.worldSeed.value = this.config.worldSeed;
    this.resolution.value = resolution;
    this.chunkSize.value = this.config.chunkSize;

    const heightmapCompute = this.createHeightmapCompute();
    await this.renderer.computeAsync(heightmapCompute);

    const heights = new Float32Array(vertexCount);
    // @ts-expect-error - readStorageBufferAsync is experimental WebGPU API
    await this.renderer.readStorageBufferAsync(this.heightBuffer, heights);

    const normalCompute = this.createNormalCompute(heights);
    await this.renderer.computeAsync(normalCompute);

    const normals = new Float32Array(vertexCount * 3);
    // @ts-expect-error - readStorageBufferAsync is experimental WebGPU API
    await this.renderer.readStorageBufferAsync(this.normalBuffer, normals);

    const colorCompute = this.createColorCompute(heights);
    await this.renderer.computeAsync(colorCompute);

    const colors = new Float32Array(vertexCount * 3);
    // @ts-expect-error - readStorageBufferAsync is experimental WebGPU API
    await this.renderer.readStorageBufferAsync(this.colorBuffer, colors);

    const { vertices, indices } = buildTerrainGeometry(
      heights,
      resolution,
      originX,
      originZ,
      this.config.chunkSize,
    );

    const centerHeight = heights[Math.floor(vertexCount / 2)] ?? 0;
    const biome = this.getBiomeFromHeight(centerHeight);

    const { blendWeights1, blendWeights2 } = this.generateBlendWeights(heights, normals, resolution, originX, originZ);
    const vegetation = this.generateVegetation(heights, normals, originX, originZ, resolution, biome, lod);

    const withSkirts = addSkirtGeometry(
      vertices,
      normals,
      colors,
      blendWeights1,
      blendWeights2,
      indices,
      resolution,
      lod,
      heights,
    );

    return {
      vertices: withSkirts.vertices,
      normals: withSkirts.normals,
      colors: withSkirts.colors,
      indices: withSkirts.indices,
      blendWeights1: withSkirts.blendWeights1,
      blendWeights2: withSkirts.blendWeights2,
      vegetation,
      biome,
      usedGPU: true,
    };
  }

  private createHeightmapCompute() {
    const heightStorage = storage(this.heightBuffer!, "float", this.heightBuffer!.count);

    const computeFn = Fn(() => {
      const idx = instanceIndex;
      const res = this.resolution;
      const size = this.chunkSize;
      const originX = this.chunkOriginX;
      const originZ = this.chunkOriginZ;
      const seed = this.worldSeed;

      const x = idx.mod(res);
      const z = floor(idx.div(res));

      const step = size.div(res.sub(1));
      const worldX = originX.add(x.mul(step));
      const worldZ = originZ.add(z.mul(step));

      const scale = float(this.config.noise.baseScale);
      const height = this.fbmNoise(worldX.mul(scale), worldZ.mul(scale), seed);

      const scaledHeight = height.mul(this.config.noise.heightScale);

      heightStorage.element(idx).assign(scaledHeight);
    });

    return computeFn().compute(this.heightBuffer!.count);
  }

  private createNormalCompute(_heights: Float32Array) {
    const normalStorage = storage(this.normalBuffer!, "vec3", this.normalBuffer!.count / 3);

    const computeFn = Fn(() => {
      const idx = instanceIndex;
      const res = this.resolution;

      const x = idx.mod(res); // eslint-disable-line @typescript-eslint/no-unused-vars
      const z = floor(idx.div(res)); // eslint-disable-line @typescript-eslint/no-unused-vars

      const step = this.chunkSize.div(res.sub(1));

      const leftIdx = max(idx.sub(1), float(0)); // eslint-disable-line @typescript-eslint/no-unused-vars
      const rightIdx = min(idx.add(1), res.mul(res).sub(1)); // eslint-disable-line @typescript-eslint/no-unused-vars
      const downIdx = max(idx.sub(res), float(0)); // eslint-disable-line @typescript-eslint/no-unused-vars
      const upIdx = min(idx.add(res), res.mul(res).sub(1)); // eslint-disable-line @typescript-eslint/no-unused-vars

      const heightLeft = float(0);
      const heightRight = float(0);
      const heightDown = float(0);
      const heightUp = float(0);

      const nx = heightLeft.sub(heightRight);
      const ny = step.mul(2);
      const nz = heightDown.sub(heightUp);

      const normal = normalize(vec3(nx, ny, nz));
      normalStorage.element(idx).assign(normal);
    });

    return computeFn().compute(this.normalBuffer!.count / 3);
  }

  private createColorCompute(_heights: Float32Array) {
    const colorStorage = storage(this.colorBuffer!, "vec3", this.colorBuffer!.count / 3);

    const computeFn = Fn(() => {
      const idx = instanceIndex;
      const height = float(0);

      const oceanLevel = float(this.config.biome.oceanLevel);
      const mountainLevel = float(this.config.biome.mountainLevel);

      const oceanColor = vec3(0.1, 0.3, 0.6);
      const plainsColor = vec3(0.3, 0.5, 0.2);
      const mountainColor = vec3(0.6, 0.6, 0.65);
      const snowColor = vec3(0.9, 0.9, 0.95);

      const heightNorm = clamp(height.div(50), float(-1), float(1)); // eslint-disable-line @typescript-eslint/no-unused-vars

      let color: ReturnType<typeof mix> = plainsColor as unknown as ReturnType<typeof mix>;

      const isOcean = height.lessThan(oceanLevel);
      color = mix(color, oceanColor, isOcean.toFloat());

      const isMountain = height.greaterThan(mountainLevel);
      color = mix(color, mountainColor, isMountain.toFloat());

      const isSnow = height.greaterThan(mountainLevel.mul(1.5));
      color = mix(color, snowColor, isSnow.toFloat());

      colorStorage.element(idx).assign(color);
    });

    return computeFn().compute(this.colorBuffer!.count / 3);
  }

  private fbmNoise(x: ReturnType<typeof float>, z: ReturnType<typeof float>, seed: ReturnType<typeof uniform>) {
    const { octaves, lacunarity, persistence } = this.config.noise;

    let value: ReturnType<typeof float> = float(0);
    let amplitude: ReturnType<typeof float> = float(1);
    let frequency: ReturnType<typeof float> = float(1);
    let maxValue: ReturnType<typeof float> = float(0);

    for (let i = 0; i < octaves; i++) {
      const nx = x.mul(frequency);
      const nz = z.mul(frequency);

      const n = this.pseudoNoise(nx, nz, seed.add(i));

      value = value.add(amplitude.mul(n));
      maxValue = maxValue.add(amplitude);
      amplitude = amplitude.mul(persistence);
      frequency = frequency.mul(lacunarity);
    }

    return value.div(maxValue);
  }

  private pseudoNoise(x: ReturnType<typeof float>, z: ReturnType<typeof float>, seed: ReturnType<typeof float>) {
    const dot = x.mul(12.9898).add(z.mul(78.233)).add(seed.mul(43.758));
    const sinVal = sin(dot);
    return fract(sinVal.mul(43758.5453));
  }

  private getBiomeFromHeight(height: number): string {
    const { oceanLevel, mountainLevel } = this.config.biome;
    if (height < oceanLevel) return "ocean";
    if (height > mountainLevel) return "mountains";
    return "plains";
  }

  private generateBlendWeights(
    heights: Float32Array,
    normals: Float32Array,
    resolution: number,
    originX: number,
    originZ: number
  ): { blendWeights1: Float32Array; blendWeights2: Float32Array } {
    const vertexCount = resolution * resolution;
    const blendWeights1 = new Float32Array(vertexCount * 3);
    const blendWeights2 = new Float32Array(vertexCount * 3);
    const { chunkSize } = this.config;
    const step = chunkSize / (resolution - 1);

    const noise = new SeededNoise(this.config.worldSeed);

    for (let z = 0; z < resolution; z++) {
      for (let x = 0; x < resolution; x++) {
        const i = z * resolution + x;
        const height = heights[i] ?? 0;
        const ny = normals[i * 3 + 1] ?? 1;
        const slope = 1 - ny;

        const worldX = originX + x * step;
        const worldZ = originZ + z * step;

        const biomeType = getBiomeType(noise, worldX, worldZ, height, DEFAULT_BIOME_CONFIG);
        const characteristics = BIOME_CHARACTERISTICS[biomeType];
        let { grass, rock, dirt, sand, snow } = { ...characteristics.blendWeights };

        const ROCK_SLOPE_START = 0.35;
        const ROCK_SLOPE_FULL = 0.75;
        if (slope > ROCK_SLOPE_START) {
          const rockFactor = Math.min(1, (slope - ROCK_SLOPE_START) / (ROCK_SLOPE_FULL - ROCK_SLOPE_START));
          const smoothRock = rockFactor * rockFactor * (3 - 2 * rockFactor);

          const grassLoss = grass * smoothRock * 0.85;
          const dirtLoss = dirt * smoothRock * 0.7;
          const sandLoss = sand * smoothRock * 0.6;

          grass -= grassLoss;
          dirt -= dirtLoss;
          sand -= sandLoss;
          rock += grassLoss + dirtLoss + sandLoss;
        }

        const variationNoise = (noise.fbm(worldX * 0.05, 0, worldZ * 0.05, 3) + 1) * 0.5;
        const variation = (variationNoise - 0.5) * 0.12;

        if (grass > 0.1 && dirt > 0.1) {
          grass += variation;
          dirt -= variation;
        }

        const total = grass + rock + dirt + sand + snow;
        if (total > 0) {
          grass /= total;
          rock /= total;
          dirt /= total;
          sand /= total;
          snow /= total;
        }

        grass = Math.max(0, Math.min(1, grass));
        rock = Math.max(0, Math.min(1, rock));
        dirt = Math.max(0, Math.min(1, dirt));
        sand = Math.max(0, Math.min(1, sand));
        snow = Math.max(0, Math.min(1, snow));

        blendWeights1[i * 3] = grass;
        blendWeights1[i * 3 + 1] = rock;
        blendWeights1[i * 3 + 2] = dirt;

        blendWeights2[i * 3] = sand;
        blendWeights2[i * 3 + 1] = snow;
        blendWeights2[i * 3 + 2] = 0;
      }
    }

    return { blendWeights1, blendWeights2 };
  }

  private generateVegetation(
    heights: Float32Array,
    normals: Float32Array,
    originX: number,
    originZ: number,
    resolution: number,
    biome: string,
    lod: number
  ): GPUVegetationData[] {
    const { chunkSize, worldSeed } = this.config;

    const chunkX = Math.round(originX / chunkSize);
    const chunkZ = Math.round(originZ / chunkSize);

    const step = chunkSize / (resolution - 1);
    const sampleTerrain = (worldX: number, worldZ: number): TerrainSample => {
      const localX = worldX - originX;
      const localZ = worldZ - originZ;
      const gx = Math.floor(localX / step);
      const gz = Math.floor(localZ / step);

      const clampedGx = Math.max(0, Math.min(resolution - 1, gx));
      const clampedGz = Math.max(0, Math.min(resolution - 1, gz));
      const idx = clampedGz * resolution + clampedGx;

      const height = heights[idx] ?? 0;
      const normalY = normals[idx * 3 + 1] ?? 1;
      const slope = 1 - Math.abs(normalY);

      const biomeEnum = getBiomeType(this.noise!, worldX, worldZ, height, DEFAULT_BIOME_CONFIG);
      const localBiome = biomeTypeToLegacy(biomeEnum);

      return { height, slope, biome: localBiome };
    };

    const instances = generateVegetationScatter(
      chunkX,
      chunkZ,
      { worldSeed, chunkSize, lod, densityMultiplier: 1.0 },
      sampleTerrain,
    );

    const legacyInstances = toLegacyFormat(instances);

    return legacyInstances.map(inst => ({
      type: this.mapVegetationType(inst.type),
      x: originX + inst.x,
      y: inst.y,
      z: originZ + inst.z,
      scale: inst.scale,
      rotation: inst.rotation,
    }));
  }

  private mapVegetationType(
    type: "tree1" | "tree2" | "tree3" | "rock1" | "rock2" | "bush1" | "bush2" | "grass"
  ): GPUVegetationData["type"] {
    switch (type) {
      case "tree1":
      case "tree2":
      case "tree3":
        return "tree";
      case "rock1":
      case "rock2":
        return "rock";
      case "bush1":
      case "bush2":
        return "bush";
      case "grass":
        return "grass";
      default:
        return "grass";
    }
  }

  dispose(): void {
    this.renderer?.dispose();
    this.renderer = null;
    this.heightBuffer = null;
    this.normalBuffer = null;
    this.colorBuffer = null;
    this.isInitialized = false;
    this.initPromise = null;
  }
}
