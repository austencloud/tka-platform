import { HttpsError } from "firebase-functions/v2/https";

export const MAX_MESSAGE_LENGTH = 2000;
const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/;
const MAX_URL_LENGTH = 2048;
const MAX_NAME_LENGTH = 240;

const ATTACHMENT_TYPES = new Set([
  "sequence",
  "collection",
  "link",
  "feedback",
]);

const METADATA_STRING_LIMITS: Record<string, number> = {
  title: 240,
  description: 1000,
  sequenceId: 240,
  sequenceShortCode: 128,
  sequenceWord: 240,
  sequenceCloudWord: 240,
  sequenceName: 240,
  sequenceThumbnail: MAX_URL_LENGTH,
  sequenceAuthor: 240,
  collectionId: 240,
  collectionOwnerId: 240,
  collectionName: 240,
  collectionIcon: 120,
  collectionColor: 120,
  collectionAccessRole: 20,
  feedbackId: 240,
  feedbackTitle: 240,
  feedbackType: 20,
  feedbackStatus: 40,
  feedbackDescription: 1000,
};

const METADATA_NUMBER_FIELDS = new Set([
  "width",
  "height",
  "sequenceStepCount",
  "collectionSequenceCount",
]);

export interface CanonicalReplyPreview {
  messageId: string;
  senderId: string;
  senderName: string;
  content: string;
  attachmentType?: string;
}

export function requireSafeId(value: unknown, field: string): string {
  if (typeof value !== "string" || !SAFE_ID.test(value)) {
    throw new HttpsError("invalid-argument", `${field} is invalid.`);
  }
  return value;
}

export function optionalReplyMessageId(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new HttpsError("invalid-argument", "Reply preview is invalid.");
  }

  const reply = value as Record<string, unknown>;
  return requireSafeId(reply.messageId, "Reply message ID");
}

export function buildCanonicalReplyPreview(
  messageId: string,
  data: Record<string, unknown> | undefined
): CanonicalReplyPreview {
  if (!data || data.isDeleted === true) {
    throw new HttpsError(
      "failed-precondition",
      "The original message is no longer available."
    );
  }

  const senderId = typeof data.senderId === "string" ? data.senderId : "";
  const senderName =
    typeof data.senderName === "string" ? data.senderName.trim() : "";
  const content = typeof data.content === "string" ? data.content : "";
  if (!senderId || !senderName || content.length > MAX_MESSAGE_LENGTH) {
    throw new HttpsError(
      "failed-precondition",
      "The original message cannot be quoted."
    );
  }

  const preview: CanonicalReplyPreview = {
    messageId,
    senderId,
    senderName: senderName.slice(0, 120),
    content,
  };
  const attachments = Array.isArray(data.attachments) ? data.attachments : [];
  const attachment = attachments[0] as Record<string, unknown> | undefined;
  if (typeof attachment?.type === "string") {
    preview.attachmentType = attachment.type;
  }
  return preview;
}

export function isAnonymousToken(token: Record<string, unknown>): boolean {
  const firebase = token.firebase as { sign_in_provider?: string } | undefined;
  return firebase?.sign_in_provider === "anonymous";
}

function requireRecord(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpsError("invalid-argument", `${field} is invalid.`);
  }
  return value as Record<string, unknown>;
}

function optionalString(
  value: unknown,
  field: string,
  maxLength: number
): string | undefined {
  if (value == null) return undefined;
  if (typeof value !== "string" || value.length > maxLength) {
    throw new HttpsError("invalid-argument", `${field} is invalid.`);
  }
  return value;
}

function optionalNavigationUrl(
  value: unknown,
  field: string
): string | undefined {
  const url = optionalString(value, field, MAX_URL_LENGTH);
  if (url === undefined) return undefined;
  if (url.startsWith("/") && !url.startsWith("//")) return url;

  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      return url;
    }
  } catch {
    // Fall through to the same public validation error as unsupported schemes.
  }

  throw new HttpsError("invalid-argument", `${field} is invalid.`);
}

function sanitizeMetadata(value: unknown): Record<string, unknown> | undefined {
  if (value == null) return undefined;
  const input = requireRecord(value, "Attachment metadata");
  const metadata: Record<string, unknown> = {};

  for (const [key, entry] of Object.entries(input)) {
    const stringLimit = METADATA_STRING_LIMITS[key];
    if (stringLimit !== undefined) {
      const sanitized = optionalString(
        entry,
        `Attachment metadata ${key}`,
        stringLimit
      );
      if (sanitized !== undefined) metadata[key] = sanitized;
      continue;
    }

    if (METADATA_NUMBER_FIELDS.has(key)) {
      if (
        typeof entry !== "number" ||
        !Number.isFinite(entry) ||
        entry < 0 ||
        entry > 1_000_000
      ) {
        throw new HttpsError(
          "invalid-argument",
          `Attachment metadata ${key} is invalid.`
        );
      }
      metadata[key] = entry;
      continue;
    }

    throw new HttpsError(
      "invalid-argument",
      `Attachment metadata ${key} is not supported.`
    );
  }

  if (
    metadata.collectionAccessRole !== undefined &&
    metadata.collectionAccessRole !== "viewer" &&
    metadata.collectionAccessRole !== "editor"
  ) {
    throw new HttpsError(
      "invalid-argument",
      "Collection access role is invalid."
    );
  }

  return metadata;
}

export function sanitizeClientAttachments(
  value: unknown
): Record<string, unknown>[] | undefined {
  if (value == null) return undefined;
  if (!Array.isArray(value) || value.length !== 1) {
    throw new HttpsError(
      "invalid-argument",
      "Messages support one attachment at a time."
    );
  }

  const input = requireRecord(value[0], "Attachment");
  if (typeof input.type !== "string" || !ATTACHMENT_TYPES.has(input.type)) {
    throw new HttpsError(
      "invalid-argument",
      "This attachment type cannot be sent here."
    );
  }

  const attachment: Record<string, unknown> = { type: input.type };
  const id = optionalString(input.id, "Attachment ID", 240);
  const url = optionalNavigationUrl(input.url, "Attachment URL");
  const thumbnailUrl = optionalString(
    input.thumbnailUrl,
    "Attachment thumbnail",
    MAX_URL_LENGTH
  );
  const name = optionalString(input.name, "Attachment name", MAX_NAME_LENGTH);
  const metadata = sanitizeMetadata(input.metadata);

  if (id !== undefined) attachment.id = id;
  if (url !== undefined) attachment.url = url;
  if (thumbnailUrl !== undefined) attachment.thumbnailUrl = thumbnailUrl;
  if (name !== undefined) attachment.name = name;
  if (metadata !== undefined) attachment.metadata = metadata;

  return [attachment];
}
