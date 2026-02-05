import adapter from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess({ script: true }),

  kit: {
    adapter: adapter({
      pages: "build",
      assets: "build",
      fallback: "200.html",
      strict: false,
    }),

    alias: {
      $lib: "./src/lib",
      "$lib/*": "./src/lib/*",
    },

    prerender: {
      crawl: true,
      entries: ["/", "/terms", "/privacy"],
      handleHttpError: ({ path, message }) => {
        // /about and /roots are on the scribe app, not the landing site.
        // /favicon.ico is fine as a 404 during prerender (will be added to static/).
        if (["/about", "/roots", "/favicon.ico"].includes(path)) {
          return;
        }
        throw new Error(message);
      },
    },
  },

  onwarn: (warning, handler) => {
    if (warning.code === "state_referenced_locally") return;
    handler(warning);
  },
};

export default config;
