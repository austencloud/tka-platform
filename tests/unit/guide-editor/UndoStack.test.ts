import { describe, it, expect } from 'vitest';
import { UndoStack } from '../../../src/routes/(public)/guide/level-1/_lib/UndoStack.svelte';

describe('UndoStack', () => {
	it('starts empty with no undo/redo available', () => {
		const stack = new UndoStack<{ v: number }>(50);
		expect(stack.canUndo).toBe(false);
		expect(stack.canRedo).toBe(false);
	});

	it('records snapshots and supports undo', () => {
		const stack = new UndoStack<{ v: number }>(50);
		stack.record({ v: 1 });
		stack.record({ v: 2 });
		expect(stack.canUndo).toBe(true);
		const undone = stack.undo();
		expect(undone).toEqual({ v: 1 });
	});

	it('supports redo after undo', () => {
		const stack = new UndoStack<{ v: number }>(50);
		stack.record({ v: 1 });
		stack.record({ v: 2 });
		stack.undo();
		expect(stack.canRedo).toBe(true);
		const redone = stack.redo();
		expect(redone).toEqual({ v: 2 });
	});

	it('clears redo stack on new record', () => {
		const stack = new UndoStack<{ v: number }>(50);
		stack.record({ v: 1 });
		stack.record({ v: 2 });
		stack.undo();
		stack.record({ v: 3 });
		expect(stack.canRedo).toBe(false);
	});

	it('caps stack at maxSize, dropping oldest entries', () => {
		// maxSize = max entries in the undo buffer (current is held separately).
		// With maxSize=3 and 5 records, undoBuf holds the 3 most recent prior
		// states; the oldest (v:1, v:2) are evicted.
		const stack = new UndoStack<{ v: number }>(3);
		stack.record({ v: 1 });
		stack.record({ v: 2 });
		stack.record({ v: 3 });
		stack.record({ v: 4 });
		stack.record({ v: 5 });
		// undoBuf = [v:2, v:3, v:4], current = v:5. Three undos available.
		expect(stack.undo()).toEqual({ v: 4 });
		expect(stack.undo()).toEqual({ v: 3 });
		expect(stack.undo()).toEqual({ v: 2 });
		expect(stack.canUndo).toBe(false);
	});

	it('returns undefined when undo/redo not possible', () => {
		const stack = new UndoStack<{ v: number }>(50);
		expect(stack.undo()).toBeUndefined();
		expect(stack.redo()).toBeUndefined();
	});

	it('clears all history with clear()', () => {
		const stack = new UndoStack<{ v: number }>(50);
		stack.record({ v: 1 });
		stack.record({ v: 2 });
		stack.clear();
		expect(stack.canUndo).toBe(false);
		expect(stack.canRedo).toBe(false);
	});

	it('rejects non-positive maxSize in constructor', () => {
		expect(() => new UndoStack<number>(0)).toThrow(/positive integer/);
		expect(() => new UndoStack<number>(-1)).toThrow(/positive integer/);
		expect(() => new UndoStack<number>(1.5)).toThrow(/positive integer/);
	});

	it('coalesces consecutive records with the same key inside the window', () => {
		const stack = new UndoStack<{ v: number }>(50);
		stack.record({ v: 0 });
		stack.record({ v: 1 }, { key: 'text:title', withinMs: 600 });
		stack.record({ v: 2 }, { key: 'text:title', withinMs: 600 });
		stack.record({ v: 3 }, { key: 'text:title', withinMs: 600 });
		// All three keystroke records collapse onto a single undo entry.
		// Undo restores v:0 (the snapshot before the first keystroke).
		expect(stack.undo()).toEqual({ v: 0 });
		expect(stack.canUndo).toBe(false);
	});

	it('starts a new entry when coalesce keys differ', () => {
		const stack = new UndoStack<{ field: string; v: number }>(50);
		stack.record({ field: 'init', v: 0 });
		stack.record({ field: 'a', v: 1 }, { key: 'text:a', withinMs: 600 });
		stack.record({ field: 'b', v: 2 }, { key: 'text:b', withinMs: 600 });
		// First undo returns the post-field-a state, second returns init.
		expect(stack.undo()).toEqual({ field: 'a', v: 1 });
		expect(stack.undo()).toEqual({ field: 'init', v: 0 });
	});

	it('breakCoalesce forces the next record to start a fresh entry', () => {
		const stack = new UndoStack<{ v: number }>(50);
		stack.record({ v: 0 });
		stack.record({ v: 1 }, { key: 'text:title', withinMs: 600 });
		stack.breakCoalesce();
		stack.record({ v: 2 }, { key: 'text:title', withinMs: 600 });
		expect(stack.undo()).toEqual({ v: 1 });
		expect(stack.undo()).toEqual({ v: 0 });
	});
});
