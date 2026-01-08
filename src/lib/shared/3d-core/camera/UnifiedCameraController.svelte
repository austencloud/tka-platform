<script lang="ts">
	/**
	 * Unified Camera Controller
	 *
	 * Single component handling both first-person and third-person camera modes
	 * with smooth transitions. Used across all 3D destinations (Stage, Gallery, Worlds).
	 *
	 * Features:
	 * - Press V to toggle between first-person and third-person
	 * - Smooth transitions using slerp (spherical interpolation)
	 * - Physics-aware (works with/without Rapier)
	 * - Configurable per destination
	 */

	import type { Camera as ThreeCamera, Vector3 as ThreeVector3 } from "three";
	import { Vector3 } from "three";
	import {
		CameraMode,
		DEFAULT_CAMERA_CONFIG,
		type CameraConfig,
		type CameraState,
		type PhysicsProvider,
		type Vector3 as Vec3,
		type Rotation,
	} from "./types";
	import { cameraPreferences } from "./camera-preferences.svelte";
	import {
		lerpVector3,
		slerpRotation,
		cubicBezier,
		clamp,
	} from "./transitions";

	interface Props {
		camera: ThreeCamera;
		destinationId: string;
		config?: Partial<CameraConfig>;
		physicsProvider?: PhysicsProvider;
		target?: ThreeVector3; // For 3rd person follow target
		onModeChange?: (mode: CameraMode) => void;
	}

	let {
		camera,
		destinationId,
		config = {},
		physicsProvider,
		target,
		onModeChange,
	}: Props = $props();

	// Merge with defaults
	const fullConfig: CameraConfig = { ...DEFAULT_CAMERA_CONFIG, ...config };

	// Camera state
	let state = $state<CameraState>({
		mode: cameraPreferences.getModeForDestination(destinationId),
		position: { x: 0, y: fullConfig.eyeHeight, z: 0 },
		rotation: { yaw: 0, pitch: 0 },
		target: null,
		isTransitioning: false,
		transitionProgress: 0,
	});

	// Transition state (before/after for interpolation)
	let transitionStart: { position: Vec3; rotation: Rotation } | null = null;
	let transitionTarget: { position: Vec3; rotation: Rotation } | null = null;
	let transitionTime = 0;

	// Input state
	let moveInput = { forward: 0, right: 0 }; // -1 to 1
	let mouseDelta = { x: 0, y: 0 };
	let isPointerLocked = false;

	// Movement vectors (reused every frame)
	const forward = new Vector3();
	const right = new Vector3();
	const moveDir = new Vector3();

	/**
	 * Toggle camera mode (V key)
	 */
	function toggleCameraMode() {
		if (state.isTransitioning) return; // Don't allow toggle during transition

		const newMode = cameraPreferences.toggleMode(destinationId);
		startTransition(newMode);

		if (onModeChange) {
			onModeChange(newMode);
		}
	}

	/**
	 * Start transition to new camera mode
	 */
	function startTransition(newMode: CameraMode) {
		// Capture current state as transition start
		transitionStart = {
			position: { ...state.position },
			rotation: { ...state.rotation },
		};

		// Calculate target state for new mode
		const targetState = calculateTargetState(newMode);
		transitionTarget = targetState;

		// Begin transition
		state.isTransitioning = true;
		state.transitionProgress = 0;
		transitionTime = 0;
		state.mode = newMode;
	}

	/**
	 * Calculate target camera state for a mode
	 */
	function calculateTargetState(mode: CameraMode): {
		position: Vec3;
		rotation: Rotation;
	} {
		if (mode === CameraMode.FIRST_PERSON) {
			// First person: camera at eye height, use current rotation
			return {
				position: {
					x: state.position.x,
					y: fullConfig.eyeHeight,
					z: state.position.z,
				},
				rotation: state.rotation,
			};
		} else {
			// Third person: calculate orbital position around target
			const targetPos = target || new Vector3(state.position.x, 0, state.position.z);
			const distance = fullConfig.distance;
			const height = fullConfig.height;
			const yaw = state.rotation.yaw;
			const pitch = clamp(
				state.rotation.pitch,
				fullConfig.minPitch,
				fullConfig.maxPitch,
			);

			return {
				position: {
					x: targetPos.x - Math.sin(yaw) * distance * Math.cos(pitch),
					y: targetPos.y + height + Math.sin(pitch) * distance * 0.5,
					z: targetPos.z - Math.cos(yaw) * distance * Math.cos(pitch),
				},
				rotation: { yaw, pitch },
			};
		}
	}

	/**
	 * Update camera transition
	 */
	function updateTransition(deltaTime: number) {
		if (!state.isTransitioning || !transitionStart || !transitionTarget) return;

		transitionTime += deltaTime;
		const rawProgress = transitionTime / fullConfig.blendDuration;

		if (rawProgress >= 1) {
			// Transition complete
			state.position = transitionTarget.position;
			state.rotation = transitionTarget.rotation;
			state.isTransitioning = false;
			state.transitionProgress = 1;
			transitionStart = null;
			transitionTarget = null;
		} else {
			// Interpolate using cubic bezier easing
			const easedProgress = cubicBezier(rawProgress);
			state.transitionProgress = easedProgress;

			// Interpolate position
			state.position = lerpVector3(
				transitionStart.position,
				transitionTarget.position,
				easedProgress,
			);

			// Interpolate rotation with slerp
			state.rotation = slerpRotation(
				transitionStart.rotation,
				transitionTarget.rotation,
				easedProgress,
			);

			// Interpolate FOV if enabled
			if (fullConfig.fovTransition && "fov" in camera && "updateProjectionMatrix" in camera) {
				const fovStart =
					state.mode === CameraMode.FIRST_PERSON
						? fullConfig.fovThirdPerson
						: fullConfig.fovFirstPerson;
				const fovEnd =
					state.mode === CameraMode.FIRST_PERSON
						? fullConfig.fovFirstPerson
						: fullConfig.fovThirdPerson;
				(camera as any).fov = fovStart + (fovEnd - fovStart) * easedProgress;
				(camera as any).updateProjectionMatrix();
			}
		}
	}

	/**
	 * Update camera rotation from mouse input
	 */
	function updateRotation() {
		if (mouseDelta.x !== 0 || mouseDelta.y !== 0) {
			state.rotation.yaw -= mouseDelta.x * fullConfig.mouseSensitivity;
			state.rotation.pitch -= mouseDelta.y * fullConfig.mouseSensitivity;

			// Clamp pitch
			state.rotation.pitch = clamp(
				state.rotation.pitch,
				fullConfig.lookAngleLimitDown,
				fullConfig.lookAngleLimitUp,
			);

			// Reset mouse delta
			mouseDelta.x = 0;
			mouseDelta.y = 0;
		}
	}

	/**
	 * Update camera position from movement input
	 */
	function updateMovement(deltaTime: number) {
		if (state.isTransitioning) return; // Don't move during transition

		// Calculate movement direction from input
		const hasInput = moveInput.forward !== 0 || moveInput.right !== 0;
		if (!hasInput) return;

		// Get forward and right vectors from camera rotation
		const yaw = state.rotation.yaw;
		forward.set(-Math.sin(yaw), 0, -Math.cos(yaw));
		right.set(Math.cos(yaw), 0, -Math.sin(yaw));

		// Combine inputs
		moveDir.set(0, 0, 0);
		moveDir.addScaledVector(forward, moveInput.forward);
		moveDir.addScaledVector(right, moveInput.right);
		moveDir.normalize();

		// Apply movement
		if (physicsProvider) {
			// Use physics provider
			physicsProvider.movePlayer(
				{ x: moveDir.x, y: moveDir.y, z: moveDir.z },
				deltaTime,
			);
			const newPos = physicsProvider.getPlayerPosition();
			state.position = newPos;
		} else {
			// Kinematic movement (no physics)
			const speed = 5; // Base movement speed
			state.position.x += moveDir.x * speed * deltaTime;
			state.position.z += moveDir.z * speed * deltaTime;
		}
	}

	/**
	 * Apply camera state to Three.js camera
	 */
	function applyToCamera() {
		// Set rotation (YXZ order for FPS-style)
		camera.rotation.order = "YXZ";
		camera.rotation.y = state.rotation.yaw;
		camera.rotation.x = state.rotation.pitch;

		// Set position
		camera.position.set(state.position.x, state.position.y, state.position.z);
	}

	/**
	 * Main update loop (called every frame)
	 */
	export function update(deltaTime: number) {
		updateTransition(deltaTime);
		updateRotation();
		updateMovement(deltaTime);
		applyToCamera();
	}

	/**
	 * Keyboard event handlers
	 */
	function onKeyDown(event: KeyboardEvent) {
		switch (event.key.toLowerCase()) {
			case "w":
				moveInput.forward = 1;
				break;
			case "s":
				moveInput.forward = -1;
				break;
			case "a":
				moveInput.right = -1;
				break;
			case "d":
				moveInput.right = 1;
				break;
			case "v":
				toggleCameraMode();
				break;
		}
	}

	function onKeyUp(event: KeyboardEvent) {
		switch (event.key.toLowerCase()) {
			case "w":
			case "s":
				moveInput.forward = 0;
				break;
			case "a":
			case "d":
				moveInput.right = 0;
				break;
		}
	}

	/**
	 * Mouse event handlers
	 */
	function onMouseMove(event: MouseEvent) {
		if (!isPointerLocked) return;

		mouseDelta.x += event.movementX;
		mouseDelta.y += event.movementY;
	}

	function onPointerLockChange() {
		isPointerLocked = document.pointerLockElement !== null;
	}

	/**
	 * Request pointer lock (call from parent when canvas is clicked)
	 */
	export function requestPointerLock(element: HTMLElement) {
		element.requestPointerLock();
	}

	/**
	 * Lifecycle
	 */
	$effect(() => {
		// Add event listeners
		window.addEventListener("keydown", onKeyDown);
		window.addEventListener("keyup", onKeyUp);
		window.addEventListener("mousemove", onMouseMove);
		document.addEventListener("pointerlockchange", onPointerLockChange);

		return () => {
			// Cleanup
			window.removeEventListener("keydown", onKeyDown);
			window.removeEventListener("keyup", onKeyUp);
			window.removeEventListener("mousemove", onMouseMove);
			document.removeEventListener("pointerlockchange", onPointerLockChange);
		};
	});
</script>

<!-- No visual output - controller only -->
