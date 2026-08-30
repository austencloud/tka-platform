import path from "node:path";
import process from "node:process";

import { inspectWorkspaceInstall } from "./lib/workspace-install-health.mjs";

const projectRoot = path.resolve(process.argv[2] ?? process.cwd());
const report = await inspectWorkspaceInstall({ projectRoot });

if (report.healthy) {
  process.stdout.write(
    `[workspace-install] Healthy: ${report.dependencyCount} dependency manifests and ${report.criticalImportCount} critical imports verified.\n`
  );
  process.exit(0);
}

process.stderr.write(
  `[workspace-install] Unhealthy install: ${report.issues.length} problem${report.issues.length === 1 ? "" : "s"} found.\n`
);
for (const issue of report.issues) {
  const subject = issue.packageName ?? issue.path;
  process.stderr.write(`  - ${subject}: ${issue.message}\n`);
}
process.exit(1);
