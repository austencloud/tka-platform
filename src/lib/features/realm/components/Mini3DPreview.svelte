<script lang="ts">
	/**
	 * Mini3DPreview
	 *
	 * Lightweight Threlte canvas that renders a destination-specific 3D preview.
	 * Used in destination cards to show live scene previews.
	 *
	 * Features:
	 * - Lazy loads destination-specific scene content
	 * - Responds to hover state for animations
	 * - Minimal geometry, no post-processing for performance
	 * - Graceful fallback while loading
	 */

	import { Canvas } from "@threlte/core";
	import { T } from "@threlte/core";
	import { onMount, type Component } from "svelte";

	interface Props {
		destinationId: string;
		isHovered: boolean;
		onReady?: () => void;
		onError?: (error: Error) => void;
	}

	let { destinationId, isHovered, onReady, onError }: Props = $props();

	// Scene loading state
	let SceneContent = $state<Component<{ isHovered: boolean }> | null>(null);
	let isLoading = $state(true);
	let hasError = $state(false);

	// Preview-specific camera settings (closer than full scene)
	const CAMERA_POSITION: [number, number, number] = [0, 120, 180];
	const CAMERA_FOV = 50;

	// Load destination-specific preview scene
	onMount(async () => {
		try {
			// Dynamic import of destination-specific preview
			const module = await import(`./previews/${destinationId}-preview.svelte`);
			SceneContent = module.default;
			isLoading = false;
			onReady?.();
		} catch (err) {
			console.warn(`[Mini3DPreview] Failed to load preview for "${destinationId}":`, err);
			hasError = true;
			isLoading = false;
			onError?.(err instanceof Error ? err : new Error(String(err)));
		}
	});
</script>

<div class="mini-preview" class:loading={isLoading} class:error={hasError}>
	{#if !hasError}
		<Canvas>
			<!-- Camera -->
			<T.PerspectiveCamera
				makeDefault
				position={CAMERA_POSITION}
				fov={CAMERA_FOV}
			/>

			<!-- Lighting (simplified for performance) -->
			<T.AmbientLight intensity={0.5} color="#ffffff" />
			<T.DirectionalLight
				position={[100, 150, 100]}
				intensity={0.7}
				castShadow={false}
			/>

			<!-- Scene content (lazy loaded) -->
			{#if SceneContent}
				<SceneContent {isHovered} />
			{/if}
		</Canvas>
	{/if}

	<!-- Loading overlay -->
	{#if isLoading}
		<div class="loading-overlay">
			<div class="loading-spinner"></div>
		</div>
	{/if}
</div>

<style>
	.mini-preview {
		position: absolute;
		inset: 0;
		background: linear-gradient(
			135deg,
			rgba(139, 92, 246, 0.1),
			rgba(6, 182, 212, 0.1)
		);
	}

	.mini-preview :global(canvas) {
		width: 100% !important;
		height: 100% !important;
	}

	.loading-overlay {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: inherit;
	}

	.loading-spinner {
		width: 32px;
		height: 32px;
		border: 3px solid rgba(255, 255, 255, 0.1);
		border-top-color: rgba(139, 92, 246, 0.6);
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.error {
		display: flex;
		align-items: center;
		justify-content: center;
	}
</style>
