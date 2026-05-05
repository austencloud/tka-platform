import { getContext, setContext } from "svelte";
import type { DisassembleSlotState } from "../state/disassemble-state.svelte";

const DISASSEMBLE_CTX_KEY = Symbol("disassemble");

export interface DisassembleContext {
  slotState: DisassembleSlotState;
}

export function setDisassembleContext(ctx: DisassembleContext): void {
  setContext(DISASSEMBLE_CTX_KEY, ctx);
}

export function getDisassembleContext(): DisassembleContext {
  return getContext<DisassembleContext>(DISASSEMBLE_CTX_KEY);
}
