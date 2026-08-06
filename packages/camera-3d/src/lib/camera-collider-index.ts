import type { Object3D } from "three";

/**
 * Collect only the scene objects that opted into third-person camera
 * collision. Raycasting the whole scene and filtering the hits afterwards
 * makes every floor, prop, avatar, and effect pay intersection cost each frame.
 */
export function collectCameraColliders(root: Object3D): Object3D[] {
	const colliders: Object3D[] = [];
	root.traverse((object) => {
		if (object.userData.cameraCollider) colliders.push(object);
	});
	return colliders;
}
