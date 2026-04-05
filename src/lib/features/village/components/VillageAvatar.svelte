<!--
  VillageAvatar — Renders one village entity as an Avatar3D with props.

  Uses the same positioning pattern as MuseumPerformerStation3D:
  - Outer T.Group at position.y = -STAGE_LIFT cancels Avatar3D's internal offset
  - Avatar3D position.y = STAGE_LIFT for IK/grid alignment
  - Net result: feet land at Y=0 (ground plane)
-->
<script lang="ts">
	import { T } from "@threlte/core";
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

	// Avatar position: IK targets and prop orbit sit at shoulder height
	const avatarPosition = $derived({
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
		moveSpeed={isMoving ? 0.5 : 0}
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
