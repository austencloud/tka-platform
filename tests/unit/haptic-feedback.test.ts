import { describe, it, expect } from "vitest";
import { MockHapticFeedback } from "../mocks/mock-haptic-service";

describe("MockHapticFeedback", () => {
  it("tracks impact calls with style", () => {
    const haptic = new MockHapticFeedback();
    haptic.impact("light");
    haptic.impact("medium");
    haptic.impact("heavy");

    const impacts = haptic.getCallsByMethod("impact");
    expect(impacts).toHaveLength(3);
    expect(impacts[0].args[0]).toBe("light");
    expect(impacts[1].args[0]).toBe("medium");
    expect(impacts[2].args[0]).toBe("heavy");
  });

  it("tracks notification calls with type", () => {
    const haptic = new MockHapticFeedback();
    haptic.notification("success");
    haptic.notification("warning");
    haptic.notification("error");

    const notifications = haptic.getCallsByMethod("notification");
    expect(notifications).toHaveLength(3);
    expect(notifications[0].args[0]).toBe("success");
    expect(notifications[2].args[0]).toBe("error");
  });

  it("tracks selection calls", () => {
    const haptic = new MockHapticFeedback();
    haptic.selection();
    haptic.selection();

    expect(haptic.getCallsByMethod("selection")).toHaveLength(2);
  });

  it("tracks legacy trigger calls", () => {
    const haptic = new MockHapticFeedback();
    haptic.trigger("selection");
    haptic.trigger("success");

    const triggers = haptic.getCallsByMethod("trigger");
    expect(triggers).toHaveLength(2);
    expect(triggers[0].args[0]).toBe("selection");
    expect(triggers[1].args[0]).toBe("success");
  });

  it("returns false when not supported", () => {
    const haptic = new MockHapticFeedback();
    haptic.setSupported(false);

    expect(haptic.impact("medium")).toBe(false);
    expect(haptic.notification("success")).toBe(false);
    expect(haptic.selection()).toBe(false);
  });

  it("clear resets all calls", () => {
    const haptic = new MockHapticFeedback();
    haptic.impact("light");
    haptic.notification("error");
    haptic.selection();
    expect(haptic.getCallCount()).toBe(3);

    haptic.clear();
    expect(haptic.getCallCount()).toBe(0);
  });

  it("getCallCount returns total across all methods", () => {
    const haptic = new MockHapticFeedback();
    haptic.impact("light");
    haptic.notification("success");
    haptic.trigger("selection");
    haptic.selection();

    expect(haptic.getCallCount()).toBe(4);
  });
});
