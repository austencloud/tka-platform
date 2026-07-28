import { describe, expect, it } from "vitest";
import { createSequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import { generateSequenceRoutePath } from "$lib/shared/navigation/services/sequence-encoder";
import {
  buildSequenceMessageAttachment,
  decodeLegacySequenceAttachment,
} from "$lib/shared/inbox/domain/message-attachment-builders";
import { buildSequenceSharePayload } from "$lib/shared/inbox/domain/build-sequence-share-payload";
import { getMessagePreviewText } from "$lib/shared/messaging/domain/message-preview";

function findUndefinedPaths(value: unknown, path = "attachment"): string[] {
  if (value === undefined) return [path];
  if (value === null || typeof value !== "object") return [];

  return Object.entries(value).flatMap(([key, child]) =>
    findUndefinedPaths(child, `${path}.${key}`)
  );
}

describe("message attachment presentation", () => {
  it("uses useful previews for attachment-only messages", () => {
    expect(getMessagePreviewText("", [{ type: "image" }])).toBe(
      "Sent an image"
    );
    expect(getMessagePreviewText("", [{ type: "sequence" }])).toBe(
      "Shared a sequence"
    );
    expect(
      getMessagePreviewText("A caption that should win", [{ type: "image" }])
    ).toBe("A caption that should win");
  });

  it("uses a compact short-code route instead of serializing the sequence", () => {
    const sequence = createSequenceData({
      id: "private-sequence-id",
      name: "Private practice",
      word: "AB",
      displayName: "Practice pair",
    });

    const attachment = buildSequenceMessageAttachment(sequence, "AB3D");

    expect(attachment.url).toBe("/q/AB3D");
    expect(attachment.url).not.toContain("private-sequence-id");
    expect(attachment.metadata?.sequenceId).toBe("private-sequence-id");
    expect(attachment.metadata?.sequenceShortCode).toBe("AB3D");
    expect(findUndefinedPaths(attachment)).toEqual([]);
  });

  it("keeps the source sequence available to the send sheet for short-code minting", () => {
    const sequence = createSequenceData({
      id: "sequence-for-send-sheet",
      name: "Send sheet sequence",
      word: "AB",
    });

    expect(buildSequenceSharePayload(sequence).sequence).toBe(sequence);
  });

  it("uses the canonical compact word in share previews and attachments", () => {
    const sequence = createSequenceData({
      id: "repeating-sequence",
      name: "Repeating sequence",
      word: "ABABABAB",
    });

    const payload = buildSequenceSharePayload(sequence);
    const attachment = buildSequenceMessageAttachment(sequence, "LOOP");

    expect(payload.sequenceWord).toBe("AB");
    expect(attachment.name).toBe("AB");
    expect(attachment.metadata?.sequenceWord).toBe("AB");
  });

  it("recovers already-sent serialized sequence attachments", () => {
    const sequence = createSequenceData({
      id: "legacy-sequence",
      name: "Legacy sequence",
      word: "AB",
    });
    const legacyAttachment = {
      type: "sequence" as const,
      url: generateSequenceRoutePath(sequence),
    };

    const decoded = decodeLegacySequenceAttachment(legacyAttachment);

    expect(decoded?.steps).toEqual([]);
  });

  it("does not treat a document ID route as a serialized sequence", () => {
    expect(
      decodeLegacySequenceAttachment({
        type: "sequence",
        url: "/sequence/private-sequence-id",
      })
    ).toBeNull();
  });
});
