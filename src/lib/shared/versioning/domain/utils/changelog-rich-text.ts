// Changelog entry text carries two inline tokens, authored by the release
// pipeline: markdown links `[label](url)` and icon glyphs `{icon:name}`.
// This module is the single tokenizer; ChangelogRichText.svelte renders the
// segments, and plaintext consumers (clipboard copy) strip them.

export type ChangelogSegment =
  | { kind: "text"; value: string }
  | { kind: "link"; label: string; href: string; external: boolean }
  | { kind: "icon"; name: string };

const TOKEN_PATTERN = /\[([^\]]+)\]\(([^)\s]+)\)|\{icon:([a-z0-9-]+)\}/g;

const INTERNAL_HOSTS = new Set([
  "tkaflowarts.com",
  "www.tkaflowarts.com",
  "localhost",
]);

export function toChangelogSegments(input: string): ChangelogSegment[] {
  const segments: ChangelogSegment[] = [];
  let cursor = 0;
  for (const match of input.matchAll(TOKEN_PATTERN)) {
    const index = match.index ?? 0;
    if (index > cursor) {
      segments.push({ kind: "text", value: input.slice(cursor, index) });
    }
    if (match[3]) {
      const name = match[3];
      segments.push({
        kind: "icon",
        name: name.startsWith("fa-") ? name : `fa-${name}`,
      });
    } else {
      segments.push(toLink(match[1]!, match[2]!));
    }
    cursor = index + match[0].length;
  }
  if (cursor < input.length) {
    segments.push({ kind: "text", value: input.slice(cursor) });
  }
  return segments;
}

function toLink(label: string, url: string): ChangelogSegment {
  try {
    const parsed = new URL(url, "https://tkaflowarts.com");
    const internal = INTERNAL_HOSTS.has(parsed.hostname);
    return {
      kind: "link",
      label,
      href: internal
        ? parsed.pathname + parsed.search + parsed.hash
        : parsed.href,
      external: !internal,
    };
  } catch {
    return { kind: "text", value: label };
  }
}

/** Entry text with tokens flattened: links become their label, icons vanish. */
export function changelogPlainText(input: string): string {
  return toChangelogSegments(input)
    .map((s) => (s.kind === "text" ? s.value : s.kind === "link" ? s.label : ""))
    .join("")
    .replace(/\s{2,}/g, " ")
    .trim();
}
