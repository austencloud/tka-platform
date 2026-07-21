export interface Command {
  execute(): void;
  undo(): void;
  label: string;
}

/**
 * Reactive command history for mutations that can be replayed and reversed.
 *
 * `execute` is for commands that own their initial mutation. `record` is for
 * interfaces such as drag-and-drop where the mutation has already happened by
 * the time the command boundary is known.
 */
export class CommandStack {
  private _undoStack: Command[] = $state([]);
  private _redoStack: Command[] = $state([]);

  constructor(private readonly maxEntries = 50) {}

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

  execute(command: Command): void {
    command.execute();
    this.record(command);
  }

  record(command: Command): void {
    this._undoStack.push(command);
    if (this._undoStack.length > this.maxEntries) {
      this._undoStack.splice(0, this._undoStack.length - this.maxEntries);
    }
    this._redoStack.length = 0;
  }

  undo(): boolean {
    const command = this._undoStack.pop();
    if (!command) return false;
    command.undo();
    this._redoStack.push(command);
    return true;
  }

  redo(): boolean {
    const command = this._redoStack.pop();
    if (!command) return false;
    command.execute();
    this._undoStack.push(command);
    return true;
  }

  clear(): void {
    this._undoStack.length = 0;
    this._redoStack.length = 0;
  }
}
