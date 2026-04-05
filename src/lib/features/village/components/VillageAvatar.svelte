<!--
  VillageAvatar — Renders one village entity as an Avatar3D with props.

  Uses the same positioning pattern as MuseumPerformerStation3D.
  Computes its own movement detection by tracking position deltas each frame.
-->
<script lang="ts">
	import { T, useTask } from "@threlte/core";
	import Avatar3D from "$lib/shared/3d/components/Avatar3D.svelte";
	import Prop3D from "$lib/shared/3d/components/props/Prop3D.svelte";
	import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
	import { userProportionsState } from "$lib/shared/3d/state/user-proportions-state.svelte";
	import type { AvatarRenderState } from "../state/village-state.svelte";

	interface Props {
		renderState: AvatarRenderState;
		isSelected?: boolean;
	}

	const { renderState, isSelected = false }: Props = $props();

	const STAGE_LIFT = $derived(-userProportionsState.groundY);

	// Mutable refs updated by useTask — Avatar3D reads these as props
	let posX = 0;
	let posZ = 0;
	let prevX = 0;
	let prevZ = 0;
	let angle = 0;
	let moving = false;
	let speed = 0;

	// Position object for Avatar3D (recreated each frame for prop change detection)
	let avatarPosition = $state({ x: 0, y: 0, z: 0 });
	let facingAngle = $state(0);
	let isMoving = $state(false);
	let moveSpeed = $state(0);

	useTask(() => {
		const inst = renderState.instanceState;

		prevX = posX;
		prevZ = posZ;
		posX = inst.position.x;
		posZ = inst.position.z;
		angle = inst.facingAngle;

		const dx = posX - prevX;
		const dz = posZ - prevZ;
		const frameDist = Math.sqrt(dx * dx + dz * dz);

		moving = frameDist > 0.001;
		speed = moving ? Math.min(1, frameDist * 15) : 0;

		// Update $state values for Avatar3D props
		avatarPosition = { x: posX, y: STAGE_LIFT, z: posZ };
		facingAngle = angle;
		isMoving = moving;
		moveSpeed = speed;
	});

	const bluePropState = $derived(renderState.instanceState.bluePropState);
	const redPropState = $derived(renderState.instanceState.redPropState);

	const isPerforming = $derived(
		renderState.entity.social.state === "teaching" ||
		renderState.entity.social.state === "learning" ||
		renderState.entity.social.state === "performing" ||
		renderState.entity.social.state === "practicing"
	);
</script>

<!-- Visual offset group: cancel STAGE_LIFT so feet land on Y=0 ground -->
<T.Group position.y={-STAGE_LIFT}>
	<Avatar3D
		id={renderState.entityId}
		{bluePropState}
		{redPropState}
		position={avatarPosition}
		{facingAngle}
		isActive={isSelected}
		{isMoving}
		{moveSpeed}
		moveDirection={{ x: 0, z: 1 }}
		enableLocomotion={true}
	/>
</T.Group>

{#if isPerforming && bluePropState}
	<Prop3D
		propType={PropType.STAFF}
		color="blue"
		propState={bluePropState}
		avatarPosition={avatarPosition}
		{facingAngle}
	/>
{/if}

{#if isPerforming && redPropState}
	<Prop3D
		propType={PropType.STAFF}
		color="red"
		propState={redPropState}
		avatarPosition={avatarPosition}
		{facingAngle}
	/>
{/if}
