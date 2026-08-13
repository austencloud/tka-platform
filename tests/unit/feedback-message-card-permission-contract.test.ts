import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(
    process.cwd(),
    "src/lib/shared/inbox/components/messages/FeedbackMessageCard.svelte"
  ),
  "utf8"
);

describe("FeedbackMessageCard permission boundary", () => {
  it("does not preflight a private feedback document when rendering an attachment", () => {
    expect(source).not.toContain("feedbackService");
    expect(source).not.toContain("feedback-repository");
    expect(source).toContain(
      "const feedbackId = $derived(attachment.metadata?.feedbackId)"
    );
  });
});
