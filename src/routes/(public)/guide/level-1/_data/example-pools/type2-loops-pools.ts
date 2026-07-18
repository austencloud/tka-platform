/**
 * type2-loops page - thin module wrapping the pool-adapter factory over
 * type2-loops.pool.json (three slots: alpha-gamma / beta-gamma / gamma-beta).
 * See README.md for the schema and the rollout spec
 * (docs/superpowers/specs/2026-07-16-guide-example-pools-rollout.md, section 2b)
 * for the "one thin module per page" pattern.
 */
import json from "./type2-loops.pool.json";
import { buildPools } from "./pool-adapter";
import type { PoolEntry, RawPool } from "./pool-adapter";

const built = buildPools(json as RawPool);

/** Candidates that failed to adapt, if any (expected empty - see the factory-sweep test). */
export const flagged = built.flagged;

/** Per-slot PoolEntry arrays (entries 1..N; entry 0 lives in type2-loops.content.ts). */
export const alphaGammaPool: PoolEntry[] = built.pools["alpha-gamma"] ?? [];
export const betaGammaPool: PoolEntry[] = built.pools["beta-gamma"] ?? [];
export const gammaBetaPool: PoolEntry[] = built.pools["gamma-beta"] ?? [];
