import {
  getViteDependencyStatePaths,
  isViteDependencyStatePath,
} from "./vite-dependency-cache";
import type { Plugin, ViteDevServer } from "vite";

interface ViteDependencyRefreshPluginOptions {
  projectRoot: string;
  restartDelayMs?: number;
}

export function createViteDependencyRefreshPlugin({
  projectRoot,
  restartDelayMs = 750,
}: ViteDependencyRefreshPluginOptions): Plugin {
  return {
    name: "dependency-cache-live-refresh",
    apply: "serve",
    configureServer(server: ViteDevServer) {
      const dependencyStatePaths = getViteDependencyStatePaths(projectRoot);
      let restartTimer: ReturnType<typeof setTimeout> | undefined;

      server.watcher.add(dependencyStatePaths);

      const scheduleRefresh = (changedPath: string) => {
        if (!isViteDependencyStatePath(projectRoot, changedPath)) return;

        if (restartTimer) clearTimeout(restartTimer);
        restartTimer = setTimeout(() => {
          restartTimer = undefined;
          server.config.logger.info(
            "Dependency state changed. Rebuilding optimized bundles..."
          );
          void server.restart(true);
        }, restartDelayMs);
      };

      server.watcher.on("change", scheduleRefresh);
      server.httpServer?.once("close", () => {
        if (restartTimer) clearTimeout(restartTimer);
        server.watcher.off("change", scheduleRefresh);
      });
    },
  };
}
