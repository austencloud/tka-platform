/**
 * Player Avatar for Infinite Worlds
 *
 * Creates a simple capsule-based avatar for the player.
 * Used in third-person mode to show player position.
 */

import {
	Group,
	Mesh,
	CapsuleGeometry,
	MeshStandardMaterial,
	SphereGeometry,
} from "three";

// Avatar dimensions (meters)
const CAPSULE_RADIUS = 0.3;
const CAPSULE_HEIGHT = 1.4; // Body height (excluding head)
const HEAD_RADIUS = 0.2;
const HEAD_Y_OFFSET = 0.9; // Above capsule center

/**
 * Create a simple humanoid avatar mesh
 * Returns a Group containing the avatar parts
 */
export function createPlayerAvatarMesh(): Group {
	const avatarGroup = new Group();
	avatarGroup.name = "PlayerAvatar";

	// Body (capsule)
	const bodyGeometry = new CapsuleGeometry(CAPSULE_RADIUS, CAPSULE_HEIGHT, 8, 16);
	const bodyMaterial = new MeshStandardMaterial({
		color: 0x4a90d9, // Blue
		roughness: 0.7,
		metalness: 0.1,
	});
	const bodyMesh = new Mesh(bodyGeometry, bodyMaterial);
	bodyMesh.castShadow = true;
	bodyMesh.receiveShadow = true;
	avatarGroup.add(bodyMesh);

	// Head (sphere)
	const headGeometry = new SphereGeometry(HEAD_RADIUS, 16, 12);
	const headMaterial = new MeshStandardMaterial({
		color: 0xf5d0c5, // Skin tone
		roughness: 0.8,
		metalness: 0,
	});
	const headMesh = new Mesh(headGeometry, headMaterial);
	headMesh.position.y = HEAD_Y_OFFSET;
	headMesh.castShadow = true;
	avatarGroup.add(headMesh);

	return avatarGroup;
}

/**
 * Update avatar visibility based on camera mode
 * @param avatarGroup The avatar group to update
 * @param isFirstPerson Whether camera is in first-person mode
 */
export function setAvatarVisibility(avatarGroup: Group | null, isFirstPerson: boolean): void {
	if (!avatarGroup) return;
	avatarGroup.visible = !isFirstPerson;
}

/**
 * Update avatar position and rotation
 * @param avatarGroup The avatar group to update
 * @param position World position
 * @param yaw Facing direction (radians)
 */
export function updateAvatarTransform(
	avatarGroup: Group | null,
	position: { x: number; y: number; z: number },
	yaw: number
): void {
	if (!avatarGroup) return;

	avatarGroup.position.set(position.x, position.y, position.z);
	avatarGroup.rotation.y = yaw;
}

/**
 * Dispose of avatar resources
 */
export function disposePlayerAvatar(avatarGroup: Group | null): void {
	if (!avatarGroup) return;

	avatarGroup.traverse((child) => {
		if (child instanceof Mesh) {
			child.geometry.dispose();
			if (child.material instanceof MeshStandardMaterial) {
				child.material.dispose();
			}
		}
	});
}
