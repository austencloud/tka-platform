import { describe, expect, it } from "vitest";

import {
  doesPreviewMatchMessage,
  getPreviewPointerState,
  getPreviewSignature,
  selectLatestMessage,
  type MessageRecord,
} from "../../scripts/migrations/backfill-message-preview-ids";

function timestamp(seconds: number, nanoseconds = 0) {
  return { seconds, nanoseconds };
}

function message(
  id: string,
  seconds: number,
  overrides: Record<string, unknown> = {}
): MessageRecord {
  return {
    id,
    data: {
      createdAt: timestamp(seconds),
      senderId: "sender-a",
      content: "Hello",
      attachments: null,
      ...overrides,
    },
  };
}

describe("message preview ID backfill decisions", () => {
  it("distinguishes absent, valid, and corrupt preview pointers", () => {
    expect(getPreviewPointerState({})).toEqual({ kind: "no-preview" });
    expect(
      getPreviewPointerState({ lastMessage: { content: "Hello" } })
    ).toMatchObject({ kind: "missing-pointer" });
    expect(
      getPreviewPointerState({
        lastMessage: { messageId: "message-1" },
      })
    ).toEqual({ kind: "linked", messageId: "message-1" });
    expect(
      getPreviewPointerState({ lastMessage: { messageId: null } })
    ).toMatchObject({ kind: "invalid-pointer" });
  });

  it("selects the newest message regardless of query order", () => {
    expect(
      selectLatestMessage([
        message("middle", 20),
        message("oldest", 10),
        message("newest", 30),
      ])
    ).toMatchObject({ kind: "candidate", messageId: "newest" });
  });

  it("blocks a conversation when any message timestamp is unusable", () => {
    expect(
      selectLatestMessage([
        message("valid", 20),
        {
          id: "missing-created-at",
          data: { senderId: "sender-a", content: "Unknown order" },
        },
      ])
    ).toEqual({
      kind: "invalid-message-timestamp",
      messageIds: ["missing-created-at"],
    });
  });

  it("blocks tied latest timestamps instead of guessing", () => {
    expect(
      selectLatestMessage([message("first", 30), message("second", 30)])
    ).toEqual({
      kind: "ambiguous-latest",
      messageIds: ["first", "second"],
    });
  });

  it("reports a preview with no messages", () => {
    expect(selectLatestMessage([])).toEqual({ kind: "orphan-preview" });
  });

  it("uses the app preview formatter when checking the candidate", () => {
    const imageMessage = message("image", 30, {
      content: "",
      attachments: [{ id: "image-1", type: "image" }],
    });
    expect(
      doesPreviewMatchMessage(
        {
          content: "Sent an image",
          senderId: "sender-a",
          hasAttachment: true,
        },
        imageMessage.data
      )
    ).toBe(true);
    expect(
      doesPreviewMatchMessage(
        {
          content: "Old preview text",
          senderId: "sender-a",
          hasAttachment: true,
        },
        imageMessage.data
      )
    ).toBe(false);
  });

  it("normalizes timestamp instances in the race-check signature", () => {
    const base = {
      content: "Hello",
      senderId: "sender-a",
      senderName: "A",
      hasAttachment: false,
    };
    expect(
      getPreviewSignature({ ...base, createdAt: timestamp(10, 250) })
    ).toBe(
      getPreviewSignature({
        ...base,
        createdAt: { _seconds: 10, _nanoseconds: 250 },
      })
    );
  });
});
