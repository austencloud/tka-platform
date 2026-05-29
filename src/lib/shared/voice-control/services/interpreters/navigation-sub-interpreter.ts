import type { ISubInterpreter } from "../contracts/ISubInterpreter";
import type { VoiceCommand, VoiceCommandCategory, CommandContext } from "../../domain/voice-command-types";
import { MODULE_DEFINITIONS } from "../../../navigation/config/module-definitions";
import type { ModuleDefinition } from "../../../navigation/domain/types";

// Module navigation patterns
const MODULE_PATTERNS: RegExp[] = [
  /^(?:go to|goto)\s+(.+)$/,
  /^(?:open)\s+(.+)$/,
  /^(?:navigate to)\s+(.+)$/,
  /^(?:show)\s+(.+)$/,
  /^(?:switch to)\s+(.+)\s+module$/,
];

// Tab switching patterns
const TAB_PATTERNS: RegExp[] = [
  /^(?:switch to)\s+(?:the\s+)?(.+?)(?:\s+tab)?$/,
  /^(?:go to|goto)\s+(?:the\s+)?(.+?)\s+tab$/,
  /^(?:open)\s+(?:the\s+)?(.+?)\s+tab$/,
  /^(?:show)\s+(?:the\s+)?(.+?)\s+tab$/,
];

// Fuzzy aliases
const MODULE_ALIASES: Record<string, string> = {
  creator: "create",
  creation: "create",
  builder: "create",
  build: "create",
  maker: "create",
  browsing: "browse",
  discover: "browse",
  explore: "browse",
  search: "browse",
  learning: "learn",
  study: "learn",
  education: "learn",
  lessons: "learn",
  composing: "compose",
  composition: "compose",
  animate: "compose",
  animation: "compose",
  training: "train",
  practice: "train",
  watching: "watch",
  videos: "watch",
  video: "watch",
  "choreo card": "choreo_card",
  "choreography card": "choreo_card",
  writing: "write",
  lab: "lab",
  laboratory: "lab",
  experiments: "lab",
  tika: "tika",
  teeka: "tika",
};

const TAB_ALIASES: Record<string, string> = {
  // Create module tabs
  constructor: "construct",
  constructing: "construct",
  assembler: "assemble",
  assembling: "assemble",
  generator: "generate",
  generating: "generate",
  auto: "generate",
  random: "generate",
  speller: "spell",
  spelling: "spell",
  // Learn module tabs
  lessons: "concepts",
  concept: "concepts",
  games: "play",
  playing: "play",
  reference: "codex",
  dictionary: "codex",
  // Browse module tabs
  sequences: "gallery",
  collection: "collections",
  playlist: "collections",
  playlists: "collections",
  creators: "creators",
  people: "creators",
  users: "creators",
  // Compose module tabs
  arranging: "arrange",
  arrangement: "arrange",
  browsing: "browse",
  // Train module tabs
  practicing: "practice",
  challenge: "challenges",
  stats: "progress",
  statistics: "progress",
  history: "progress",
  // Feedback module tabs
  submitting: "submit",
  "my feedback": "my-feedback",
  managing: "manage",
  management: "manage",
  // Settings module tabs
  account: "profile",
  user: "profile",
  prop: "props",
  background: "theme",
  backgrounds: "theme",
  appearance: "theme",
  "release notes": "release-notes",
  updates: "release-notes",
  "what's new": "release-notes",
  visible: "visibility",
  display: "visibility",
  keys: "keyboard",
  shortcuts: "keyboard",
  hotkeys: "keyboard",
  preference: "preferences",
  languages: "language",
  translation: "language",
  // Watch module tabs
  videos: "feed",
  stream: "feed",
  library: "library",
};

export class NavigationSubInterpreter implements ISubInterpreter {
  readonly category: VoiceCommandCategory = "navigation";

  tryInterpret(text: string, context: CommandContext): VoiceCommand | null {
    // Try tab switching first when the text explicitly says "tab"
    // or uses "switch to" (which strongly signals tab intent)
    if (text.includes("tab") || text.startsWith("switch to")) {
      const tabCommand = this.tryParseTabCommand(text, context);
      if (tabCommand) return tabCommand;
    }

    // Try module navigation
    const moduleCommand = this.tryParseModuleCommand(text);
    if (moduleCommand) return moduleCommand;

    // Fallback: try tab switching for patterns without explicit "tab" keyword
    const tabFallback = this.tryParseTabCommand(text, context);
    if (tabFallback) return tabFallback;

    return null;
  }

  private tryParseModuleCommand(text: string): VoiceCommand | null {
    for (const pattern of MODULE_PATTERNS) {
      const match = text.match(pattern);
      if (!match?.[1]) continue;

      const rawTarget = match[1].trim();
      const moduleId = this.resolveModule(rawTarget);
      if (moduleId) {
        return {
          category: "navigation",
          action: "navigate_module",
          target: moduleId,
          rawText: text,
          confidence: 0.9,
        };
      }
    }
    return null;
  }

  private resolveModule(spoken: string): string | null {
    const normalized = spoken.toLowerCase().trim();

    const directMatch = MODULE_DEFINITIONS.find((m) => m.id === normalized);
    if (directMatch) return directMatch.id;

    const labelMatch = MODULE_DEFINITIONS.find(
      (m) => m.label.toLowerCase() === normalized
    );
    if (labelMatch) return labelMatch.id;

    const aliased = MODULE_ALIASES[normalized];
    if (aliased) return aliased;

    return null;
  }

  private tryParseTabCommand(text: string, context: CommandContext): VoiceCommand | null {
    for (const pattern of TAB_PATTERNS) {
      const match = text.match(pattern);
      if (!match?.[1]) continue;

      const rawTarget = match[1].trim();
      const tabId = this.resolveTab(rawTarget, context.currentModule);
      if (tabId) {
        return {
          category: "navigation",
          action: "switch_tab",
          target: tabId,
          rawText: text,
          confidence: 0.85,
        };
      }
    }
    return null;
  }

  private resolveTab(spoken: string, currentModuleId: string): string | null {
    const normalized = spoken.toLowerCase().trim();
    const moduleDef = this.findModule(currentModuleId);
    if (!moduleDef || moduleDef.sections.length === 0) return null;

    const directMatch = moduleDef.sections.find((s) => s.id === normalized);
    if (directMatch) return directMatch.id;

    const labelMatch = moduleDef.sections.find(
      (s) => s.label.toLowerCase() === normalized
    );
    if (labelMatch) return labelMatch.id;

    const aliasedId = TAB_ALIASES[normalized];
    if (aliasedId) {
      const aliasMatch = moduleDef.sections.find((s) => s.id === aliasedId);
      if (aliasMatch) return aliasMatch.id;
    }

    return null;
  }

  private findModule(moduleId: string): ModuleDefinition | undefined {
    return MODULE_DEFINITIONS.find((m) => m.id === moduleId);
  }
}
