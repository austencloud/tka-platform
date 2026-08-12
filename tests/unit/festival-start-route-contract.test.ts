import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { isStandaloneAppSurface } from "$lib/shared/navigation/services/app-shell-route";

const readSource = (path: string): string =>
  readFileSync(resolve(process.cwd(), path), "utf-8");

describe("festival /start route contract", () => {
  it("uses app auth bootstrap without becoming an app navigation module", () => {
    expect(isStandaloneAppSurface("/start")).toBe(true);
    expect(isStandaloneAppSurface("/start/")).toBe(true);
    expect(isStandaloneAppSurface("/create/construct")).toBe(false);
  });

  it("guards module restore before it interprets the first URL segment", () => {
    const moduleState = readSource(
      "src/lib/shared/application/state/ui/module-state.ts"
    );

    expect(moduleState).toContain(
      "if (isStandaloneAppSurface(pathname)) return;"
    );
  });
});
