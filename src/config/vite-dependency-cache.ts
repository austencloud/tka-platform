import { existsSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";

const DEFAULT_VITE_DEV_PORT = 5173;

interface OptimizedDependencyMetadata {
  optimized?: Record<string, { src?: unknown }>;
}

export interface ViteDependencyCachePlan {
  cacheDir: string;
  forceRefresh: boolean;
  port: number;
  reason: "invalid-metadata" | "stale-dependencies" | null;
  staleDependencies: string[];
}

interface CreateViteDependencyCachePlanOptions {
  argv?: readonly string[];
  env?: Readonly<Record<string, string | undefined>>;
  projectRoot: string;
}

function parsePort(value: string | undefined): number | null {
  if (!value || !/^\d+$/.test(value)) return null;

  const port = Number(value);
  return Number.isInteger(port) && port > 0 && port <= 65_535 ? port : null;
}

export function resolveViteDevPort(
  argv: readonly string[],
  env: Readonly<Record<string, string | undefined>> = {}
): number {
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--port") {
      const port = parsePort(argv[index + 1]);
      if (port !== null) return port;
    }

    if (argument.startsWith("--port=")) {
      const port = parsePort(argument.slice("--port=".length));
      if (port !== null) return port;
    }
  }

  return parsePort(env.TKA_VITE_PORT) ?? DEFAULT_VITE_DEV_PORT;
}

export function getViteDependencyCacheDir(
  projectRoot: string,
  port: number
): string {
  return path.resolve(projectRoot, "node_modules/.vite", `port-${port}`);
}

function getPackageName(dependencyId: string): string | null {
  if (dependencyId.includes(" > ")) return null;

  const segments = dependencyId.split("/");
  if (dependencyId.startsWith("@")) {
    return segments.length >= 2 ? `${segments[0]}/${segments[1]}` : null;
  }

  return segments[0] || null;
}

function isPathInside(parentPath: string, candidatePath: string): boolean {
  const relativePath = path.relative(parentPath, candidatePath);
  return (
    relativePath === "" ||
    (!relativePath.startsWith(`..${path.sep}`) &&
      relativePath !== ".." &&
      !path.isAbsolute(relativePath))
  );
}

function findStaleDependencies(
  projectRoot: string,
  metadataPath: string,
  metadata: OptimizedDependencyMetadata
): string[] {
  if (!metadata.optimized || typeof metadata.optimized !== "object") {
    throw new TypeError("Vite dependency metadata has no optimized entries");
  }

  const metadataDir = path.dirname(metadataPath);
  const staleDependencies = new Set<string>();

  for (const [dependencyId, optimizedEntry] of Object.entries(
    metadata.optimized
  )) {
    const packageName = getPackageName(dependencyId);
    if (!packageName || typeof optimizedEntry?.src !== "string") continue;

    const installedPackageJson = path.resolve(
      projectRoot,
      "node_modules",
      ...packageName.split("/"),
      "package.json"
    );

    // Only root-installed packages provide an authoritative current target.
    // Nested optimizer entries are validated by their owning direct package.
    if (!existsSync(installedPackageJson)) continue;

    const installedPackageRoot = realpathSync(
      path.dirname(installedPackageJson)
    );
    const cachedSourcePath = path.resolve(metadataDir, optimizedEntry.src);

    if (!existsSync(cachedSourcePath)) {
      staleDependencies.add(packageName);
      continue;
    }

    const cachedSourceRealPath = realpathSync(cachedSourcePath);
    if (!isPathInside(installedPackageRoot, cachedSourceRealPath)) {
      staleDependencies.add(packageName);
    }
  }

  return [...staleDependencies].sort();
}

export function createViteDependencyCachePlan({
  argv = process.argv,
  env = process.env,
  projectRoot,
}: CreateViteDependencyCachePlanOptions): ViteDependencyCachePlan {
  const port = resolveViteDevPort(argv, env);
  const cacheDir = getViteDependencyCacheDir(projectRoot, port);
  const metadataPath = path.join(cacheDir, "deps", "_metadata.json");

  if (!existsSync(metadataPath)) {
    return {
      cacheDir,
      forceRefresh: false,
      port,
      reason: null,
      staleDependencies: [],
    };
  }

  try {
    const metadata = JSON.parse(
      readFileSync(metadataPath, "utf8")
    ) as OptimizedDependencyMetadata;
    const staleDependencies = findStaleDependencies(
      projectRoot,
      metadataPath,
      metadata
    );

    return {
      cacheDir,
      forceRefresh: staleDependencies.length > 0,
      port,
      reason: staleDependencies.length > 0 ? "stale-dependencies" : null,
      staleDependencies,
    };
  } catch {
    return {
      cacheDir,
      forceRefresh: true,
      port,
      reason: "invalid-metadata",
      staleDependencies: [],
    };
  }
}
