/**
 * PlacedObjectRenderer
 *
 * Creates Three.js meshes for placed objects.
 * Uses primitive geometries as fallbacks, with GLTF support for future.
 */

import {
	Mesh,
	Group,
	ConeGeometry,
	BoxGeometry,
	CylinderGeometry,
	SphereGeometry,
	MeshStandardMaterial,
	type BufferGeometry,
} from "three";
import type { PlacedObject } from "./placed-object";
import { type ObjectDefinition, getObjectDefinition } from "./object-catalog";

export class PlacedObjectRenderer {
	private geometryCache = new Map<string, BufferGeometry>();

	/**
	 * Create a mesh for a placed object
	 */
	createMesh(object: PlacedObject): Mesh | Group {
		const definition = getObjectDefinition(object.modelKey);
		if (!definition) {
			console.warn(`Unknown object type: ${object.modelKey}, using default box`);
			return this.createDefaultMesh(object);
		}

		const mesh = this.createFallbackMesh(definition, object);

		// Store reference to domain object
		mesh.userData.placedObjectId = object.id;
		mesh.userData.objectType = object.objectType;
		mesh.userData.modelKey = object.modelKey;
		mesh.userData.isPlacedObject = true;

		// Apply transform
		mesh.position.fromArray(object.position);
		mesh.quaternion.fromArray(object.rotation);
		mesh.scale.fromArray(object.scale);

		// Apply visibility
		mesh.visible = object.visible ?? true;

		return mesh;
	}

	/**
	 * Create fallback mesh using primitive geometry
	 */
	private createFallbackMesh(def: ObjectDefinition, object: PlacedObject): Mesh | Group {
		const color = object.color ? parseInt(object.color.replace("#", ""), 16) : def.color;
		const isZone = def.type === "zone";

		const material = new MeshStandardMaterial({
			color,
			metalness: 0.1,
			roughness: 0.8,
			transparent: isZone,
			opacity: isZone ? 0.4 : 1,
		});

		let geometry: BufferGeometry;
		const s = def.defaultScale;

		switch (def.fallbackGeometry) {
			case "cone":
				geometry = this.getCachedGeometry(`cone-${s}`, () => new ConeGeometry(s * 0.4, s, 8));
				break;

			case "box":
				geometry = this.getCachedGeometry(
					`box-${s}`,
					() => new BoxGeometry(s, s * 0.5, s),
				);
				break;

			case "cylinder":
				geometry = this.getCachedGeometry(
					`cylinder-${s}`,
					() => new CylinderGeometry(s * 0.5, s * 0.5, s * 0.3, 16),
				);
				break;

			case "sphere":
				geometry = this.getCachedGeometry(
					`sphere-${s}`,
					() => new SphereGeometry(s * 0.5, 16, 12),
				);
				break;

			case "flag":
				return this.createFlagMesh(def, color);

			default:
				geometry = this.getCachedGeometry("default-box", () => new BoxGeometry(1, 1, 1));
		}

		const mesh = new Mesh(geometry, material);

		// Offset by default height
		if (def.defaultHeight > 0) {
			mesh.position.y = def.defaultHeight;
		}

		// Cast shadows for non-zones
		if (!isZone) {
			mesh.castShadow = true;
			mesh.receiveShadow = true;
		}

		return mesh;
	}

	/**
	 * Create a flag mesh (pole + flag)
	 */
	private createFlagMesh(def: ObjectDefinition, color: number): Group {
		const group = new Group();

		// Pole
		const poleGeometry = this.getCachedGeometry(
			"flag-pole",
			() => new CylinderGeometry(0.05, 0.05, 3, 8),
		);
		const poleMaterial = new MeshStandardMaterial({
			color: 0x8b4513,
			metalness: 0.3,
			roughness: 0.7,
		});
		const pole = new Mesh(poleGeometry, poleMaterial);
		pole.position.y = 1.5;
		pole.castShadow = true;
		group.add(pole);

		// Flag
		const flagGeometry = this.getCachedGeometry(
			"flag-cloth",
			() => new BoxGeometry(1, 0.6, 0.02),
		);
		const flagMaterial = new MeshStandardMaterial({
			color,
			metalness: 0,
			roughness: 0.9,
		});
		const flag = new Mesh(flagGeometry, flagMaterial);
		flag.position.set(0.5, 2.5, 0);
		flag.castShadow = true;
		group.add(flag);

		return group;
	}

	/**
	 * Create a default box mesh for unknown objects
	 */
	private createDefaultMesh(object: PlacedObject): Mesh {
		const geometry = this.getCachedGeometry("default-box", () => new BoxGeometry(1, 1, 1));
		const material = new MeshStandardMaterial({
			color: 0xff00ff, // Magenta = error color
			metalness: 0.1,
			roughness: 0.8,
		});
		const mesh = new Mesh(geometry, material);
		mesh.userData.placedObjectId = object.id;
		mesh.userData.isPlacedObject = true;
		mesh.position.fromArray(object.position);
		mesh.quaternion.fromArray(object.rotation);
		mesh.scale.fromArray(object.scale);
		return mesh;
	}

	/**
	 * Get or create cached geometry
	 */
	private getCachedGeometry(key: string, factory: () => BufferGeometry): BufferGeometry {
		let geometry = this.geometryCache.get(key);
		if (!geometry) {
			geometry = factory();
			this.geometryCache.set(key, geometry);
		}
		return geometry;
	}

	/**
	 * Update mesh from object data (after transform change)
	 */
	updateMesh(mesh: Mesh | Group, object: PlacedObject): void {
		mesh.position.fromArray(object.position);
		mesh.quaternion.fromArray(object.rotation);
		mesh.scale.fromArray(object.scale);
		mesh.visible = object.visible ?? true;

		// Update color if it's a single mesh
		if (mesh instanceof Mesh && object.color) {
			const material = mesh.material as MeshStandardMaterial;
			material.color.setHex(parseInt(object.color.replace("#", ""), 16));
		}
	}

	/**
	 * Dispose all cached geometries
	 */
	dispose(): void {
		for (const geometry of this.geometryCache.values()) {
			geometry.dispose();
		}
		this.geometryCache.clear();
	}
}

/**
 * Singleton instance for use across the module
 */
let rendererInstance: PlacedObjectRenderer | null = null;

export function getPlacedObjectRenderer(): PlacedObjectRenderer {
	if (!rendererInstance) {
		rendererInstance = new PlacedObjectRenderer();
	}
	return rendererInstance;
}
