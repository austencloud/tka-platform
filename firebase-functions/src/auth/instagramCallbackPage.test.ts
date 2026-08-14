import {
  instagramFailureMessage,
  sendInstagramCallbackPage,
} from "./instagramCallbackPage";

describe("Instagram callback page", () => {
  it("escapes displayed text and locks inline code to a nonce", () => {
    const response = {
      status: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };

    sendInstagramCallbackPage(
      response as never,
      {
        returnOrigin: "https://tkaflowarts.com",
        state: "state",
        status: "error",
        message: '<script>alert("x")</script>',
      },
      400
    );

    expect(response.status).toHaveBeenCalledWith(400);
    const headers = response.set.mock.calls[0][0] as Record<string, string>;
    expect(headers["Cache-Control"]).toContain("no-store");
    expect(headers["Content-Security-Policy"]).toMatch(
      /script-src 'nonce-[A-Za-z0-9_-]+'/
    );
    expect(headers["Content-Security-Policy"]).not.toContain("unsafe-inline");

    const html = response.send.mock.calls[0][0] as string;
    expect(html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
    expect(html).not.toContain('<script>alert("x")</script>');
  });

  it("does not expose provider response text in public errors", () => {
    expect(instagramFailureMessage("instagram/provider-error")).toBe(
      "Instagram could not complete sign-in."
    );
  });

  it("stops people from retrying an app configuration failure", () => {
    expect(
      instagramFailureMessage("instagram/app-configuration-mismatch")
    ).toContain("Trying again will not fix this");
  });
});
