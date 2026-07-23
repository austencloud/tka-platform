import { describe, it, expect, vi } from "vitest";
import { startFirstSequence } from "$lib/shared/onboarding/services/start-first-sequence";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

function makeSequence(steps: unknown[] = [{ id: "s1" }]): SequenceData {
  return {
    id: "seq-1",
    word: "AB",
    steps,
  } as unknown as SequenceData;
}

describe("startFirstSequence", () => {
  it("returns generate-failed when generate() throws", async () => {
    const loadIntoWorkspace = vi.fn();
    const save = vi.fn();
    const onKept = vi.fn();

    const result = await startFirstSequence({
      generate: async () => {
        throw new Error("boom");
      },
      loadIntoWorkspace,
      save,
      onKept,
    });

    expect(result).toEqual({ status: "generate-failed" });
    expect(loadIntoWorkspace).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
    expect(onKept).not.toHaveBeenCalled();
  });

  it("returns generate-failed when the generated sequence has no steps", async () => {
    const loadIntoWorkspace = vi.fn();
    const save = vi.fn();

    const result = await startFirstSequence({
      generate: async () => makeSequence([]),
      loadIntoWorkspace,
      save,
      onKept: vi.fn(),
    });

    expect(result).toEqual({ status: "generate-failed" });
    expect(loadIntoWorkspace).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it("loads into workspace before attempting save, and returns persist-failed on save() throw", async () => {
    const calls: string[] = [];
    const sequence = makeSequence();

    const result = await startFirstSequence({
      generate: async () => sequence,
      loadIntoWorkspace: () => calls.push("load"),
      save: async () => {
        calls.push("save");
        throw new Error("save boom");
      },
      onKept: vi.fn(),
    });

    expect(result).toEqual({ status: "persist-failed" });
    expect(calls).toEqual(["load", "save"]);
  });

  it("returns persist-failed when save() resolves with persisted: false", async () => {
    const onKept = vi.fn();

    const result = await startFirstSequence({
      generate: async () => makeSequence(),
      loadIntoWorkspace: vi.fn(),
      save: async () => ({ persisted: false, isGuest: true, sequenceId: "seq-1" }),
      onKept,
    });

    expect(result).toEqual({ status: "persist-failed" });
    expect(onKept).not.toHaveBeenCalled();
  });

  it("on a persisted GUEST keep, calls onKept and returns generated-kept", async () => {
    const onKept = vi.fn();

    const result = await startFirstSequence({
      generate: async () => makeSequence(),
      loadIntoWorkspace: vi.fn(),
      save: async () => ({ persisted: true, isGuest: true, sequenceId: "seq-1" }),
      onKept,
    });

    expect(result).toEqual({ status: "generated-kept", sequenceId: "seq-1" });
    expect(onKept).toHaveBeenCalledWith("seq-1");
    expect(onKept).toHaveBeenCalledTimes(1);
  });

  it("on a persisted FULL-ACCOUNT keep, does NOT call onKept but still returns generated-kept", async () => {
    const onKept = vi.fn();

    const result = await startFirstSequence({
      generate: async () => makeSequence(),
      loadIntoWorkspace: vi.fn(),
      save: async () => ({ persisted: true, isGuest: false, sequenceId: "seq-2" }),
      onKept,
    });

    expect(result).toEqual({ status: "generated-kept", sequenceId: "seq-2" });
    expect(onKept).not.toHaveBeenCalled();
  });
});
