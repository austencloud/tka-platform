/**
 * Caption presets for the post-handoff share sheet.
 *
 * The composer's textarea is always the source of truth — presets only FILL
 * it. This store owns the three things worth persisting across sessions: the
 * hashtag set (edited once, applied forever), any captions saved as custom
 * presets, and the last artifact the user shared.
 *
 * Deliberately excluded: generated/humor-profile taglines. Generated voice
 * posting as Austen was rejected during the ghost-presenter work, and that
 * judgment carries here — every preset in this file is either a literal fact
 * about the sequence or text the user typed themselves.
 */

import { browser } from "$app/environment";
import { simplifyRepeatedWord } from "$lib/shared/foundation/utils/word-simplifier";

const STORAGE_KEY = "tka-caption-presets-v1";
const MAX_CUSTOM_PRESETS = 8;

export const DEFAULT_HASHTAGS = "#flowarts #flowart #spinning #tka";

export interface CaptionPreset {
  id: string;
  /** Chip label. Short — the full text lands in the textarea. */
  label: string;
  text: string;
}

interface PersistedCaptions {
  hashtags: string;
  custom: string[];
}

/**
 * Short codes are minted as HTTPS://TKA.RUN/CODE — uppercase, because that is
 * what QR alphanumeric mode encodes most densely and what gets set on printed
 * cards. Under a post it reads as shouting, so a caption lowercases the scheme
 * and host. The URL parser does exactly that and leaves the path alone, which
 * matters: the code's own case is left untouched.
 */
function forCaption(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  try {
    return new URL(trimmed).toString();
  } catch {
    return trimmed;
  }
}

function loadPersisted(): PersistedCaptions {
  if (!browser) return { hashtags: DEFAULT_HASHTAGS, custom: [] };

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { hashtags: DEFAULT_HASHTAGS, custom: [] };

    const parsed = JSON.parse(raw) as Partial<PersistedCaptions>;
    return {
      hashtags:
        typeof parsed.hashtags === "string" ? parsed.hashtags : DEFAULT_HASHTAGS,
      custom: Array.isArray(parsed.custom)
        ? parsed.custom.filter((entry): entry is string => typeof entry === "string")
        : [],
    };
  } catch {
    // A corrupt entry must never block sharing — fall back to defaults.
    return { hashtags: DEFAULT_HASHTAGS, custom: [] };
  }
}

class CaptionPresetManager {
  #persisted = $state<PersistedCaptions>(loadPersisted());

  get hashtags(): string {
    return this.#persisted.hashtags;
  }

  get customPresets(): string[] {
    return this.#persisted.custom;
  }

  setHashtags(value: string): void {
    this.#persisted = { ...this.#persisted, hashtags: value };
    this.#save();
  }

  saveCustomPreset(text: string): void {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (this.#persisted.custom.includes(trimmed)) return;

    const custom = [trimmed, ...this.#persisted.custom].slice(
      0,
      MAX_CUSTOM_PRESETS
    );
    this.#persisted = { ...this.#persisted, custom };
    this.#save();
  }

  removeCustomPreset(text: string): void {
    const custom = this.#persisted.custom.filter((entry) => entry !== text);
    this.#persisted = { ...this.#persisted, custom };
    this.#save();
  }

  /**
   * Presets offered for a specific sequence, in tap order.
   *
   * `word` MUST arrive raw — this simplifies it. A LOOP caption reads FΨ,
   * never FΨFΨFΨFΨ (.claude/rules/simplified-word-display.md).
   *
   * `url` is a tka.run short link or nothing. The viewer's own share URL
   * carries the whole sequence inline and runs past 200 characters — pasted
   * under a post it reads as spam, so a caption never carries one. An empty
   * url is a normal state (a guest, or a code still minting), not an error.
   */
  buildPresets(input: { word: string; url: string }): CaptionPreset[] {
    const word = simplifyRepeatedWord(input.word || "").trim();
    const url = forCaption(input.url);

    const base = [word, url].filter(Boolean).join(" — ");
    const presets: CaptionPreset[] = [];

    if (base) {
      presets.push({
        id: "word-link",
        label: url ? "Word + link" : "Word",
        text: base,
      });
    }

    const hashtags = this.hashtags.trim();
    if (base && hashtags) {
      presets.push({
        id: "word-link-tags",
        label: "+ hashtags",
        text: `${base}\n\n${hashtags}`,
      });
    }

    for (const [index, text] of this.#persisted.custom.entries()) {
      presets.push({
        id: `custom-${index}`,
        label: text.length > 24 ? `${text.slice(0, 24)}…` : text,
        text,
      });
    }

    return presets;
  }

  #save(): void {
    if (!browser) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.#persisted));
    } catch {
      // Private-mode / quota. Presets degrade to session-only rather than
      // failing the share.
    }
  }
}

let instance: CaptionPresetManager | null = null;

export function getCaptionPresetManager(): CaptionPresetManager {
  return (instance ??= new CaptionPresetManager());
}

export type { CaptionPresetManager };
