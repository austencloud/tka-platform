/**
 * Promo Scene Manager Implementation
 *
 * Manages the Three.js scene for 3D device mockup rendering.
 * Handles device model loading, environment setup, and scene lifecycle.
 */

import {
  Scene, PerspectiveCamera, WebGLRenderer, Group, Mesh,
  SRGBColorSpace, ACESFilmicToneMapping,
  AmbientLight, DirectionalLight, MeshStandardMaterial,
  Color, CanvasTexture, EquirectangularReflectionMapping,
  Box3, Vector3, Object3D, Material,
} from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type {
  DeviceType,
  DeviceConfig,
  EnvironmentConfig,
  EnvironmentType,
  SceneRefs,
} from "../domain/promo-models";

/**
 * Default device configurations
 */
const DEVICE_CONFIGS: Partial<Record<DeviceType, DeviceConfig>> = {
  "iphone-16": {
    id: "iphone-16",
    name: "iPhone 16",
    modelPath: "/models/iphone-16.glb",
    screenMeshName: "Screen",
    screenAspectRatio: 19.5 / 9,
  },
};

/**
 * Environment presets
 */
const ENVIRONMENT_PRESETS: Record<EnvironmentType, EnvironmentConfig> = {
  studio: {
    type: "studio",
    backgroundColor: "#1a1a2e",
    intensity: 1.0,
  },
  gradient: {
    type: "gradient",
    gradientColors: ["#1a1a2e", "#0f0f1a"],
    intensity: 1.0,
  },
  space: {
    type: "space",
    backgroundColor: "#000000",
    intensity: 0.8,
  },
  sunset: {
    type: "sunset",
    hdrPath: "/environments/sunset.hdr",
    intensity: 1.2,
  },
  custom: {
    type: "custom",
    backgroundColor: "#1a1a2e",
    intensity: 1.0,
  },
};

export class PromoSceneManager {
  private scene: Scene | null = null;
  private camera: PerspectiveCamera | null = null;
  private renderer: WebGLRenderer | null = null;
  private device: Group | null = null;
  private screenMesh: Mesh | null = null;
  private gltfLoader: GLTFLoader;
  private hdrLoader: HDRLoader;
  private currentDeviceType: DeviceType | null = null;
  private orbitControls: OrbitControls | null = null;

  /** Recommended camera distance based on model size */
  private _cameraDistance: number = 5;

  constructor() {
    this.gltfLoader = new GLTFLoader();
    this.hdrLoader = new HDRLoader();
  }

  async initialize(
    canvas: HTMLCanvasElement,
    width: number,
    height: number
  ): Promise<void> {
    // Create scene
    this.scene = new Scene();

    // Create camera
    this.camera = new PerspectiveCamera(50, width / height, 0.1, 1000);
    this.camera.position.set(0, 0, 5);
    this.camera.lookAt(0, 0, 0);

    // Create renderer
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true, // Required for video export
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    // Set up default lighting
    this.setupDefaultLighting();

    // Set default environment
    this.setEnvironment("studio");

    // Add orbit controls for debugging/manual adjustment
    this.orbitControls = new OrbitControls(this.camera, canvas);
    this.orbitControls.enableDamping = true;
    this.orbitControls.dampingFactor = 0.05;
    this.orbitControls.target.set(0, 0, 0);
    this.orbitControls.update();
  }

  private setupDefaultLighting(): void {
    if (!this.scene) return;

    // Ambient light for overall illumination
    const ambientLight = new AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);

    // Key light (main light source)
    const keyLight = new DirectionalLight(0xffffff, 1.0);
    keyLight.position.set(5, 5, 5);
    keyLight.castShadow = true;
    this.scene.add(keyLight);

    // Fill light (softer, from opposite side)
    const fillLight = new DirectionalLight(0xffffff, 0.4);
    fillLight.position.set(-5, 3, 5);
    this.scene.add(fillLight);

    // Rim light (creates edge highlights)
    const rimLight = new DirectionalLight(0xffffff, 0.3);
    rimLight.position.set(0, 5, -5);
    this.scene.add(rimLight);
  }

  async loadDevice(deviceType: DeviceType): Promise<void> {
    const config = DEVICE_CONFIGS[deviceType];
    if (!config) {
      throw new Error(`Unknown device type: ${deviceType}`);
    }

    await this.loadDeviceFromPath(config.modelPath, config.screenMeshName);
    this.currentDeviceType = deviceType;
  }

  async loadDeviceFromPath(
    modelPath: string,
    screenMeshName: string = "Screen"
  ): Promise<void> {
    if (!this.scene) {
      throw new Error("Scene not initialized. Call initialize() first.");
    }

    // Remove existing device
    if (this.device) {
      this.scene.remove(this.device);
      this.disposeObject(this.device);
      this.device = null;
      this.screenMesh = null;
    }

    try {
      const gltf = await this.gltfLoader.loadAsync(modelPath);
      this.device = gltf.scene;

      // Find the screen mesh
      this.device.traverse((child) => {
        if (child instanceof Mesh) {
          // Try to find screen by name or by naming convention
          const name = child.name.toLowerCase();
          if (
            name.includes("screen") ||
            name.includes("display") ||
            name === screenMeshName.toLowerCase()
          ) {
            this.screenMesh = child;
          }
        }
      });

      // If no screen mesh found by name, look for the largest flat surface
      if (!this.screenMesh) {
        const screenCandidate = this.findLargestFlatMesh(this.device);
        if (screenCandidate) {
          this.screenMesh = screenCandidate;
        }
      }

      // Get original bounding box
      const bbox = new Box3().setFromObject(this.device);
      const center = bbox.getCenter(new Vector3());
      const size = bbox.getSize(new Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);

      // Calculate scale to normalize model to roughly 2 units
      const targetSize = 2;
      const scale = targetSize / maxDim;

      // Create a pivot group to properly center the model
      const pivot = new Group();
      pivot.add(this.device);

      // Move device within pivot to center it
      this.device.position.set(-center.x, -center.y, -center.z);

      // Apply scale to pivot
      pivot.scale.setScalar(scale);

      // Replace device reference with pivot
      this.device = pivot;

      // Auto-orient the model: many phone models are lying flat
      const newBbox = new Box3().setFromObject(this.device);
      const newSize = newBbox.getSize(new Vector3());
      // If the model is wider than tall in the current orientation, rotate it
      if (newSize.y < newSize.z) {
        // Phone is lying down (Z is taller than Y), rotate to stand up
        this.device.rotation.x = -Math.PI / 2;
      } else if (newSize.y < newSize.x && newSize.z < newSize.x) {
        // Phone is on its side (X is the longest), rotate 90° on Z
        this.device.rotation.z = Math.PI / 2;
      }

      // Update camera position based on model size
      if (this.camera) {
        const finalBbox = new Box3().setFromObject(this.device);
        const finalSize = finalBbox.getSize(new Vector3());
        // Camera distance: phone should fill a good portion of frame
        // Model is ~2 units, camera at 5 gives nice framing with preset scaling
        this._cameraDistance = Math.max(finalSize.x, finalSize.y, finalSize.z) * 2.5;
        this.camera.position.set(0, 0, this._cameraDistance);
        this.camera.lookAt(0, 0, 0);
      }

      // Debug helpers disabled for production
      // const axesHelper = new THREE.AxesHelper(2);
      // this.scene.add(axesHelper);
      // const gridHelper = new THREE.GridHelper(4, 10, 0x444444, 0x222222);
      // gridHelper.position.y = -1.5;
      // this.scene.add(gridHelper);

      this.scene.add(this.device);
    } catch (error) {
      console.error("[PromoSceneManager] Failed to load device:", error);
      throw error;
    }
  }

  setEnvironment(environment: EnvironmentType | EnvironmentConfig): void {
    if (!this.scene || !this.renderer) return;

    const config: EnvironmentConfig =
      typeof environment === "string"
        ? ENVIRONMENT_PRESETS[environment]
        : environment;

    // Set background
    if (config.transparent) {
      this.scene.background = null;
    } else if (config.gradientColors) {
      // Create gradient background
      const canvas = document.createElement("canvas");
      canvas.width = 2;
      canvas.height = 256;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const gradient = ctx.createLinearGradient(0, 0, 0, 256);
        gradient.addColorStop(0, config.gradientColors[0]);
        gradient.addColorStop(1, config.gradientColors[1]);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 2, 256);
        const texture = new CanvasTexture(canvas);
        this.scene.background = texture;
      }
    } else if (config.backgroundColor) {
      this.scene.background = new Color(config.backgroundColor);
    }

    // Load HDR environment map if provided
    if (config.hdrPath) {
      this.hdrLoader.load(config.hdrPath, (texture) => {
        if (this.scene) {
          texture.mapping = EquirectangularReflectionMapping;
          this.scene.environment = texture;
        }
      });
    }

    // Adjust exposure
    if (config.intensity !== undefined) {
      this.renderer.toneMappingExposure = config.intensity;
    }
  }

  getSceneRefs(): SceneRefs {
    return {
      device: this.device,
      screenMesh: this.screenMesh,
      camera: this.camera,
      scene: this.scene,
      renderer: this.renderer,
    };
  }

  getDevice(): Group | null {
    return this.device;
  }

  getScreenMesh(): Mesh | null {
    return this.screenMesh;
  }

  getCamera(): PerspectiveCamera | null {
    return this.camera;
  }

  getRenderer(): WebGLRenderer | null {
    return this.renderer;
  }

  resize(width: number, height: number): void {
    if (!this.camera || !this.renderer) return;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  render(): void {
    if (!this.scene || !this.camera || !this.renderer) return;

    // Update orbit controls
    if (this.orbitControls) {
      this.orbitControls.update();
    }

    this.renderer.render(this.scene, this.camera);
  }

  getAvailableDevices(): DeviceConfig[] {
    return Object.values(DEVICE_CONFIGS).filter(
      (c): c is DeviceConfig => c !== undefined
    );
  }

  /**
   * Get the recommended camera distance for the current model.
   * Used by animation controller to scale preset camera positions.
   */
  getCameraDistance(): number {
    return this._cameraDistance;
  }

  dispose(): void {
    // Dispose orbit controls
    if (this.orbitControls) {
      this.orbitControls.dispose();
      this.orbitControls = null;
    }

    // Dispose device
    if (this.device) {
      this.disposeObject(this.device);
      this.device = null;
    }

    // Dispose scene
    if (this.scene) {
      this.scene.traverse((object) => {
        this.disposeObject(object);
      });
      this.scene = null;
    }

    // Dispose renderer
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }

    this.camera = null;
    this.screenMesh = null;
  }

  /**
   * Find the largest flat mesh in a group (heuristic for screen detection)
   */
  private findLargestFlatMesh(group: Group): Mesh | null {
    let largestArea = 0;
    let result: Mesh | null = null;

    group.traverse((child) => {
      if (child instanceof Mesh && child.geometry) {
        const bbox = new Box3().setFromObject(child);
        const size = new Vector3();
        bbox.getSize(size);
        const area = size.x * size.y;
        // Look for flat surfaces (thin in Z relative to X and Y)
        if (area > largestArea && size.z < size.x && size.z < size.y) {
          largestArea = area;
          result = child;
        }
      }
    });

    return result;
  }

  private disposeObject(object: Object3D): void {
    if (object instanceof Mesh) {
      if (object.geometry) {
        object.geometry.dispose();
      }
      if (object.material) {
        if (Array.isArray(object.material)) {
          object.material.forEach((mat) => this.disposeMaterial(mat));
        } else {
          this.disposeMaterial(object.material);
        }
      }
    }
  }

  private disposeMaterial(material: Material): void {
    material.dispose();
    // Dispose textures
    const mat = material as MeshStandardMaterial;
    if (mat.map) mat.map.dispose();
    if (mat.normalMap) mat.normalMap.dispose();
    if (mat.roughnessMap) mat.roughnessMap.dispose();
    if (mat.metalnessMap) mat.metalnessMap.dispose();
    if (mat.emissiveMap) mat.emissiveMap.dispose();
    if (mat.aoMap) mat.aoMap.dispose();
  }
}
