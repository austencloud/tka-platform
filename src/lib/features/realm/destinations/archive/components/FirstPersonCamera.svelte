<script lang="ts">
	/**
	 * FirstPersonCamera — Proper FPS camera for indoor scenes.
	 *
	 * Uses the Three.js PointerLockControls pattern:
	 * - Euler 'YXZ' order → quaternion (no lookAt, no gimbal lock)
	 * - Rotation applied in mousemove handler (immediate, no lag)
	 * - Movement on XZ plane relative to camera facing
	 */
	import { T, useThrelte, useTask } from "@threlte/core";
	import { onMount, onDestroy } from "svelte";
	import * as THREE from "three";

	interface Props {
		position?: [number, number, number];
		lookAt?: [number, number, number];
		speed?: number;
		eyeHeight: number;
		onPositionChange?: (pos: { x: number; y: number; z: number }) => void;
	}

	let {
		position = [0, 10, 3],
		lookAt = [0, 9.5, -5],
		speed = 3,
		eyeHeight,
		onPositionChange,
	}: Props = $props();

	const { renderer } = useThrelte();

	let camera: THREE.PerspectiveCamera | null = null;
	let isLocked = $state(false);
	let domElement: HTMLCanvasElement | null = null;

	// Yaw/pitch as plain numbers (not reactive — updated in mousemove, read in useTask)
	let yaw = 0;
	let pitch = 0;

	// Reusable Euler with 'YXZ' order — prevents gimbal lock for FPS cameras
	const _euler = new THREE.Euler(0, 0, 0, "YXZ");
	const SENSITIVITY = 0.002;
	const HALF_PI = Math.PI / 2 - 0.01;

	const keys = { forward: false, backward: false, left: false, right: false };

	// Derive initial yaw/pitch from position → lookAt.
	// Three.js camera faces -Z, so yaw=0 means looking toward -Z.
	{
		const dx = lookAt[0] - position[0];
		const dy = lookAt[1] - position[1];
		const dz = lookAt[2] - position[2];
		yaw = Math.atan2(-dx, -dz);
		pitch = Math.atan2(dy, Math.sqrt(dx * dx + dz * dz));
	}

	let camX = position[0];
	let camY = eyeHeight;
	let camZ = position[2];

	// ── Event handlers (defined at module level so cleanup can reference them) ──

	function onClick() {
		if (!document.pointerLockElement && domElement) {
			console.log("[FPSCamera] CLICK → requesting pointer lock");
			domElement.requestPointerLock();
		}
	}

	function onPointerLockChange() {
		isLocked = document.pointerLockElement === domElement;
		console.log(`[FPSCamera] LOCK: ${isLocked} camera=${!!camera}`);
	}

	function onMouseMove(e: MouseEvent) {
		if (!isLocked || !camera) return;

		yaw -= e.movementX * SENSITIVITY;
		pitch -= e.movementY * SENSITIVITY;
		pitch = Math.max(-HALF_PI, Math.min(HALF_PI, pitch));

		// Apply immediately — Euler → Quaternion (the PointerLockControls pattern)
		_euler.set(pitch, yaw, 0, "YXZ");
		camera.quaternion.setFromEuler(_euler);
	}

	function onKeyDown(e: KeyboardEvent) {
		if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
		switch (e.key.toLowerCase()) {
			case "w": keys.forward = true; break;
			case "s": keys.backward = true; break;
			case "a": keys.left = true; break;
			case "d": keys.right = true; break;
		}
	}

	function onKeyUp(e: KeyboardEvent) {
		switch (e.key.toLowerCase()) {
			case "w": keys.forward = false; break;
			case "s": keys.backward = false; break;
			case "a": keys.left = false; break;
			case "d": keys.right = false; break;
		}
	}

	// ── Mount / Destroy ──

	function attach(canvas: HTMLCanvasElement) {
		domElement = canvas;
		console.log(`[FPSCamera] ATTACHED to canvas ${canvas.width}x${canvas.height}`);
		canvas.addEventListener("click", onClick);
		document.addEventListener("pointerlockchange", onPointerLockChange);
		document.addEventListener("mousemove", onMouseMove);
	}

	function detach() {
		if (domElement) {
			domElement.removeEventListener("click", onClick);
			if (document.pointerLockElement === domElement) document.exitPointerLock();
		}
		document.removeEventListener("pointerlockchange", onPointerLockChange);
		document.removeEventListener("mousemove", onMouseMove);
	}

	onMount(() => {
		const canvas =
			(renderer.current?.domElement as HTMLCanvasElement | undefined) ??
			document.querySelector<HTMLCanvasElement>("canvas[data-engine]");

		if (canvas) {
			attach(canvas);
		} else {
			// WebGPU canvas may not exist yet — poll for it
			console.log("[FPSCamera] Canvas not ready, polling...");
			let attempts = 0;
			const interval = setInterval(() => {
				const c = document.querySelector<HTMLCanvasElement>("canvas[data-engine]");
				if (c) {
					clearInterval(interval);
					attach(c);
				} else if (++attempts > 50) {
					clearInterval(interval);
					console.error("[FPSCamera] Failed to find canvas after 5s");
				}
			}, 100);
		}
	});

	onDestroy(detach);

	// ── Movement (per-frame, XZ plane, camera-relative) ──

	useTask((delta) => {
		if (!camera) return;

		if (isLocked) {
			const moveSpeed = speed * delta;
			const s = Math.sin(yaw);
			const c = Math.cos(yaw);

			// Camera faces -Z when yaw=0, so forward = (-sin, 0, -cos)
			if (keys.forward)  { camX -= s * moveSpeed; camZ -= c * moveSpeed; }
			if (keys.backward) { camX += s * moveSpeed; camZ += c * moveSpeed; }
			if (keys.left)     { camX -= c * moveSpeed; camZ += s * moveSpeed; }
			if (keys.right)    { camX += c * moveSpeed; camZ -= s * moveSpeed; }
		}

		camera.position.set(camX, camY, camZ);
		onPositionChange?.({ x: camX, y: camY, z: camZ });
	});
</script>

<svelte:window onkeydown={onKeyDown} onkeyup={onKeyUp} />

<T.PerspectiveCamera
	makeDefault
	position.x={camX}
	position.y={camY}
	position.z={camZ}
	fov={70}
	near={0.1}
	far={100}
	on:create={({ ref }) => {
		camera = ref;
		console.log("[FPSCamera] Camera CREATED");
		// Set initial orientation via Euler → Quaternion
		_euler.set(pitch, yaw, 0, "YXZ");
		ref.quaternion.setFromEuler(_euler);
	}}
/>
