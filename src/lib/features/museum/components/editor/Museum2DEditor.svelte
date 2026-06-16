<script lang="ts">
	/**
	 * Floor Plan Editor - Top-level assembly.
	 *
	 * Wires up the editor state, distributes it via context, and
	 * composes the tool palette, canvas, property inspector, and
	 * template picker into a three-column layout.
	 *
	 * Keyboard shortcuts:
	 *   Ctrl+Z  - Undo
	 *   Ctrl+Shift+Z - Redo
	 */

	import { getEditorContext } from "../../state/editor-context";
	import EditorToolPalette from "./EditorToolPalette.svelte";
	import EditorCanvas from "./EditorCanvas.svelte";
	import PropertyInspector from "./PropertyInspector.svelte";
	import TemplatePicker from "./TemplatePicker.svelte";

	// Context is set by Museum2DModule with the generated grid already loaded
	const { state: editor } = getEditorContext();

	let showTemplatePicker = $state(false);

	function handleKeydown(event: KeyboardEvent): void {
		// Ctrl+Z = undo, Ctrl+Shift+Z = redo
		if (event.ctrlKey && event.key === "z" && !event.shiftKey) {
			event.preventDefault();
			editor.undo();
		} else if (event.ctrlKey && event.key === "Z" && event.shiftKey) {
			event.preventDefault();
			editor.redo();
		} else if (event.ctrlKey && event.key === "y") {
			event.preventDefault();
			editor.redo();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="editor-layout">
	<!-- Left: Tool Palette -->
	<aside class="editor-sidebar palette-sidebar">
		<EditorToolPalette />
	</aside>

	<!-- Center: Canvas -->
	<main class="editor-main">
		<div class="editor-toolbar">
			<button
				type="button"
				class="toolbar-btn"
				disabled={!editor.canUndo}
				onclick={() => editor.undo()}
				title="Undo (Ctrl+Z)"
				aria-label="Undo"
			>
				<i class="fa-solid fa-rotate-left" aria-hidden="true"></i>
			</button>
			<button
				type="button"
				class="toolbar-btn"
				disabled={!editor.canRedo}
				onclick={() => editor.redo()}
				title="Redo (Ctrl+Shift+Z)"
				aria-label="Redo"
			>
				<i class="fa-solid fa-rotate-right" aria-hidden="true"></i>
			</button>
			<div class="toolbar-spacer"></div>
			<button
				type="button"
				class="toolbar-btn"
				class:active={showTemplatePicker}
				onclick={() => (showTemplatePicker = !showTemplatePicker)}
				title="Wing templates"
			>
				<i class="fa-solid fa-layer-group"></i>
				Templates
			</button>
		</div>

		<div class="canvas-wrapper">
			<EditorCanvas />
			{#if showTemplatePicker}
				<div class="template-overlay">
					<TemplatePicker onclose={() => (showTemplatePicker = false)} />
				</div>
			{/if}
		</div>
	</main>

	<!-- Right: Property Inspector -->
	<aside class="editor-sidebar inspector-sidebar">
		<PropertyInspector />
	</aside>
</div>

<style>
	.editor-layout {
		display: grid;
		grid-template-columns: 160px 1fr 220px;
		height: 100%;
		width: 100%;
		gap: 0;
		background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
	}

	.editor-sidebar {
		overflow-y: auto;
		border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
	}

	.palette-sidebar {
		border-right-width: 1px;
		border-left: none;
		border-top: none;
		border-bottom: none;
	}

	.inspector-sidebar {
		border-left-width: 1px;
		border-right: none;
		border-top: none;
		border-bottom: none;
	}

	.editor-main {
		display: flex;
		flex-direction: column;
		overflow: hidden;
		min-width: 0;
	}

	.editor-toolbar {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.375rem 0.5rem;
		border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.02));
	}

	.toolbar-btn {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		height: 32px;
		padding: 0 0.625rem;
		background: transparent;
		border: 1.5px solid transparent;
		border-radius: 6px;
		color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
		cursor: pointer;
		font-size: var(--font-size-compact, 12px);
		transition:
			border-color 0.15s,
			background 0.15s,
			color 0.15s;
	}

	.toolbar-btn:hover:not(:disabled) {
		background: var(--theme-card-bg-hover, rgba(255, 255, 255, 0.06));
		color: var(--theme-text, #ffffff);
	}

	.toolbar-btn:disabled {
		opacity: 0.3;
		cursor: default;
	}

	.toolbar-btn.active {
		border-color: var(--theme-accent, #6366f1);
		color: var(--theme-text, #ffffff);
	}

	.toolbar-spacer {
		flex: 1;
	}

	.canvas-wrapper {
		flex: 1;
		position: relative;
		overflow: hidden;
	}

	.template-overlay {
		position: absolute;
		top: 0.5rem;
		right: 0.5rem;
		z-index: 20;
		width: 280px;
		max-height: calc(100% - 1rem);
		overflow-y: auto;
		background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
		border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		border-radius: 8px;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
	}
</style>
