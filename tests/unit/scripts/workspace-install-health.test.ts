import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { inspectWorkspaceInstall } from "../../../scripts/lib/workspace-install-health.mjs";

const temporaryRoots: string[] = [];

function createProject(
  dependencies: Record<string, string>,
  packages: Record<string, { manifest?: object; source?: string }>
): string {
  const projectRoot = mkdtempSync(
    path.join(tmpdir(), "tka-workspace-install-health-")
  );
  temporaryRoots.push(projectRoot);
  writeFileSync(
    path.join(projectRoot, "package.json"),
    JSON.stringify({ name: "fixture", type: "module", dependencies }),
    "utf8"
  );

  for (const [packageName, fixture] of Object.entries(packages)) {
    const packageRoot = path.join(
      projectRoot,
      "node_modules",
      ...packageName.split("/")
    );
    mkdirSync(packageRoot, { recursive: true });
    if (fixture.manifest) {
      writeFileSync(
        path.join(packageRoot, "package.json"),
        JSON.stringify(fixture.manifest),
        "utf8"
      );
    }
    if (fixture.source !== undefined) {
      writeFileSync(path.join(packageRoot, "index.js"), fixture.source, "utf8");
    }
  }

  return projectRoot;
}

afterEach(() => {
  for (const projectRoot of temporaryRoots.splice(0)) {
    rmSync(projectRoot, { recursive: true, force: true });
  }
});

describe("workspace install health", () => {
  it("accepts installed dependency roots whose critical entrypoints import", async () => {
    const projectRoot = createProject(
      { healthy: "1.0.0" },
      {
        healthy: {
          manifest: {
            name: "healthy",
            version: "1.0.0",
            type: "module",
            exports: "./index.js",
          },
          source: "export const ready = true;\n",
        },
      }
    );

    await expect(
      inspectWorkspaceInstall({
        projectRoot,
        criticalImports: ["healthy"],
      })
    ).resolves.toMatchObject({
      healthy: true,
      dependencyCount: 1,
      criticalImportCount: 1,
      issues: [],
    });
  });

  it("rejects the hollow package directory that pnpm can otherwise overlook", async () => {
    const projectRoot = createProject({ hollow: "1.0.0" }, { hollow: {} });

    const report = await inspectWorkspaceInstall({
      projectRoot,
      criticalImports: [],
    });

    expect(report.healthy).toBe(false);
    expect(report.issues).toContainEqual(
      expect.objectContaining({
        kind: "missing-package-manifest",
        packageName: "hollow",
      })
    );
  });

  it("rejects an entrypoint whose transitive import is missing", async () => {
    const projectRoot = createProject(
      { broken: "1.0.0" },
      {
        broken: {
          manifest: {
            name: "broken",
            version: "1.0.0",
            type: "module",
            exports: "./index.js",
          },
          source: 'import "missing-transitive-package";\n',
        },
      }
    );

    const report = await inspectWorkspaceInstall({
      projectRoot,
      criticalImports: ["broken"],
    });

    expect(report.healthy).toBe(false);
    expect(report.issues).toContainEqual(
      expect.objectContaining({
        kind: "unimportable-critical-module",
        packageName: "broken",
      })
    );
  });
});

describe("dev launcher install guard", () => {
  const launcher = readFileSync(path.resolve("scripts/start-dev.ps1"), "utf8");

  it("restores the HTTPS certificate before Vite is allowed to start", () => {
    const certificateGuardIndex = launcher.indexOf(
      "Ensure-DevHttpsCertificate $repoRoot"
    );
    const viteStartIndex = launcher.indexOf(
      'Write-Status "Starting Vite dev server..."'
    );

    expect(launcher).toContain('Join-Path $RepoRoot ".tools\\mkcert.exe"');
    expect(launcher).toContain(
      "Vite was not started because the Cloudflare tunnel requires HTTPS."
    );
    expect(certificateGuardIndex).toBeGreaterThan(-1);
    expect(viteStartIndex).toBeGreaterThan(certificateGuardIndex);
  });

  it("runs the install preflight before Vite is allowed to start", () => {
    const preflightIndex = launcher.lastIndexOf(
      "Test-WorkspaceInstall $repoRoot"
    );
    const viteStartIndex = launcher.indexOf(
      'Write-Status "Starting Vite dev server..."'
    );

    expect(preflightIndex).toBeGreaterThan(-1);
    expect(viteStartIndex).toBeGreaterThan(preflightIndex);
  });

  it("repairs from the frozen lockfile and fails closed", () => {
    expect(launcher).toContain(
      "pnpm install --force --offline --frozen-lockfile"
    );
    expect(launcher).toContain("pnpm install --force --frozen-lockfile");
    expect(launcher).toContain("pnpm run build:packages");
    expect(launcher).toContain(
      "Vite was not started with an unhealthy install."
    );
  });

  it("requests one clean Vite optimizer pass after a repair", () => {
    expect(launcher).toContain('$env:TKA_FORCE_VITE_DEPS = "1"');
  });
});
