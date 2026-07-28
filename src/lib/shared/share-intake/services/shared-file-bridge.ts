import { Capacitor } from "@capacitor/core";
import type {
  IntakeProblem,
  SharedFileDescriptor,
} from "../domain/share-intake-models";
import { MAX_INTAKE_BYTES, safeName } from "./intake-validator";

/** Anything already carrying a scheme (data:, blob:, https:) is fetchable as-is. */
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/**
 * Four at a time. Each read pulls a whole image into WebView memory; a
 * Promise.all over a 20-file SEND_MULTIPLE fans out 20 of them simultaneously,
 * which on a mid-range Android device is how the WebView gets killed.
 */
const MAX_CONCURRENT_READS = 4;

/**
 * Make a plugin URI reachable from the WebView.
 *
 * Capacitor.convertFileSrc is a plain string concat onto the local bridge
 * origin - it does NOT percent-encode. The plugin writes the SENDER'S display
 * name verbatim into the cache path, so "photo#2.png" would truncate at the
 * '#' and 404, and a name with a space or '?' fails the same way. Each path
 * segment is encoded first, leaving the separators intact.
 */
export function toFetchableUrl(uri: string): string {
  if (HAS_SCHEME.test(uri)) return uri;
  const encoded = uri.split("/").map(encodeURIComponent).join("/");
  return Capacitor.convertFileSrc(encoded);
}

export type BridgeOutcome =
  | { ok: true; file: File; descriptor: SharedFileDescriptor }
  | { ok: false; problem: IntakeProblem };

/**
 * Turn one plugin descriptor into a real File.
 *
 * Isolated behind this one function on purpose: if convertFileSrc proves
 * unreliable across Android versions, the fallback is Filesystem.readFile ->
 * base64 -> Blob, and only this file changes.
 *
 * Never throws and never returns a bare null. A share can reference a file the
 * sending app already revoked; that has to be RECORDED, because
 * "TKA opened and nothing happened" is the exact symptom the device matrix is
 * hunting for.
 */
export async function sharedFileToFile(
  descriptor: SharedFileDescriptor
): Promise<BridgeOutcome> {
  const name = safeName(descriptor.name);

  let response: Response;
  try {
    response = await fetch(toFetchableUrl(descriptor.uri));
  } catch (caught) {
    return {
      ok: false,
      problem: { name, reason: "unreachable", detail: String(caught) },
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      problem: { name, reason: "not-found", detail: `HTTP ${response.status}` },
    };
  }

  // Check the DECLARED length before reading. Without this a 200 MB file is
  // pulled fully into WebView memory just to be rejected one line later.
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_INTAKE_BYTES) {
    return {
      ok: false,
      problem: { name, reason: "too-large", detail: `${declared} bytes declared` },
    };
  }

  // Uint8Array<ArrayBuffer>, not the default Uint8Array<ArrayBufferLike>: a
  // BlobPart cannot be backed by a SharedArrayBuffer, so the loose form is
  // rejected by the File constructor's types.
  let bytes: Uint8Array<ArrayBuffer>;
  try {
    bytes = new Uint8Array(await response.arrayBuffer());
  } catch (caught) {
    return {
      ok: false,
      problem: { name, reason: "unreachable", detail: String(caught) },
    };
  }

  if (bytes.byteLength === 0) {
    return { ok: false, problem: { name, reason: "empty" } };
  }
  // The header is advisory and often absent on the bridge scheme, so the real
  // length is checked too.
  if (bytes.byteLength > MAX_INTAKE_BYTES) {
    return {
      ok: false,
      problem: { name, reason: "too-large", detail: `${bytes.byteLength} bytes` },
    };
  }

  // new File([bytes]), NOT new File([blob]): jsdom's File constructor
  // stringifies a Node Blob into "[object Blob]", so a blob-built File is 15
  // bytes of garbage under vitest and correct in a browser - a test that can
  // never be trusted. A Uint8Array behaves identically in both.
  const file = new File([bytes], name, { type: descriptor.mimeType });

  // The plugin's SharedFile has no size field, so the descriptor's size is
  // undefined until right here. Task 13 derives the durable receiptId from
  // THIS descriptor, which is what stops two same-named screenshots colliding.
  return { ok: true, file, descriptor: { ...descriptor, name, size: file.size } };
}

export interface BridgeBatch {
  bridged: Array<{ file: File; descriptor: SharedFileDescriptor }>;
  problems: IntakeProblem[];
}

/**
 * Bridge a batch with bounded concurrency, preserving input order and keeping
 * a problem record for every file that did not make it.
 */
export async function sharedFilesToFiles(
  descriptors: SharedFileDescriptor[]
): Promise<BridgeBatch> {
  const slots: Array<{ file: File; descriptor: SharedFileDescriptor } | undefined> =
    new Array(descriptors.length);
  const problems: IntakeProblem[] = [];
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < descriptors.length) {
      const index = cursor;
      cursor += 1;
      const descriptor = descriptors[index];
      // Unreachable given the loop bound, but noUncheckedIndexedAccess is on
      // and a cast here would be a lie for zero gain.
      if (!descriptor) continue;
      const outcome = await sharedFileToFile(descriptor);
      if (outcome.ok) {
        slots[index] = { file: outcome.file, descriptor: outcome.descriptor };
      } else {
        problems.push(outcome.problem);
      }
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(MAX_CONCURRENT_READS, descriptors.length) },
      () => worker()
    )
  );

  return {
    bridged: slots.filter(
      (slot): slot is { file: File; descriptor: SharedFileDescriptor } =>
        slot !== undefined
    ),
    problems,
  };
}
