import type { ISubInterpreter } from "../contracts/ISubInterpreter";
import type { VoiceCommand, VoiceCommandCategory, CommandContext } from "../../domain/voice-command-types";

// Prop type aliases: spoken name → canonical prop type
const PROP_ALIASES: Record<string, string> = {
  staff: "staff",
  staves: "staff",
  poi: "poi",
  fan: "fan",
  fans: "fan",
  club: "club",
  clubs: "club",
  hoop: "hoop",
  hoops: "hoop",
  buugeng: "buugeng",
  "boo geng": "buugeng",
  "buu geng": "buugeng",
  triad: "triad",
  triads: "triad",
  sword: "sword",
  swords: "sword",
  hand: "hand",
  hands: "hand",
  chicken: "chicken",
  chickens: "chicken",
  guitar: "guitar",
  ukulele: "ukulele",
  "mini hoop": "minihoop",
  minihoop: "minihoop",
};

// Patterns
/** "change props to poi" or "change prop to fans" */
const CHANGE_BOTH_PATTERN = /^change\s+(?:props?|prop type)\s+to\s+(.+)$/;

/** "change blue prop to staff" or "change blue to fans" */
const CHANGE_HAND_PATTERN = /^change\s+(blue|red)\s+(?:prop\s+)?to\s+(.+)$/;

/** "use clubs" or "use poi" */
const USE_PATTERN = /^use\s+(.+)$/;

export class PropSubInterpreter implements ISubInterpreter {
  readonly category: VoiceCommandCategory = "prop";

  tryInterpret(text: string, _context: CommandContext): VoiceCommand | null {
    // "change blue prop to staff"
    const handMatch = text.match(CHANGE_HAND_PATTERN);
    if (handMatch?.[1] && handMatch?.[2]) {
      const propType = this.resolveProp(handMatch[2].trim());
      if (propType) {
        return {
          category: "prop",
          action: "change_prop",
          target: propType,
          args: { hand: handMatch[1] },
          rawText: text,
          confidence: 0.9,
        };
      }
    }

    // "change props to poi"
    const bothMatch = text.match(CHANGE_BOTH_PATTERN);
    if (bothMatch?.[1]) {
      const propType = this.resolveProp(bothMatch[1].trim());
      if (propType) {
        return {
          category: "prop",
          action: "change_prop",
          target: propType,
          args: { hand: "both" },
          rawText: text,
          confidence: 0.9,
        };
      }
    }

    // "use clubs"
    const useMatch = text.match(USE_PATTERN);
    if (useMatch?.[1]) {
      const propType = this.resolveProp(useMatch[1].trim());
      if (propType) {
        return {
          category: "prop",
          action: "change_prop",
          target: propType,
          args: { hand: "both" },
          rawText: text,
          confidence: 0.85,
        };
      }
    }

    return null;
  }

  private resolveProp(spoken: string): string | null {
    const normalized = spoken.toLowerCase().trim();
    return PROP_ALIASES[normalized] ?? null;
  }
}
