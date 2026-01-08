/**
 * Pictograph Display
 *
 * Creates wall-mounted pictograph exhibits.
 * Renders sequence to canvas texture with frame.
 */

import {
  Group,
  Mesh,
  PlaneGeometry,
  BoxGeometry,
  MeshStandardMaterial,
  CanvasTexture,
  type Scene,
} from "three";
import type { LibrarySequence } from "$lib/features/library/domain/models/LibrarySequence";
import type { IImageComposer } from "$lib/shared/render/services/contracts/IImageComposer";

// ============================================================================
// TYPES
// ============================================================================

export interface PictographDisplayConfig {
  width: number;
  height: number;
  frameWidth: number;
  frameColor: number;
  matteColor: number;
}

export interface PictographDisplay {
  group: Group;
  sequence: LibrarySequence;
  dispose: () => void;
}

// ============================================================================
// DEFAULT CONFIG
// ============================================================================

const DEFAULT_CONFIG: PictographDisplayConfig = {
  width: 1.2,
  height: 1.0,
  frameWidth: 0.05,
  frameColor: 0x1a1a1a, // Dark frame for modern look
  matteColor: 0xffffff, // White matte
};

// ============================================================================
// PICTOGRAPH DISPLAY
// ============================================================================

/**
 * Create a wall-mounted pictograph display
 */
export async function createPictographDisplay(
  scene: Scene,
  sequence: LibrarySequence,
  position: { x: number; y: number; z: number },
  rotation: number,
  imageComposer: IImageComposer,
  config: Partial<PictographDisplayConfig> = {}
): Promise<PictographDisplay> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const group = new Group();
  group.name = `exhibit-${sequence.id}`;

  const materials: MeshStandardMaterial[] = [];
  const geometries: (PlaneGeometry | BoxGeometry)[] = [];

  // Create frame
  const frameGroup = createFrame(cfg, materials, geometries);
  group.add(frameGroup);

  // Create matte (white border inside frame)
  const matteMaterial = new MeshStandardMaterial({
    color: cfg.matteColor,
    roughness: 0.9,
  });
  materials.push(matteMaterial);

  const matteGeometry = new PlaneGeometry(
    cfg.width - cfg.frameWidth,
    cfg.height - cfg.frameWidth
  );
  geometries.push(matteGeometry);

  const matte = new Mesh(matteGeometry, matteMaterial);
  matte.position.z = 0.01;
  group.add(matte);

  // Render sequence to texture
  try {
    const canvas = await imageComposer.composeSequenceImage(sequence, {
      backgroundColor: "#ffffff",
      addWord: false,
      includeStartPosition: true,
      beatSize: 200,
    });

    // Create texture from canvas
    const texture = new CanvasTexture(canvas);
    texture.needsUpdate = true;

    // Calculate aspect ratio
    const aspectRatio = canvas.width / canvas.height;
    const pictureWidth = cfg.width - cfg.frameWidth * 3;
    const pictureHeight = pictureWidth / aspectRatio;

    const pictureMaterial = new MeshStandardMaterial({
      map: texture,
      roughness: 0.5,
    });
    materials.push(pictureMaterial);

    const pictureGeometry = new PlaneGeometry(pictureWidth, pictureHeight);
    geometries.push(pictureGeometry);

    const picture = new Mesh(pictureGeometry, pictureMaterial);
    picture.position.z = 0.02;
    group.add(picture);
  } catch (error) {
    console.error(`[PictographDisplay] Failed to render sequence ${sequence.id}:`, error);
    // Create placeholder
    const placeholderMaterial = new MeshStandardMaterial({
      color: 0xcccccc,
      roughness: 0.9,
    });
    materials.push(placeholderMaterial);

    const placeholderGeometry = new PlaneGeometry(
      cfg.width - cfg.frameWidth * 3,
      cfg.height - cfg.frameWidth * 3
    );
    geometries.push(placeholderGeometry);

    const placeholder = new Mesh(placeholderGeometry, placeholderMaterial);
    placeholder.position.z = 0.02;
    group.add(placeholder);
  }

  // Create name plaque
  const plaque = createNamePlaque(sequence.word || sequence.name || "Untitled", materials, geometries);
  plaque.position.y = -cfg.height / 2 - 0.12;
  plaque.position.z = 0.01;
  group.add(plaque);

  // Position and rotate
  group.position.set(position.x, position.y, position.z);
  group.rotation.y = rotation;

  scene.add(group);

  return {
    group,
    sequence,
    dispose: () => {
      scene.remove(group);
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => {
        if (m.map) m.map.dispose();
        m.dispose();
      });
    },
  };
}

/**
 * Create frame geometry
 */
function createFrame(
  cfg: PictographDisplayConfig,
  materials: MeshStandardMaterial[],
  geometries: (PlaneGeometry | BoxGeometry)[]
): Group {
  const frame = new Group();
  const frameMaterial = new MeshStandardMaterial({
    color: cfg.frameColor,
    roughness: 0.3,
    metalness: 0.1,
  });
  materials.push(frameMaterial);

  const frameDepth = 0.03;

  // Top
  const topGeom = new BoxGeometry(cfg.width, cfg.frameWidth, frameDepth);
  geometries.push(topGeom);
  const top = new Mesh(topGeom, frameMaterial);
  top.position.y = cfg.height / 2 - cfg.frameWidth / 2;
  frame.add(top);

  // Bottom
  const bottomGeom = new BoxGeometry(cfg.width, cfg.frameWidth, frameDepth);
  geometries.push(bottomGeom);
  const bottom = new Mesh(bottomGeom, frameMaterial);
  bottom.position.y = -cfg.height / 2 + cfg.frameWidth / 2;
  frame.add(bottom);

  // Left
  const leftGeom = new BoxGeometry(cfg.frameWidth, cfg.height, frameDepth);
  geometries.push(leftGeom);
  const left = new Mesh(leftGeom, frameMaterial);
  left.position.x = -cfg.width / 2 + cfg.frameWidth / 2;
  frame.add(left);

  // Right
  const rightGeom = new BoxGeometry(cfg.frameWidth, cfg.height, frameDepth);
  geometries.push(rightGeom);
  const right = new Mesh(rightGeom, frameMaterial);
  right.position.x = cfg.width / 2 - cfg.frameWidth / 2;
  frame.add(right);

  return frame;
}

/**
 * Create name plaque below picture
 */
function createNamePlaque(
  name: string,
  materials: MeshStandardMaterial[],
  geometries: (PlaneGeometry | BoxGeometry)[]
): Group {
  const plaque = new Group();

  // Plaque background
  const plaqueMaterial = new MeshStandardMaterial({
    color: 0x2a2a2a,
    roughness: 0.2,
    metalness: 0.3,
  });
  materials.push(plaqueMaterial);

  const plaqueWidth = Math.min(0.8, name.length * 0.05 + 0.2);
  const plaqueGeom = new BoxGeometry(plaqueWidth, 0.08, 0.01);
  geometries.push(plaqueGeom);

  const plaqueBase = new Mesh(plaqueGeom, plaqueMaterial);
  plaque.add(plaqueBase);

  // Note: Text rendering would require canvas texture or troika-three-text
  // For now, the plaque is just a solid rectangle
  // Text can be added in a future iteration

  return plaque;
}

/**
 * Create a simple placeholder display (no async rendering)
 */
export function createPlaceholderDisplay(
  scene: Scene,
  sequenceId: string,
  position: { x: number; y: number; z: number },
  rotation: number
): PictographDisplay {
  const cfg = DEFAULT_CONFIG;
  const group = new Group();
  group.name = `exhibit-placeholder-${sequenceId}`;

  const materials: MeshStandardMaterial[] = [];
  const geometries: (PlaneGeometry | BoxGeometry)[] = [];

  // Simple gray rectangle
  const material = new MeshStandardMaterial({
    color: 0x888888,
    roughness: 0.9,
  });
  materials.push(material);

  const geometry = new PlaneGeometry(cfg.width, cfg.height);
  geometries.push(geometry);

  const mesh = new Mesh(geometry, material);
  group.add(mesh);

  group.position.set(position.x, position.y, position.z);
  group.rotation.y = rotation;

  scene.add(group);

  return {
    group,
    sequence: null as any, // Placeholder has no sequence
    dispose: () => {
      scene.remove(group);
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}
