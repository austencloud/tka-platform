/**
 * UISubInterpreter
 *
 * Handles global UI navigation: scroll, go back, close modal, confirm, fullscreen.
 * Lower priority than module-specific interpreters but higher than navigation.
 */

import type { ISubInterpreter } from "../contracts/ISubInterpreter";
import type { VoiceCommand, VoiceCommandCategory, CommandContext } from "../../domain/voice-command-types";

const SCROLL_UP_PHRASES = new Set(["scroll up", "page up"]);
const SCROLL_DOWN_PHRASES = new Set(["scroll down", "page down"]);
const BACK_PHRASES = new Set(["go back", "back"]);
const CONFIRM_PHRASES = new Set(["confirm", "ok", "yes"]);
const CANCEL_PHRASES = new Set(["cancel", "no"]);
const FULLSCREEN_PHRASES = new Set(["fullscreen", "toggle fullscreen", "full screen"]);

export class UISubInterpreter implements ISubInterpreter {
  readonly category: VoiceCommandCategory = "ui";

  tryInterpret(text: string, _context: CommandContext): VoiceCommand | null {
    if (SCROLL_UP_PHRASES.has(text)) return this.build("scroll_up", text);
    if (SCROLL_DOWN_PHRASES.has(text)) return this.build("scroll_down", text);
    if (BACK_PHRASES.has(text)) return this.build("go_back", text);
    if (CONFIRM_PHRASES.has(text)) return this.build("confirm", text);
    if (CANCEL_PHRASES.has(text)) return this.build("cancel", text);
    if (FULLSCREEN_PHRASES.has(text)) return this.build("fullscreen", text);
    return null;
  }

  private build(action: string, rawText: string): VoiceCommand {
    return {
      category: "ui",
      action,
      target: "",
      rawText,
      confidence: 0.85,
    };
  }
}
