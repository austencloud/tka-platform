import { buildCanonicalReplyPreview } from "./finalizeMessageImage";

describe("message reply previews", () => {
  it("copies the complete original text and attachment type", () => {
    const content = "A".repeat(240);

    expect(
      buildCanonicalReplyPreview("message-1", {
        senderId: "sender-1",
        senderName: "Austen",
        content,
        attachments: [{ type: "image", storagePath: "private/path.webp" }],
        isDeleted: false,
      })
    ).toEqual({
      messageId: "message-1",
      senderId: "sender-1",
      senderName: "Austen",
      content,
      attachmentType: "image",
    });
  });

  it("rejects deleted and missing originals", () => {
    expect(() =>
      buildCanonicalReplyPreview("message-1", {
        senderId: "sender-1",
        senderName: "Austen",
        content: "Removed",
        isDeleted: true,
      })
    ).toThrow("The original message is no longer available.");
    expect(() => buildCanonicalReplyPreview("missing", undefined)).toThrow(
      "The original message is no longer available."
    );
  });
});
