// Pure markdown formatter that bundles everything an AI needs to reason about a
// deck: identity, the current on-screen print layout, the frozen recipe, and the
// full card list. No DOM, no state — fed by DeckReleaserTab and handed to the
// Copy-for-AI button's getData. Markdown so it pastes legibly into a chat.

import type { CardSizeId } from "../domain/card-sizes";
import type { CardVariation, DeckRecipe, DeckReleaseCard } from "../domain/models/DeckRelease";
import { getTnDElementByIconPath } from "../domain/tnd-element";

export interface DeckAiSummaryLayout {
  cardSize: CardSizeId;
  cardsPerPage: number;
  copies: number;
  groupByColor: boolean;
  groupByLetter: boolean;
  sheets: number;
  blanks: number;
}

export interface DeckAiSummaryInput {
  name?: string;
  deckNumber: number;
  isReleased: boolean;
  cards: DeckReleaseCard[];
  layout: DeckAiSummaryLayout;
  recipe?: DeckRecipe;
}

function deckNumberLabel(n: number): string {
  return `#${String(n).padStart(3, "0")}`;
}

/** "4-step ×54" style distribution, highest step count first. */
function stepDistribution(cards: DeckReleaseCard[]): string {
  const dist = new Map<number, number>();
  for (const c of cards) dist.set(c.stepCount, (dist.get(c.stepCount) ?? 0) + 1);
  const rows = [...dist.entries()].sort((a, b) => b[0] - a[0]);
  if (rows.length === 1) return `${rows[0]![0]}-step`;
  return rows.map(([step, count]) => `${step}-step ×${count}`).join(", ");
}

function variationLabel(v?: CardVariation): string {
  if (!v) return "—";
  const parts: string[] = [];
  if (v.turnLabel) parts.push(v.turnLabel);
  else if (v.turnPattern) parts.push(`turns ${v.turnPattern}`);
  if (v.reversalSequence) parts.push(`rev ${v.reversalSequence}`);
  if (v.startOriMode && v.startOriMode !== "radial") parts.push(v.startOriMode);
  if (v.gridMode && v.gridMode !== "diamond") parts.push(v.gridMode);
  return parts.length ? parts.join(", ") : "—";
}

function colorLabel(card: DeckReleaseCard): string {
  const el = getTnDElementByIconPath(card.footer?.iconPath ?? "");
  return el ? `${el.element} (${el.name})` : "—";
}

function recipeSection(recipe: DeckRecipe): string {
  const lines: string[] = [`- Mode: ${recipe.deckMode}`];
  if (recipe.startOriModes?.length) lines.push(`- Start orientation: ${recipe.startOriModes.join(", ")}`);
  if (recipe.gridModes?.length) lines.push(`- Grid modes: ${recipe.gridModes.join(", ")}`);
  if (recipe.reversalPattern) {
    const r = recipe.reversalPattern;
    lines.push(`- Reversal: ${r.id ?? "custom"}${r.sequence ? ` (${r.sequence})` : ""}`);
  } else {
    lines.push(`- Reversal: none`);
  }
  if (recipe.deckMode === "loop") {
    if (recipe.totalCards != null) lines.push(`- Target total cards: ${recipe.totalCards}`);
    if (recipe.sliceTypes?.length) lines.push(`- Slice types: ${recipe.sliceTypes.join(", ")}`);
    if (recipe.weights?.length) {
      const w = recipe.weights.map((x) => `${x.stepCount}-step×${x.weight}`).join(", ");
      lines.push(`- Step weights: ${w}`);
    }
  } else {
    if (recipe.tndFamilyIds?.length) lines.push(`- TnD families: ${recipe.tndFamilyIds.join(", ")}`);
    if (recipe.tndTurnPatternIds?.length) lines.push(`- TnD turn patterns: ${recipe.tndTurnPatternIds.join(", ")}`);
  }
  return lines.join("\n");
}

export function buildDeckAiSummary(input: DeckAiSummaryInput): string {
  const { name, deckNumber, isReleased, cards, layout, recipe } = input;
  const title = name?.trim() || "Untitled Deck";
  const mode = recipe?.deckMode ? `${recipe.deckMode.toUpperCase()} mode` : "";
  const fit = layout.blanks === 0 ? "perfect fit (0 blanks)" : `${layout.blanks} blank cells`;

  const out: string[] = [];

  out.push(`# Deck: ${title} (${isReleased ? "released " : "draft, next "}${deckNumberLabel(deckNumber)})`);
  out.push(
    `${cards.length} cards · ${stepDistribution(cards)}${mode ? ` · ${mode}` : ""}`,
  );

  out.push("", "## Current print layout (what's on screen)");
  out.push(
    `- Card size: ${layout.cardSize} (${layout.cardsPerPage} per sheet)`,
    `- Copies per card: ${layout.copies}`,
    `- Group by color: ${layout.groupByColor ? "on" : "off"}`,
    `- Group by letter: ${layout.groupByLetter ? "on" : "off"}`,
    `- Sheets: ${layout.sheets} · ${fit}`,
  );

  if (recipe) {
    out.push("", "## Recipe (frozen dial-set)");
    out.push(recipeSection(recipe));
  }

  out.push("", `## Cards (${cards.length})`);
  out.push("| # | Letter | Steps | Color | Variation |");
  out.push("|---|--------|-------|-------|-----------|");
  for (const c of cards) {
    out.push(
      `| ${c.position} | ${c.word || "—"} | ${c.stepCount} | ${colorLabel(c)} | ${variationLabel(c.variation)} |`,
    );
  }

  return out.join("\n");
}
