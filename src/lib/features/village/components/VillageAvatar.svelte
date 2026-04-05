<!--
  VillageAvatar — Renders one village entity as an Avatar3D with props + name label.

  Hides avatar for a brief loading period, then fades in.
  The useGLTF=true default means Avatar3D loads the real model;
  we just hide it during the initial load to avoid the fallback flash.
-->
<script lang="ts">
	import { T, useTask } from "@threlte/core";
	import { HTML } from "@threlte/extras";
	import type { Group } from "three";
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
	let moving = false;
	let speed = 0;

	let avatarPosition = $state({ x: 0, y: 0, z: 0 });
	let facingAngle = $state(0);
	let isMoving = $state(false);
	let moveSpeed = $state(0);

	// Two-phase loading:
	// Phase 1: Mount Avatar3D with visible=false so it starts loading the GLTF
	// Phase 2: After model loads, switch to visible=true
	// We detect "loaded" by checking if Avatar3D's internal group has a SkinnedMesh
	let preloading = $state(true);  // Phase 1: invisible preload
	let showAvatar = $state(false); // Phase 2: visible
	let labelOpacity = $state(0);
	let avatarGroupRef: Group | undefined = $state();

	useTask(() => {
		const inst = renderState.instanceState;

		prevX = posX;
		prevZ = posZ;
		posX = inst.position.x;
		posZ = inst.position.z;

		const dx = posX - prevX;
		const dz = posZ - prevZ;
		const frameDist = Math.sqrt(dx * dx + dz * dz);

		moving = frameDist > 0.001;
		speed = moving ? frameDist * 60 : 0;

		avatarPosition = { x: posX, y: STAGE_LIFT, z: posZ };
		facingAngle = inst.facingAngle;
		isMoving = moving;
		moveSpeed = speed;

		// Detect when GLTF model loads by scanning the group for SkinnedMesh.
		// Avatar3D is mounted with visible=false during preloading — the
		// component tree IS rendered (allowing GLTF fetch), just not drawn.
		if (preloading && avatarGroupRef) {
			let found = false;
			avatarGroupRef.traverse((child: any) => {
				if (child.isSkinnedMesh) found = true;
			});
			if (found) {
				preloading = false;
				showAvatar = true;
			}
		}

		// Fade in label
		if (showAvatar && labelOpacity < 1) {
			labelOpacity = Math.min(1, labelOpacity + 0.04);
		}
	});

	const bluePropState = $derived(renderState.instanceState.bluePropState);
	const redPropState = $derived(renderState.instanceState.redPropState);

	const isPerforming = $derived(
		socialState === "teaching" ||
		socialState === "learning" ||
		socialState === "performing" ||
		socialState === "practicing"
	);

	const labelColor = $derived(
		socialState === "teaching" ? "#4ade80" :
		socialState === "learning" ? "#60a5fa" :
		socialState === "performing" ? "#e8a87c" :
		socialState === "seeking" ? "#fbbf24" :
		"#ffffff"
	);
</script>

<!-- Visual offset group: cancel STAGE_LIFT so feet land on Y=0 ground -->
<T.Group position.y={-STAGE_LIFT} bind:ref={avatarGroupRef}>
	<Avatar3D
		id={renderState.entityId}
		avatarId={avatarModelId}
		{bluePropState}
		{redPropState}
		position={avatarPosition}
		{facingAngle}
		isActive={isSelected}
		isMoving={showAvatar ? isMoving : false}
		moveSpeed={showAvatar ? moveSpeed : 0}
		moveDirection={{ x: 0, z: 1 }}
		enableLocomotion={showAvatar}
		visible={showAvatar}
	/>

	<!-- Name label floating above head -->
	{#if showAvatar}
		<T.Group
			position.x={avatarPosition.x}
			position.y={avatarPosition.y + 0.6}
			position.z={avatarPosition.z}
		>
			<HTML center sprite>
				<div
					class="name-label"
					style="color: {labelColor}; opacity: {labelOpacity}"
				>
					{avatarName}
					<span class="state-indicator">
						{lifecyclePhase === "elder" ? "🔥" : ""}
					</span>
				</div>
			</HTML>
		</T.Group>
	{/if}
</T.Group>

{#if showAvatar && isPerforming && bluePropState}
	<Prop3D
		propType={PropType.STAFF}
		color="blue"
		propState={bluePropState}
		avatarPosition={avatarPosition}
		{facingAngle}
	/>
{/if}

{#if showAvatar && isPerforming && redPropState}
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
