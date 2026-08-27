/**
 * Drainage-Based Water Renderer
 *
 * Creates realistic water surfaces that follow terrain topology.
 * Uses a custom shader with:
 * - Gerstner wave displacement for realistic wave shapes
 * - Animated normal maps for surface detail
 * - Fresnel-based reflection/refraction blending
 * - Depth-based color absorption
 *
 * References:
 * - GPU Gems Ch.1: Effective Water Simulation from Physical Models
 * - Water Flow in Portal 2 (Vlachos, SIGGRAPH 2010)
 * - three.js Water2 shader
 */

import {
  BufferGeometry,
  Float32BufferAttribute,
  Uint32BufferAttribute,
  Mesh,
  Color,
  ShaderMaterial,
  type Scene,
  DoubleSide,
  Vector3,
  TextureLoader,
  RepeatWrapping,
  type Texture,
  UniformsUtils,
} from "three";
import type { DrainageData } from "../generation/gpu/terrain-compute-types";


export interface DrainageWaterConfig {
  /** Base water color (deep water) */
  deepColor: string;
  /** Shallow water color */
  shallowColor: string;
  /** Reflection tint color (sky/environment) */
  reflectionColor: string;
  /** Base opacity for shallow water */
  shallowOpacity: number;
  /** Opacity for deep water */
  deepOpacity: number;
  /** Height offset above terrain for water surface */
  surfaceOffset: number;
  /** Ocean level (from biome config) */
  oceanLevel: number;
  /** Enable animated waves */
  enableWaves: boolean;
  /** Wave amplitude (vertical displacement in meters) */
  waveAmplitude: number;
  /** Wave steepness (0 = sine, 1 = sharp crests) */
  waveSteepness: number;
  /** Wave speed multiplier */
  waveSpeed: number;
  /** Normal map scale (UV tiling) */
  normalMapScale: number;
  /** Normal map strength (0-1) */
  normalStrength: number;
  /** Reflectivity at perpendicular view (Fresnel R0) */
  reflectivity: number;
  /** Refraction distortion strength */
  refractionStrength: number;
  /** Specular highlight intensity */
  specularIntensity: number;
  /** Specular highlight size (shininess) */
  specularPower: number;
}

interface ChunkWaterMesh {
  mesh: Mesh;
  chunkX: number;
  chunkZ: number;
  bounds: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  };
}

// DEFAULT CONFIG - Tuned for realistic lake/pond water

const DEFAULT_DRAINAGE_WATER_CONFIG: DrainageWaterConfig = {
  deepColor: "#0a4d5c",
  shallowColor: "#4da6b8",
  reflectionColor: "#87ceeb", // Sky blue for reflections
  shallowOpacity: 0.6,
  deepOpacity: 0.85,
  surfaceOffset: 0.15,
  oceanLevel: -10,
  enableWaves: true,
  waveAmplitude: 0.12, // 12cm waves
  waveSteepness: 0.4, // Moderate crest sharpness
  waveSpeed: 0.8,
  normalMapScale: 8.0, // Tiles per chunk
  normalStrength: 0.5,
  reflectivity: 0.02, // Water's Fresnel R0 ≈ 0.02
  refractionStrength: 0.03,
  specularIntensity: 1.2,
  specularPower: 256.0,
};


const WaterShader = {
  uniforms: {
    uTime: { value: 0 },
    uDeepColor: { value: new Color(0x0a4d5c) },
    uShallowColor: { value: new Color(0x4da6b8) },
    uReflectionColor: { value: new Color(0x87ceeb) },
    uSunDirection: { value: new Vector3(0.5, 0.7, 0.5).normalize() },
    uSunColor: { value: new Color(0xffffee) },
    uWaveAmplitude: { value: 0.12 },
    uWaveSteepness: { value: 0.4 },
    uWaveSpeed: { value: 0.8 },
    uNormalMap0: { value: null as Texture | null },
    uNormalMap1: { value: null as Texture | null },
    uNormalMapScale: { value: 8.0 },
    uNormalStrength: { value: 0.5 },
    uReflectivity: { value: 0.02 },
    uRefractionStrength: { value: 0.03 },
    uSpecularIntensity: { value: 1.2 },
    uSpecularPower: { value: 256.0 },
    uOpacity: { value: 0.8 },
  },

  vertexShader: /* glsl */ `
    uniform float uTime;
    uniform float uWaveAmplitude;
    uniform float uWaveSteepness;
    uniform float uWaveSpeed;

    varying vec3 vWorldPosition;
    varying vec3 vWorldNormal;
    varying vec3 vViewDirection;
    varying vec2 vUv;
    varying vec3 vVertexColor;
    varying float vWaveHeight;

    // Gerstner wave function
    // Returns vec3: xy = horizontal displacement, z = vertical displacement
    vec3 gerstnerWave(vec2 pos, float amplitude, float steepness, vec2 direction, float frequency, float speed, float time) {
      float k = 2.0 * 3.14159 * frequency;
      float c = speed / k;
      vec2 d = normalize(direction);
      float f = k * (dot(d, pos) - c * time);
      float a = steepness / k;

      return vec3(
        d.x * a * cos(f),
        d.y * a * cos(f),
        amplitude * sin(f)
      );
    }

    void main() {
      vVertexColor = color;
      vUv = uv;

      // Get world position for wave calculation
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vec2 pos2D = worldPos.xz;

      // Sum multiple Gerstner waves for natural appearance
      vec3 displacement = vec3(0.0);

      if (uWaveAmplitude > 0.001) {
        // Wave 1: Primary swell (low frequency, high amplitude)
        displacement += gerstnerWave(
          pos2D,
          uWaveAmplitude,
          uWaveSteepness,
          vec2(1.0, 0.3),
          0.08,
          uWaveSpeed * 1.0,
          uTime
        );

        // Wave 2: Secondary swell (different direction)
        displacement += gerstnerWave(
          pos2D,
          uWaveAmplitude * 0.5,
          uWaveSteepness * 0.8,
          vec2(-0.4, 1.0),
          0.12,
          uWaveSpeed * 1.3,
          uTime
        );

        // Wave 3: Cross chop
        displacement += gerstnerWave(
          pos2D,
          uWaveAmplitude * 0.3,
          uWaveSteepness * 0.6,
          vec2(0.7, -0.7),
          0.2,
          uWaveSpeed * 0.9,
          uTime
        );

        // Wave 4: Small ripples
        displacement += gerstnerWave(
          pos2D,
          uWaveAmplitude * 0.15,
          uWaveSteepness * 0.4,
          vec2(-1.0, 0.2),
          0.35,
          uWaveSpeed * 1.6,
          uTime
        );
      }

      // Apply displacement
      vec3 newPosition = position;
      newPosition.x += displacement.x;
      newPosition.z += displacement.y;
      newPosition.y += displacement.z;

      vWaveHeight = displacement.z;

      // Calculate world position and normal
      vec4 finalWorldPos = modelMatrix * vec4(newPosition, 1.0);
      vWorldPosition = finalWorldPos.xyz;

      // Transform normal (approximation - proper would recalculate from displaced neighbors)
      vWorldNormal = normalize(normalMatrix * normal);

      // View direction for Fresnel
      vViewDirection = normalize(cameraPosition - finalWorldPos.xyz);

      gl_Position = projectionMatrix * viewMatrix * finalWorldPos;
    }
  `,

  fragmentShader: /* glsl */ `
    uniform float uTime;
    uniform vec3 uDeepColor;
    uniform vec3 uShallowColor;
    uniform vec3 uReflectionColor;
    uniform vec3 uSunDirection;
    uniform vec3 uSunColor;
    uniform sampler2D uNormalMap0;
    uniform sampler2D uNormalMap1;
    uniform float uNormalMapScale;
    uniform float uNormalStrength;
    uniform float uReflectivity;
    uniform float uRefractionStrength;
    uniform float uSpecularIntensity;
    uniform float uSpecularPower;
    uniform float uOpacity;

    varying vec3 vWorldPosition;
    varying vec3 vWorldNormal;
    varying vec3 vViewDirection;
    varying vec2 vUv;
    varying vec3 vVertexColor;
    varying float vWaveHeight;

    // Fresnel-Schlick approximation
    float fresnel(vec3 viewDir, vec3 normal, float R0) {
      float cosTheta = max(dot(viewDir, normal), 0.0);
      return R0 + (1.0 - R0) * pow(1.0 - cosTheta, 5.0);
    }

    void main() {
      // Animated UV offsets for normal maps (flow effect)
      float flowSpeed = 0.02;
      vec2 flow1 = vec2(uTime * flowSpeed * 0.7, uTime * flowSpeed * 0.3);
      vec2 flow2 = vec2(-uTime * flowSpeed * 0.5, uTime * flowSpeed * 0.8);

      // Scale UVs based on world position for seamless tiling across chunks
      vec2 worldUV = vWorldPosition.xz * 0.1 * uNormalMapScale;

      // Sample two normal maps with different flow directions
      vec3 normal0 = vec3(0.0, 1.0, 0.0);
      vec3 normal1 = vec3(0.0, 1.0, 0.0);

      #ifdef USE_NORMAL_MAPS
        normal0 = texture2D(uNormalMap0, worldUV + flow1).rgb * 2.0 - 1.0;
        normal1 = texture2D(uNormalMap1, worldUV * 0.8 + flow2).rgb * 2.0 - 1.0;
      #endif

      // Blend normal maps
      vec3 blendedNormal = normalize(normal0 + normal1);

      // Mix with geometric normal
      vec3 N = normalize(vWorldNormal);
      vec3 perturbedNormal = normalize(mix(
        N,
        normalize(vec3(blendedNormal.x, blendedNormal.z, blendedNormal.y)),
        uNormalStrength
      ));

      // View direction
      vec3 V = normalize(vViewDirection);

      // Fresnel reflectance
      float F = fresnel(V, perturbedNormal, uReflectivity);

      // Depth-based water color (from vertex colors)
      // vVertexColor encodes depth: more blue = deeper
      float depthFactor = 1.0 - vVertexColor.r; // Invert red channel as depth proxy
      vec3 waterColor = mix(uShallowColor, uDeepColor, depthFactor * 0.5 + 0.3);

      // Add wave height influence on color
      waterColor = mix(waterColor, uShallowColor, clamp(vWaveHeight * 3.0 + 0.5, 0.0, 0.3));

      // Reflection color (simplified - using constant sky color)
      vec3 reflectionColor = uReflectionColor;

      // Add some variation to reflection based on view angle
      reflectionColor = mix(reflectionColor, uDeepColor, (1.0 - F) * 0.3);

      // Specular highlight (sun reflection)
      vec3 L = normalize(uSunDirection);
      vec3 H = normalize(L + V);
      float NdotH = max(dot(perturbedNormal, H), 0.0);
      float specular = pow(NdotH, uSpecularPower) * uSpecularIntensity;

      // Only show specular where sun would hit
      float NdotL = max(dot(perturbedNormal, L), 0.0);
      specular *= NdotL;

      // Final color: blend refraction (water color) and reflection based on Fresnel
      vec3 finalColor = mix(waterColor, reflectionColor, F);

      // Add specular highlight
      finalColor += uSunColor * specular;

      // Slight blue tint for underwater feeling
      finalColor = mix(finalColor, vec3(0.1, 0.3, 0.5), 0.05);

      // Output with opacity
      float finalOpacity = mix(0.7, uOpacity, depthFactor);
      gl_FragColor = vec4(finalColor, finalOpacity);

      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `,
};


export class DrainageWaterManager {
  private scene: Scene;
  private config: DrainageWaterConfig;
  private waterMeshes: Map<string, ChunkWaterMesh> = new Map();
  private sharedMaterial: ShaderMaterial;
  private normalMap0: Texture | null = null;
  private normalMap1: Texture | null = null;

  constructor(scene: Scene, config: Partial<DrainageWaterConfig> = {}) {
    this.scene = scene;
    this.config = { ...DEFAULT_DRAINAGE_WATER_CONFIG, ...config };

    // Create shared shader material
    this.sharedMaterial = this.createWaterMaterial();

    this.loadNormalMaps();
  }

  /**
   * Load water normal maps for surface detail
   */
  private loadNormalMaps(): void {
    const loader = new TextureLoader();

    // Use three.js built-in water normal maps
    // These are shipped with three.js examples
    const normalMapPath0 = "/textures/water/Water_1_M_Normal.jpg";
    const normalMapPath1 = "/textures/water/Water_2_M_Normal.jpg";

    loader.load(
      normalMapPath0,
      (texture) => {
        texture.wrapS = texture.wrapT = RepeatWrapping;
        this.normalMap0 = texture;
        if (this.sharedMaterial.uniforms.uNormalMap0) {
          this.sharedMaterial.uniforms.uNormalMap0.value = texture;
        }
        this.sharedMaterial.defines = this.sharedMaterial.defines || {};
        this.sharedMaterial.defines.USE_NORMAL_MAPS = "";
        this.sharedMaterial.needsUpdate = true;
      },
      undefined,
      () => {
        console.warn("[DrainageWater] Normal map 0 not found, using flat normals");
      }
    );

    loader.load(
      normalMapPath1,
      (texture) => {
        texture.wrapS = texture.wrapT = RepeatWrapping;
        this.normalMap1 = texture;
        if (this.sharedMaterial.uniforms.uNormalMap1) {
          this.sharedMaterial.uniforms.uNormalMap1.value = texture;
        }
        this.sharedMaterial.needsUpdate = true;
      },
      undefined,
      () => {
        console.warn("[DrainageWater] Normal map 1 not found, using flat normals");
      }
    );
  }

  private createWaterMaterial(): ShaderMaterial {
    const material = new ShaderMaterial({
      uniforms: UniformsUtils.clone(WaterShader.uniforms),
      vertexShader: WaterShader.vertexShader,
      fragmentShader: WaterShader.fragmentShader,
      transparent: true,
      side: DoubleSide,
      vertexColors: true,
    });

    // Apply config values to uniforms
    if (material.uniforms.uDeepColor) {
      material.uniforms.uDeepColor.value = new Color(this.config.deepColor);
    }
    if (material.uniforms.uShallowColor) {
      material.uniforms.uShallowColor.value = new Color(this.config.shallowColor);
    }
    if (material.uniforms.uReflectionColor) {
      material.uniforms.uReflectionColor.value = new Color(this.config.reflectionColor);
    }
    if (material.uniforms.uWaveAmplitude) {
      material.uniforms.uWaveAmplitude.value = this.config.enableWaves ? this.config.waveAmplitude : 0;
    }
    if (material.uniforms.uWaveSteepness) {
      material.uniforms.uWaveSteepness.value = this.config.waveSteepness;
    }
    if (material.uniforms.uWaveSpeed) {
      material.uniforms.uWaveSpeed.value = this.config.waveSpeed;
    }
    if (material.uniforms.uNormalMapScale) {
      material.uniforms.uNormalMapScale.value = this.config.normalMapScale;
    }
    if (material.uniforms.uNormalStrength) {
      material.uniforms.uNormalStrength.value = this.config.normalStrength;
    }
    if (material.uniforms.uReflectivity) {
      material.uniforms.uReflectivity.value = this.config.reflectivity;
    }
    if (material.uniforms.uRefractionStrength) {
      material.uniforms.uRefractionStrength.value = this.config.refractionStrength;
    }
    if (material.uniforms.uSpecularIntensity) {
      material.uniforms.uSpecularIntensity.value = this.config.specularIntensity;
    }
    if (material.uniforms.uSpecularPower) {
      material.uniforms.uSpecularPower.value = this.config.specularPower;
    }
    if (material.uniforms.uOpacity) {
      material.uniforms.uOpacity.value = this.config.deepOpacity;
    }

    return material;
  }

  /**
   * Create water mesh for a chunk based on drainage data
   */
  createChunkWater(
    chunkX: number,
    chunkZ: number,
    chunkSize: number,
    resolution: number,
    drainage: DrainageData,
    terrainHeights: Float32Array
  ): void {
    const key = `${chunkX},${chunkZ}`;

    if (!drainage.waterBounds.hasWater) {
      return;
    }

    this.removeChunkWater(chunkX, chunkZ);

    const geometry = this.buildWaterGeometry(
      chunkX,
      chunkZ,
      chunkSize,
      resolution,
      drainage,
      terrainHeights
    );

    if (!geometry) {
      return;
    }

    const mesh = new Mesh(geometry, this.sharedMaterial);
    mesh.renderOrder = 100;

    this.scene.add(mesh);

    const originX = chunkX * chunkSize;
    const originZ = chunkZ * chunkSize;
    const step = chunkSize / (resolution - 1);

    this.waterMeshes.set(key, {
      mesh,
      chunkX,
      chunkZ,
      bounds: {
        minX: originX + drainage.waterBounds.minX * step,
        maxX: originX + drainage.waterBounds.maxX * step,
        minZ: originZ + drainage.waterBounds.minZ * step,
        maxZ: originZ + drainage.waterBounds.maxZ * step,
      },
    });
  }

  /**
   * Build water geometry from drainage data
   */
  private buildWaterGeometry(
    chunkX: number,
    chunkZ: number,
    chunkSize: number,
    resolution: number,
    drainage: DrainageData,
    terrainHeights: Float32Array
  ): BufferGeometry | null {
    const { waterMask, waterDepth } = drainage;
    const step = chunkSize / (resolution - 1);
    const originX = chunkX * chunkSize;
    const originZ = chunkZ * chunkSize;

    const vertexMap = new Int32Array(resolution * resolution).fill(-1);
    let waterVertexCount = 0;

    for (let z = 0; z < resolution; z++) {
      for (let x = 0; x < resolution; x++) {
        const idx = z * resolution + x;
        if (waterMask[idx]! > 0.1) {
          vertexMap[idx] = waterVertexCount++;
        }
      }
    }

    if (waterVertexCount === 0) {
      return null;
    }

    const positions = new Float32Array(waterVertexCount * 3);
    const normals = new Float32Array(waterVertexCount * 3);
    const colors = new Float32Array(waterVertexCount * 3);
    const uvs = new Float32Array(waterVertexCount * 2);
    const maxWaterHeight = this.config.oceanLevel + 5;

    const deepColor = new Color(this.config.deepColor);
    const shallowColor = new Color(this.config.shallowColor);

    let vertIdx = 0;
    for (let z = 0; z < resolution; z++) {
      for (let x = 0; x < resolution; x++) {
        const idx = z * resolution + x;
        const waterVal = waterMask[idx]!;

        if (waterVal > 0.1) {
          const worldX = originX + x * step;
          const worldZ = originZ + z * step;
          const terrainHeight = terrainHeights[idx]!;
          const depth = waterDepth[idx]!;

          const waterSurfaceY =
            waterVal < 1.0
              ? terrainHeight + depth * waterVal + this.config.surfaceOffset
              : maxWaterHeight + this.config.surfaceOffset;

          positions[vertIdx * 3] = worldX;
          positions[vertIdx * 3 + 1] = waterSurfaceY;
          positions[vertIdx * 3 + 2] = worldZ;

          // Initial normals pointing up (will be perturbed in shader)
          normals[vertIdx * 3] = 0;
          normals[vertIdx * 3 + 1] = 1;
          normals[vertIdx * 3 + 2] = 0;

          // UVs based on grid position
          uvs[vertIdx * 2] = x / (resolution - 1);
          uvs[vertIdx * 2 + 1] = z / (resolution - 1);

          // Color encodes depth for shader
          const depthFactor = Math.min(1, depth / 5);
          const color = shallowColor.clone().lerp(deepColor, depthFactor);
          colors[vertIdx * 3] = color.r;
          colors[vertIdx * 3 + 1] = color.g;
          colors[vertIdx * 3 + 2] = color.b;

          vertIdx++;
        }
      }
    }

    const indices: number[] = [];

    for (let z = 0; z < resolution - 1; z++) {
      for (let x = 0; x < resolution - 1; x++) {
        const idx = z * resolution + x;
        const v00 = vertexMap[idx]!;
        const v10 = vertexMap[idx + 1]!;
        const v01 = vertexMap[idx + resolution]!;
        const v11 = vertexMap[idx + resolution + 1]!;

        if (v00 < 0 || v10 < 0 || v01 < 0 || v11 < 0) {
          continue;
        }

        indices.push(v00, v01, v10);
        indices.push(v10, v01, v11);
      }
    }

    if (indices.length === 0) {
      return null;
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
    geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3));
    geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
    geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
    geometry.setIndex(new Uint32BufferAttribute(new Uint32Array(indices), 1));

    return geometry;
  }

  /**
   * Remove water mesh for a chunk
   */
  removeChunkWater(chunkX: number, chunkZ: number): void {
    const key = `${chunkX},${chunkZ}`;
    const chunkWater = this.waterMeshes.get(key);

    if (chunkWater) {
      this.scene.remove(chunkWater.mesh);
      chunkWater.mesh.geometry.dispose();
      this.waterMeshes.delete(key);
    }
  }

  /**
   * Update water animation
   */
  update(time: number, _cameraX: number, _cameraZ: number): void {
    if (this.sharedMaterial.uniforms.uTime) {
      this.sharedMaterial.uniforms.uTime.value = time;
    }
  }

  /**
   * Set sun direction for specular highlights
   */
  setSunDirection(direction: Vector3): void {
    if (this.sharedMaterial.uniforms.uSunDirection) {
      this.sharedMaterial.uniforms.uSunDirection.value.copy(direction).normalize();
    }
  }

  /**
   * Set sun color
   */
  setSunColor(color: Color): void {
    if (this.sharedMaterial.uniforms.uSunColor) {
      this.sharedMaterial.uniforms.uSunColor.value.copy(color);
    }
  }

  /**
   * Set ocean level and recreate affected water
   */
  setOceanLevel(level: number): void {
    this.config.oceanLevel = level;
  }

  /**
   * Toggle water visibility
   */
  setVisible(visible: boolean): void {
    for (const chunkWater of this.waterMeshes.values()) {
      chunkWater.mesh.visible = visible;
    }
  }

  /**
   * Get statistics
   */
  getStats(): { chunkCount: number; totalVertices: number } {
    let totalVertices = 0;
    for (const chunkWater of this.waterMeshes.values()) {
      totalVertices += chunkWater.mesh.geometry.attributes.position?.count ?? 0;
    }
    return {
      chunkCount: this.waterMeshes.size,
      totalVertices,
    };
  }

  /**
   * Dispose all resources
   */
  dispose(): void {
    for (const chunkWater of this.waterMeshes.values()) {
      this.scene.remove(chunkWater.mesh);
      chunkWater.mesh.geometry.dispose();
    }
    this.waterMeshes.clear();
    this.sharedMaterial.dispose();
    this.normalMap0?.dispose();
    this.normalMap1?.dispose();
  }
}
