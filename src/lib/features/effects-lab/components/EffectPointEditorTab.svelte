<!--
  EffectPointEditorTab.svelte

  Orchestrator: composes EffectPropTypeSelector + EffectPointSvgCanvas + EffectPointListPanel.
  Creates and manages the editor state, wires keyboard shortcuts.
  Accepts an EffectDescriptor to parameterize for fire/LED/future effects.
-->
<script lang="ts">
	import { onMount, onDestroy } from "svelte";
	import { container } from "$lib/shared/di";
	import { EffectPointEditorState } from "../state/effect-point-editor-state.svelte";
	import type { IEffectPointOverrideProvider } from "../services/contracts/IEffectPointOverrideProvider";
	import type { IEffectPointsPersister } from "../services/contracts/IEffectPointsPersister";
	import type { EffectDescriptor } from "../domain/EffectDescriptor";
	import EffectPropTypeSelector from "./EffectPropTypeSelector.svelte";
	import EffectPointSvgCanvas from "./EffectPointSvgCanvas.svelte";
	import EffectPointListPanel from "./EffectPointListPanel.svelte";

	interface Props {
		descriptor: EffectDescriptor;
	}
	let { descriptor }: Props = $props();

	// Resolve the correct override provider based on effect type
	const providerKey =
		descriptor.id === "fire" || descriptor.id === "charcoal"
			? "firePointOverrideProvider"
			: "ledPointOverrideProvider";
	const provider = container.items[
		providerKey
	] as IEffectPointOverrideProvider;
	const persister = container.items.effectPointsPersister as IEffectPointsPersister;
	const editorState = new EffectPointEditorState(provider, descriptor, persister);

	function handleKeyDown(e: KeyboardEvent) {
		if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
			e.preventDefault();
			editorState.undo();
			return;
		}
		if (
			(e.key === "Delete" || e.key === "Backspace") &&
			editorState.selectedPointIndex >= 0
		) {
			const tag = (e.target as HTMLElement)?.tagName;
			if (tag === "INPUT" || tag === "TEXTAREA") return;
			e.preventDefault();
			editorState.deletePoint(editorState.selectedPointIndex);
		}
	}

	onMount(() => {
		window.addEventListener("keydown", handleKeyDown);
	});

	onDestroy(() => {
		window.removeEventListener("keydown", handleKeyDown);
		editorState.dispose();
	});
</script>

<div class="editor-tab">
	<EffectPropTypeSelector {editorState} {descriptor} />

	<div class="editor-content">
		<EffectPointSvgCanvas {editorState} {descriptor} />
		<div class="list-panel-wrapper">
			<EffectPointListPanel {editorState} {descriptor} />
		</div>
	</div>
</div>

<style>
	.editor-tab {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 0;
		overflow: hidden;
	}

	.editor-content {
		flex: 1;
		display: grid;
		grid-template-columns: 1fr 400px;
		gap: var(--spacing-md, 16px);
		padding: var(--spacing-md, 16px);
		min-height: 0;
		overflow: hidden;
	}

	.list-panel-wrapper {
		min-height: 0;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	@media (max-width: 900px) {
		.editor-content {
			grid-template-columns: 1fr;
			grid-template-rows: 1fr auto;
		}
	}
</style>
