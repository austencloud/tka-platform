// Session-local dev config for the notation-redesign worktree (NOT committed).
// - node_modules is a junction to C:/tka-platform/node_modules; Vite resolves the
//   real path outside this root and 403s the client entry -> widen fs.allow.
// - This worktree has no .cert/; reuse the primary checkout's mkcert dev cert so
//   the server matches main's HTTPS/2 (the localhost cert covers :5176 too).
import { mergeConfig, defineConfig, type ConfigEnv } from "vite";
import { readFileSync } from "node:fs";
import base from "./vite.config";

const CERT = "C:/tka-platform/.cert";

export default defineConfig(async (env: ConfigEnv) => {
  const resolved = typeof base === "function" ? await (base as any)(env) : base;
  return mergeConfig(resolved, {
    server: {
      fs: {
        allow: ["C:/worktrees/tka-platform/notation-redesign", "C:/tka-platform"],
      },
      https: {
        cert: readFileSync(`${CERT}/dev-cert.pem`),
        key: readFileSync(`${CERT}/dev-key.pem`),
      },
    },
  });
});
