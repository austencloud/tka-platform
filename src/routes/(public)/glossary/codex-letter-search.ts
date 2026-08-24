const GREEK_NAMES: Readonly<Record<string, string>> = {
  alpha: "α",
  beta: "β",
  gamma: "γ",
  delta: "Δ",
  lambda: "Λ",
  omega: "Ω",
  phi: "Φ",
  psi: "Ψ",
  sigma: "Σ",
  theta: "Θ",
  tau: "τ",
};

function normalizeLetterQuery(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/^letter\s+/, "")
    .replace(/[–—]/g, "-")
    .replace(/(?:\s+|-)dash$/, "-")
    .replace(/\s*-\s*$/, "-")
    .replace(/\s+/g, " ");
}

/**
 * Resolve a whole search query to one registered Codex letter. Partial text
 * stays in glossary search, while exact symbols and spoken letter names open
 * the visual reference instead of synthesizing a text definition.
 */
export function resolveCodexLetterQuery(
  value: string,
  dataframeLetters: readonly string[],
  extensions: readonly string[]
): string | null {
  const normalized = normalizeLetterQuery(value);
  if (!normalized) return null;

  const available = [...dataframeLetters, ...extensions];
  const direct = available.find(
    (letter) =>
      letter.normalize("NFKC").toLocaleLowerCase("en-US") === normalized
  );
  if (direct) return direct;

  const dashed = normalized.endsWith("-");
  const base = dashed ? normalized.slice(0, -1) : normalized;
  let candidate: string | null = null;

  if (/^[a-z]$/.test(base)) {
    candidate = base.toUpperCase();
  } else if (GREEK_NAMES[base]) {
    candidate = GREEK_NAMES[base];
  }

  if (!candidate) return null;
  if (dashed) candidate += "-";

  return available.includes(candidate) ? candidate : null;
}
