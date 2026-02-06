<script lang="ts">
	/**
	 * PlayerNameTag
	 *
	 * Billboard text that always faces the camera, showing player name.
	 * Positioned above the player's avatar.
	 */

	import { T, useThrelte, useTask } from '@threlte/core';
	import { Text } from '@threlte/extras';
	import { type Group } from 'three';

	interface Props {
		/** Player's display name */
		name: string;
		/** Position above the player */
		position: { x: number; y: number; z: number };
		/** Player status affects color */
		status?: 'active' | 'idle' | 'away';
	}

	let { name, position, status = 'active' }: Props = $props();

	const { camera } = useThrelte();

	// Color based on status
	const textColor = $derived(
		status === 'active' ? '#ffffff' : status === 'idle' ? '#a0a0a0' : '#606060'
	);

	// Billboard rotation (face camera)
	let groupRef: Group | undefined = $state();

	// Update billboard rotation each frame using useTask
	useTask(() => {
		if (groupRef && camera.current) {
			// Make the name tag face the camera
			groupRef.quaternion.copy(camera.current.quaternion);
		}
	});
</script>

<T.Group bind:ref={groupRef} position={[position.x, position.y + 50, position.z]}>
	<!-- Background panel -->
	<T.Mesh position={[0, 0, -1]}>
		<T.PlaneGeometry args={[name.length * 12 + 20, 28]} />
		<T.MeshBasicMaterial color="#000000" opacity={0.6} transparent />
	</T.Mesh>

	<!-- Player name text -->
	<Text
		text={name}
		fontSize={18}
		color={textColor}
		anchorX="center"
		anchorY="middle"
		font="/fonts/inter-medium.woff"
	/>
</T.Group>
