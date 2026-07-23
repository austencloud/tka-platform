import { describe, expect, it } from "vitest";
import { createSequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import { decodeSequenceWithCompression } from "$lib/shared/navigation/services/sequence-encoder";
import { buildSequenceMessageAttachment } from "$lib/shared/inbox/domain/message-attachment-builders";
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

  it("embeds a sequence snapshot instead of a private document ID route", () => {
    const sequence = createSequenceData({
      id: "private-sequence-id",
      name: "Private practice",
      word: "AB",
      displayName: "Practice pair",
    });

    const attachment = buildSequenceMessageAttachment(sequence);
    const encodedRouteId = attachment.url?.replace("/sequence/", "") ?? "";
    const decoded = decodeSequenceWithCompression(
      decodeURIComponent(encodedRouteId)
    );

    expect(attachment.url).toMatch(/^\/sequence\//);
    expect(attachment.url).not.toBe("/sequence/private-sequence-id");
    expect(attachment.metadata?.sequenceId).toBe("private-sequence-id");
    expect(findUndefinedPaths(attachment)).toEqual([]);
    expect(decoded.steps).toEqual([]);
  });
});
