<!--
  VillageEventToast — Floating HTML text that fades upward from an event location.
  Lightweight HTML overlay, no 3D geometry.
-->
<script lang="ts">
	import { T } from "@threlte/core";
	import { HTML } from "@threlte/extras";
	import type { VillageEventToast as ToastData } from "../state/village-visual-state.svelte";

	interface Props {
		toast: ToastData;
	}

	const { toast }: Props = $props();

	const age = $derived(performance.now() - toast.createdAt);
	const progress = $derived(Math.min(1, age / toast.duration));
	const yOffset = $derived(0.5 + progress * 1.5);
	const opacity = $derived(1 - progress);
</script>

<T.Group
	position.x={toast.worldX}
	position.y={yOffset}
	position.z={toast.worldZ}
>
	<HTML center sprite>
		<div
			class="toast-label"
			style="color: {toast.color}; opacity: {opacity}"
		>
			{toast.text}
		</div>
	</HTML>
</T.Group>

<style>
	.toast-label {
		font-size: 12px;
		font-family: monospace;
		text-shadow: 0 0 6px rgba(0, 0, 0, 0.9);
		white-space: nowrap;
		pointer-events: none;
		user-select: none;
	}
</style>
