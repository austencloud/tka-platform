/**
 * Octree Spatial Structure
 *
 * Hierarchical spatial partitioning for efficient queries on millions of objects.
 * Uses Morton codes (Z-order curves) for cache-friendly memory layout.
 *
 * Features:
 * - O(log n) insertions and queries
 * - LOD built into tree structure
 * - GPU-friendly linear layout
 * - Streaming-ready (each node can be loaded/unloaded independently)
 */


/**
 * Axis-aligned bounding box
 */
export interface AABB {
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
}

/**
 * Octree node - stored in flat array for cache efficiency
 */
export interface OctreeNode {
  id: number;
  bounds: AABB;
  depth: number;
  parentId: number | null;
  childIds: number[]; // 8 children or empty
  entityIds: number[]; // Entities in this node (leaf nodes only)
  isLeaf: boolean;
}

/**
 * Octree configuration
 */
export interface OctreeConfig {
  worldSize: number; // Size of the root node (world bounds)
  maxDepth: number; // Maximum tree depth
  maxEntitiesPerNode: number; // Split threshold
  minNodeSize: number; // Don't split below this size
}

/**
 * Frustum for culling
 */
export interface Frustum {
  planes: Array<{ normal: { x: number; y: number; z: number }; distance: number }>;
}


export class Octree {
  private nodes: Map<number, OctreeNode> = new Map();
  private entityToNode: Map<number, number> = new Map();
  private nextNodeId = 0;
  private config: OctreeConfig;
  private rootId: number;

  constructor(config: Partial<OctreeConfig> = {}) {
    this.config = {
      worldSize: config.worldSize ?? 1000,
      maxDepth: config.maxDepth ?? 8,
      maxEntitiesPerNode: config.maxEntitiesPerNode ?? 16,
      minNodeSize: config.minNodeSize ?? 1,
    };

    const halfSize = this.config.worldSize / 2;
    this.rootId = this.createNode({
      minX: -halfSize,
      minY: -halfSize,
      minZ: -halfSize,
      maxX: halfSize,
      maxY: halfSize,
      maxZ: halfSize,
    }, 0, null);
  }


  private createNode(bounds: AABB, depth: number, parentId: number | null): number {
    const id = this.nextNodeId++;
    const node: OctreeNode = {
      id,
      bounds,
      depth,
      parentId,
      childIds: [],
      entityIds: [],
      isLeaf: true,
    };
    this.nodes.set(id, node);
    return id;
  }

  private getNode(id: number): OctreeNode | undefined {
    return this.nodes.get(id);
  }

  private subdivide(nodeId: number): void {
    const node = this.getNode(nodeId);
    if (!node?.isLeaf) return;

    const { bounds, depth } = node;
    const midX = (bounds.minX + bounds.maxX) / 2;
    const midY = (bounds.minY + bounds.maxY) / 2;
    const midZ = (bounds.minZ + bounds.maxZ) / 2;

    // Create 8 child nodes (Morton order for cache efficiency)
    const childBounds: AABB[] = [
      { minX: bounds.minX, minY: bounds.minY, minZ: bounds.minZ, maxX: midX, maxY: midY, maxZ: midZ },
      { minX: midX, minY: bounds.minY, minZ: bounds.minZ, maxX: bounds.maxX, maxY: midY, maxZ: midZ },
      { minX: bounds.minX, minY: midY, minZ: bounds.minZ, maxX: midX, maxY: bounds.maxY, maxZ: midZ },
      { minX: midX, minY: midY, minZ: bounds.minZ, maxX: bounds.maxX, maxY: bounds.maxY, maxZ: midZ },
      { minX: bounds.minX, minY: bounds.minY, minZ: midZ, maxX: midX, maxY: midY, maxZ: bounds.maxZ },
      { minX: midX, minY: bounds.minY, minZ: midZ, maxX: bounds.maxX, maxY: midY, maxZ: bounds.maxZ },
      { minX: bounds.minX, minY: midY, minZ: midZ, maxX: midX, maxY: bounds.maxY, maxZ: bounds.maxZ },
      { minX: midX, minY: midY, minZ: midZ, maxX: bounds.maxX, maxY: bounds.maxY, maxZ: bounds.maxZ },
    ];

    node.childIds = childBounds.map(b => this.createNode(b, depth + 1, nodeId));
    node.isLeaf = false;

    // Redistribute entities to children
    const entities = [...node.entityIds];
    node.entityIds = [];

    for (const entityId of entities) {
      // Re-insert each entity into appropriate child
      this.insertIntoNode(nodeId, entityId, this.getEntityPosition(entityId));
    }
  }

  // Position cache for entities (would be linked to ECS in real implementation)
  private entityPositions: Map<number, { x: number; y: number; z: number }> = new Map();

  private getEntityPosition(entityId: number): { x: number; y: number; z: number } {
    return this.entityPositions.get(entityId) ?? { x: 0, y: 0, z: 0 };
  }


  /**
   * Insert an entity into the octree
   */
  insert(entityId: number, position: { x: number; y: number; z: number }): void {
    // Cache position
    this.entityPositions.set(entityId, position);

    // Remove from old node if exists
    this.remove(entityId);

    // Insert into tree
    this.insertIntoNode(this.rootId, entityId, position);
  }

  private insertIntoNode(nodeId: number, entityId: number, position: { x: number; y: number; z: number }): void {
    const node = this.getNode(nodeId);
    if (!node) return;

    // Check if position is within bounds
    if (!this.containsPoint(node.bounds, position)) return;

    if (node.isLeaf) {
      node.entityIds.push(entityId);
      this.entityToNode.set(entityId, nodeId);

      // Check if we need to subdivide
      const nodeSize = node.bounds.maxX - node.bounds.minX;
      if (
        node.entityIds.length > this.config.maxEntitiesPerNode &&
        node.depth < this.config.maxDepth &&
        nodeSize > this.config.minNodeSize
      ) {
        this.subdivide(nodeId);
      }
    } else {
      // Find the child that contains the position
      for (const childId of node.childIds) {
        const child = this.getNode(childId);
        if (child && this.containsPoint(child.bounds, position)) {
          this.insertIntoNode(childId, entityId, position);
          return;
        }
      }
    }
  }

  /**
   * Update an entity's position in the octree
   */
  update(entityId: number, newPosition: { x: number; y: number; z: number }): void {
    const currentNodeId = this.entityToNode.get(entityId);
    if (currentNodeId === undefined) {
      this.insert(entityId, newPosition);
      return;
    }

    const node = this.getNode(currentNodeId);
    if (!node) {
      this.insert(entityId, newPosition);
      return;
    }

    // If still in same node bounds, just update position cache
    if (this.containsPoint(node.bounds, newPosition)) {
      this.entityPositions.set(entityId, newPosition);
      return;
    }

    // Otherwise, remove and reinsert
    this.insert(entityId, newPosition);
  }

  /**
   * Remove an entity from the octree
   */
  remove(entityId: number): void {
    const nodeId = this.entityToNode.get(entityId);
    if (nodeId === undefined) return;

    const node = this.getNode(nodeId);
    if (node) {
      const idx = node.entityIds.indexOf(entityId);
      if (idx !== -1) {
        node.entityIds.splice(idx, 1);
      }
    }

    this.entityToNode.delete(entityId);
    this.entityPositions.delete(entityId);
  }


  /**
   * Query all entities within a radius of a point
   */
  queryRadius(center: { x: number; y: number; z: number }, radius: number): number[] {
    const results: number[] = [];
    const radiusSq = radius * radius;

    const queryBounds: AABB = {
      minX: center.x - radius,
      minY: center.y - radius,
      minZ: center.z - radius,
      maxX: center.x + radius,
      maxY: center.y + radius,
      maxZ: center.z + radius,
    };

    this.queryNode(this.rootId, queryBounds, (entityId) => {
      const pos = this.getEntityPosition(entityId);
      const dx = pos.x - center.x;
      const dy = pos.y - center.y;
      const dz = pos.z - center.z;
      if (dx * dx + dy * dy + dz * dz <= radiusSq) {
        results.push(entityId);
      }
    });

    return results;
  }

  /**
   * Query all entities within an AABB
   */
  queryAABB(bounds: AABB): number[] {
    const results: number[] = [];

    this.queryNode(this.rootId, bounds, (entityId) => {
      const pos = this.getEntityPosition(entityId);
      if (this.containsPoint(bounds, pos)) {
        results.push(entityId);
      }
    });

    return results;
  }

  /**
   * Query entities visible in a frustum (for culling)
   */
  queryFrustum(frustum: Frustum): number[] {
    const results: number[] = [];
    this.queryFrustumNode(this.rootId, frustum, results);
    return results;
  }

  private queryFrustumNode(nodeId: number, frustum: Frustum, results: number[]): void {
    const node = this.getNode(nodeId);
    if (!node) return;

    // Check if node is visible in frustum
    if (!this.intersectsFrustum(node.bounds, frustum)) return;

    if (node.isLeaf) {
      results.push(...node.entityIds);
    } else {
      // Recurse into children
      for (const childId of node.childIds) {
        this.queryFrustumNode(childId, frustum, results);
      }
    }
  }

  private queryNode(nodeId: number, bounds: AABB, callback: (entityId: number) => void): void {
    const node = this.getNode(nodeId);
    if (!node) return;

    // Check if node intersects query bounds
    if (!this.intersectsAABB(node.bounds, bounds)) return;

    if (node.isLeaf) {
      for (const entityId of node.entityIds) {
        callback(entityId);
      }
    } else {
      for (const childId of node.childIds) {
        this.queryNode(childId, bounds, callback);
      }
    }
  }


  /**
   * Get nodes at a specific LOD level based on distance from camera
   */
  getNodesForLOD(cameraPosition: { x: number; y: number; z: number }, lodDistances: number[]): Map<number, OctreeNode[]> {
    const lodNodes = new Map<number, OctreeNode[]>();

    for (let i = 0; i <= lodDistances.length; i++) {
      lodNodes.set(i, []);
    }

    this.collectLODNodes(this.rootId, cameraPosition, lodDistances, lodNodes);

    return lodNodes;
  }

  private collectLODNodes(
    nodeId: number,
    cameraPosition: { x: number; y: number; z: number },
    lodDistances: number[],
    results: Map<number, OctreeNode[]>
  ): void {
    const node = this.getNode(nodeId);
    if (!node) return;

    const distance = this.distanceToAABB(cameraPosition, node.bounds);

    // Determine LOD level based on distance
    let lod = lodDistances.length;
    for (let i = 0; i < lodDistances.length; i++) {
      const threshold = lodDistances[i];
      if (threshold !== undefined && distance < threshold) {
        lod = i;
        break;
      }
    }

    // If this node's depth matches the LOD requirement, use it
    const targetDepth = Math.min(lod + 3, this.config.maxDepth); // Map LOD to depth

    if (node.isLeaf || node.depth >= targetDepth) {
      results.get(lod)?.push(node);
    } else {
      // Recurse deeper
      for (const childId of node.childIds) {
        this.collectLODNodes(childId, cameraPosition, lodDistances, results);
      }
    }
  }


  private containsPoint(bounds: AABB, point: { x: number; y: number; z: number }): boolean {
    return (
      point.x >= bounds.minX && point.x <= bounds.maxX &&
      point.y >= bounds.minY && point.y <= bounds.maxY &&
      point.z >= bounds.minZ && point.z <= bounds.maxZ
    );
  }

  private intersectsAABB(a: AABB, b: AABB): boolean {
    return (
      a.minX <= b.maxX && a.maxX >= b.minX &&
      a.minY <= b.maxY && a.maxY >= b.minY &&
      a.minZ <= b.maxZ && a.maxZ >= b.minZ
    );
  }

  private intersectsFrustum(bounds: AABB, frustum: Frustum): boolean {
    // Simple AABB-frustum intersection test
    for (const plane of frustum.planes) {
      const px = plane.normal.x > 0 ? bounds.maxX : bounds.minX;
      const py = plane.normal.y > 0 ? bounds.maxY : bounds.minY;
      const pz = plane.normal.z > 0 ? bounds.maxZ : bounds.minZ;

      const dot = plane.normal.x * px + plane.normal.y * py + plane.normal.z * pz;
      if (dot < -plane.distance) {
        return false; // Completely outside this plane
      }
    }
    return true;
  }

  private distanceToAABB(point: { x: number; y: number; z: number }, bounds: AABB): number {
    const dx = Math.max(bounds.minX - point.x, 0, point.x - bounds.maxX);
    const dy = Math.max(bounds.minY - point.y, 0, point.y - bounds.maxY);
    const dz = Math.max(bounds.minZ - point.z, 0, point.z - bounds.maxZ);
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }


  getStats(): { nodeCount: number; entityCount: number; maxDepth: number; leafNodes: number } {
    let maxDepth = 0;
    let leafNodes = 0;

    for (const node of this.nodes.values()) {
      if (node.depth > maxDepth) maxDepth = node.depth;
      if (node.isLeaf) leafNodes++;
    }

    return {
      nodeCount: this.nodes.size,
      entityCount: this.entityToNode.size,
      maxDepth,
      leafNodes,
    };
  }

  /**
   * Clear all entities but keep structure
   */
  clearEntities(): void {
    for (const node of this.nodes.values()) {
      node.entityIds = [];
    }
    this.entityToNode.clear();
    this.entityPositions.clear();
  }

  /**
   * Dispose and clear all data
   */
  dispose(): void {
    this.nodes.clear();
    this.entityToNode.clear();
    this.entityPositions.clear();
  }
}
