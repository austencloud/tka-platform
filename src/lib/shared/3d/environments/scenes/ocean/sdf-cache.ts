/**
 * IndexedDB cache for SDF textures.
 *
 * Stores the raw typed array + metadata so repeat visits skip
 * GPU SDF generation entirely. ~128KB for 4 structures at 32³.
 */

import {
  Box3,
  Data3DTexture,
  FloatType,
  LinearFilter,
  Matrix4,
  RedFormat,
  Vector3,
} from 'three';
import type { SDFResult } from './sdf-generator';

const DB_NAME = 'tka-sdf-cache';
const DB_VERSION = 1;
const STORE_NAME = 'sdf';

interface CachedSDF {
  key: string;
  resolution: number;
  data: ArrayBuffer;
  inverseMatrix: number[] | readonly number[];
  boundsMin: [number, number, number];
  boundsMax: [number, number, number];
  timestamp: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function sdfCacheKey(
  placements: { x: number; z: number; rotY: number; targetHeight: number }[],
  resolution: number,
): string {
  const parts = placements.map(
    (p) => `${p.x},${p.z},${p.rotY.toFixed(2)},${p.targetHeight}`,
  );
  return `sdf-v2-r${resolution}-${parts.join('|')}`;
}

export async function loadCachedSDF(key: string): Promise<SDFResult[] | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);

    return new Promise((resolve) => {
      const req = store.get(key);
      req.onsuccess = () => {
        const record = req.result as { entries: CachedSDF[] } | undefined;
        if (!record?.entries?.length) {
          resolve(null);
          return;
        }

        const results: SDFResult[] = record.entries.map((entry) => {
          const dim = entry.resolution;
          const typedData = new Float32Array(entry.data);

          const texture = new Data3DTexture(typedData, dim, dim, dim);
          texture.format = RedFormat;
          texture.type = FloatType;
          texture.minFilter = LinearFilter;
          texture.magFilter = LinearFilter;
          texture.generateMipmaps = false;
          texture.needsUpdate = true;

          const inverseMatrix = new Matrix4();
          inverseMatrix.fromArray(entry.inverseMatrix);

          const bounds = new Box3(
            new Vector3(...entry.boundsMin),
            new Vector3(...entry.boundsMax),
          );

          return { texture, inverseMatrix, bounds };
        });

        resolve(results);
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function storeSDF(
  key: string,
  results: SDFResult[],
  resolution: number,
): Promise<void> {
  try {
    const entries: CachedSDF[] = results.map((r, i) => {
      const texData = r.texture.image.data as Float32Array;
      return {
        key: `${key}-${i}`,
        resolution,
        data: new Float32Array(texData).buffer,
        inverseMatrix: r.inverseMatrix.toArray(),
        boundsMin: [r.bounds.min.x, r.bounds.min.y, r.bounds.min.z] as [number, number, number],
        boundsMax: [r.bounds.max.x, r.bounds.max.y, r.bounds.max.z] as [number, number, number],
        timestamp: Date.now(),
      };
    });

    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put({ key, entries });
  } catch {
    // Cache write failure is non-fatal
  }
}
