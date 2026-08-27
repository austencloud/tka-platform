/**
 * Geometry Web Worker - converts SerializedTileBuckets into transferable
 * Float32Arrays so mesh creation on the main thread never blocks on data prep.
 *
 * The worker runs a simple priority queue: lower priority numbers process first.
 * Cancel messages remove a pending roomId from the queue without processing it.
 * Only one request is processed at a time - no parallelism inside the worker.
 *
 * No Three.js here. Everything is plain typed arrays and postMessage transfers.
 */

import type {
  GeometryWorkerRequest,
  GeometryWorkerResponse,
  RoomBuiltResponse,
  BatchTransfer,
} from "./geometry-worker-protocol";
import type { SerializedTileBuckets, SerializedBucketEntry } from "../domain/room-descriptor";


interface QueueEntry {
  roomId: string;
  buckets: SerializedTileBuckets;
  priority: number;
}

const queue: QueueEntry[] = [];
let processing = false;

function enqueue(entry: QueueEntry): void {
  // Replace an existing entry for the same roomId if one exists - the new
  // request has fresher data and possibly a different priority.
  const existing = queue.findIndex((e) => e.roomId === entry.roomId);
  if (existing !== -1) {
    queue.splice(existing, 1);
  }
  queue.push(entry);
  // Keep lowest priority number at the front.
  queue.sort((a, b) => a.priority - b.priority);
}

function dequeue(): QueueEntry | undefined {
  return queue.shift();
}

function cancel(roomId: string): void {
  const idx = queue.findIndex((e) => e.roomId === roomId);
  if (idx !== -1) {
    queue.splice(idx, 1);
  }
}


/**
 * Converts a {x, z}[] position list to a flat Float32Array [x0, z0, x1, z1, ...].
 * The returned buffer can be handed directly to postMessage's transferables list.
 */
function positionsToFloat32(
  positions: { x: number; z: number }[]
): Float32Array {
  const arr = new Float32Array(positions.length * 2);
  for (let i = 0; i < positions.length; i++) {
    const pos = positions[i];
    if (pos) {
      arr[i * 2] = pos.x;
      arr[i * 2 + 1] = pos.z;
    }
  }
  return arr;
}

/**
 * Converts a single SerializedBucketEntry to a BatchTransfer, appending the
 * underlying ArrayBuffer to the transferables list for zero-copy transfer.
 */
function convertBucketEntry(
  entry: SerializedBucketEntry,
  transferables: ArrayBuffer[]
): BatchTransfer {
  const positions = positionsToFloat32(entry.positions);
  transferables.push(positions.buffer as ArrayBuffer);

  const batch: BatchTransfer = {
    color: entry.color,
    positions,
  };
  if (entry.floorMaterial !== undefined) batch.floorMaterial = entry.floorMaterial;
  if (entry.wingTheme !== undefined) batch.wingTheme = entry.wingTheme;

  return batch;
}


function postProgress(roomId: string, phase: string): void {
  const response: GeometryWorkerResponse = { type: "progress", roomId, phase };
  (self as unknown as Worker).postMessage(response);
}

function processEntry(entry: QueueEntry): void {
  const { roomId, buckets } = entry;
  const transferables: ArrayBuffer[] = [];

  postProgress(roomId, "Processing tiles");

  const floorBatches: BatchTransfer[] = buckets.floorEntries.map((e) =>
    convertBucketEntry(e, transferables)
  );

  const wallBatches: BatchTransfer[] = buckets.wallEntries.map((e) =>
    convertBucketEntry(e, transferables)
  );

  // Convert pedestal and sign position arrays
  const pedestalPositions = positionsToFloat32(buckets.pedestalPositions);
  transferables.push(pedestalPositions.buffer as ArrayBuffer);

  const signPositions = positionsToFloat32(buckets.signPositions);
  transferables.push(signPositions.buffer as ArrayBuffer);

  postProgress(roomId, "Transferring geometry");

  const response: RoomBuiltResponse = {
    type: "room-built",
    roomId,
    floorBatches,
    wallBatches,
    pedestalPositions,
    signPositions,
    totalFloorInstances: buckets.totalFloorInstances,
    totalWallInstances: buckets.totalWallInstances,
    transferables,
  };

  (self as unknown as Worker).postMessage(response, transferables);
}

function processNext(): void {
  const next = dequeue();
  if (!next) {
    processing = false;
    return;
  }

  processing = true;

  // Use a microtask break so cancel messages already in the event queue can
  // arrive before we start work on a request that's about to be cancelled.
  Promise.resolve().then(() => {
    processEntry(next);
    processNext();
  });
}


(self as unknown as Worker).onmessage = (
  event: MessageEvent<GeometryWorkerRequest>
) => {
  const msg = event.data;

  if (msg.type === "cancel") {
    cancel(msg.roomId);
    return;
  }

  // Both "build-room" and "rebuild-from-cache" do the same work in the worker.
  enqueue({ roomId: msg.roomId, buckets: msg.buckets, priority: msg.priority });

  if (!processing) {
    processNext();
  }
};
