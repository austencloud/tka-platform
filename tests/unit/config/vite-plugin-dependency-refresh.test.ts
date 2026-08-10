import { EventEmitter } from "node:events";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createViteDependencyRefreshPlugin } from "../../../src/config/vite-plugin-dependency-refresh";
import type { ViteDevServer } from "vite";

afterEach(() => {
  vi.useRealTimers();
});

describe("createViteDependencyRefreshPlugin", () => {
  it("forces one optimized-dependency rebuild after manifest changes settle", async () => {
    vi.useFakeTimers();
    const projectRoot = path.resolve("C:/tka-platform");
    const watcher = Object.assign(new EventEmitter(), { add: vi.fn() });
    const httpServer = new EventEmitter();
    const restart = vi.fn(async () => {});
    const info = vi.fn();
    const server = {
      watcher,
      httpServer,
      restart,
      config: { logger: { info } },
    } as unknown as ViteDevServer;
    const plugin = createViteDependencyRefreshPlugin({
      projectRoot,
      restartDelayMs: 100,
    });
    const configureServer = plugin.configureServer as (
      server: ViteDevServer
    ) => void;

    configureServer(server);
    watcher.emit("change", path.join(projectRoot, "package.json"));
    watcher.emit("change", path.join(projectRoot, "pnpm-lock.yaml"));
    await vi.advanceTimersByTimeAsync(100);

    expect(watcher.add).toHaveBeenCalledWith([
      path.join(projectRoot, "package.json"),
      path.join(projectRoot, "pnpm-lock.yaml"),
    ]);
    expect(restart).toHaveBeenCalledOnce();
    expect(restart).toHaveBeenCalledWith(true);
    expect(info).toHaveBeenCalledOnce();
  });

  it("ignores unrelated changes and cancels pending work when the server closes", async () => {
    vi.useFakeTimers();
    const projectRoot = path.resolve("C:/tka-platform");
    const watcher = Object.assign(new EventEmitter(), { add: vi.fn() });
    const httpServer = new EventEmitter();
    const restart = vi.fn(async () => {});
    const server = {
      watcher,
      httpServer,
      restart,
      config: { logger: { info: vi.fn() } },
    } as unknown as ViteDevServer;
    const plugin = createViteDependencyRefreshPlugin({
      projectRoot,
      restartDelayMs: 100,
    });
    const configureServer = plugin.configureServer as (
      server: ViteDevServer
    ) => void;

    configureServer(server);
    watcher.emit("change", path.join(projectRoot, "src/package.json"));
    watcher.emit("change", path.join(projectRoot, "package.json"));
    httpServer.emit("close");
    await vi.advanceTimersByTimeAsync(100);

    expect(restart).not.toHaveBeenCalled();
  });
});
