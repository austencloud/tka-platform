export interface SoftwareSubmissionInput {
  name: string;
  url: string;
  notes: string;
}

type SubmissionParseResult =
  | { ok: true; spam: true }
  | { ok: true; spam: false; value: SoftwareSubmissionInput }
  | { ok: false; error: string };

const ALLOWED_KEYS = new Set(["name", "url", "notes", "website"]);

export function parseSoftwareSubmission(body: unknown): SubmissionParseResult {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "That submission could not be read." };
  }

  const input = body as Record<string, unknown>;
  if (Object.keys(input).some((key) => !ALLOWED_KEYS.has(key))) {
    return { ok: false, error: "That submission contains unexpected fields." };
  }

  if (
    typeof input.website !== "undefined" &&
    typeof input.website !== "string"
  ) {
    return { ok: false, error: "That submission could not be read." };
  }

  if (typeof input.website === "string" && input.website.trim()) {
    return { ok: true, spam: true };
  }

  if (
    typeof input.name !== "string" ||
    typeof input.url !== "string" ||
    typeof input.notes !== "string"
  ) {
    return { ok: false, error: "Name, link, and notes must be text." };
  }

  const name = input.name.trim();
  const url = input.url.trim();
  const notes = input.notes.trim();

  if (name.length < 2 || name.length > 120) {
    return { ok: false, error: "Use a name between 2 and 120 characters." };
  }

  if (url.length > 500) {
    return { ok: false, error: "Keep the link under 500 characters." };
  }

  if (url) {
    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
        return { ok: false, error: "Use an http or https link." };
      }
    } catch {
      return { ok: false, error: "Enter a complete link, including https://." };
    }
  }

  if (notes.length > 2000) {
    return { ok: false, error: "Keep the notes under 2,000 characters." };
  }

  return { ok: true, spam: false, value: { name, url, notes } };
}
