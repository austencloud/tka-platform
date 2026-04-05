<!--
  VillageAvatar — Renders one village entity as an Avatar3D with props.
  Reads from an AvatarInstanceState wrapper that's synced from the ECS engine.
-->
<script lang="ts">
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

	// Avatar3D uses Y=0 as shoulder/grid center. groundY is negative (distance
	// from shoulder to feet). -groundY lifts the avatar so feet sit on Y=0.
	const STAGE_LIFT = $derived(-userProportionsState.groundY);

	const position = $derived({
		x: renderState.instanceState.position.x,
		y: STAGE_LIFT,
		z: renderState.instanceState.position.z,
	});

	const facingAngle = $derived(renderState.instanceState.facingAngle);
	const bluePropState = $derived(renderState.instanceState.bluePropState);
	const redPropState = $derived(renderState.instanceState.redPropState);

	const isMoving = $derived(renderState.entity.transform.speed > 0);
	const isPerforming = $derived(
		renderState.entity.social.state === "teaching" ||
		renderState.entity.social.state === "learning" ||
		renderState.entity.social.state === "performing" ||
		renderState.entity.social.state === "practicing"
	);
</script>

<Avatar3D
	id={renderState.entityId}
	{bluePropState}
	{redPropState}
	{position}
	{facingAngle}
	isActive={isSelected}
	{isMoving}
	moveSpeed={isMoving ? 0.5 : 0}
	enableLocomotion={true}
/>

{#if isPerforming && bluePropState}
	<Prop3D
		propType={PropType.STAFF}
		color="blue"
		propState={bluePropState}
		avatarPosition={position}
		{facingAngle}
	/>
{/if}

{#if isPerforming && redPropState}
	<Prop3D
		propType={PropType.STAFF}
		color="red"
		propState={redPropState}
		avatarPosition={position}
		{facingAngle}
	/>
{/if}
