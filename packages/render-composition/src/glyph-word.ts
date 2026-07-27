/**
 * Split a TKA word into canonical letter tokens.
 *
 * A trailing dash belongs to the preceding letter, so `W-` is one token. Both
 * the glyph loader and header renderer use this function to prevent a loader /
 * layout disagreement.
 */
export function tokenizeGlyphWord(word: string): string[] {
  const tokens: string[] = [];
  const characters = [...word];

  for (let index = 0; index < characters.length; index++) {
    const character = characters[index]!;
    if (characters[index + 1] === "-") {
      tokens.push(`${character}-`);
      index++;
    } else {
      tokens.push(character);
    }
  }

  return tokens;
}
