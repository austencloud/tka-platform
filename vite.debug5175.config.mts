// Session-local dev config for the seo-main worktree (NOT committed).
// The worktree's node_modules is a junction to C:/tka-platform/node_modules;
// Vite resolves the real path, which falls outside this root and 403s the
// client entry. Widen fs.allow to cover the primary checkout's node_modules.
import { mergeConfig, defineConfig, type ConfigEnv } from "vite";
import base from "./vite.config";

export default defineConfig(async (env: ConfigEnv) => {
  const resolved = typeof base === "function" ? await (base as any)(env) : base;
  return mergeConfig(resolved, {
    server: {
      fs: {
        allow: ["C:/worktrees/tka-platform/seo-main", "C:/tka-platform"],
      },
    },
  });
});
