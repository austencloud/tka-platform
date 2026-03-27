<script lang="ts">
	/**
	 * RemotePlayerAvatar
	 *
	 * 3D representation of a remote player in the gallery.
	 * Currently uses a glowing orb with profile picture texture.
	 * Can be upgraded to full Avatar3D later.
	 */

	import { T, useTask, useThrelte } from '@threlte/core';
	import { onMount } from 'svelte';
	import { TextureLoader, Color, type Group, type Texture } from 'three';
	import type { RemotePlayer } from '../domain/multiplayer-models';
	import PlayerNameTag from './PlayerNameTag.svelte';

	interface Props {
		/** Remote player data */
		player: RemotePlayer;
		/** Whether to show name tag */
		showNameTag?: boolean;
	}

	let { player, showNameTag = true }: Props = $props();

	const { camera } = useThrelte();

	// Avatar orb parameters
	const ORB_RADIUS = 30;
	const ORB_HEIGHT_OFFSET = 160; // Height above ground (roughly head height)

	// Load profile picture as texture
	let profileTexture: Texture | null = $state(null);

	onMount(() => {
		if (player.avatarUrl) {
			const loader = new TextureLoader();
			loader.crossOrigin = 'anonymous';
			loader.load(
				player.avatarUrl,
				(texture) => {
					profileTexture = texture;
				},
				undefined,
				(error) => {
					console.warn('Failed to load avatar texture:', error);
				}
			);
		}
	});

	// Color based on status
	const orbColor = $derived(
		player.status === 'active'
			? new Color(0x60a5fa) // Blue
			: player.status === 'idle'
				? new Color(0xfbbf24) // Yellow
				: new Color(0x6b7280) // Gray
	);

	// Glow intensity based on status
	const glowIntensity = $derived(player.status === 'active' ? 1.5 : 0.8);

	// Position with height offset
	const avatarPosition = $derived([
		player.position.x,
		player.position.y + ORB_HEIGHT_OFFSET,
		player.position.z
	] as [number, number, number]);

	// Billboard rotation (face camera)
	let orbGroupRef: Group | undefined = $state();

	useTask(() => {
		if (orbGroupRef && camera.current) {
			// Make the orb face the camera (billboard effect)
			orbGroupRef.quaternion.copy(camera.current.quaternion);
		}
	});

	// Movement trail effect (subtle)
	const isMoving = $derived(player.locomotion.isMoving);
</script>

<T.Group position={avatarPosition}>
	<!-- Main avatar orb -->
	<T.Group bind:ref={orbGroupRef}>
		<!-- Outer glow sphere -->
		<T.Mesh>
			<T.SphereGeometry args={[ORB_RADIUS * 1.3, 16, 16]} />
			<T.MeshBasicMaterial
				color={orbColor}
				transparent
				opacity={0.15 * glowIntensity}
			/>
		</T.Mesh>

		<!-- Inner orb with profile picture or solid color -->
		<T.Mesh>
			<T.SphereGeometry args={[ORB_RADIUS, 24, 24]} />
			{#if profileTexture}
				<T.MeshBasicMaterial map={profileTexture} />
			{:else}
				<T.MeshStandardMaterial
					color={orbColor}
					emissive={orbColor}
					emissiveIntensity={0.3}
					roughness={0.4}
					metalness={0.1}
				/>
			{/if}
		</T.Mesh>

		<!-- Core glow -->
		<T.Mesh>
			<T.SphereGeometry args={[ORB_RADIUS * 0.5, 12, 12]} />
			<T.MeshBasicMaterial
				color={orbColor}
				transparent
				opacity={0.8}
			/>
		</T.Mesh>
	</T.Group>

	<!-- Movement indicator (trail-like effect when moving) -->
	{#if isMoving}
		<T.Mesh position={[0, 0, 15]}>
			<T.SphereGeometry args={[ORB_RADIUS * 0.4, 8, 8]} />
			<T.MeshBasicMaterial color={orbColor} transparent opacity={0.3} />
		</T.Mesh>
		<T.Mesh position={[0, 0, 30]}>
			<T.SphereGeometry args={[ORB_RADIUS * 0.25, 8, 8]} />
			<T.MeshBasicMaterial color={orbColor} transparent opacity={0.15} />
		</T.Mesh>
	{/if}

	<!-- Point light for local illumination -->
	<T.PointLight
		color={orbColor}
		intensity={50 * glowIntensity}
		distance={200}
		decay={2}
	/>
</T.Group>

<!-- Name tag above player -->
{#if showNameTag}
	<PlayerNameTag
		name={player.displayName}
		position={{
			x: player.position.x,
			y: player.position.y + ORB_HEIGHT_OFFSET,
			z: player.position.z
		}}
		status={player.status}
	/>
{/if}
