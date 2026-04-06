<!--
  VillageAvatar — Renders one village entity as an Avatar3D with props + name label.

  Hides avatar for a brief loading period, then fades in.
  The useGLTF=true default means Avatar3D loads the real model;
  we just hide it during the initial load to avoid the fallback flash.
-->
<script lang="ts">
	import { T, useTask } from "@threlte/core";
	import { HTML } from "@threlte/extras";
	import Avatar3D from "$lib/shared/3d/components/Avatar3D.svelte";
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
	const knowledgeGlow = $derived(renderState.entity.lifecycle.knowledgeGlow);

	// Visual aging: height scale varies by lifecycle phase
	const heightScale = $derived(
		lifecyclePhase === "youth" ? 0.7 :
		lifecyclePhase === "elder" ? 0.95 :
		1.0
	);

	// Death fade: passing entities lerp opacity to 0
	const isPassing = $derived(socialState === "passing");
	let deathOpacity = $state(1);
	const DEATH_FADE_RATE = 0.02; // per frame, ~50 frames to fully fade

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

	// Hide during initial GLTF load to prevent procedural fallback flash.
	// Avatar3D visible=false prevents rendering while GLTF fetches.
	// After enough frames for the model to load, switch to visible.
	let frameCount = 0;
	let showAvatar = $state(false);
	let labelOpacity = $state(0);
	// 180 frames @ 60fps = 3 seconds — generous for local 50-100MB GLBs
	const LOAD_FRAMES = 180;

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

		// Count frames until we reveal the avatar (GLTF should be loaded by then)
		if (!showAvatar) {
			frameCount++;
			if (frameCount >= LOAD_FRAMES) {
				showAvatar = true;
			}
		} else if (labelOpacity < 1) {
			labelOpacity = Math.min(1, labelOpacity + 0.04);
		}

		// Death fade
		if (isPassing) {
			deathOpacity = Math.max(0, deathOpacity - DEATH_FADE_RATE);
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
		socialState === "jamming" ? "#e8a87c" :
		socialState === "seeking" ? "#fbbf24" :
		socialState === "watching" ? "#fbbf24" :
		socialState === "mourning" ? "#ef4444" :
		socialState === "passing" ? "#ef4444" :
		"#ffffff"
	);

	// Phase indicator appended to name
	const phaseIndicator = $derived(
		lifecyclePhase === "youth" ? " (y)" :
		lifecyclePhase === "elder" ? " (e)" :
		""
	);

	// Youth names tinted sage green
	const nameTint = $derived(
		lifecyclePhase === "youth" ? "#86efac" : labelColor
	);
</script>

<!-- Visual offset group: cancel STAGE_LIFT so feet land on Y=0 ground -->
<T.Group position.y={-STAGE_LIFT} scale.y={heightScale}>
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
		visible={showAvatar && deathOpacity > 0.01}
	/>

	<!-- Elder knowledge glow: soft emissive sphere -->
	{#if lifecyclePhase === "elder" && knowledgeGlow > 0 && showAvatar}
		<T.Mesh
			position.x={avatarPosition.x}
			position.y={avatarPosition.y + 0.3}
			position.z={avatarPosition.z}
		>
			<T.IcosahedronGeometry args={[0.4, 1]} />
			<T.MeshBasicMaterial
				color="#f8fafc"
				transparent
				opacity={knowledgeGlow * 0.3 * deathOpacity}
				depthWrite={false}
			/>
		</T.Mesh>
	{/if}

	<!-- Name label floating above head -->
	{#if showAvatar && deathOpacity > 0.1}
		<T.Group
			position.x={avatarPosition.x}
			position.y={avatarPosition.y + 0.6}
			position.z={avatarPosition.z}
		>
			<HTML center sprite>
				<div
					class="name-label"
					style="color: {nameTint}; opacity: {labelOpacity * deathOpacity}"
				>
					{avatarName}
					<span class="phase-indicator">{phaseIndicator}</span>
					{#if lifecyclePhase === "elder"}
						<span class="state-indicator">🔥</span>
					{/if}
				</div>
			</HTML>
		</T.Group>
	{/if}
</T.Group>

<!-- Props are driven by Avatar3D's bluePropState/redPropState through IK.
     External Prop3D rendering will be added when teaching choreography
     is properly integrated with the avatar's transform chain. -->

<style>
	.name-label {
		font-size: 11px;
		font-family: monospace;
		text-shadow: 0 0 4px rgba(0, 0, 0, 0.8);
		white-space: nowrap;
		pointer-events: none;
		user-select: none;
	}

	.phase-indicator {
		opacity: 0.6;
	}

	.state-indicator {
		margin-left: 2px;
	}
</style>
