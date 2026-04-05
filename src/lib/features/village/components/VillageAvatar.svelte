<!--
  VillageAvatar — Renders one village entity as an Avatar3D with props + name label.

  Uses the same positioning pattern as MuseumPerformerStation3D.
  Computes movement detection from frame-to-frame position deltas.
-->
<script lang="ts">
	import { T, useTask } from "@threlte/core";
	import { HTML } from "@threlte/extras";
	import Avatar3D from "$lib/shared/3d/components/Avatar3D.svelte";
	import Prop3D from "$lib/shared/3d/components/props/Prop3D.svelte";
	import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
	import { userProportionsState } from "$lib/shared/3d/state/user-proportions-state.svelte";
	import type { AvatarRenderState } from "../state/village-state.svelte";
	import type { AvatarId } from "$lib/shared/3d/config/avatar-definitions";

	interface Props {
		renderState: AvatarRenderState;
		isSelected?: boolean;
	}

	const { renderState, isSelected = false }: Props = $props();

	const STAGE_LIFT = $derived(-userProportionsState.groundY);
	const avatarModelId = $derived(
		renderState.entity.identity.avatarModelId as AvatarId,
	);
	const avatarName = $derived(renderState.entity.identity.name);
	const lifecyclePhase = $derived(renderState.entity.lifecycle.phase);
	const socialState = $derived(renderState.entity.social.state);

	let posX = 0;
	let posZ = 0;
	let prevX = 0;
	let prevZ = 0;
	let angle = 0;
	let moving = false;
	let speed = 0;

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
		speed = moving ? frameDist * 60 : 0;

		avatarPosition = { x: posX, y: STAGE_LIFT, z: posZ };
		facingAngle = angle;
		isMoving = moving;
		moveSpeed = speed;
	});

	const bluePropState = $derived(renderState.instanceState.bluePropState);
	const redPropState = $derived(renderState.instanceState.redPropState);

	const isPerforming = $derived(
		socialState === "teaching" ||
		socialState === "learning" ||
		socialState === "performing" ||
		socialState === "practicing"
	);

	// Name label color based on state
	const labelColor = $derived(
		socialState === "teaching" ? "#4ade80" :
		socialState === "learning" ? "#60a5fa" :
		socialState === "performing" ? "#e8a87c" :
		socialState === "seeking" ? "#fbbf24" :
		"#ffffff"
	);
</script>

<!-- Visual offset group: cancel STAGE_LIFT so feet land on Y=0 ground -->
<T.Group position.y={-STAGE_LIFT}>
	<Avatar3D
		id={renderState.entityId}
		avatarId={avatarModelId}
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

	<!-- Name label floating above head -->
	<T.Group
		position.x={avatarPosition.x}
		position.y={avatarPosition.y + 0.6}
		position.z={avatarPosition.z}
	>
		<HTML center sprite>
			<div class="name-label" style="color: {labelColor}">
				{avatarName}
				<span class="state-indicator">
					{lifecyclePhase === "elder" ? "🔥" : ""}
				</span>
			</div>
		</HTML>
	</T.Group>
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

<style>
	.name-label {
		font-size: 11px;
		font-family: monospace;
		text-shadow: 0 0 4px rgba(0, 0, 0, 0.8);
		white-space: nowrap;
		pointer-events: none;
		user-select: none;
	}

	.state-indicator {
		margin-left: 2px;
	}
</style>
