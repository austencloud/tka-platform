import type { Deck } from "./models/Deck";
import type { CardFooter } from "./models/DeckRelease";

export const VTG_ABBREVIATIONS: Record<string, string> = {
  "split-same": "SS", "tog-same": "TS",
  "split-opp": "SO", "tog-opp": "TO",
  "quarter-same": "QS", "quarter-opp": "QO",
};

export const ABBR_TO_FAMILY_ID: Record<string, string> = Object.fromEntries(
  Object.entries(VTG_ABBREVIATIONS).map(([k, v]) => [v, k]),
);

export const VTG_FAMILY_LABELS: Record<string, string> = {
  "split-same": "Split-Same", "tog-same": "Tog-Same",
  "split-opp": "Split-Opp", "tog-opp": "Tog-Opp",
  "quarter-same": "Quarter-Same", "quarter-opp": "Quarter-Opp",
};

export const TURNS_TO_RATIO: Record<number, string> = {
  0: "1:1", 0.5: "2:1", 1: "3:1", 1.5: "4:1", 2: "5:1", 2.5: "6:1", 3: "7:1",
};

export const VTG_FAMILY_KEYS = Object.keys(VTG_ABBREVIATIONS);

export function resolveVtgFamilyId(
  vtgFamilyId: string | null | undefined,
  deck: Deck | null,
): string | undefined {
  if (vtgFamilyId) return vtgFamilyId;
  if (deck && VTG_ABBREVIATIONS[deck.loopType]) return deck.loopType;
  if (deck?.collection === "VTG") {
    for (const key of VTG_FAMILY_KEYS) {
      if (deck.families.some((f) => f.id.toLowerCase().includes(key))) {
        return key;
      }
    }
  }
  return undefined;
}

export function formatTurnForTKA(turn: string): string {
  const m = turn.match(/^uniform[- ](\d+)t$/i);
  if (m) return `${m[1]}T`;
  return turn.replace(/^(\d+)t$/i, "$1T");
}

export function computeTkaDesignation(deck: Deck): string {
  const parts: string[] = [];
  if (deck.sliceType) parts.push(capitalize(deck.sliceType));
  const loopType = deck.loopType || (deck.collection === "VTG" ? "rotated" : "");
  if (loopType) parts.push(capitalize(loopType));
  if (deck.stepCount) parts.push(`${deck.stepCount}-Step`);
  if (deck.turnPattern) parts.push(formatTurnForTKA(deck.turnPattern));
  if (deck.reversalPattern) parts.push(capitalize(deck.reversalPattern));
  if (deck.gridMode) parts.push(capitalize(deck.gridMode));
  return parts.join(" ") || deck.canonicalName || deck.name;
}

export function computeVtgDesignation(deck: Deck, vtgFamilyId: string | undefined): string {
  if (!vtgFamilyId) return "";
  const label = VTG_FAMILY_LABELS[vtgFamilyId] ?? vtgFamilyId;
  const turn = deck.turnPattern;
  if (turn) {
    const uniformMatch = turn.match(/^uniform[- ](\d+)t$/i);
    if (uniformMatch) {
      const turns = parseInt(uniformMatch[1] ?? "0", 10);
      const ratio = TURNS_TO_RATIO[turns];
      if (ratio) return `VTG ${label} ${ratio}`;
    }
    if (/^\d+:\d+$/.test(turn)) return `VTG ${label} ${turn}`;
  }
  return `VTG ${label}`;
}

export function computeDeckLeftLabel(deck: Deck, vtgFamilyId: string | undefined): string | undefined {
  if (!vtgFamilyId) return undefined;
  const abbr = VTG_ABBREVIATIONS[vtgFamilyId];
  if (!abbr) return undefined;
  const turn = deck.turnPattern;
  if (turn) {
    if (/^\d+:\d+$/.test(turn)) return `${abbr} ${turn}`;
    const uniformMatch = turn.match(/^uniform[- ](\d+)t$/i);
    if (uniformMatch) {
      const turns = parseInt(uniformMatch[1] ?? "0", 10);
      const ratio = TURNS_TO_RATIO[turns] ?? `${turns}t`;
      return `${abbr} ${ratio}`;
    }
  }
  return abbr;
}

const VTG_ELEMENT_MAP: Record<string, { name: string; emoji: string }> = {
  "split-same":   { name: "Split-Same", emoji: "🌊" },
  "tog-same":     { name: "Tog-Same", emoji: "🌍" },
  "quarter-same": { name: "Quarter-Same", emoji: "☀️" },
  "split-opp":    { name: "Split-Opp", emoji: "🔥" },
  "tog-opp":      { name: "Tog-Opp", emoji: "💨" },
  "quarter-opp":  { name: "Quarter-Opp", emoji: "🌙" },
};

export function parseDeckTurnRatio(turnPattern: string | undefined): string {
  if (!turnPattern) return "0:1";
  if (/^\d+:\d+$/.test(turnPattern)) return turnPattern;
  const uniformMatch = turnPattern.match(/^uniform[- ](\d+(?:\.\d+)?)t$/i);
  if (uniformMatch) {
    const turns = parseFloat(uniformMatch[1] ?? "0");
    return TURNS_TO_RATIO[turns] ?? `${turns + 1}:1`;
  }
  return "0:1";
}

export function computeVtgCardFooter(familyId: string, turnRatio: string): CardFooter {
  const el = VTG_ELEMENT_MAP[familyId];
  const center = el
    ? `${el.name} ${turnRatio} - ${el.emoji}`
    : `${familyId} ${turnRatio}`;
  return { center };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
