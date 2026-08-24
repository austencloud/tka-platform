const NON_WORD_CHARACTERS = /[^\p{L}\p{N}]+/gu;

/**
 * Glossary vocabulary appears with hyphens, spaces, arrows, and Greek letters.
 * Search treats punctuation as a word break so the spelling someone types does
 * not have to match the notation's typography exactly.
 */
export function normalizeGlossarySearchText(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(NON_WORD_CHARACTERS, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function matchesGlossarySearchText(
  value: string,
  normalizedQuery: string
): boolean {
  const normalizedValue = normalizeGlossarySearchText(value);
  if (normalizedValue.includes(normalizedQuery)) return true;

  // Curriculum copy varies between forms such as "handpath" / "hand path"
  // and "halfway" / "half way". Compact comparison makes those equivalent.
  const compactQuery = normalizedQuery.replaceAll(" ", "");
  const compactValue = normalizedValue.replaceAll(" ", "");
  return compactValue.includes(compactQuery);
}

export interface GlossarySearchableTerm {
  term: string;
  aliases: readonly string[];
  definition: string;
  examples: readonly string[];
  related: readonly { term: string }[];
  benefit: string | null;
  importance: string | null;
}

/** Search every public representation of a glossary term, including aliases. */
export function matchesGlossaryTerm(
  term: GlossarySearchableTerm,
  normalizedQuery: string
): boolean {
  // A one-character query behaves like a name or symbol lookup. Codex search
  // resolves registered letters separately; glossary search must not match
  // every definition that happens to contain the article "a."
  if ([...normalizedQuery].length === 1) {
    return [term.term, ...term.aliases].some((name) =>
      normalizeGlossarySearchText(name).split(" ").includes(normalizedQuery)
    );
  }

  return (
    matchesGlossarySearchText(term.term, normalizedQuery) ||
    term.aliases.some((alias) =>
      matchesGlossarySearchText(alias, normalizedQuery)
    ) ||
    matchesGlossarySearchText(term.definition, normalizedQuery) ||
    (term.benefit
      ? matchesGlossarySearchText(term.benefit, normalizedQuery)
      : false) ||
    (term.importance
      ? matchesGlossarySearchText(term.importance, normalizedQuery)
      : false) ||
    term.examples.some((example) =>
      matchesGlossarySearchText(example, normalizedQuery)
    ) ||
    term.related.some((related) =>
      matchesGlossarySearchText(related.term, normalizedQuery)
    )
  );
}
