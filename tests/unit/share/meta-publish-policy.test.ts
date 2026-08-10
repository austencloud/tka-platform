import { describe, expect, it } from "vitest";
import {
  assertAllowedMediaUrl,
  assertInstagramImageFormat,
  interpretContainerStatus,
  mapMetaError,
  MetaPublishError,
  sanitizeCaption,
  shouldRefreshToken,
  CAPTION_MAX_HASHTAGS,
  CAPTION_MAX_LENGTH,
} from "../../../firebase-functions/src/share/metaPublishPolicy";

const R2_BASE = "https://media.tkaflowarts.com";

function codeOf(run: () => void): string {
  try {
    run();
  } catch (error) {
    return error instanceof MetaPublishError ? error.code : "not-a-meta-error";
  }
  return "no-error";
}

describe("caption sanitation", () => {
  it("trims and leaves an ordinary caption alone", () => {
    const { caption } = sanitizeCaption("  FΨ on the beach\nhttps://tka.run/a3f9  ");
    expect(caption).toBe("FΨ on the beach\nhttps://tka.run/a3f9");
  });

  it("truncates a caption past Instagram's ceiling instead of failing the post", () => {
    const { caption } = sanitizeCaption("x".repeat(CAPTION_MAX_LENGTH + 40));
    expect(caption).toHaveLength(CAPTION_MAX_LENGTH);
  });

  it("drops hashtags past the limit from the END, keeping the earliest", () => {
    const tags = Array.from(
      { length: CAPTION_MAX_HASHTAGS + 5 },
      (_, index) => `#tag${index}`
    ).join(" ");
    const { caption, hashtagCount } = sanitizeCaption(`FΨ ${tags}`);

    expect(hashtagCount).toBe(CAPTION_MAX_HASHTAGS);
    expect(caption).toContain("#tag0");
    expect(caption).toContain(`#tag${CAPTION_MAX_HASHTAGS - 1}`);
    expect(caption).not.toContain(`#tag${CAPTION_MAX_HASHTAGS}`);
    expect(caption.match(/#[\p{L}\p{N}_]+/gu)).toHaveLength(
      CAPTION_MAX_HASHTAGS
    );
  });

  it("counts a hashtag carrying non-ASCII letters", () => {
    const { hashtagCount } = sanitizeCaption("#flowarts #kinetiskt #ψ");
    expect(hashtagCount).toBe(3);
  });
});

describe("media URL allowlist", () => {
  it("accepts a URL on the app's own R2 host", () => {
    expect(() =>
      assertAllowedMediaUrl(`${R2_BASE}/users/abc/thumbnails/s1/1_share.jpg`, R2_BASE)
    ).not.toThrow();
  });

  it("refuses a host the app does not own — Meta fetches whatever it is handed", () => {
    expect(
      codeOf(() =>
        assertAllowedMediaUrl("https://evil.example/payload.mp4", R2_BASE)
      )
    ).toBe("meta/media-url-not-allowed");
  });

  it("refuses plain HTTP even on the right host", () => {
    expect(
      codeOf(() =>
        assertAllowedMediaUrl("http://media.tkaflowarts.com/a.jpg", R2_BASE)
      )
    ).toBe("meta/media-url-not-allowed");
  });

  it("refuses a lookalike host that merely starts with the real one", () => {
    expect(
      codeOf(() =>
        assertAllowedMediaUrl(
          "https://media.tkaflowarts.com.evil.example/a.jpg",
          R2_BASE
        )
      )
    ).toBe("meta/media-url-not-allowed");
  });

  it("honours a path prefix on the public base", () => {
    const base = "https://media.tkaflowarts.com/tka";
    expect(() =>
      assertAllowedMediaUrl(`${base}/users/abc/a.jpg`, base)
    ).not.toThrow();
    expect(
      codeOf(() =>
        assertAllowedMediaUrl("https://media.tkaflowarts.com/other/a.jpg", base)
      )
    ).toBe("meta/media-url-not-allowed");
  });

  it("refuses garbage rather than passing it through", () => {
    expect(codeOf(() => assertAllowedMediaUrl("not a url", R2_BASE))).toBe(
      "meta/media-url-not-allowed"
    );
  });
});

describe("Instagram image format", () => {
  it("accepts .jpg and .jpeg", () => {
    expect(() =>
      assertInstagramImageFormat(`${R2_BASE}/a/1_share.jpg`)
    ).not.toThrow();
    expect(() =>
      assertInstagramImageFormat(`${R2_BASE}/a/1_share.JPEG`)
    ).not.toThrow();
  });

  it("refuses the PNG the card renderer produces", () => {
    // The card is a PNG; the client converts before upload. If that ever
    // regresses this is the guard that names the reason.
    expect(
      codeOf(() => assertInstagramImageFormat(`${R2_BASE}/a/1_share.png`))
    ).toBe("meta/media-rejected");
  });

  it("ignores a query string when reading the extension", () => {
    expect(() =>
      assertInstagramImageFormat(`${R2_BASE}/a/1_share.jpg?v=2`)
    ).not.toThrow();
  });
});

describe("container status", () => {
  it("treats FINISHED and PUBLISHED as ready", () => {
    expect(interpretContainerStatus("FINISHED").state).toBe("ready");
    expect(interpretContainerStatus("PUBLISHED").state).toBe("ready");
  });

  it("keeps waiting on IN_PROGRESS and on a missing status", () => {
    expect(interpretContainerStatus("IN_PROGRESS").state).toBe("pending");
    expect(interpretContainerStatus(undefined).state).toBe("pending");
  });

  it("separates an expired container from a rejected one", () => {
    const expired = interpretContainerStatus("EXPIRED");
    const rejected = interpretContainerStatus("ERROR");
    expect(expired).toMatchObject({ state: "failed", code: "meta/timed-out" });
    expect(rejected).toMatchObject({
      state: "failed",
      code: "meta/media-rejected",
    });
  });

  it("fails loudly on a status it does not recognize", () => {
    expect(interpretContainerStatus("SOMETHING_NEW")).toMatchObject({
      state: "failed",
      code: "meta/provider-error",
    });
  });
});

describe("Graph error mapping", () => {
  it("maps the OAuth family to an expired connection", () => {
    expect(mapMetaError({ error: { code: 190 } }, 400).code).toBe(
      "meta/token-expired"
    );
    expect(mapMetaError(null, 401).code).toBe("meta/token-expired");
  });

  it("maps a missing permission distinctly from a dead token", () => {
    expect(mapMetaError({ error: { code: 200 } }, 403).code).toBe(
      "meta/permission-missing"
    );
  });

  it("maps every throttle code to rate-limited", () => {
    for (const code of [4, 17, 32, 613]) {
      expect(mapMetaError({ error: { code } }, 400).code).toBe(
        "meta/rate-limited"
      );
    }
  });

  it("passes an unrecognized error through with Meta's own message", () => {
    const error = mapMetaError(
      { error: { code: 99999, message: "Something specific" } },
      400
    );
    expect(error.code).toBe("meta/provider-error");
    expect(error.message).toBe("Something specific");
  });
});

describe("token refresh window", () => {
  const DAY = 24 * 60 * 60 * 1000;
  const now = 1_700_000_000_000;

  it("refreshes once a token is inside the last week of its life", () => {
    expect(
      shouldRefreshToken(
        { issuedAtMs: now - 53 * DAY, expiresAtMs: now + 6 * DAY },
        now
      )
    ).toBe(true);
  });

  it("leaves a token with plenty of life alone", () => {
    expect(
      shouldRefreshToken(
        { issuedAtMs: now - 10 * DAY, expiresAtMs: now + 50 * DAY },
        now
      )
    ).toBe(false);
  });

  it("never refreshes a token under 24 hours old — Meta rejects that", () => {
    expect(
      shouldRefreshToken(
        { issuedAtMs: now - 60 * 60 * 1000, expiresAtMs: now + DAY },
        now
      )
    ).toBe(false);
  });

  it("still tries on an already-expired token so a retry can happen", () => {
    expect(
      shouldRefreshToken(
        { issuedAtMs: now - 61 * DAY, expiresAtMs: now - DAY },
        now
      )
    ).toBe(true);
  });
});
