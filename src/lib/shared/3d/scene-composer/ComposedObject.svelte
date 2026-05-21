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
		onselect?: (group: import('three').Object3D) => void;
		onhoverstart?: (group: import('three').Object3D) => void;
		onhoverend?: () => void;
	}

	const { placement, definition, onselect, onhoverstart, onhoverend }: Props = $props();

	const geometries = {
		box: new BoxGeometry(1, 1, 1).translate(0, 0.5, 0),
		sphere: new SphereGeometry(0.5, 16, 12).translate(0, 0.5, 0),
		cylinder: new CylinderGeometry(0.5, 0.5, 1, 16).translate(0, 0.5, 0),
		cone: new ConeGeometry(0.5, 1, 16).translate(0, 0.5, 0),
		flag: new BoxGeometry(0.05, 1, 0.5).translate(0, 0.5, 0)
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

	let groupRef: import('three').Object3D | undefined = $state();
</script>

<T.Group
	bind:ref={groupRef}
	position={placement.position}
	quaternion={placement.rotation}
	scale={effectiveScale}
	userData={{ composerId: placement.id }}
	visible={placement.visible !== false}
>
	<T.Mesh
		{geometry}
		{material}
		castShadow
		receiveShadow
		onclick={(e: any) => {
			console.log('[ComposedObject] CLICKED', placement.id, placement.objectKey);
			e.stopPropagation();
			if (groupRef) onselect?.(groupRef);
		}}
		onpointerenter={() => {
			console.log('[ComposedObject] HOVER ENTER', placement.id, placement.objectKey);
			if (groupRef) onhoverstart?.(groupRef);
		}}
		onpointerleave={() => {
			console.log('[ComposedObject] HOVER LEAVE', placement.id);
			onhoverend?.();
		}}
	/>
</T.Group>
