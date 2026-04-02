/**
 * Floor Plan Editor Context
 *
 * Distributes editor state to all descendant components via Svelte context.
 * Set once in Museum2DEditor, consumed by any child (canvas, palette, inspector).
 */

import { getContext, setContext } from "svelte";
import type { EditorState } from "./editor-state.svelte";

export interface EditorContext {
	state: EditorState;
}

const EDITOR_CONTEXT_KEY = Symbol("museum-editor");

export function setEditorContext(context: EditorContext): void {
	setContext(EDITOR_CONTEXT_KEY, context);
}

export function getEditorContext(): EditorContext {
	const context = getContext<EditorContext>(EDITOR_CONTEXT_KEY);

	if (!context) {
		throw new Error(
			"EditorContext not found. Ensure you're calling getEditorContext() " +
				"within a component that is a descendant of Museum2DEditor."
		);
	}

	return context;
}
