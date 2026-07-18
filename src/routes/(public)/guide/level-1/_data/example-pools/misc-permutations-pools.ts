/**
 * misc-permutations page - thin module wrapping the pool-adapter factory over
 * misc-permutations.pool.json (three slots: mirrored / rotated-swapped /
 * mirrored-swapped). See README.md for the schema and the rollout spec
 * (docs/superpowers/specs/2026-07-16-guide-example-pools-rollout.md, section 2b)
 * for the "one thin module per page" pattern.
 */
import json from "./misc-permutations.pool.json";
import { buildPools } from "./pool-adapter";
import type { PoolEntry, RawPool } from "./pool-adapter";

const built = buildPools(json as RawPool);

/** Candidates that failed to adapt, if any (expected empty - see the factory-sweep test). */
export const flagged = built.flagged;

/** Per-slot PoolEntry arrays (entries 1..N; entry 0 lives in misc-permutations.content.ts). */
export const mirroredPool: PoolEntry[] = built.pools.mirrored ?? [];
export const rotatedSwappedPool: PoolEntry[] = built.pools["rotated-swapped"] ?? [];
export const mirroredSwappedPool: PoolEntry[] = built.pools["mirrored-swapped"] ?? [];
