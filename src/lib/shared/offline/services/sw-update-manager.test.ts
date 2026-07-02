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

  it("reloads exactly once on controllerchange", () => {
    const container = new FakeContainer();
    const registration = new FakeRegistration();
    const reload = vi.fn();

    createSwUpdateManager({
      registration: asAny(registration),
      serviceWorker: asAny(container),
      onUpdateReady: vi.fn(),
      reload,
    });

    container.triggerControllerChange();
    container.triggerControllerChange();
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
