import { describe, it, expect, beforeEach } from "vitest";
import { Viewer3DUndoManager } from "@austencloud/scene-3d";
import type { ViewerSnapshot } from "@austencloud/scene-3d";
import { Plane } from "@austencloud/scene-3d";

function snap(label: string): ViewerSnapshot {
  return {
    performers: [
      {
        id: `performer-0-${label}`,
        position: { x: 0, z: 0 },
        facingAngle: 0,
        customBluePlane: Plane.WALL,
        customRedPlane: Plane.WALL,
        sequenceRef: null,
      },
    ],
    selectedPerformerIndex: null,
    activeFormation: "solo",
    timestamp: Date.now(),
  };
}

describe("Viewer3DUndoManager", () => {
  let mgr: Viewer3DUndoManager;

  beforeEach(() => {
    mgr = new Viewer3DUndoManager();
  });

  it("starts with both stacks empty", () => {
    expect(mgr.canUndo).toBe(false);
    expect(mgr.canRedo).toBe(false);
  });

  it("pushSnapshot makes canUndo true", () => {
    mgr.pushSnapshot("spawn", snap("A"));
    expect(mgr.canUndo).toBe(true);
    expect(mgr.canRedo).toBe(false);
  });

  it("completeEntry fills in afterState on the most recent entry", () => {
    const id = mgr.pushSnapshot("spawn", snap("A"));
    mgr.completeEntry(id, snap("B"));
    const entry = mgr.undoHistory[mgr.undoHistory.length - 1];
    expect(entry?.afterState).toBeDefined();
    expect(entry?.afterState?.performers[0]?.id).toBe("performer-0-B");
  });

  it("undo moves entry to redo stack and returns it", () => {
    const before = snap("before");
    const id = mgr.pushSnapshot("formation", before);
    mgr.completeEntry(id, snap("after"));

    const undone = mgr.undo();
    expect(undone).not.toBeNull();
    expect(undone?.beforeState.performers[0]?.id).toBe("performer-0-before");
    expect(mgr.canUndo).toBe(false);
    expect(mgr.canRedo).toBe(true);
  });

  it("redo moves entry back to undo stack and returns it", () => {
    const id = mgr.pushSnapshot("spatial", snap("before"));
    mgr.completeEntry(id, snap("after"));
    mgr.undo();

    const redone = mgr.redo();
    expect(redone).not.toBeNull();
    expect(redone?.afterState?.performers[0]?.id).toBe("performer-0-after");
    expect(mgr.canUndo).toBe(true);
    expect(mgr.canRedo).toBe(false);
  });

  it("pushing a new entry clears the redo stack", () => {
    const id1 = mgr.pushSnapshot("spawn", snap("A"));
    mgr.completeEntry(id1, snap("A-done"));
    mgr.undo();
    expect(mgr.canRedo).toBe(true);

    const id2 = mgr.pushSnapshot("remove", snap("B"));
    mgr.completeEntry(id2, snap("B-done"));
    expect(mgr.canRedo).toBe(false);
  });

  it("cap enforcement drops oldest at 51st push", () => {
    for (let i = 0; i < 51; i++) {
      const id = mgr.pushSnapshot("spatial", snap(`push-${i}`));
      mgr.completeEntry(id, snap(`push-${i}-done`));
    }
    expect(mgr.undoHistory.length).toBe(50);
    expect(mgr.undoHistory[0]?.beforeState.performers[0]?.id).toBe("performer-0-push-1");
  });

  it("clearHistory empties both stacks", () => {
    const id = mgr.pushSnapshot("spawn", snap("A"));
    mgr.completeEntry(id, snap("B"));
    mgr.undo();
    mgr.clearHistory();
    expect(mgr.canUndo).toBe(false);
    expect(mgr.canRedo).toBe(false);
  });

  it("onChange subscribers are notified on push, undo, redo, clearHistory", () => {
    let count = 0;
    const unsub = mgr.onChange(() => {
      count += 1;
    });
    const id = mgr.pushSnapshot("spawn", snap("A"));
    mgr.completeEntry(id, snap("B"));
    mgr.undo();
    mgr.redo();
    mgr.clearHistory();
    unsub();
    // Push + undo + redo + clearHistory = 4 notifications.
    // completeEntry does not notify because it's a silent patch.
    expect(count).toBe(4);
  });

  it("push → undo → redo round-trips", () => {
    const before = snap("before");
    const after = snap("after");
    const id = mgr.pushSnapshot("formation", before);
    mgr.completeEntry(id, after);

    const undone = mgr.undo();
    expect(undone?.beforeState.performers[0]?.id).toBe("performer-0-before");

    const redone = mgr.redo();
    expect(redone?.afterState?.performers[0]?.id).toBe("performer-0-after");
  });
});
