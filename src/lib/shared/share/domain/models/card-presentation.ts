export const CARD_PRESENTATION_SCHEMA_VERSION = 1 as const;
export const CARD_FOOTER_CREDIT = "Created using Flow Arts Composer";
export const CARD_FOOTER_TEXT_MAX_LENGTH = 120;

export type CardFooterMode = "off" | "credit" | "custom";

export interface CardFooterPresentation {
  readonly mode: CardFooterMode;
  /** Present only for Custom. Credit text stays product-owned and translatable. */
  readonly text?: string;
}

export interface CardPresentation {
  readonly schemaVersion: typeof CARD_PRESENTATION_SCHEMA_VERSION;
  readonly footer: CardFooterPresentation;
}

export interface ResolvedCardFooter {
  readonly show: boolean;
  readonly text: string;
}

export const DEFAULT_CARD_PRESENTATION: CardPresentation = {
  schemaVersion: CARD_PRESENTATION_SCHEMA_VERSION,
  footer: { mode: "off" },
};

function sanitizeFooterText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, CARD_FOOTER_TEXT_MAX_LENGTH);
}

/** Normalizes persisted or host-provided presentation without reading private notes. */
export function normalizeCardPresentation(value: unknown): CardPresentation {
  if (!value || typeof value !== "object") return DEFAULT_CARD_PRESENTATION;

  const footer = (value as { footer?: unknown }).footer;
  if (!footer || typeof footer !== "object") return DEFAULT_CARD_PRESENTATION;

  const mode = (footer as { mode?: unknown }).mode;
  if (mode === "credit") {
    return {
      schemaVersion: CARD_PRESENTATION_SCHEMA_VERSION,
      footer: { mode: "credit" },
    };
  }
  if (mode === "custom") {
    return {
      schemaVersion: CARD_PRESENTATION_SCHEMA_VERSION,
      footer: {
        mode: "custom",
        text: sanitizeFooterText((footer as { text?: unknown }).text),
      },
    };
  }

  return DEFAULT_CARD_PRESENTATION;
}

/** Adapts the account-default footer fields into the product presentation model. */
export function cardPresentationFromFooterSettings(
  show: boolean,
  text: string
): CardPresentation {
  if (!show) return DEFAULT_CARD_PRESENTATION;
  const sanitized = sanitizeFooterText(text);
  if (!sanitized || sanitized === CARD_FOOTER_CREDIT) {
    return {
      schemaVersion: CARD_PRESENTATION_SCHEMA_VERSION,
      footer: { mode: "credit" },
    };
  }
  return {
    schemaVersion: CARD_PRESENTATION_SCHEMA_VERSION,
    footer: { mode: "custom", text: sanitized },
  };
}

export function resolveCardFooter(
  presentation: CardPresentation
): ResolvedCardFooter {
  const normalized = normalizeCardPresentation(presentation);
  switch (normalized.footer.mode) {
    case "credit":
      return { show: true, text: CARD_FOOTER_CREDIT };
    case "custom": {
      const text = sanitizeFooterText(normalized.footer.text);
      return { show: text.length > 0, text };
    }
    default:
      return { show: false, text: "" };
  }
}

export function cardPresentationsEqual(
  left: CardPresentation,
  right: CardPresentation
): boolean {
  return (
    JSON.stringify(normalizeCardPresentation(left)) ===
    JSON.stringify(normalizeCardPresentation(right))
  );
}
