import letterMappings from "../../../../../../../static/data/learn/letter-mappings.json";
export type TKALetter = keyof typeof letterMappings.letters;

export interface LetterPositionData {
  startPosition: string;
  endPosition: string;
  blueMotion: string;
  redMotion: string;
}

export class LetterDomainService {
  private static readonly mappings = letterMappings.letters as Record<string, LetterPositionData>;

  /**
   * Get the canonical movement type for a character
   */
  static getLetterType(char: string): number {
    const categories = letterMappings.categories;
    if (categories["dual-shift"].includes(char)) return 1;
    if (categories["shift"].includes(char)) return 2;
    if (categories["cross-shift"].includes(char)) return 3;
    if (categories["dash"].includes(char)) return 4;
    if (categories["dual_dash"].includes(char)) return 5;
    if (categories["static"].includes(char)) return 6;
    return 0;
  }

  /**
   * Determine if a letter can follow another letter based on position continuity.
   * Logic: prev.endPosition group must match next.startPosition group.
   * Groups are normalized (e.g., alpha1 -> alpha).
   */
  static canFollow(prevChar: string, nextChar: string): boolean {
    const prev = this.mappings[prevChar];
    const next = this.mappings[nextChar];

    if (!prev || !next) return true; // Fail-safe to allowed

    const prevEndGroup = this.normalizeGroup(prev.endPosition);
    const nextStartGroup = this.normalizeGroup(next.startPosition);

    return prevEndGroup === nextStartGroup;
  }

  /**
   * Normalize a position string (e.g., "alpha3" -> "alpha", "β5" -> "beta")
   */
  private static normalizeGroup(pos: string): string {
    const lower = pos.toLowerCase();
    const group = lower.replace(/[0-9]/g, "").trim();
    
    const greekMap: Record<string, string> = {
      "α": "alpha",
      "β": "beta",
      "γ": "gamma"
    };

    return greekMap[group] || group;
  }

  /**
   * Get all letters that can validly follow the given character
   */
  static getValidNextLetters(lastChar: string): string[] {
    // If the last character is a dash '-', we need to find the letter BEFORE it
    // because '-' is a modifier, not a movement itself in terms of start/end position.
    // However, in this system, 'W-' is a character.
    return Object.keys(this.mappings).filter(char => this.canFollow(lastChar, char));
  }

  /**
   * Parse a sequence string and return the last meaningful letter/character.
   * Handles multi-char characters like 'W-' or 'Σ-'.
   */
  static getLastLetter(query: string): string | null {
    if (!query) return null;
    
    const allChars = Object.keys(this.mappings).sort((a, b) => b.length - a.length);
    
    // Check for suffix matches
    for (const char of allChars) {
      if (query.endsWith(char)) return char;
    }
    
    // If no match found, the last character might be a raw letter we don't have mapping for
    // or a dash that isn't part of a valid char.
    return null;
  }
}
