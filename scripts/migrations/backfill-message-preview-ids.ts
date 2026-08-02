/**
 * Backfill the message document ID stored in each conversation's last-message
 * preview. Message documents already have IDs; legacy conversation previews do
 * not point back to them, so an edit cannot refresh the inbox preview.
 *
 * The scan reads every message in a legacy conversation before choosing a
 * target. A conversation is blocked if any message lacks a usable createdAt or
 * if two messages share the latest timestamp. Apply rechecks the preview and
 * latest message in a transaction, then verifies every conversation pointer.
 *
 *   TKA_ADMIN=1 npx tsx scripts/migrations/backfill-message-preview-ids.ts
 *   TKA_ADMIN=1 npx tsx scripts/migrations/backfill-message-preview-ids.ts --apply
 *   TKA_ADMIN=1 npx tsx scripts/migrations/backfill-message-preview-ids.ts --verify
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import type {
  DocumentData,
  Firestore,
  Query,
  QueryDocumentSnapshot,
} from "firebase-admin/firestore";

import { getMessagePreviewText } from "../../src/lib/shared/messaging/domain/message-preview";
import type { MessageAttachment } from "../../src/lib/shared/messaging/domain/models/message-models";

const CONVERSATIONS_COLLECTION = "conversations";
const MESSAGES_SUBCOLLECTION = "messages";
const EXPECTED_PROJECT_ID = "the-kinetic-alphabet";
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SERVICE_ACCOUNT_PATH = join(REPO_ROOT, "serviceAccountKey.json");
const BACKUP_DIRECTORY = join(REPO_ROOT, "scripts", "migrations", "backups");
const DETAIL_LIMIT = 50;
const CONVERSATION_PAGE_SIZE = 200;

type UnknownRecord = Record<string, unknown>;

export interface MessageRecord {
  readonly id: string;
  readonly data: UnknownRecord;
}

export type PreviewPointerState =
  | { readonly kind: "no-preview" }
  | { readonly kind: "missing-pointer"; readonly preview: UnknownRecord }
  | { readonly kind: "linked"; readonly messageId: string }
  | { readonly kind: "invalid-pointer"; readonly detail: string };

export type LatestMessageState =
  | { readonly kind: "orphan-preview" }
  | {
      readonly kind: "invalid-message-timestamp";
      readonly messageIds: readonly string[];
    }
  | {
      readonly kind: "ambiguous-latest";
      readonly messageIds: readonly string[];
    }
  | {
      readonly kind: "candidate";
      readonly messageId: string;
      readonly message: UnknownRecord;
    };

export interface BackfillTarget {
  readonly conversationId: string;
  readonly messageId: string;
  readonly previewSignature: string;
  readonly previewMatchesMessage: boolean;
}

type BlockReason =
  | "invalid-pointer"
  | "messages-without-preview"
  | "orphan-preview"
  | "invalid-message-timestamp"
  | "ambiguous-latest";

interface BlockedConversation {
  readonly conversationId: string;
  readonly reason: BlockReason;
  readonly detail: string;
}

interface BackfillScan {
  readonly totalConversations: number;
  readonly noPreview: number;
  readonly alreadyLinked: number;
  readonly targets: readonly BackfillTarget[];
  readonly blocked: readonly BlockedConversation[];
}

type ApplyStatus =
  | "written"
  | "already-linked"
  | "conversation-removed"
  | "preview-removed"
  | "preview-changed"
  | "pointer-changed"
  | "latest-message-changed"
  | "failed";

interface ApplyResult extends BackfillTarget {
  readonly status: ApplyStatus;
  readonly detail?: string;
}

interface VerificationProblem {
  readonly conversationId: string;
  readonly reason:
    | BlockReason
    | "missing-pointer"
    | "dangling-pointer"
    | "pointer-is-not-latest";
  readonly detail: string;
}

interface VerificationReport {
  readonly totalConversations: number;
  readonly noPreview: number;
  readonly validPointers: number;
  readonly problems: readonly VerificationProblem[];
}

interface TimestampParts {
  readonly seconds: number;
  readonly nanoseconds: number;
}

function asRecord(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === "object"
    ? (value as UnknownRecord)
    : null;
}

function timestampParts(value: unknown): TimestampParts | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    const milliseconds = value.getTime();
    const seconds = Math.floor(milliseconds / 1000);
    return {
      seconds,
      nanoseconds: Math.round((milliseconds - seconds * 1000) * 1_000_000),
    };
  }

  const record = asRecord(value);
  if (!record) return null;

  const seconds = record["seconds"] ?? record["_seconds"];
  const nanoseconds = record["nanoseconds"] ?? record["_nanoseconds"];
  if (
    typeof seconds !== "number" ||
    !Number.isInteger(seconds) ||
    typeof nanoseconds !== "number" ||
    !Number.isInteger(nanoseconds) ||
    nanoseconds < 0 ||
    nanoseconds >= 1_000_000_000
  ) {
    return null;
  }

  return { seconds, nanoseconds };
}

function compareTimestamps(
  left: TimestampParts,
  right: TimestampParts
): number {
  if (left.seconds !== right.seconds) return left.seconds - right.seconds;
  return left.nanoseconds - right.nanoseconds;
}

function timestampSignature(value: unknown): string {
  const parts = timestampParts(value);
  return parts ? `${parts.seconds}:${parts.nanoseconds}` : "invalid";
}

export function getPreviewPointerState(
  conversation: UnknownRecord
): PreviewPointerState {
  const preview = asRecord(conversation["lastMessage"]);
  if (!preview) return { kind: "no-preview" };

  if (!Object.hasOwn(preview, "messageId")) {
    return { kind: "missing-pointer", preview };
  }

  const messageId = preview["messageId"];
  if (typeof messageId === "string" && messageId.trim().length > 0) {
    return { kind: "linked", messageId };
  }

  return {
    kind: "invalid-pointer",
    detail: `lastMessage.messageId is ${messageId === null ? "null" : typeof messageId}`,
  };
}

export function selectLatestMessage(
  messages: readonly MessageRecord[]
): LatestMessageState {
  if (messages.length === 0) return { kind: "orphan-preview" };

  const invalidMessageIds: string[] = [];
  let latest: { record: MessageRecord; timestamp: TimestampParts } | null =
    null;
  let tiedMessageIds: string[] = [];

  for (const message of messages) {
    const timestamp = timestampParts(message.data["createdAt"]);
    if (!timestamp) {
      invalidMessageIds.push(message.id);
      continue;
    }

    if (!latest) {
      latest = { record: message, timestamp };
      tiedMessageIds = [message.id];
      continue;
    }

    const comparison = compareTimestamps(timestamp, latest.timestamp);
    if (comparison > 0) {
      latest = { record: message, timestamp };
      tiedMessageIds = [message.id];
    } else if (comparison === 0) {
      tiedMessageIds.push(message.id);
    }
  }

  if (invalidMessageIds.length > 0) {
    return {
      kind: "invalid-message-timestamp",
      messageIds: invalidMessageIds,
    };
  }

  if (!latest) {
    return {
      kind: "invalid-message-timestamp",
      messageIds: messages.map((message) => message.id),
    };
  }

  if (tiedMessageIds.length > 1) {
    return { kind: "ambiguous-latest", messageIds: tiedMessageIds };
  }

  return {
    kind: "candidate",
    messageId: latest.record.id,
    message: latest.record.data,
  };
}

export function getPreviewSignature(preview: UnknownRecord): string {
  return JSON.stringify({
    content: preview["content"] ?? null,
    senderId: preview["senderId"] ?? null,
    senderName: preview["senderName"] ?? null,
    createdAt: timestampSignature(preview["createdAt"]),
    hasAttachment: preview["hasAttachment"] ?? null,
  });
}

export function doesPreviewMatchMessage(
  preview: UnknownRecord,
  message: UnknownRecord
): boolean {
  const attachments = Array.isArray(message["attachments"])
    ? (message["attachments"] as MessageAttachment[])
    : undefined;
  const content =
    typeof message["content"] === "string" ? message["content"] : "";

  return (
    preview["content"] === getMessagePreviewText(content, attachments) &&
    preview["senderId"] === message["senderId"] &&
    preview["hasAttachment"] === Boolean(attachments?.length)
  );
}

async function loadMessages(
  db: Firestore,
  conversationId: string
): Promise<MessageRecord[]> {
  const snapshot = await db
    .collection(CONVERSATIONS_COLLECTION)
    .doc(conversationId)
    .collection(MESSAGES_SUBCOLLECTION)
    .select("createdAt", "senderId", "content", "attachments")
    .get();

  return snapshot.docs.map((message) => ({
    id: message.id,
    data: message.data(),
  }));
}

async function conversationHasMessages(
  db: Firestore,
  conversationId: string
): Promise<boolean> {
  const snapshot = await db
    .collection(CONVERSATIONS_COLLECTION)
    .doc(conversationId)
    .collection(MESSAGES_SUBCOLLECTION)
    .limit(1)
    .get();
  return !snapshot.empty;
}

async function* conversationDocuments(
  db: Firestore
): AsyncGenerator<QueryDocumentSnapshot<DocumentData>> {
  let lastDocument: QueryDocumentSnapshot<DocumentData> | null = null;

  while (true) {
    let query: Query<DocumentData> = db
      .collection(CONVERSATIONS_COLLECTION)
      .orderBy("__name__")
      .limit(CONVERSATION_PAGE_SIZE);
    if (lastDocument) query = query.startAfter(lastDocument);

    const snapshot = await query.get();
    for (const document of snapshot.docs) yield document;

    lastDocument = snapshot.docs.at(-1) ?? null;
    if (snapshot.size < CONVERSATION_PAGE_SIZE) return;
  }
}

function blockerFromLatest(
  conversationId: string,
  latest: Exclude<LatestMessageState, { kind: "candidate" }>
): BlockedConversation {
  switch (latest.kind) {
    case "orphan-preview":
      return {
        conversationId,
        reason: latest.kind,
        detail: "The conversation has a preview but no message documents.",
      };
    case "invalid-message-timestamp":
      return {
        conversationId,
        reason: latest.kind,
        detail: `${latest.messageIds.length} message(s) have no usable createdAt.`,
      };
    case "ambiguous-latest":
      return {
        conversationId,
        reason: latest.kind,
        detail: `${latest.messageIds.length} messages share the latest createdAt.`,
      };
  }
}

async function scanBackfill(db: Firestore): Promise<BackfillScan> {
  let totalConversations = 0;
  let noPreview = 0;
  let alreadyLinked = 0;
  const targets: BackfillTarget[] = [];
  const blocked: BlockedConversation[] = [];

  for await (const conversation of conversationDocuments(db)) {
    totalConversations++;
    const pointer = getPreviewPointerState(conversation.data());

    if (pointer.kind === "no-preview") {
      if (await conversationHasMessages(db, conversation.id)) {
        blocked.push({
          conversationId: conversation.id,
          reason: "messages-without-preview",
          detail: "The conversation has messages but no lastMessage preview.",
        });
      } else {
        noPreview++;
      }
      continue;
    }
    if (pointer.kind === "linked") {
      alreadyLinked++;
      continue;
    }
    if (pointer.kind === "invalid-pointer") {
      blocked.push({
        conversationId: conversation.id,
        reason: pointer.kind,
        detail: pointer.detail,
      });
      continue;
    }

    const latest = selectLatestMessage(await loadMessages(db, conversation.id));
    if (latest.kind !== "candidate") {
      blocked.push(blockerFromLatest(conversation.id, latest));
      continue;
    }

    targets.push({
      conversationId: conversation.id,
      messageId: latest.messageId,
      previewSignature: getPreviewSignature(pointer.preview),
      previewMatchesMessage: doesPreviewMatchMessage(
        pointer.preview,
        latest.message
      ),
    });
  }

  return {
    totalConversations,
    noPreview,
    alreadyLinked,
    targets,
    blocked,
  };
}

function messageRecords(
  documents: readonly QueryDocumentSnapshot<DocumentData>[]
): MessageRecord[] {
  return documents.map((message) => ({
    id: message.id,
    data: message.data(),
  }));
}

async function applyTarget(
  db: Firestore,
  target: BackfillTarget
): Promise<ApplyResult> {
  const conversationRef = db
    .collection(CONVERSATIONS_COLLECTION)
    .doc(target.conversationId);

  try {
    const status = await db.runTransaction<ApplyStatus>(async (transaction) => {
      const conversation = await transaction.get(conversationRef);
      if (!conversation.exists) return "conversation-removed";

      const pointer = getPreviewPointerState(conversation.data() ?? {});
      if (pointer.kind === "no-preview") return "preview-removed";
      if (pointer.kind === "linked") {
        return pointer.messageId === target.messageId
          ? "already-linked"
          : "pointer-changed";
      }
      if (pointer.kind === "invalid-pointer") return "pointer-changed";
      if (getPreviewSignature(pointer.preview) !== target.previewSignature) {
        return "preview-changed";
      }

      const latestQuery = conversationRef
        .collection(MESSAGES_SUBCOLLECTION)
        .select("createdAt")
        .orderBy("createdAt", "desc")
        .limit(2);
      const latestSnapshot = await transaction.get(latestQuery);
      const latest = selectLatestMessage(messageRecords(latestSnapshot.docs));
      if (
        latest.kind !== "candidate" ||
        latest.messageId !== target.messageId
      ) {
        return "latest-message-changed";
      }

      transaction.update(conversationRef, {
        "lastMessage.messageId": target.messageId,
      });
      return "written";
    });

    return { ...target, status };
  } catch (error) {
    return {
      ...target,
      status: "failed",
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

async function verifyPointers(db: Firestore): Promise<VerificationReport> {
  let totalConversations = 0;
  let noPreview = 0;
  let validPointers = 0;
  const problems: VerificationProblem[] = [];

  for await (const conversation of conversationDocuments(db)) {
    totalConversations++;
    const pointer = getPreviewPointerState(conversation.data());
    if (pointer.kind === "no-preview") {
      if (await conversationHasMessages(db, conversation.id)) {
        problems.push({
          conversationId: conversation.id,
          reason: "messages-without-preview",
          detail: "The conversation has messages but no lastMessage preview.",
        });
      } else {
        noPreview++;
      }
      continue;
    }
    if (pointer.kind === "invalid-pointer") {
      problems.push({
        conversationId: conversation.id,
        reason: pointer.kind,
        detail: pointer.detail,
      });
      continue;
    }

    const latest = selectLatestMessage(await loadMessages(db, conversation.id));
    if (latest.kind !== "candidate") {
      const blocker = blockerFromLatest(conversation.id, latest);
      problems.push(blocker);
      continue;
    }

    if (pointer.kind === "missing-pointer") {
      problems.push({
        conversationId: conversation.id,
        reason: pointer.kind,
        detail: `The latest message is ${latest.messageId}.`,
      });
      continue;
    }

    const pointedMessageExists = (
      await db
        .collection(CONVERSATIONS_COLLECTION)
        .doc(conversation.id)
        .collection(MESSAGES_SUBCOLLECTION)
        .doc(pointer.messageId)
        .get()
    ).exists;
    if (!pointedMessageExists) {
      problems.push({
        conversationId: conversation.id,
        reason: "dangling-pointer",
        detail: `lastMessage.messageId points to missing message ${pointer.messageId}.`,
      });
      continue;
    }

    if (pointer.messageId !== latest.messageId) {
      problems.push({
        conversationId: conversation.id,
        reason: "pointer-is-not-latest",
        detail: `Stored ${pointer.messageId}; latest is ${latest.messageId}.`,
      });
      continue;
    }

    validPointers++;
  }

  return { totalConversations, noPreview, validPointers, problems };
}

function printDetails(
  label: string,
  records: readonly { conversationId: string; detail?: string }[]
): void {
  if (records.length === 0) return;
  console.log(`\n${label}:`);
  for (const record of records.slice(0, DETAIL_LIMIT)) {
    console.log(
      `  ${record.conversationId}${record.detail ? `: ${record.detail}` : ""}`
    );
  }
  if (records.length > DETAIL_LIMIT) {
    console.log(
      `  ${records.length - DETAIL_LIMIT} more omitted from console output.`
    );
  }
}

function printScan(scan: BackfillScan): void {
  const differingPreviews = scan.targets.filter(
    (target) => !target.previewMatchesMessage
  ).length;
  console.log(`Conversations scanned: ${scan.totalConversations}`);
  console.log(`Empty conversations without a preview: ${scan.noPreview}`);
  console.log(`Already linked: ${scan.alreadyLinked}`);
  console.log(`Ready to backfill: ${scan.targets.length}`);
  console.log(`Previews differing from latest message: ${differingPreviews}`);
  console.log(`Blocked: ${scan.blocked.length}`);
  printDetails("Blocked conversations", scan.blocked);
}

function printVerification(report: VerificationReport): void {
  console.log(`Conversations checked: ${report.totalConversations}`);
  console.log(`Empty conversations without a preview: ${report.noPreview}`);
  console.log(`Valid latest-message pointers: ${report.validPointers}`);
  console.log(`Verification problems: ${report.problems.length}`);
  printDetails("Verification problems", report.problems);
}

function createManifestPath(): string {
  mkdirSync(BACKUP_DIRECTORY, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return join(BACKUP_DIRECTORY, `message-preview-id-backfill-${stamp}.json`);
}

function writeManifest(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function manifestTarget(target: BackfillTarget): UnknownRecord {
  return {
    conversationId: target.conversationId,
    messageId: target.messageId,
    previewMatchesMessage: target.previewMatchesMessage,
  };
}

function manifestResult(result: ApplyResult): UnknownRecord {
  return {
    ...manifestTarget(result),
    status: result.status,
    ...(result.detail ? { detail: result.detail } : {}),
  };
}

function readProjectId(): string {
  const serviceAccount = JSON.parse(
    readFileSync(SERVICE_ACCOUNT_PATH, "utf8")
  ) as { project_id?: unknown };
  return typeof serviceAccount.project_id === "string"
    ? serviceAccount.project_id
    : "";
}

type Mode = "dry-run" | "apply" | "verify";

function parseMode(args: readonly string[]): Mode {
  const requested = [
    args.includes("--apply") ? "apply" : null,
    args.includes("--verify") ? "verify" : null,
  ].filter((mode): mode is Exclude<Mode, "dry-run"> => mode !== null);

  if (requested.length > 1) {
    throw new Error("Use either --apply or --verify, not both.");
  }
  return requested[0] ?? "dry-run";
}

async function run(): Promise<void> {
  const mode = parseMode(process.argv.slice(2));
  if (process.env.TKA_ADMIN !== "1") {
    throw new Error("This migration requires TKA_ADMIN=1.");
  }

  process.chdir(REPO_ROOT);
  const projectId = readProjectId();
  if (projectId !== EXPECTED_PROJECT_ID) {
    throw new Error(
      `Expected Firebase project ${EXPECTED_PROJECT_ID}; service account targets ${projectId || "unknown"}.`
    );
  }

  const providerPath = "../lib/firestore-provider.js";
  const provider = (await import(providerPath)) as {
    initFirestore: () => Promise<unknown>;
  };
  const initialized = (await provider.initFirestore()) as {
    db: Firestore;
    isAdmin: boolean;
    sdk: string;
  };
  if (!initialized.isAdmin) {
    throw new Error("The migration did not initialize with the Admin SDK.");
  }

  console.log("Message preview ID backfill");
  console.log(`Project: ${projectId}`);
  console.log(`Mode: ${mode}`);
  console.log(`SDK: ${initialized.sdk}\n`);

  if (mode === "verify") {
    const verification = await verifyPointers(initialized.db);
    printVerification(verification);
    if (verification.problems.length > 0) process.exitCode = 2;
    return;
  }

  const scan = await scanBackfill(initialized.db);
  printScan(scan);

  if (mode === "dry-run") {
    if (scan.blocked.length > 0) process.exitCode = 2;
    return;
  }

  if (scan.blocked.length > 0) {
    throw new Error(
      `Preflight found ${scan.blocked.length} blocked conversation(s). No writes were made.`
    );
  }

  const manifestPath = createManifestPath();
  const startedAt = new Date().toISOString();
  writeManifest(manifestPath, {
    projectId,
    startedAt,
    completedAt: null,
    status: "planned",
    targets: scan.targets.map(manifestTarget),
  });

  const results: ApplyResult[] = [];
  for (const target of scan.targets) {
    results.push(await applyTarget(initialized.db, target));
  }

  const verification = await verifyPointers(initialized.db);
  const completedAt = new Date().toISOString();
  writeManifest(manifestPath, {
    projectId,
    startedAt,
    completedAt,
    status: verification.problems.length === 0 ? "verified" : "needs-review",
    scan: {
      totalConversations: scan.totalConversations,
      noPreview: scan.noPreview,
      alreadyLinked: scan.alreadyLinked,
      targets: scan.targets.length,
    },
    results: results.map(manifestResult),
    verification,
  });

  const written = results.filter(
    (result) => result.status === "written"
  ).length;
  const failed = results.filter((result) => result.status === "failed");
  const changed = results.filter(
    (result) =>
      result.status !== "written" && result.status !== "already-linked"
  );
  console.log(`\nPointers written: ${written}`);
  console.log(
    `Already linked during apply: ${results.length - written - changed.length}`
  );
  console.log(`Changed during apply: ${changed.length - failed.length}`);
  console.log(`Failed writes: ${failed.length}`);
  printDetails("Apply failures", failed);
  console.log(`Manifest: ${manifestPath}`);
  console.log("\nVerification");
  printVerification(verification);

  if (
    failed.length > 0 ||
    changed.length > 0 ||
    verification.problems.length > 0
  ) {
    process.exitCode = 2;
  }
}

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : "";
if (import.meta.url === invokedPath) {
  void run().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
