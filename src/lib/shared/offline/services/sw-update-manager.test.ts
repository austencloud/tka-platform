import { describe, it, expect, vi } from "vitest";
import { createSwUpdateManager } from "./sw-update-manager";

class FakeWorker extends EventTarget {
  state: string = "installing";
  postMessage = vi.fn();
  setState(s: string) {
    this.state = s;
    this.dispatchEvent(new Event("statechange"));
  }
}

class FakeRegistration extends EventTarget {
  installing: FakeWorker | null = null;
  waiting: FakeWorker | null = null;
  update = vi.fn().mockResolvedValue(undefined);
  triggerUpdateFound(worker: FakeWorker) {
    this.installing = worker;
    this.dispatchEvent(new Event("updatefound"));
  }
}

class FakeContainer extends EventTarget {
  controller: unknown = null;
  triggerControllerChange() {
    this.dispatchEvent(new Event("controllerchange"));
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asAny = (x: unknown) => x as any;

describe("createSwUpdateManager", () => {
  it("fires onUpdateReady when a worker installs over an existing controller", () => {
    const container = new FakeContainer();
    container.controller = {}; // a SW already controls the page → this is an update
    const registration = new FakeRegistration();
    const onUpdateReady = vi.fn();

    createSwUpdateManager({
      registration: asAny(registration),
      serviceWorker: asAny(container),
      onUpdateReady,
      reload: vi.fn(),
    });

    const worker = new FakeWorker();
    registration.triggerUpdateFound(worker);
    worker.setState("installed");

    expect(onUpdateReady).toHaveBeenCalledTimes(1);
  });

  it("does NOT fire onUpdateReady on first install (no controller)", () => {
    const container = new FakeContainer(); // controller stays null
    const registration = new FakeRegistration();
    const onUpdateReady = vi.fn();

    createSwUpdateManager({
      registration: asAny(registration),
      serviceWorker: asAny(container),
      onUpdateReady,
      reload: vi.fn(),
    });

    const worker = new FakeWorker();
    registration.triggerUpdateFound(worker);
    worker.setState("installed");

    expect(onUpdateReady).not.toHaveBeenCalled();
  });

  it("fires immediately when a worker is already waiting at construction", () => {
    const container = new FakeContainer();
    container.controller = {};
    const registration = new FakeRegistration();
    registration.waiting = new FakeWorker();
    const onUpdateReady = vi.fn();

    createSwUpdateManager({
      registration: asAny(registration),
      serviceWorker: asAny(container),
      onUpdateReady,
      reload: vi.fn(),
    });

    expect(onUpdateReady).toHaveBeenCalledTimes(1);
  });

  it("apply() posts SKIP_WAITING to the waiting worker", () => {
    const container = new FakeContainer();
    container.controller = {};
    const registration = new FakeRegistration();
    const waiting = new FakeWorker();
    registration.waiting = waiting;
    let applyFn: (() => void) | null = null;

    createSwUpdateManager({
      registration: asAny(registration),
      serviceWorker: asAny(container),
      onUpdateReady: (apply) => {
        applyFn = apply;
      },
      reload: vi.fn(),
    });

    applyFn!();
    expect(waiting.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
  });

  it("does not reload when the first install claims the open page", () => {
    const container = new FakeContainer();
    const registration = new FakeRegistration();
    const reload = vi.fn();

    createSwUpdateManager({
      registration: asAny(registration),
      serviceWorker: asAny(container),
      onUpdateReady: vi.fn(),
      reload,
    });

    const worker = new FakeWorker();
    registration.triggerUpdateFound(worker);
    worker.setState("installed");
    container.triggerControllerChange();

    expect(reload).not.toHaveBeenCalled();
  });

  it("does not reload an already-controlled page before the update is accepted", () => {
    const container = new FakeContainer();
    container.controller = {};
    const registration = new FakeRegistration();
    const reload = vi.fn();

    createSwUpdateManager({
      registration: asAny(registration),
      serviceWorker: asAny(container),
      onUpdateReady: vi.fn(),
      reload,
    });

    container.triggerControllerChange();

    expect(reload).not.toHaveBeenCalled();
  });

  it("reloads exactly once after an accepted update takes control", () => {
    const container = new FakeContainer();
    container.controller = {};
    const registration = new FakeRegistration();
    const waiting = new FakeWorker();
    registration.waiting = waiting;
    const reload = vi.fn();
    let applyFn: (() => void) | null = null;

    createSwUpdateManager({
      registration: asAny(registration),
      serviceWorker: asAny(container),
      onUpdateReady: (apply) => {
        applyFn = apply;
      },
      reload,
    });

    applyFn!();
    container.triggerControllerChange();
    container.triggerControllerChange();

    expect(waiting.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("notifies only once when the browser reports the same update repeatedly", () => {
    const container = new FakeContainer();
    container.controller = {};
    const registration = new FakeRegistration();
    const onUpdateReady = vi.fn();

    createSwUpdateManager({
      registration: asAny(registration),
      serviceWorker: asAny(container),
      onUpdateReady,
      reload: vi.fn(),
    });

    const first = new FakeWorker();
    registration.triggerUpdateFound(first);
    first.setState("installed");
    const second = new FakeWorker();
    registration.triggerUpdateFound(second);
    second.setState("installed");

    expect(onUpdateReady).toHaveBeenCalledTimes(1);
  });

  it("does not arm a reload when apply runs without a waiting worker", () => {
    const container = new FakeContainer();
    container.controller = {};
    const registration = new FakeRegistration();
    const reload = vi.fn();
    let applyFn: (() => void) | null = null;

    const waiting = new FakeWorker();
    registration.waiting = waiting;
    createSwUpdateManager({
      registration: asAny(registration),
      serviceWorker: asAny(container),
      onUpdateReady: (apply) => {
        applyFn = apply;
      },
      reload,
    });

    registration.waiting = null;
    applyFn!();
    container.triggerControllerChange();

    expect(waiting.postMessage).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it("checks for an update when a long-lived tab becomes visible", async () => {
    const container = new FakeContainer();
    const registration = new FakeRegistration();
    const original = Object.getOwnPropertyDescriptor(
      document,
      "visibilityState"
    );

    const dispose = createSwUpdateManager({
      registration: asAny(registration),
      serviceWorker: asAny(container),
      onUpdateReady: vi.fn(),
      reload: vi.fn(),
    });

    try {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        value: "hidden",
      });
      document.dispatchEvent(new Event("visibilitychange"));
      expect(registration.update).not.toHaveBeenCalled();

      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        value: "visible",
      });
      document.dispatchEvent(new Event("visibilitychange"));
      await Promise.resolve();
      expect(registration.update).toHaveBeenCalledTimes(1);
    } finally {
      dispose();
      if (original)
        Object.defineProperty(document, "visibilityState", original);
    }
  });

  it("removes every lifecycle listener when disposed", () => {
    const container = new FakeContainer();
    container.controller = {};
    const registration = new FakeRegistration();
    const onUpdateReady = vi.fn();
    const reload = vi.fn();

    const dispose = createSwUpdateManager({
      registration: asAny(registration),
      serviceWorker: asAny(container),
      onUpdateReady,
      reload,
    });
    dispose();

    const worker = new FakeWorker();
    registration.triggerUpdateFound(worker);
    worker.setState("installed");
    container.triggerControllerChange();
    document.dispatchEvent(new Event("visibilitychange"));

    expect(onUpdateReady).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
    expect(registration.update).not.toHaveBeenCalled();
  });
});
