import {
  Color,
  DoubleSide,
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
  Vector3,
  type Camera,
} from "three";
import { OCEAN_WATER_DEPTH_METERS } from "../../domain/models/ocean-water-depth";
import vertexShader from "../../scenes/ocean/shaders/water/gerstner.vert?raw";
import fragmentShader from "../../scenes/ocean/shaders/water/snell-window.frag?raw";

export interface OceanWaterSurfaceOptions {
  groundY?: number;
  surfaceY?: number;
  size?: number;
  segments?: number;
  opacity?: number;
  color?: string;
  skyColor?: string;
  tirDarkness?: number;
  fogColor?: string;
  fogDensity?: number;
}

export interface OceanWaterSurfaceWorld {
  object: Mesh<PlaneGeometry, ShaderMaterial>;
  update(deltaSeconds: number, camera: Camera): void;
  setGroundY(groundY: number): void;
  setFog(color: string, density: number): void;
  dispose(): void;
}

export function createOceanWaterSurface(
  options: OceanWaterSurfaceOptions = {}
): OceanWaterSurfaceWorld {
  const groundY = options.groundY ?? 0;
  const size = options.size ?? 110;
  const segments = options.segments ?? 256;
  const geometry = new PlaneGeometry(size, size, segments, segments);
  const material = new ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uSize: { value: size },
      uColor: { value: new Color(options.color ?? "#0d3050") },
      uOpacity: { value: options.opacity ?? 0.12 },
      uWaveScale: { value: 0.62 },
      uWaveSpeed: { value: 0.5 },
      uWaveAmplitude: { value: 0.34 },
      uCameraPosition: { value: new Vector3() },
      uSnellEnabled: { value: true },
      uSkyColor: { value: new Color(options.skyColor ?? "#3f7892") },
      uSunColor: { value: new Color("#ffffdd") },
      uSunSize: { value: 0.08 },
      uTirDarkness: { value: options.tirDarkness ?? 1 },
      uEdgeSoftness: { value: 0.08 },
      uNoiseScale: { value: 0.11 },
      uNoiseSpeed: { value: 0.06 },
      uNoiseAmplitude: { value: 0.085 },
      uFogColor: { value: new Color(options.fogColor ?? "#0a2438") },
      uFogDensity: { value: options.fogDensity ?? 0.026 },
    },
  });
  material.forceSinglePass = true;

  const object = new Mesh(geometry, material);
  object.name = "ocean-water-surface";
  object.rotation.x = -Math.PI / 2;
  object.position.y =
    options.surfaceY ?? groundY + OCEAN_WATER_DEPTH_METERS;

  return {
    object,
    update(deltaSeconds, camera) {
      material.uniforms.uTime!.value += deltaSeconds;
      material.uniforms.uCameraPosition!.value.copy(camera.position);
    },
    setGroundY(nextGroundY) {
      object.position.y = nextGroundY + OCEAN_WATER_DEPTH_METERS;
    },
    setFog(color, density) {
      material.uniforms.uFogColor!.value.set(color);
      material.uniforms.uFogDensity!.value = density;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
