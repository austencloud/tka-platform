import type { Catalog } from "./models/Catalog";
import type { CardFooter } from "./models/DeckRelease";
import { TND_BY_FAMILY } from "./tnd-element";

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
  catalog: Catalog | null,
): string | undefined {
  if (vtgFamilyId) return vtgFamilyId;
  if (catalog && VTG_ABBREVIATIONS[catalog.loopType]) return catalog.loopType;
  if (catalog?.collection === "VTG") {
    for (const key of VTG_FAMILY_KEYS) {
      if (catalog.families.some((f) => f.id.toLowerCase().includes(key))) {
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

export function computeTkaDesignation(catalog: Catalog): string {
  const parts: string[] = [];
  if (catalog.sliceType) parts.push(capitalize(catalog.sliceType));
  const loopType = catalog.loopType || (catalog.collection === "VTG" ? "rotated" : "");
  if (loopType) parts.push(capitalize(loopType));
  if (catalog.stepCount) parts.push(`${catalog.stepCount}-Step`);
  if (catalog.turnPattern) parts.push(formatTurnForTKA(catalog.turnPattern));
  if (catalog.reversalPattern) parts.push(capitalize(catalog.reversalPattern));
  if (catalog.gridMode) parts.push(capitalize(catalog.gridMode));
  return parts.join(" ") || catalog.canonicalName || catalog.name;
}

export function computeVtgDesignation(catalog: Catalog, vtgFamilyId: string | undefined): string {
  if (!vtgFamilyId) return "";
  const label = VTG_FAMILY_LABELS[vtgFamilyId] ?? vtgFamilyId;
  const turn = catalog.turnPattern;
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

export function computeCatalogLeftLabel(catalog: Catalog, vtgFamilyId: string | undefined): string | undefined {
  if (!vtgFamilyId) return undefined;
  const abbr = VTG_ABBREVIATIONS[vtgFamilyId];
  if (!abbr) return undefined;
  const turn = catalog.turnPattern;
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


export function parseDeckTurnRatio(turnPattern: string | undefined): string {
  if (!turnPattern) return "1:1";
  if (/^\d+:\d+(\|\d+:\d+)?$/.test(turnPattern)) return turnPattern;
  const uniformMatch = turnPattern.match(/^uniform[- ](\d+(?:\.\d+)?)t$/i);
  if (uniformMatch) {
    const turns = parseFloat(uniformMatch[1] ?? "0");
    return TURNS_TO_RATIO[turns] ?? `${turns * 2 + 1}:1`;
  }
  const pipeMatch = turnPattern.match(/^([\d.]+)\|([\d.]+)$/);
  if (pipeMatch) {
    const b = parseFloat(pipeMatch[1]!);
    const r = parseFloat(pipeMatch[2]!);
    return `${TURNS_TO_RATIO[b] ?? `${b * 2 + 1}:1`}|${TURNS_TO_RATIO[r] ?? `${r * 2 + 1}:1`}`;
  }
  return "1:1";
}

export function computeVtgCardFooter(familyId: string, _turnRatio: string): CardFooter {
  const theme = TND_BY_FAMILY[familyId];
  return theme
    ? { center: theme.name, iconPath: theme.iconPath }
    : { center: familyId };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
