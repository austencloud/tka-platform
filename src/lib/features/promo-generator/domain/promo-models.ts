/**
 * Promo Generator Domain Models
 *
 * Core types for the 3D device mockup video generator.
 */

import type * as THREE from "three";


/**
 * Supported device types for mockups
 */
export type DeviceType =
  // Only iphone-16.glb ships in static/models (the others were never committed —
  // "moved to R2" removed them). "custom" marks a user-uploaded .glb/.gltf.
  | "iphone-16"
  | "custom";

/**
 * Device configuration including model path and screen mesh info
 */
export interface DeviceConfig {
  /** Unique device identifier */
  id: DeviceType;
  /** Human-readable device name */
  name: string;
  /** Path to the GLB/GLTF model file */
  modelPath: string;
  /** Name of the screen mesh in the model (for texture mapping) */
  screenMeshName: string;
  /** Default screen aspect ratio (width/height) */
  screenAspectRatio: number;
  /** Screen UV mapping configuration */
  screenUV?: {
    flipX?: boolean;
    flipY?: boolean;
    rotation?: number;
  };
}


/**
 * Environment/lighting presets
 */
export type EnvironmentType =
  | "studio"
  | "gradient"
  | "space"
  | "sunset"
  | "custom";

/**
 * Environment configuration
 */
export interface EnvironmentConfig {
  /** Environment type identifier */
  type: EnvironmentType;
  /** Path to HDR environment map (optional) */
  hdrPath?: string;
  /** Solid background color (CSS color string) */
  backgroundColor?: string;
  /** Gradient colors [top, bottom] */
  gradientColors?: [string, string];
  /** Environment intensity multiplier */
  intensity?: number;
  /** Whether background is transparent (for compositing) */
  transparent?: boolean;
}


/**
 * Camera state at a specific point in time
 */
export interface CameraState {
  /** Camera position [x, y, z] */
  position: [number, number, number];
  /** Point the camera looks at [x, y, z] */
  lookAt: [number, number, number];
  /** Field of view in degrees */
  fov?: number;
}

/**
 * Device state at a specific point in time
 */
export interface DeviceState {
  /** Device rotation in radians [x, y, z] */
  rotation: [number, number, number];
  /** Device position [x, y, z] */
  position: [number, number, number];
  /** Device scale (uniform) */
  scale?: number;
}

/**
 * A single keyframe in the animation timeline
 */
export interface AnimationKeyframe {
  /** Time position (0-1 normalized, or seconds if useSeconds=true) */
  time: number;
  /** Camera state at this keyframe */
  camera?: Partial<CameraState>;
  /** Device state at this keyframe */
  device?: Partial<DeviceState>;
  /** Screenshot to display at this keyframe (path or data URL) */
  screenshot?: string;
  /** Easing function name (e.g., "power2.inOut", "sine.out") */
  easing?: string;
}

/**
 * Animation preset definition
 */
export interface AnimationPreset {
  /** Unique preset identifier */
  id: string;
  /** Human-readable preset name */
  name: string;
  /** Description of the animation style */
  description: string;
  /** Total animation duration in seconds */
  duration: number;
  /** Array of keyframes defining the animation */
  keyframes: AnimationKeyframe[];
  /** Default camera state */
  defaultCamera: CameraState;
  /** Default device state */
  defaultDevice: DeviceState;
  /** Whether times in keyframes are in seconds (vs normalized 0-1) */
  useSeconds?: boolean;
}


/**
 * Video export resolution presets
 */
export type ExportResolution = "720p" | "1080p" | "4k";

/**
 * Video export format options
 */
export type ExportFormat = "mp4" | "webm";

/**
 * Video export configuration
 */
export interface ExportConfig {
  /** Output resolution */
  resolution: ExportResolution;
  /** Frames per second */
  fps: 30 | 60;
  /** Output format */
  format: ExportFormat;
  /** Output filename (without extension) */
  filename: string;
  /** Video bitrate in kbps (optional, auto-calculated if not set) */
  bitrate?: number;
}

/**
 * Resolution dimensions lookup
 */
export const RESOLUTION_DIMENSIONS: Record<
  ExportResolution,
  { width: number; height: number }
> = {
  "720p": { width: 1280, height: 720 },
  "1080p": { width: 1920, height: 1080 },
  "4k": { width: 3840, height: 2160 },
};


/**
 * Current state of the promo generator
 */
export interface PromoGeneratorState {
  /** Whether the scene is loaded and ready */
  isReady: boolean;
  /** Whether an export is in progress */
  isExporting: boolean;
  /** Export progress (0-100) */
  exportProgress: number;
  /** Current error message (if any) */
  error: string | null;
  /** Currently loaded device */
  currentDevice: DeviceType | null;
  /** Currently active preset */
  currentPreset: string | null;
  /** Currently loaded screenshots */
  screenshots: string[];
}

/**
 * Screenshot content to be mapped to device screen
 */
export interface ScreenshotContent {
  /** Image source (URL, path, or base64 data URL) */
  source: string;
  /** When to show this screenshot (normalized time 0-1) */
  startTime?: number;
  /** When to hide this screenshot (normalized time 0-1) */
  endTime?: number;
}


/**
 * References to Three.js scene objects
 */
export interface SceneRefs {
  /** The loaded device model */
  device: THREE.Group | null;
  /** The screen mesh for texture mapping */
  screenMesh: THREE.Mesh | null;
  /** The camera */
  camera: THREE.PerspectiveCamera | null;
  /** The scene */
  scene: THREE.Scene | null;
  /** The renderer */
  renderer: THREE.WebGLRenderer | null;
}
