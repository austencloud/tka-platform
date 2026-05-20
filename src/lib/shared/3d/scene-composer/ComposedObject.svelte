<script lang="ts">
	import { T } from '@threlte/core';
	import {
		BoxGeometry,
		SphereGeometry,
		CylinderGeometry,
		ConeGeometry,
		MeshStandardMaterial,
		Color
	} from 'three';
	import type { ObjectDefinition } from '../procedural-engine/objects/object-catalog';
	import type { ComposerPlacement } from './types';

	interface Props {
		placement: ComposerPlacement;
		definition: ObjectDefinition;
	}

	const { placement, definition }: Props = $props();

	const geometries = {
		box: new BoxGeometry(1, 1, 1),
		sphere: new SphereGeometry(0.5, 16, 12),
		cylinder: new CylinderGeometry(0.5, 0.5, 1, 16),
		cone: new ConeGeometry(0.5, 1, 16),
		flag: new BoxGeometry(0.05, 1, 0.5)
	};

	const geometry = $derived(geometries[definition.fallbackGeometry] ?? geometries.box);

	const material = $derived(
		new MeshStandardMaterial({
			color: new Color(definition.color),
			roughness: 0.7,
			metalness: 0.1
		})
	);

	const effectiveScale = $derived<[number, number, number]>([
		placement.scale[0] * definition.defaultScale,
		placement.scale[1] * definition.defaultScale,
		placement.scale[2] * definition.defaultScale
	]);
</script>

<T.Group
	position={placement.position}
	quaternion={placement.rotation}
	scale={effectiveScale}
	userData={{ composerId: placement.id }}
	visible={placement.visible !== false}
>
	<T.Mesh {geometry} {material} castShadow receiveShadow />
</T.Group>
