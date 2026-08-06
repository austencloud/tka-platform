<!--
  EffectPointEditorTab.svelte

  Orchestrator: composes EffectPropTypeSelector + EffectPointSvgCanvas + EffectPointListPanel.
  Creates and manages the editor state, wires keyboard shortcuts.
  Edits unified tip points shared by all effects.
-->
<script lang="ts">
	import { onMount, onDestroy } from "svelte";
	import { getTipPointOverrideProvider } from "../get-tip-point-override-provider";
	import { getEffectPointsPersister } from "../get-effect-points-persister";
	import { EffectPointEditorState } from "../state/effect-point-editor-state.svelte";
	import EffectPropTypeSelector from "./EffectPropTypeSelector.svelte";
	import EffectPointSvgCanvas from "./EffectPointSvgCanvas.svelte";
	import EffectPointListPanel from "./EffectPointListPanel.svelte";

	const provider = getTipPointOverrideProvider();
	const persister = getEffectPointsPersister();
	const editorState = new EffectPointEditorState(provider, persister);

	function handleKeyDown(e: KeyboardEvent) {
		if (
			e.key === "Delete" &&
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

<div class="editor-tab" data-edit-history-shortcut-scope>
	<EffectPropTypeSelector {editorState} />

	<div class="editor-content">
		<EffectPointSvgCanvas {editorState} />
		<div class="list-panel-wrapper">
			<EffectPointListPanel {editorState} />
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
