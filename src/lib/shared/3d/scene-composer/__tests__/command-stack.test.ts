import { describe, it, expect, beforeEach } from "vitest";
import { CommandStack, type Command } from "../command-stack.svelte";

function makeCommand(
	label: string
): Command & { executed: boolean; undone: boolean } {
	const cmd = {
		label,
		executed: false,
		undone: false,
		execute() {
			this.executed = true;
			this.undone = false;
		},
		undo() {
			this.undone = true;
			this.executed = false;
		},
	};
	return cmd;
}

describe("CommandStack", () => {
	let stack: CommandStack;

	beforeEach(() => {
		stack = new CommandStack();
	});

	it("executes a command and tracks it", () => {
		const cmd = makeCommand("Place Rock");
		stack.execute(cmd);
		expect(cmd.executed).toBe(true);
		expect(stack.canUndo).toBe(true);
		expect(stack.canRedo).toBe(false);
	});

	it("undoes a command", () => {
		const cmd = makeCommand("Place Rock");
		stack.execute(cmd);
		stack.undo();
		expect(cmd.undone).toBe(true);
		expect(stack.canUndo).toBe(false);
		expect(stack.canRedo).toBe(true);
	});

	it("redoes an undone command", () => {
		const cmd = makeCommand("Place Rock");
		stack.execute(cmd);
		stack.undo();
		stack.redo();
		expect(cmd.executed).toBe(true);
		expect(stack.canUndo).toBe(true);
		expect(stack.canRedo).toBe(false);
	});

	it("clears redo stack on new action after undo", () => {
		const cmd1 = makeCommand("Place Rock");
		const cmd2 = makeCommand("Place Tree");
		stack.execute(cmd1);
		stack.undo();
		stack.execute(cmd2);
		expect(stack.canRedo).toBe(false);
	});

	it("clear() resets both stacks", () => {
		stack.execute(makeCommand("a"));
		stack.execute(makeCommand("b"));
		stack.undo();
		stack.clear();
		expect(stack.canUndo).toBe(false);
		expect(stack.canRedo).toBe(false);
	});
});
