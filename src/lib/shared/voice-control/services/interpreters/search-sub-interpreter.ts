/**
 * SearchSubInterpreter
 *
 * Module-scoped to "browse". Handles search, filter, and sort commands.
 */

import type { ISubInterpreter } from "../contracts/ISubInterpreter";
import type { VoiceCommand, VoiceCommandCategory, CommandContext } from "../../domain/voice-command-types";

/** "search for fire" or "search fire" */
const SEARCH_PATTERN = /^search(?:\s+for)?\s+(.+)$/;

/** "filter by difficulty" */
const FILTER_PATTERN = /^filter(?:\s+by)?\s+(.+)$/;

/** "sort by newest" */
const SORT_PATTERN = /^sort(?:\s+by)?\s+(.+)$/;

const CLEAR_PHRASES = new Set(["clear filters", "show all", "reset filters", "clear search"]);

export class SearchSubInterpreter implements ISubInterpreter {
  readonly category: VoiceCommandCategory = "search";
  readonly activeInModules = ["browse"];

  tryInterpret(text: string, _context: CommandContext): VoiceCommand | null {
    if (CLEAR_PHRASES.has(text)) {
      return this.build("clear_filters", "", text);
    }

    const searchMatch = text.match(SEARCH_PATTERN);
    if (searchMatch?.[1]) {
      return this.build("search", searchMatch[1].trim(), text);
    }

    const filterMatch = text.match(FILTER_PATTERN);
    if (filterMatch?.[1]) {
      return this.build("filter", filterMatch[1].trim(), text);
    }

    const sortMatch = text.match(SORT_PATTERN);
    if (sortMatch?.[1]) {
      return this.build("sort", sortMatch[1].trim(), text);
    }

    return null;
  }

  private build(action: string, target: string, rawText: string): VoiceCommand {
    return {
      category: "search",
      action,
      target,
      rawText,
      confidence: 0.85,
    };
  }
}
