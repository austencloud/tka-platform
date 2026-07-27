import { describe, expect, it, vi } from "vitest";
import {
  chooseSpecificClaimAction,
  resolveFeedbackSessionId,
} from "../../scripts/lib/feedback-claim-session.js";

describe("resolveFeedbackSessionId", () => {
  it("keeps Codex commands in the same feedback session", () => {
    expect(
      resolveFeedbackSessionId(
        {
          CODEX_THREAD_ID: "codex-thread",
          CLAUDE_CODE_SESSION_ID: "claude-session",
        },
        vi.fn()
      )
    ).toBe("codex-thread");
  });

  it("uses the Claude session when no Codex thread exists", () => {
    expect(
      resolveFeedbackSessionId(
        { CLAUDE_CODE_SESSION_ID: "claude-session" },
        vi.fn()
      )
    ).toBe("claude-session");
  });

  it("creates an isolated fallback for an ordinary shell", () => {
    expect(resolveFeedbackSessionId({}, () => "generated-session")).toBe(
      "generated-session"
    );
  });
});

describe("chooseSpecificClaimAction", () => {
  it("claims available work", () => {
    expect(
      chooseSpecificClaimAction({ status: "new" }, "current-session", false)
    ).toBe("claim");
  });

  it("refreshes a live claim owned by the same agent session", () => {
    expect(
      chooseSpecificClaimAction(
        { status: "in-progress", claimSession: "current-session" },
        "current-session",
        false
      )
    ).toBe("refresh");
  });

  it("reclaims an expired lease", () => {
    expect(
      chooseSpecificClaimAction(
        { status: "in-progress", claimSession: "old-session" },
        "current-session",
        true
      )
    ).toBe("reclaim");
  });

  it("protects another session's live claim", () => {
    expect(
      chooseSpecificClaimAction(
        { status: "in-progress", claimSession: "other-session" },
        "current-session",
        false
      )
    ).toBe("blocked");
  });
});
