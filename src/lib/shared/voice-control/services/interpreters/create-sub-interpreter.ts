/**
 * CreateSubInterpreter
 *
 * Module-scoped to "create". Handles undo/redo/save/clear/mirror/swap/reverse commands.
 * Only active when the user is in the create module.
 */

import type { ISubInterpreter } from "../ISubInterpreter";
import type {
  VoiceCommand,
  VoiceCommandCategory,
  CommandContext,
} from "../../domain/voice-command-types";

const UNDO_PHRASES = new Set(["undo", "go back one", "undo that"]);
const REDO_PHRASES = new Set(["redo", "redo that"]);
const CLEAR_PHRASES = new Set([
  "clear",
  "reset",
  "start over",
  "clear sequence",
]);
const SAVE_PHRASES = new Set(["save", "save sequence", "save to library"]);
const MIRROR_PHRASES = new Set(["mirror", "mirror sequence"]);
const FLIP_PHRASES = new Set(["flip", "flip sequence"]);
// "swap colors" remains a spoken legacy alias; the operation swaps hand roles.
const SWAP_PHRASES = new Set([
  "swap hands",
  "switch hands",
  "swap colors",
  "swap",
]);
const REVERSE_PHRASES = new Set(["reverse", "reverse sequence", "rewind"]);
const ROTATE_PHRASES = new Set(["rotate", "rotate sequence"]);

export class CreateSubInterpreter implements ISubInterpreter {
  readonly category: VoiceCommandCategory = "create";
  readonly activeInModules = ["create"];

  tryInterpret(text: string, _context: CommandContext): VoiceCommand | null {
    if (UNDO_PHRASES.has(text)) return this.build("undo", text);
    if (REDO_PHRASES.has(text)) return this.build("redo", text);
    if (CLEAR_PHRASES.has(text)) return this.build("clear", text);
    if (SAVE_PHRASES.has(text)) return this.build("save", text);
    if (MIRROR_PHRASES.has(text)) return this.build("mirror", text);
    if (FLIP_PHRASES.has(text)) return this.build("flip", text);
    if (SWAP_PHRASES.has(text)) return this.build("swap", text);
    if (REVERSE_PHRASES.has(text)) return this.build("reverse", text);
    if (ROTATE_PHRASES.has(text)) return this.build("rotate", text);
    return null;
  }

  private build(action: string, rawText: string): VoiceCommand {
    return {
      category: "create",
      action,
      target: "",
      rawText,
      confidence: 0.9,
    };
  }
}
