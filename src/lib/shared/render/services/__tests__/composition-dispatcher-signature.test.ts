import { describe, it, expect } from "vitest";
import { CompositionDispatcher } from "../composition-dispatcher";

// Minimal stubs — signature tracking never touches the composer/text renderer.
const stub = {} as never;

describe("CompositionDispatcher signature tracking", () => {
  it("starts with a null seeded signature", () => {
    const d = new CompositionDispatcher(stub, stub);
    expect(d.getSeededSignature()).toBeNull();
  });

  it("clears the seeded signature on terminate", () => {
    const d = new CompositionDispatcher(stub, stub);
    // Force a seeded signature without spawning workers.
    (d as unknown as { seededSignature: string | null }).seededSignature = "sig-abc";
    expect(d.getSeededSignature()).toBe("sig-abc");
    d.terminate();
    expect(d.getSeededSignature()).toBeNull();
  });

  it("setPendingSignature records the signature to seed at next init", () => {
    const d = new CompositionDispatcher(stub, stub);
    d.setPendingSignature("sig-xyz");
    expect((d as unknown as { pendingSignature: string | null }).pendingSignature).toBe("sig-xyz");
  });

  it("beginSeed raises a seed gate until the returned resolver is called", async () => {
    const d = new CompositionDispatcher(stub, stub);
    const finish = d.beginSeed("sig-1");
    const gate = (d as unknown as { seedGate: Promise<void> | null }).seedGate;
    expect(gate).not.toBeNull();
    expect((d as unknown as { pendingSignature: string | null }).pendingSignature).toBe("sig-1");
    finish();
    await gate; // resolves without hanging
    expect((d as unknown as { seedGate: Promise<void> | null }).seedGate).toBeNull();
  });

  it("beginSeed tears down a pool seeded with a different signature", () => {
    const d = new CompositionDispatcher(stub, stub);
    (d as unknown as { seededSignature: string | null }).seededSignature = "old-sig";
    d.beginSeed("new-sig");
    // terminate() clears the seeded signature.
    expect(d.getSeededSignature()).toBeNull();
  });
});
