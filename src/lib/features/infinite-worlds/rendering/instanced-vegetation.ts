/**
 * Instanced Vegetation Renderer
 *
 * Uses Three.js InstancedMesh for GPU-efficient rendering of vegetation.
 * A single draw call renders thousands of trees/rocks/grass.
 *
 * Features:
 * - Automatic batching by vegetation type
 * - Dynamic instance buffer updates
 * - LOD support with billboard fallback
 * - Frustum culling at batch level
 */

import {
  InstancedMesh,
  Object3D,
  Matrix4,
  Vector3,
  Quaternion,
  Euler,
  Color,
  ConeGeometry,
  CylinderGeometry,
  SphereGeometry,
  DodecahedronGeometry,
  BufferGeometry,
  Float32BufferAttribute,
  MeshStandardMaterial,
  MeshLambertMaterial,
  type Scene,
  type Material,
} from "three";
import type { VegetationData } from "../workers/chunk-generator.worker";

// ============================================================================
// TYPES
// ============================================================================

export type VegetationType = "tree" | "rock" | "grass";

interface VegetationBatch {
  mesh: InstancedMesh;
  instances: Map<string, number>; // chunkKey -> startIndex
  instanceCount: number;
  maxInstances: number;
  dirty: boolean;
}

interface VegetationConfig {
  maxTreeInstances: number;
  maxRockInstances: number;
  maxGrassInstances: number;
}

// ============================================================================
// DEFAULT CONFIG
// ============================================================================

const DEFAULT_CONFIG: VegetationConfig = {
  maxTreeInstances: 10000,
  maxRockInstances: 5000,
  maxGrassInstances: 50000,
};

// ============================================================================
// VEGETATION MANAGER
// ============================================================================

export class VegetationManager {
  private scene: Scene;
  private config: VegetationConfig;
  private batches: Map<VegetationType, VegetationBatch> = new Map();
  private chunkVegetation: Map<string, VegetationData[]> = new Map();

  // Temporary objects for matrix composition (avoid GC)
  private tempObject = new Object3D();
  private tempMatrix = new Matrix4();
  private tempPosition = new Vector3();
  private tempQuaternion = new Quaternion();
  private tempScale = new Vector3();
  private tempEuler = new Euler();

  constructor(scene: Scene, config: Partial<VegetationConfig> = {}) {
    this.scene = scene;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initBatches();
  }

  // ==========================================================================
  // INITIALIZATION
  // ==========================================================================

  private initBatches(): void {
    // Create tree batch
    const treeGeometry = this.createTreeGeometry();
    const treeMaterial = new MeshLambertMaterial({
      color: 0x228b22,
      flatShading: true,
    });
    this.createBatch("tree", treeGeometry, treeMaterial, this.config.maxTreeInstances);

    // Create rock batch
    const rockGeometry = this.createRockGeometry();
    const rockMaterial = new MeshLambertMaterial({
      color: 0x696969,
      flatShading: true,
    });
    this.createBatch("rock", rockGeometry, rockMaterial, this.config.maxRockInstances);

    // Create grass batch
    const grassGeometry = this.createGrassGeometry();
    const grassMaterial = new MeshLambertMaterial({
      color: 0x32cd32,
      flatShading: true,
      side: 2, // DoubleSide
    });
    this.createBatch("grass", grassGeometry, grassMaterial, this.config.maxGrassInstances);

    console.log("[VegetationManager] Initialized batches");
  }

  private createBatch(
    type: VegetationType,
    geometry: BufferGeometry,
    material: Material,
    maxInstances: number
  ): void {
    const mesh = new InstancedMesh(geometry, material, maxInstances);
    mesh.count = 0; // Start with 0 visible instances
    mesh.frustumCulled = true;
    mesh.castShadow = true;
    mesh.receiveShadow = false;

    // Initialize all matrices to identity (hidden)
    const identity = new Matrix4();
    for (let i = 0; i < maxInstances; i++) {
      mesh.setMatrixAt(i, identity);
    }
    mesh.instanceMatrix.needsUpdate = true;

    this.scene.add(mesh);

    this.batches.set(type, {
      mesh,
      instances: new Map(),
      instanceCount: 0,
      maxInstances,
      dirty: false,
    });
  }

  // ==========================================================================
  // PROCEDURAL GEOMETRY
  // ==========================================================================

  private createTreeGeometry(): BufferGeometry {
    // Simple low-poly tree: just a cone for now (single geometry, properly indexed)
    const geometry = new ConeGeometry(1.5, 6, 6);
    geometry.translate(0, 3, 0); // Lift up so base is at y=0
    return geometry;
  }

  private createRockGeometry(): BufferGeometry {
    // Irregular rock shape using dodecahedron with some deformation
    const geometry = new DodecahedronGeometry(1, 0);

    // Slightly randomize vertices for more natural look
    const positions = geometry.getAttribute("position");
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      const z = positions.getZ(i);

      // Flatten vertically and add slight variation
      positions.setY(i, y * 0.6);
    }
    positions.needsUpdate = true;
    geometry.computeVertexNormals();

    return geometry;
  }

  private createGrassGeometry(): BufferGeometry {
    // Simple grass blade - thin triangle
    const geometry = new BufferGeometry();

    const positions = new Float32Array([
      -0.05, 0, 0,
      0.05, 0, 0,
      0, 0.5, 0,
    ]);

    const normals = new Float32Array([
      0, 0, 1,
      0, 0, 1,
      0, 0, 1,
    ]);

    geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
    geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3));

    return geometry;
  }

  // ==========================================================================
  // CHUNK VEGETATION MANAGEMENT
  // ==========================================================================

  /**
   * Add vegetation for a chunk
   */
  addChunkVegetation(
    chunkKey: string,
    chunkWorldX: number,
    chunkWorldZ: number,
    vegetation: VegetationData[]
  ): void {
    if (vegetation.length === 0) return;

    console.log(`[VegetationManager] Adding ${vegetation.length} items for chunk ${chunkKey}`);

    // Store vegetation data
    this.chunkVegetation.set(chunkKey, vegetation);

    // Group by type
    const byType = new Map<VegetationType, VegetationData[]>();
    for (const v of vegetation) {
      const list = byType.get(v.type) || [];
      list.push(v);
      byType.set(v.type, list);
    }

    // Add to batches
    for (const [type, items] of byType) {
      console.log(`[VegetationManager] Adding ${items.length} ${type}s`);
      this.addToBatch(type, chunkKey, chunkWorldX, chunkWorldZ, items);
    }
  }

  /**
   * Remove vegetation for a chunk
   */
  removeChunkVegetation(chunkKey: string): void {
    const vegetation = this.chunkVegetation.get(chunkKey);
    if (!vegetation) return;

    // Group by type to know which batches to update
    const types = new Set(vegetation.map(v => v.type));

    for (const type of types) {
      this.removeFromBatch(type, chunkKey);
    }

    this.chunkVegetation.delete(chunkKey);
  }

  private addToBatch(
    type: VegetationType,
    chunkKey: string,
    chunkWorldX: number,
    chunkWorldZ: number,
    items: VegetationData[]
  ): void {
    const batch = this.batches.get(type);
    if (!batch) return;

    const startIndex = batch.instanceCount;
    const count = Math.min(items.length, batch.maxInstances - batch.instanceCount);

    if (count <= 0) {
      console.warn(`[VegetationManager] ${type} batch full`);
      return;
    }

    // Set instance matrices
    for (let i = 0; i < count; i++) {
      const item = items[i]!;
      const instanceIndex = startIndex + i;

      // Compose transform matrix
      this.tempPosition.set(
        chunkWorldX + item.x,
        item.y,
        chunkWorldZ + item.z
      );
      this.tempEuler.set(0, item.rotation, 0);
      this.tempQuaternion.setFromEuler(this.tempEuler);
      this.tempScale.setScalar(item.scale);

      this.tempObject.position.copy(this.tempPosition);
      this.tempObject.quaternion.copy(this.tempQuaternion);
      this.tempObject.scale.copy(this.tempScale);
      this.tempObject.updateMatrix();

      batch.mesh.setMatrixAt(instanceIndex, this.tempObject.matrix);
    }

    batch.instances.set(chunkKey, startIndex);
    batch.instanceCount += count;
    batch.mesh.count = batch.instanceCount;
    batch.mesh.instanceMatrix.needsUpdate = true;

    console.log(`[VegetationManager] Batch ${type} now has ${batch.instanceCount} instances`);
  }

  private removeFromBatch(type: VegetationType, chunkKey: string): void {
    const batch = this.batches.get(type);
    if (!batch) return;

    // For simplicity, we'll just mark this as needing rebuild
    // A more efficient approach would compact the buffer
    batch.instances.delete(chunkKey);
    batch.dirty = true;
  }

  /**
   * Rebuild dirty batches (called periodically)
   */
  rebuildDirtyBatches(): void {
    for (const [type, batch] of this.batches) {
      if (!batch.dirty) continue;

      // Rebuild from stored vegetation data
      batch.instanceCount = 0;

      for (const [chunkKey, vegetation] of this.chunkVegetation) {
        const items = vegetation.filter(v => v.type === type);
        if (items.length === 0) continue;

        // Parse chunk position from key
        const parts = chunkKey.split(",").map(Number);
        const chunkWorldX = (parts[0] ?? 0) * 32;
        const chunkWorldZ = (parts[2] ?? 0) * 32;

        const startIndex = batch.instanceCount;
        const count = Math.min(items.length, batch.maxInstances - batch.instanceCount);

        for (let i = 0; i < count; i++) {
          const item = items[i]!;
          const instanceIndex = startIndex + i;

          this.tempPosition.set(
            chunkWorldX + item.x,
            item.y,
            chunkWorldZ + item.z
          );
          this.tempEuler.set(0, item.rotation, 0);
          this.tempQuaternion.setFromEuler(this.tempEuler);
          this.tempScale.setScalar(item.scale);

          this.tempObject.position.copy(this.tempPosition);
          this.tempObject.quaternion.copy(this.tempQuaternion);
          this.tempObject.scale.copy(this.tempScale);
          this.tempObject.updateMatrix();

          batch.mesh.setMatrixAt(instanceIndex, this.tempObject.matrix);
        }

        batch.instances.set(chunkKey, startIndex);
        batch.instanceCount += count;
      }

      batch.mesh.count = batch.instanceCount;
      batch.mesh.instanceMatrix.needsUpdate = true;
      batch.dirty = false;
    }
  }

  // ==========================================================================
  // STATS & CLEANUP
  // ==========================================================================

  getStats(): { trees: number; rocks: number; grass: number } {
    return {
      trees: this.batches.get("tree")?.instanceCount ?? 0,
      rocks: this.batches.get("rock")?.instanceCount ?? 0,
      grass: this.batches.get("grass")?.instanceCount ?? 0,
    };
  }

  dispose(): void {
    for (const batch of this.batches.values()) {
      this.scene.remove(batch.mesh);
      batch.mesh.geometry.dispose();
      if (Array.isArray(batch.mesh.material)) {
        batch.mesh.material.forEach(m => m.dispose());
      } else {
        batch.mesh.material.dispose();
      }
    }
    this.batches.clear();
    this.chunkVegetation.clear();
  }
}
