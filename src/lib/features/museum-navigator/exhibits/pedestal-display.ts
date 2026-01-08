/**
 * Pedestal Display
 *
 * Creates pedestal exhibits for 3D animated sequences.
 * Platform with spotlight, ready for Avatar3D integration.
 */

import {
  Group,
  Mesh,
  CylinderGeometry,
  BoxGeometry,
  MeshStandardMaterial,
  SpotLight,
  SpotLightHelper,
  type Scene,
} from "three";
import type { LibrarySequence } from "$lib/features/library/domain/models/LibrarySequence";

// ============================================================================
// TYPES
// ============================================================================

export interface PedestalConfig {
  baseRadius: number;
  baseHeight: number;
  platformRadius: number;
  platformHeight: number;
  baseColor: number;
  platformColor: number;
  spotlightIntensity: number;
  showSpotlightHelper: boolean;
}

export interface PedestalDisplay {
  group: Group;
  sequence: LibrarySequence;
  spotlight: SpotLight;
  /** Position where avatar should be placed */
  avatarPosition: { x: number; y: number; z: number };
  dispose: () => void;
}

// ============================================================================
// DEFAULT CONFIG
// ============================================================================

const DEFAULT_CONFIG: PedestalConfig = {
  baseRadius: 0.4,
  baseHeight: 0.6,
  platformRadius: 0.35,
  platformHeight: 0.05,
  baseColor: 0x2a2a2a, // Dark gray base
  platformColor: 0x3a3a3a, // Slightly lighter platform
  spotlightIntensity: 2,
  showSpotlightHelper: false,
};

// ============================================================================
// PEDESTAL DISPLAY
// ============================================================================

/**
 * Create a pedestal display for 3D animation
 */
export function createPedestalDisplay(
  scene: Scene,
  sequence: LibrarySequence,
  position: { x: number; y: number; z: number },
  rotation: number,
  config: Partial<PedestalConfig> = {}
): PedestalDisplay {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const group = new Group();
  group.name = `pedestal-${sequence.id}`;

  const materials: MeshStandardMaterial[] = [];
  const geometries: (CylinderGeometry | BoxGeometry)[] = [];

  // Base cylinder
  const baseMaterial = new MeshStandardMaterial({
    color: cfg.baseColor,
    roughness: 0.3,
    metalness: 0.2,
  });
  materials.push(baseMaterial);

  const baseGeometry = new CylinderGeometry(
    cfg.baseRadius,
    cfg.baseRadius * 1.1, // Slightly wider at bottom
    cfg.baseHeight,
    32
  );
  geometries.push(baseGeometry);

  const base = new Mesh(baseGeometry, baseMaterial);
  base.position.y = cfg.baseHeight / 2;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  // Platform top
  const platformMaterial = new MeshStandardMaterial({
    color: cfg.platformColor,
    roughness: 0.2,
    metalness: 0.3,
  });
  materials.push(platformMaterial);

  const platformGeometry = new CylinderGeometry(
    cfg.platformRadius,
    cfg.platformRadius,
    cfg.platformHeight,
    32
  );
  geometries.push(platformGeometry);

  const platform = new Mesh(platformGeometry, platformMaterial);
  platform.position.y = cfg.baseHeight + cfg.platformHeight / 2;
  platform.castShadow = true;
  platform.receiveShadow = true;
  group.add(platform);

  // Accent ring
  const ringMaterial = new MeshStandardMaterial({
    color: 0x4a90c2, // Blue accent
    roughness: 0.1,
    metalness: 0.8,
    emissive: 0x4a90c2,
    emissiveIntensity: 0.2,
  });
  materials.push(ringMaterial);

  const ringGeometry = new CylinderGeometry(
    cfg.platformRadius + 0.02,
    cfg.platformRadius + 0.02,
    0.02,
    32
  );
  geometries.push(ringGeometry);

  const ring = new Mesh(ringGeometry, ringMaterial);
  ring.position.y = cfg.baseHeight + cfg.platformHeight + 0.01;
  group.add(ring);

  // Spotlight
  const spotlight = new SpotLight(
    0xffffff,
    cfg.spotlightIntensity,
    8, // distance
    Math.PI / 6, // angle
    0.5, // penumbra
    1 // decay
  );
  spotlight.position.set(0, 3, 0);
  spotlight.target.position.set(0, cfg.baseHeight + cfg.platformHeight, 0);
  spotlight.castShadow = true;
  spotlight.shadow.mapSize.width = 512;
  spotlight.shadow.mapSize.height = 512;
  group.add(spotlight);
  group.add(spotlight.target);

  // Optional spotlight helper for debugging
  if (cfg.showSpotlightHelper) {
    const helper = new SpotLightHelper(spotlight);
    group.add(helper);
  }

  // Name plaque on front of base
  const plaque = createBasePlaque(sequence.word || sequence.name || "Untitled", materials, geometries);
  plaque.position.set(0, cfg.baseHeight * 0.3, cfg.baseRadius + 0.01);
  group.add(plaque);

  // Position and rotate
  group.position.set(position.x, position.y, position.z);
  group.rotation.y = rotation;

  scene.add(group);

  // Calculate where avatar should be placed
  const avatarPosition = {
    x: position.x,
    y: position.y + cfg.baseHeight + cfg.platformHeight,
    z: position.z,
  };

  return {
    group,
    sequence,
    spotlight,
    avatarPosition,
    dispose: () => {
      scene.remove(group);
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      spotlight.dispose();
    },
  };
}

/**
 * Create name plaque for base
 */
function createBasePlaque(
  name: string,
  materials: MeshStandardMaterial[],
  geometries: (CylinderGeometry | BoxGeometry)[]
): Mesh {
  const plaqueMaterial = new MeshStandardMaterial({
    color: 0x1a1a1a,
    roughness: 0.2,
    metalness: 0.4,
  });
  materials.push(plaqueMaterial);

  const plaqueWidth = Math.min(0.5, name.length * 0.04 + 0.1);
  const plaqueGeom = new BoxGeometry(plaqueWidth, 0.06, 0.005);
  geometries.push(plaqueGeom);

  return new Mesh(plaqueGeom, plaqueMaterial);
}

/**
 * Create empty pedestal (no sequence assigned)
 */
export function createEmptyPedestal(
  scene: Scene,
  position: { x: number; y: number; z: number },
  config: Partial<PedestalConfig> = {}
): { group: Group; dispose: () => void } {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const group = new Group();
  group.name = "pedestal-empty";

  const materials: MeshStandardMaterial[] = [];
  const geometries: CylinderGeometry[] = [];

  // Simple base
  const baseMaterial = new MeshStandardMaterial({
    color: 0x3a3a3a,
    roughness: 0.5,
  });
  materials.push(baseMaterial);

  const baseGeometry = new CylinderGeometry(
    cfg.baseRadius,
    cfg.baseRadius * 1.1,
    cfg.baseHeight,
    16
  );
  geometries.push(baseGeometry);

  const base = new Mesh(baseGeometry, baseMaterial);
  base.position.y = cfg.baseHeight / 2;
  group.add(base);

  group.position.set(position.x, position.y, position.z);
  scene.add(group);

  return {
    group,
    dispose: () => {
      scene.remove(group);
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}
