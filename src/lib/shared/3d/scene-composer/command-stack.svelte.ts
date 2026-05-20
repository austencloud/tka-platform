export interface Command {
	execute(): void;
	undo(): void;
	label: string;
}

export class CommandStack {
	private _undoStack: Command[] = $state([]);
	private _redoStack: Command[] = $state([]);

	get canUndo(): boolean {
		return this._undoStack.length > 0;
	}

	get canRedo(): boolean {
		return this._redoStack.length > 0;
	}

	get undoLabel(): string | undefined {
		return this._undoStack[this._undoStack.length - 1]?.label;
	}

	get redoLabel(): string | undefined {
		return this._redoStack[this._redoStack.length - 1]?.label;
	}

	execute(cmd: Command): void {
		cmd.execute();
		this._undoStack.push(cmd);
		this._redoStack.length = 0;
	}

	undo(): void {
		const cmd = this._undoStack.pop();
		if (!cmd) return;
		cmd.undo();
		this._redoStack.push(cmd);
	}

	redo(): void {
		const cmd = this._redoStack.pop();
		if (!cmd) return;
		cmd.execute();
		this._undoStack.push(cmd);
	}

	clear(): void {
		this._undoStack.length = 0;
		this._redoStack.length = 0;
	}
}
