/**
 * Room Renderer
 *
 * Creates box room geometry for museum galleries.
 * Generates floor, walls, and ceiling with modern gallery materials.
 */

import {
  BoxGeometry,
  Mesh,
  MeshStandardMaterial,
  Group,
  PlaneGeometry,
  DoubleSide,
  type Scene,
  type Material,
} from "three";

// ============================================================================
// TYPES
// ============================================================================

export interface RoomConfig {
  type: "hub" | "gallery" | "hallway";
  width: number;
  depth: number;
  height: number;
  exits?: ("north" | "south" | "east" | "west")[];
}

export interface RoomMesh {
  group: Group;
  floor: Mesh;
  ceiling: Mesh;
  walls: Mesh[];
  config: RoomConfig;
  dispose: () => void;
}

// ============================================================================
// MATERIALS (Modern Gallery Theme)
// ============================================================================

function createFloorMaterial(): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color: 0x2a2a2a, // Dark gray concrete
    roughness: 0.8,
    metalness: 0.1,
  });
}

function createWallMaterial(): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color: 0xf5f5f5, // Off-white walls
    roughness: 0.9,
    metalness: 0.0,
  });
}

function createCeilingMaterial(): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color: 0xffffff, // White ceiling
    roughness: 0.95,
    metalness: 0.0,
  });
}

// ============================================================================
// ROOM CREATION
// ============================================================================

/**
 * Create a room with floor, walls, and ceiling
 */
export function createRoom(scene: Scene, config: RoomConfig): RoomMesh {
  const { width, depth, height, exits = [] } = config;

  const group = new Group();
  group.name = `room-${config.type}`;

  // Materials
  const floorMat = createFloorMaterial();
  const wallMat = createWallMaterial();
  const ceilingMat = createCeilingMaterial();

  const materials: Material[] = [floorMat, wallMat, ceilingMat];
  const walls: Mesh[] = [];

  // Floor
  const floorGeom = new PlaneGeometry(width, depth);
  const floor = new Mesh(floorGeom, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  floor.receiveShadow = true;
  floor.name = "floor";
  group.add(floor);

  // Ceiling
  const ceilingGeom = new PlaneGeometry(width, depth);
  const ceiling = new Mesh(ceilingGeom, ceilingMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = height;
  ceiling.name = "ceiling";
  group.add(ceiling);

  // Walls - create each wall segment
  // North wall (back, -Z)
  if (!exits.includes("north")) {
    const northWall = createWall(width, height, wallMat);
    northWall.position.set(0, height / 2, -depth / 2);
    northWall.name = "wall-north";
    walls.push(northWall);
    group.add(northWall);
  }

  // South wall (front, +Z)
  if (!exits.includes("south")) {
    const southWall = createWall(width, height, wallMat);
    southWall.position.set(0, height / 2, depth / 2);
    southWall.rotation.y = Math.PI;
    southWall.name = "wall-south";
    walls.push(southWall);
    group.add(southWall);
  }

  // East wall (right, +X)
  if (!exits.includes("east")) {
    const eastWall = createWall(depth, height, wallMat);
    eastWall.position.set(width / 2, height / 2, 0);
    eastWall.rotation.y = -Math.PI / 2;
    eastWall.name = "wall-east";
    walls.push(eastWall);
    group.add(eastWall);
  }

  // West wall (left, -X)
  if (!exits.includes("west")) {
    const westWall = createWall(depth, height, wallMat);
    westWall.position.set(-width / 2, height / 2, 0);
    westWall.rotation.y = Math.PI / 2;
    westWall.name = "wall-west";
    walls.push(westWall);
    group.add(westWall);
  }

  scene.add(group);

  return {
    group,
    floor,
    ceiling,
    walls,
    config,
    dispose: () => {
      scene.remove(group);

      // Dispose geometries
      floorGeom.dispose();
      ceilingGeom.dispose();
      walls.forEach((wall) => wall.geometry.dispose());

      // Dispose materials
      materials.forEach((mat) => mat.dispose());
    },
  };
}

/**
 * Create a single wall plane
 */
function createWall(width: number, height: number, material: MeshStandardMaterial): Mesh {
  const geometry = new PlaneGeometry(width, height);
  const wall = new Mesh(geometry, material);
  wall.receiveShadow = true;
  wall.castShadow = false;
  return wall;
}

/**
 * Create doorway geometry (wall with opening)
 * Used when a wall has an exit
 */
export function createDoorway(
  wallWidth: number,
  wallHeight: number,
  doorWidth: number,
  doorHeight: number,
  material: MeshStandardMaterial
): Group {
  const doorway = new Group();

  // Left section
  const leftWidth = (wallWidth - doorWidth) / 2;
  if (leftWidth > 0) {
    const leftGeom = new PlaneGeometry(leftWidth, wallHeight);
    const leftWall = new Mesh(leftGeom, material);
    leftWall.position.x = -(wallWidth / 2) + leftWidth / 2;
    doorway.add(leftWall);
  }

  // Right section
  const rightWidth = (wallWidth - doorWidth) / 2;
  if (rightWidth > 0) {
    const rightGeom = new PlaneGeometry(rightWidth, wallHeight);
    const rightWall = new Mesh(rightGeom, material);
    rightWall.position.x = wallWidth / 2 - rightWidth / 2;
    doorway.add(rightWall);
  }

  // Top section (above door)
  const topHeight = wallHeight - doorHeight;
  if (topHeight > 0) {
    const topGeom = new PlaneGeometry(doorWidth, topHeight);
    const topWall = new Mesh(topGeom, material);
    topWall.position.y = doorHeight / 2 + topHeight / 2;
    doorway.add(topWall);
  }

  return doorway;
}
