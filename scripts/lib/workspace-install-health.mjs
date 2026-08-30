import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const CRITICAL_IMPORTS = Object.freeze([
  "zod",
  "@9square/domain",
  "@caps/domain",
  "@flow-arts/core",
  "@spin-science/domain",
  "@tka/domain",
  "@tka/render-core",
  "@tka/sequence-engine",
  "@tka/tka-types",
  "@vtg/domain",
  "svelte",
  "@sveltejs/vite-plugin-svelte",
  "vite",
]);

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

export function getDeclaredDependencyNames(manifest) {
  return [
    ...new Set([
      ...Object.keys(manifest.dependencies ?? {}),
      ...Object.keys(manifest.devDependencies ?? {}),
    ]),
  ].sort();
}

function packageRoot(projectRoot, packageName) {
  return path.join(projectRoot, "node_modules", ...packageName.split("/"));
}

export function inspectDeclaredDependencyRoots({ projectRoot, manifest }) {
  const issues = [];
  const dependencyNames = getDeclaredDependencyNames(manifest);

  for (const packageName of dependencyNames) {
    const manifestPath = path.join(
      packageRoot(projectRoot, packageName),
      "package.json"
    );

    if (!existsSync(manifestPath)) {
      issues.push({
        kind: "missing-package-manifest",
        packageName,
        path: manifestPath,
        message: "the installed package directory has no package.json",
      });
      continue;
    }

    try {
      const installedManifest = readJson(manifestPath);
      if (installedManifest.name !== packageName) {
        issues.push({
          kind: "mismatched-package-manifest",
          packageName,
          path: manifestPath,
          message: `expected package ${packageName}, found ${String(installedManifest.name)}`,
        });
      }
    } catch (error) {
      issues.push({
        kind: "invalid-package-manifest",
        packageName,
        path: manifestPath,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { dependencyNames, issues };
}

export async function inspectCriticalImports({
  projectRoot,
  specifiers = CRITICAL_IMPORTS,
}) {
  const issues = [];
  const projectRequire = createRequire(
    pathToFileURL(path.join(projectRoot, "package.json"))
  );

  for (const packageName of specifiers) {
    let entryPath;
    try {
      entryPath = projectRequire.resolve(packageName);
    } catch (error) {
      issues.push({
        kind: "unresolvable-critical-module",
        packageName,
        path: null,
        message: error instanceof Error ? error.message : String(error),
      });
      continue;
    }

    if (!existsSync(entryPath)) {
      issues.push({
        kind: "missing-critical-entry",
        packageName,
        path: entryPath,
        message: "the resolved module entrypoint does not exist",
      });
      continue;
    }

    try {
      await import(pathToFileURL(entryPath).href);
    } catch (error) {
      issues.push({
        kind: "unimportable-critical-module",
        packageName,
        path: entryPath,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { specifiers: [...specifiers], issues };
}

export async function inspectWorkspaceInstall({
  projectRoot,
  criticalImports = CRITICAL_IMPORTS,
}) {
  const rootManifestPath = path.join(projectRoot, "package.json");
  let manifest;

  try {
    manifest = readJson(rootManifestPath);
  } catch (error) {
    return {
      healthy: false,
      dependencyCount: 0,
      criticalImportCount: criticalImports.length,
      issues: [
        {
          kind: "invalid-root-manifest",
          packageName: null,
          path: rootManifestPath,
          message: error instanceof Error ? error.message : String(error),
        },
      ],
    };
  }

  const dependencyInspection = inspectDeclaredDependencyRoots({
    projectRoot,
    manifest,
  });
  const criticalImportInspection = await inspectCriticalImports({
    projectRoot,
    specifiers: criticalImports,
  });
  const issues = [
    ...dependencyInspection.issues,
    ...criticalImportInspection.issues,
  ];

  return {
    healthy: issues.length === 0,
    dependencyCount: dependencyInspection.dependencyNames.length,
    criticalImportCount: criticalImportInspection.specifiers.length,
    issues,
  };
}
