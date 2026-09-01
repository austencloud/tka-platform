import { describe, expect, it } from "vitest";
import {
  CARD_FOOTER_CREDIT,
  CARD_FOOTER_TEXT_MAX_LENGTH,
  cardPresentationFromFooterSettings,
  normalizeCardPresentation,
  resolveCardFooter,
} from "./card-presentation";

describe("card presentation", () => {
  it("keeps private sequence notes outside the presentation model", () => {
    const normalized = normalizeCardPresentation({
      notes: "private rehearsal note",
      footer: { mode: "off" },
    });

    expect(normalized).toEqual({
      schemaVersion: 1,
      footer: { mode: "off" },
    });
    expect(JSON.stringify(normalized)).not.toContain("private rehearsal note");
  });

  it("resolves off, product credit, and custom text explicitly", () => {
    expect(
      resolveCardFooter({ schemaVersion: 1, footer: { mode: "off" } })
    ).toEqual({ show: false, text: "" });
    expect(
      resolveCardFooter({ schemaVersion: 1, footer: { mode: "credit" } })
    ).toEqual({ show: true, text: CARD_FOOTER_CREDIT });
    expect(
      resolveCardFooter({
        schemaVersion: 1,
        footer: { mode: "custom", text: "  Shared from First Fire  " },
      })
    ).toEqual({ show: true, text: "Shared from First Fire" });
  });

  it("sanitizes persisted custom text and caps its length", () => {
    const text = `  ${"a".repeat(CARD_FOOTER_TEXT_MAX_LENGTH + 20)}  `;
    const normalized = normalizeCardPresentation({
      schemaVersion: 99,
      footer: { mode: "custom", text },
    });

    expect(normalized.schemaVersion).toBe(1);
    expect(normalized.footer.text).toHaveLength(CARD_FOOTER_TEXT_MAX_LENGTH);
  });

  it("adapts legacy account defaults without confusing credit and custom text", () => {
    expect(
      cardPresentationFromFooterSettings(false, "anything").footer.mode
    ).toBe("off");
    expect(
      cardPresentationFromFooterSettings(true, CARD_FOOTER_CREDIT)
    ).toEqual({
      schemaVersion: 1,
      footer: { mode: "credit" },
    });
    expect(cardPresentationFromFooterSettings(true, "First Fire 2026")).toEqual(
      {
        schemaVersion: 1,
        footer: { mode: "custom", text: "First Fire 2026" },
      }
    );
  });
});
