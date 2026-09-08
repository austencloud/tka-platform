import { existsSync } from "node:fs";
import { join } from "node:path";

export const REQUIRED_SVELTE_KIT_OUTPUTS = [
  "tsconfig.json",
  "ambient.d.ts",
  join("types", "route_meta_data.json"),
  join("types", "src", "routes", "$types.d.ts"),
  join("types", "src", "routes", "proxy+layout.server.ts"),
];

export function isSvelteKitGeneratedStateIntact(outputDirectory) {
  return REQUIRED_SVELTE_KIT_OUTPUTS.every((relativePath) =>
    existsSync(join(outputDirectory, relativePath))
  );
}
