/**
 * SequenceSubInterpreter
 *
 * Handles commands for interacting with a viewed sequence:
 * save to library, favorite, share, export, open in create.
 * Active globally since sequences can be viewed in browse, compose, etc.
 */

import type { ISubInterpreter } from "../ISubInterpreter";
import type { VoiceCommand, VoiceCommandCategory, CommandContext } from "../../domain/voice-command-types";

const SAVE_PHRASES = new Set(["save to library", "add to library"]);
const FAVORITE_PHRASES = new Set(["favorite", "like"]);
const UNFAVORITE_PHRASES = new Set(["unfavorite", "unlike"]);
const SHARE_PHRASES = new Set(["share", "share sequence"]);
const EXPORT_PHRASES = new Set(["export", "download", "save as image"]);
const EDIT_PHRASES = new Set(["open in create", "edit", "edit sequence"]);

export class SequenceSubInterpreter implements ISubInterpreter {
  readonly category: VoiceCommandCategory = "sequence";

  tryInterpret(text: string, _context: CommandContext): VoiceCommand | null {
    if (SAVE_PHRASES.has(text)) return this.build("save_to_library", text);
    if (FAVORITE_PHRASES.has(text)) return this.build("favorite", text);
    if (UNFAVORITE_PHRASES.has(text)) return this.build("unfavorite", text);
    if (SHARE_PHRASES.has(text)) return this.build("share", text);
    if (EXPORT_PHRASES.has(text)) return this.build("export", text);
    if (EDIT_PHRASES.has(text)) return this.build("open_in_create", text);
    return null;
  }

  private build(action: string, rawText: string): VoiceCommand {
    return {
      category: "sequence",
      action,
      target: "",
      rawText,
      confidence: 0.85,
    };
  }
}
