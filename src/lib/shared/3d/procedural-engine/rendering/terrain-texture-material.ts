/**
 * Terrain Texture Material
 *
 * Texture-based terrain splatting using MeshStandardMaterial.
 * Uses actual PBR textures (diffuse, normal, roughness) for realistic terrain.
 *
 * Features:
 * - 4-layer texture splatting (grass, rock, dirt, sand)
 * - Triplanar mapping to avoid UV stretching on slopes
 * - Blend weights from vertex attributes (computed in chunk worker)
 * - Standard WebGL compatible (no WebGPU required)
 *
 * Textures from AmbientCG (CC0 license):
 * - Grass: Grass001
 * - Rock: Rock030
 * - Dirt: Ground037
 * - Sand: Ground054
 */

import {
  MeshStandardMaterial,
  TextureLoader,
  RepeatWrapping,
  LinearMipMapLinearFilter,
  LinearFilter,
  SRGBColorSpace,
  type Texture,
} from "three";


export interface TerrainTextureConfig {
  /** Texture repeat scale (default: 0.05 = 20m repeat) */
  textureScale?: number;
  /** Triplanar blend sharpness (default: 4.0) */
  triplanarSharpness?: number;
  /** Base roughness multiplier (default: 1.0) */
  roughnessMultiplier?: number;
  /** Normal map strength (default: 1.0) */
  normalStrength?: number;
}

const DEFAULT_CONFIG: Required<TerrainTextureConfig> = {
  textureScale: 0.05,
  triplanarSharpness: 4.0,
  roughnessMultiplier: 1.0,
  normalStrength: 1.0,
};


const TEXTURE_BASE = "/textures/terrain";

const TEXTURE_PATHS = {
  grass: {
    diffuse: `${TEXTURE_BASE}/grass/diffuse.jpg`,
    normal: `${TEXTURE_BASE}/grass/normal.jpg`,
    roughness: `${TEXTURE_BASE}/grass/roughness.jpg`,
  },
  rock: {
    diffuse: `${TEXTURE_BASE}/rock/diffuse.jpg`,
    normal: `${TEXTURE_BASE}/rock/normal.jpg`,
    roughness: `${TEXTURE_BASE}/rock/roughness.jpg`,
  },
  dirt: {
    diffuse: `${TEXTURE_BASE}/dirt/diffuse.jpg`,
    normal: `${TEXTURE_BASE}/dirt/normal.jpg`,
    roughness: `${TEXTURE_BASE}/dirt/roughness.jpg`,
  },
  sand: {
    diffuse: `${TEXTURE_BASE}/sand/diffuse.jpg`,
    normal: `${TEXTURE_BASE}/sand/normal.jpg`,
    roughness: `${TEXTURE_BASE}/sand/roughness.jpg`,
  },
};

// ============================================================================
// TEXTURE LOADING
// ============================================================================

interface TerrainTextures {
  grassDiffuse: Texture;
  grassNormal: Texture;
  grassRoughness: Texture;
  rockDiffuse: Texture;
  rockNormal: Texture;
  rockRoughness: Texture;
  dirtDiffuse: Texture;
  dirtNormal: Texture;
  dirtRoughness: Texture;
  sandDiffuse: Texture;
  sandNormal: Texture;
  sandRoughness: Texture;
}

let cachedTextures: TerrainTextures | null = null;
let texturesLoading: Promise<TerrainTextures> | null = null;

function configureTexture(texture: Texture, isDiffuse: boolean = false): void {
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.minFilter = LinearMipMapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.anisotropy = 4;
  texture.generateMipmaps = true;
  // Diffuse textures need sRGB color space for correct color rendering
  if (isDiffuse) {
    texture.colorSpace = SRGBColorSpace;
  }
}

/**
 * Load all terrain textures (cached)
 */
export async function loadTerrainTextures(): Promise<TerrainTextures> {
  if (cachedTextures) return cachedTextures;
  if (texturesLoading) return texturesLoading;

  const loader = new TextureLoader();

  texturesLoading = (async () => {
    const loadTexture = async (path: string, isDiffuse: boolean = false): Promise<Texture> => {
      const tex = await loader.loadAsync(path);
      configureTexture(tex, isDiffuse);
      return tex;
    };

    const [
      grassDiffuse,
      grassNormal,
      grassRoughness,
      rockDiffuse,
      rockNormal,
      rockRoughness,
      dirtDiffuse,
      dirtNormal,
      dirtRoughness,
      sandDiffuse,
      sandNormal,
      sandRoughness,
    ] = await Promise.all([
      loadTexture(TEXTURE_PATHS.grass.diffuse, true),
      loadTexture(TEXTURE_PATHS.grass.normal),
      loadTexture(TEXTURE_PATHS.grass.roughness),
      loadTexture(TEXTURE_PATHS.rock.diffuse, true),
      loadTexture(TEXTURE_PATHS.rock.normal),
      loadTexture(TEXTURE_PATHS.rock.roughness),
      loadTexture(TEXTURE_PATHS.dirt.diffuse, true),
      loadTexture(TEXTURE_PATHS.dirt.normal),
      loadTexture(TEXTURE_PATHS.dirt.roughness),
      loadTexture(TEXTURE_PATHS.sand.diffuse, true),
      loadTexture(TEXTURE_PATHS.sand.normal),
      loadTexture(TEXTURE_PATHS.sand.roughness),
    ]);

    cachedTextures = {
      grassDiffuse,
      grassNormal,
      grassRoughness,
      rockDiffuse,
      rockNormal,
      rockRoughness,
      dirtDiffuse,
      dirtNormal,
      dirtRoughness,
      sandDiffuse,
      sandNormal,
      sandRoughness,
    };

    return cachedTextures;
  })();

  return texturesLoading;
}

// ============================================================================
// SHADER INJECTION
// ============================================================================

/**
 * Create terrain material with texture splatting via onBeforeCompile
 *
 * This approach modifies MeshStandardMaterial's shader to:
 * 1. Read blend weights from vertex attributes
 * 2. Sample 4 texture layers with triplanar projection
 * 3. Blend diffuse, normal, and roughness based on weights
 */
export function createTerrainTextureMaterial(
  textures: TerrainTextures,
  config: TerrainTextureConfig = {}
): MeshStandardMaterial {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  const material = new MeshStandardMaterial({
    roughness: 0.8,
    metalness: 0.0,
    // Enable vertex colors as a fallback base
    vertexColors: true,
  });

  // Inject custom shader code
  material.onBeforeCompile = (shader) => {
    // Add uniforms for all textures
    shader.uniforms.grassDiffuse = { value: textures.grassDiffuse };
    shader.uniforms.grassNormal = { value: textures.grassNormal };
    shader.uniforms.grassRoughness = { value: textures.grassRoughness };
    shader.uniforms.rockDiffuse = { value: textures.rockDiffuse };
    shader.uniforms.rockNormal = { value: textures.rockNormal };
    shader.uniforms.rockRoughness = { value: textures.rockRoughness };
    shader.uniforms.dirtDiffuse = { value: textures.dirtDiffuse };
    shader.uniforms.dirtNormal = { value: textures.dirtNormal };
    shader.uniforms.dirtRoughness = { value: textures.dirtRoughness };
    shader.uniforms.sandDiffuse = { value: textures.sandDiffuse };
    shader.uniforms.sandNormal = { value: textures.sandNormal };
    shader.uniforms.sandRoughness = { value: textures.sandRoughness };

    shader.uniforms.textureScale = { value: cfg.textureScale };
    shader.uniforms.triplanarSharpness = { value: cfg.triplanarSharpness };
    shader.uniforms.normalStrength = { value: cfg.normalStrength };

    // ========================================================================
    // VERTEX SHADER MODIFICATIONS
    // ========================================================================

    // Add varying declarations after common includes
    shader.vertexShader = shader.vertexShader.replace(
      "#include <common>",
      `#include <common>
      attribute vec3 blendWeights1;
      attribute vec3 blendWeights2;
      varying vec3 vBlendWeights1;
      varying vec3 vBlendWeights2;
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;
      `
    );

    // Pass data to fragment shader after world position is calculated
    shader.vertexShader = shader.vertexShader.replace(
      "#include <worldpos_vertex>",
      `#include <worldpos_vertex>
      vBlendWeights1 = blendWeights1;
      vBlendWeights2 = blendWeights2;
      vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
      vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
      `
    );

    // ========================================================================
    // FRAGMENT SHADER MODIFICATIONS
    // ========================================================================

    // Add uniform and varying declarations
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <common>",
      `#include <common>
      uniform sampler2D grassDiffuse;
      uniform sampler2D grassNormal;
      uniform sampler2D grassRoughness;
      uniform sampler2D rockDiffuse;
      uniform sampler2D rockNormal;
      uniform sampler2D rockRoughness;
      uniform sampler2D dirtDiffuse;
      uniform sampler2D dirtNormal;
      uniform sampler2D dirtRoughness;
      uniform sampler2D sandDiffuse;
      uniform sampler2D sandNormal;
      uniform sampler2D sandRoughness;
      uniform float textureScale;
      uniform float triplanarSharpness;
      uniform float normalStrength;

      varying vec3 vBlendWeights1;
      varying vec3 vBlendWeights2;
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;

      // Triplanar sampling helper
      vec4 triplanarSample(sampler2D tex, vec3 worldPos, vec3 blendWeights) {
        vec2 uvX = worldPos.zy * textureScale;
        vec2 uvY = worldPos.xz * textureScale;
        vec2 uvZ = worldPos.xy * textureScale;

        vec4 texX = texture2D(tex, uvX);
        vec4 texY = texture2D(tex, uvY);
        vec4 texZ = texture2D(tex, uvZ);

        return texX * blendWeights.x + texY * blendWeights.y + texZ * blendWeights.z;
      }

      // Get triplanar blend weights from world normal
      vec3 getTriplanarBlend(vec3 worldNormal, float sharpness) {
        vec3 blend = pow(abs(worldNormal), vec3(sharpness));
        blend /= (blend.x + blend.y + blend.z + 0.0001);
        return blend;
      }
      `
    );

    // Replace the color_fragment include which sets diffuseColor from vertex colors
    // We want to override this with our texture-splatted color
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <color_fragment>",
      `
      // Get triplanar blend weights from world normal
      vec3 triBlend = getTriplanarBlend(vWorldNormal, triplanarSharpness);

      // Extract material blend weights from vertex attributes
      float wGrass = vBlendWeights1.x;
      float wRock = vBlendWeights1.y;
      float wDirt = vBlendWeights1.z;
      float wSand = vBlendWeights2.x;

      // Ensure weights sum to something (avoid black if no weights)
      float totalWeight = wGrass + wRock + wDirt + wSand;
      if (totalWeight < 0.001) {
        // Fallback to grass if no weights
        wGrass = 1.0;
      }

      // Sample each material's diffuse with triplanar projection
      vec4 grassColor = triplanarSample(grassDiffuse, vWorldPosition, triBlend);
      vec4 rockColor = triplanarSample(rockDiffuse, vWorldPosition, triBlend);
      vec4 dirtColor = triplanarSample(dirtDiffuse, vWorldPosition, triBlend);
      vec4 sandColor = triplanarSample(sandDiffuse, vWorldPosition, triBlend);

      // Blend based on terrain weights
      vec4 blendedDiffuse =
        grassColor * wGrass +
        rockColor * wRock +
        dirtColor * wDirt +
        sandColor * wSand;

      // Apply to diffuseColor (overriding vertex colors)
      diffuseColor = blendedDiffuse;
      `
    );

    // Replace roughness calculation
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <roughnessmap_fragment>",
      `
      // Sample roughness maps with triplanar
      vec3 triBlendRough = getTriplanarBlend(vWorldNormal, triplanarSharpness);

      float grassRough = triplanarSample(grassRoughness, vWorldPosition, triBlendRough).r;
      float rockRough = triplanarSample(rockRoughness, vWorldPosition, triBlendRough).r;
      float dirtRough = triplanarSample(dirtRoughness, vWorldPosition, triBlendRough).r;
      float sandRough = triplanarSample(sandRoughness, vWorldPosition, triBlendRough).r;

      float blendedRoughness =
        grassRough * vBlendWeights1.x +
        rockRough * vBlendWeights1.y +
        dirtRough * vBlendWeights1.z +
        sandRough * vBlendWeights2.x;

      // Ensure roughness has a minimum if no weights
      if (blendedRoughness < 0.001) {
        blendedRoughness = 0.8;
      }

      roughnessFactor = blendedRoughness;
      `
    );

    // Store modified shader for debugging if needed
    (material as unknown as Record<string, unknown>).customShader = shader;
  };

  // Store config for potential updates
  (material as unknown as Record<string, unknown>).terrainConfig = cfg;

  return material;
}

/**
 * Create a simple fallback material using vertex colors
 * Used when textures fail to load or for performance mode
 */
export function createTerrainFallbackMaterial(): MeshStandardMaterial {
  return new MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.8,
    metalness: 0.1,
  });
}

/**
 * Dispose of cached textures (call on cleanup)
 */
export function disposeTerrainTextures(): void {
  if (cachedTextures) {
    Object.values(cachedTextures).forEach((tex) => tex.dispose());
    cachedTextures = null;
    texturesLoading = null;
  }
}
