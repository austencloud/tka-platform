import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [sveltekit()],
  build: {
    target: "esnext",
    minify: "esbuild",
    cssMinify: "esbuild",
  },
  ssr: {
    // Workspace packages ship raw TypeScript source, not pre-built JS.
    // Tell Vite to transform them instead of loading as native Node ESM.
    noExternal: ["@tka/types", "@tka/animation-renderer"],
  },
  server: {
    port: 5175,
    strictPort: true,
    fs: {
      // Allow serving files from workspace packages
      allow: ["../../packages"],
    },
  },
});
