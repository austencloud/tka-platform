/**
 * Three.js Camera Layers for First-Person Viewmodel System
 *
 * Three.js objects have 32 available layers (0-31). A camera only renders
 * objects that share at least one enabled layer with the camera.
 *
 * This system uses layers to:
 * - Hide the player's own body in first-person (prevents seeing inside own mesh)
 * - Show viewmodel (props/hands) only in first-person
 * - Keep other players' bodies always visible
 *
 * References:
 * - Three.js layers: https://threejs.org/docs/#api/en/core/Object3D.layers
 * - Threlte layers plugin: https://threlte.xyz/docs/reference/extras/layers
 */

/**
 * Layer 0: World objects
 * Default layer for all objects. Environment, other players, world props.
 * Visible in all camera modes.
 */
export const LAYER_WORLD = 0;

/**
 * Layer 1: Player body
 * The local player's avatar body. Hidden in first-person to prevent
 * seeing inside own mesh. Visible in orbit and third-person.
 */
export const LAYER_PLAYER_BODY = 1;

/**
 * Layer 2: Viewmodel
 * Props/hands rendered in first-person only. These are positioned
 * relative to the camera and rendered after clearing depth buffer
 * to prevent clipping through world geometry.
 */
export const LAYER_VIEWMODEL = 2;

/**
 * Get layers array for camera based on camera mode.
 *
 * @param isFirstPerson - Whether camera is in first-person mode
 * @returns Array of layer indices the camera should render
 */
export function getCameraLayers(isFirstPerson: boolean): number[] {
	if (isFirstPerson) {
		// First-person: See world + viewmodel, NOT own body
		return [LAYER_WORLD, LAYER_VIEWMODEL];
	} else {
		// Orbit/Third-person: See world + own body, NOT viewmodel
		return [LAYER_WORLD, LAYER_PLAYER_BODY];
	}
}

/**
 * Check if an object should be on the player body layer.
 * Used to determine if this is the "active" player's avatar.
 *
 * @param isLocalPlayer - Whether this avatar belongs to the local player
 * @param isActive - Whether this is the currently controlled avatar
 */
export function shouldUsePlayerBodyLayer(
	isLocalPlayer: boolean,
	isActive: boolean
): boolean {
	// Only the active local player's body goes on the special layer
	// Other players' bodies stay on LAYER_WORLD so they're always visible
	return isLocalPlayer && isActive;
}
