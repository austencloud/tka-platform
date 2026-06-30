/**
 * decideFork — version-aware fork decision (corruption-core logic).
 *
 * Guards the rule that a hash-version bump must never look like a content change
 * (which would spuriously fork unmigrated docs), while a real content edit still
 * forks. See fork-decision.ts + the content-hash-v2 rollout spec.
 */
import { describe, it, expect, vi } from "vitest";
import {
  decideFork,
  type ForkDecisionInput,
} from "../../../src/lib/shared/library/services/fork-decision";

const V1 = 1;
const V2 = 2;

function input(over: Partial<ForkDecisionInput>): ForkDecisionInput {
  return {
    incomingHash: "incoming",
    existingHash: "existing",
    existingVersion: V1,
    activeVersion: V1,
    recomputeExistingAtActiveVersion: async () => undefined,
    ...over,
  };
}

describe("decideFork — same version (inert / pre-versioning behavior)", () => {
  it("equal hashes → no fork, never recomputes", async () => {
    const recompute = vi.fn(async () => undefined);
    const { fork } = await decideFork(
      input({ incomingHash: "h", existingHash: "h", recomputeExistingAtActiveVersion: recompute })
    );
    expect(fork).toBe(false);
    expect(recompute).not.toHaveBeenCalled();
  });

  it("different hashes (real edit) → fork, never recomputes", async () => {
    const recompute = vi.fn(async () => undefined);
    const { fork } = await decideFork(
      input({ incomingHash: "new", existingHash: "old", recomputeExistingAtActiveVersion: recompute })
    );
    expect(fork).toBe(true);
    expect(recompute).not.toHaveBeenCalled();
  });

  it("legacy doc without a stored hash → no fork", async () => {
    const { fork } = await decideFork(input({ existingHash: undefined }));
    expect(fork).toBe(false);
  });

  it("missing incoming hash → no fork", async () => {
    const { fork } = await decideFork(input({ incomingHash: undefined, existingHash: "x" }));
    expect(fork).toBe(false);
  });
});

describe("decideFork — cross version (the phantom-fork guard)", () => {
  it("version bump with identical content → NO fork, recomputes on the active basis", async () => {
    // Stored under V1 with hash "v1hash". Recomputing the SAME content under V2
    // yields "incoming" — equal to the incoming hash → this is a basis change,
    // not a content change. Must NOT fork.
    const recompute = vi.fn(async () => "incoming");
    const { fork, comparableExistingHash } = await decideFork(
      input({
        incomingHash: "incoming",
        existingHash: "v1hash",
        existingVersion: V1,
        activeVersion: V2,
        recomputeExistingAtActiveVersion: recompute,
      })
    );
    expect(recompute).toHaveBeenCalledOnce();
    expect(comparableExistingHash).toBe("incoming");
    expect(fork).toBe(false);
  });

  it("version bump with a real edit → forks (recomputed stored hash still differs)", async () => {
    // Recomputing the stored content under V2 yields "v2stored"; the incoming is
    // "v2edited" → genuine content change across the version bump → fork.
    const recompute = vi.fn(async () => "v2stored");
    const { fork } = await decideFork(
      input({
        incomingHash: "v2edited",
        existingHash: "v1hash",
        existingVersion: V1,
        activeVersion: V2,
        recomputeExistingAtActiveVersion: recompute,
      })
    );
    expect(recompute).toHaveBeenCalledOnce();
    expect(fork).toBe(true);
  });

  it("cross-version but recompute fails (undefined) → no fork (safe default)", async () => {
    const recompute = vi.fn(async () => undefined);
    const { fork } = await decideFork(
      input({
        incomingHash: "incoming",
        existingHash: "v1hash",
        existingVersion: V1,
        activeVersion: V2,
        recomputeExistingAtActiveVersion: recompute,
      })
    );
    expect(recompute).toHaveBeenCalledOnce();
    expect(fork).toBe(false);
  });
});
