// Editor-wide reactive state container. Created once per /edit route load
// (in +page.svelte). Pages and primitives consume it via getContext().
//
// Holds: live sidecar for the loaded page, undo stack, autosave coordinator,
// current selection, and editor mode flag.

import { getContext, setContext } from 'svelte';
import { UndoStack } from './UndoStack.svelte';
import { AutosaveCoordinator } from './AutosaveCoordinator.svelte';
import { validateSidecar, type PageSidecar } from './sidecar-schema';

const KEY = Symbol('GuideEditorContext');

export type EditorMode = 'edit' | 'preview';

export class EditorContext {
	pageNumber: number = $state(0);
	sidecar: PageSidecar = $state({ pageNumber: 0, text: {}, placedAssets: [] });
	mode: EditorMode = $state('edit');
	selectedAssetId: string | null = $state(null);

	readonly undo: UndoStack<PageSidecar>;
	readonly autosave: AutosaveCoordinator;

	constructor(initial: PageSidecar) {
		validateSidecar(initial);
		this.pageNumber = initial.pageNumber;
		this.sidecar = initial;
		this.undo = new UndoStack<PageSidecar>(50);
		this.undo.record(structuredClone(initial));
		this.autosave = new AutosaveCoordinator(() => this.persist(), 800);
	}

	/**
	 * Apply a mutation to the sidecar. Records a snapshot for undo and
	 * schedules an autosave. The mutator receives a deep clone of the
	 * current sidecar and returns the new sidecar.
	 */
	mutate(fn: (draft: PageSidecar) => PageSidecar): void {
		const next = fn(structuredClone(this.sidecar));
		validateSidecar(next);
		this.sidecar = next;
		this.undo.record(structuredClone(next));
		this.autosave.notifyEdit();
	}

	performUndo(): void {
		const prev = this.undo.undo();
		if (prev !== undefined) {
			this.sidecar = structuredClone(prev);
			this.autosave.notifyEdit();
		}
	}

	performRedo(): void {
		const next = this.undo.redo();
		if (next !== undefined) {
			this.sidecar = structuredClone(next);
			this.autosave.notifyEdit();
		}
	}

	private async persist(): Promise<void> {
		const res = await fetch(`/api/guide/level-1/page/${this.pageNumber}`, {
			method: 'PUT',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(this.sidecar)
		});
		if (!res.ok) {
			const errMsg = await res.text().catch(() => res.statusText);
			throw new Error(`Save failed: ${errMsg}`);
		}
	}
}

export function provideEditorContext(initial: PageSidecar): EditorContext {
	const ctx = new EditorContext(initial);
	setContext(KEY, ctx);
	return ctx;
}

export function useEditorContext(): EditorContext {
	const ctx = getContext<EditorContext | undefined>(KEY);
	if (!ctx) throw new Error('useEditorContext called outside of /edit route');
	return ctx;
}

/**
 * Same as useEditorContext but returns null if no context provider is in
 * scope. Use in page templates that render in BOTH editor and read-only
 * modes — branch on the result to pick EditableText vs RenderedText.
 */
export function tryEditorContext(): EditorContext | null {
	return getContext<EditorContext | undefined>(KEY) ?? null;
}
