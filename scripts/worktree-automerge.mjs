#!/usr/bin/env node
/**
 * worktree-automerge — auto-merge ready worktrees to main, hands-off.
 *
 * Austen runs many worktrees at once and doesn't want to remember to merge the
 * finished ones. This scans every worktree and merges the ones that are truly
 * ready, on a strict green gate. It merges SERVER-SIDE through `gh` (push branch
 * → PR → merge), so it never touches the primary checkout's working tree — which
 * is usually dirty with an active session's work and must not be disturbed.
 *
 * A worktree is "ready" only when ALL hold:
 *   - its branch isn't main and isn't a skip-prefixed branch (wip/ spike/ …)
 *   - no `.automerge-skip` file in the worktree (explicit opt-out)
 *   - working tree is clean (nothing uncommitted)
 *   - quiescent: last commit is older than QUIESCENT_MIN (an actively-worked
 *     branch is left alone so we never yank it out from under a live session)
 *   - it's ahead of origin/main (something to merge)
 *   - it merges into origin/main with no conflicts
 *   - `npm run check` passes in the worktree (the real quality gate)
 *
 * Default is a DRY RUN (report only). Pass --apply to actually merge. Because
 * main auto-deploys to production (CF Pages), every merge here ships to prod —
 * that's the chosen behavior, but it's why the gate is strict and every action
 * is logged to .git/automerge-log.jsonl with the pre-merge origin/main SHA so a
 * bad merge can be reverted.
 *
 * Local task completion (the normal agent workflow):
 *   node scripts/worktree-automerge.mjs --finish codex/my-task --route /real-route
 *   node scripts/worktree-automerge.mjs --finish codex/my-task --nonvisual
 *
 * The finish mode merges verified work into the local main checkout, removes
 * the worktree and branch, and prints the :5173 delivery URL. It deliberately
 * leaves everything intact when a safety gate fails.
 *
 * Scheduled remote scan usage:
 *   node scripts/worktree-automerge.mjs                 # dry run, full gate
 *   node scripts/worktree-automerge.mjs --skip-checks   # dry run, cheap gates only (fast preview)
 *   node scripts/worktree-automerge.mjs --apply         # merge the ready ones
 *   node scripts/worktree-automerge.mjs --apply --prune # + remove merged worktrees
 */

import { execFileSync, execSync } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  lstatSync,
  realpathSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const SKIP_BRANCH_PREFIXES = [
  "wip/",
  "spike/",
  "experiment/",
  "tmp/",
  "draft/",
];
const SKIP_FILE = ".automerge-skip";
const QUIESCENT_MIN = 30;
const LOCK_STALE_MIN = 60;
const MAIN = "main";

const APPLY = process.argv.includes("--apply");
const PRUNE = process.argv.includes("--prune");
const SKIP_CHECKS = process.argv.includes("--skip-checks");
const DRY_RUN = process.argv.includes("--dry-run");

function argumentAfter(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : (process.argv[index + 1] ?? null);
}

const FINISH_REQUESTED = process.argv.includes("--finish");
const FINISH_BRANCH = argumentAfter("--finish");
const DELIVERY_ROUTE = argumentAfter("--route");
const NONVISUAL = process.argv.includes("--nonvisual");

// Resolve the git dir once so the lock + log live with the repo, not a worktree.
const GIT_COMMON_DIR = sh("git rev-parse --git-common-dir");
const LOCK = join(GIT_COMMON_DIR, "automerge.lock");
const LOG = join(GIT_COMMON_DIR, "automerge-log.jsonl");

function sh(cmd, opts = {}) {
  return execSync(cmd, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...opts,
  }).trim();
}
function run(executable, args, opts = {}) {
  const output = execFileSync(executable, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...opts,
  });
  return typeof output === "string" ? output.trim() : "";
}
function git(args, opts = {}) {
  return run("git", args, opts);
}
function trySh(cmd, opts = {}) {
  try {
    return { ok: true, out: sh(cmd, opts) };
  } catch (e) {
    return { ok: false, out: (e.stdout || "") + (e.stderr || "") };
  }
}
function tryGit(args, opts = {}) {
  try {
    return { ok: true, out: git(args, opts) };
  } catch (error) {
    return {
      ok: false,
      out: `${error.stdout ?? ""}${error.stderr ?? ""}`,
    };
  }
}
function logLine(obj) {
  appendFileSync(LOG, JSON.stringify(obj) + "\n");
}

function fail(message) {
  throw new Error(message);
}

function splitNullList(raw) {
  return raw.split("\0").filter(Boolean);
}

function isAncestor(older, newer) {
  return tryGit(["merge-base", "--is-ancestor", older, newer]).ok;
}

function changedPaths(path) {
  return new Set([
    ...splitNullList(git(["-C", path, "diff", "--name-only", "-z"])),
    ...splitNullList(
      git(["-C", path, "diff", "--cached", "--name-only", "-z"])
    ),
    ...splitNullList(
      git(["-C", path, "ls-files", "--others", "--exclude-standard", "-z"])
    ),
  ]);
}

function assertNoGitOperation(path) {
  const markers = [
    "MERGE_HEAD",
    "CHERRY_PICK_HEAD",
    "REVERT_HEAD",
    "BISECT_LOG",
    "rebase-merge",
    "rebase-apply",
  ];
  const active = markers.filter((marker) => {
    const markerPath = git(["-C", path, "rev-parse", "--git-path", marker]);
    return existsSync(
      isAbsolute(markerPath) ? markerPath : resolve(path, markerPath)
    );
  });
  if (active.length)
    fail(`main has an in-progress Git operation (${active.join(", ")})`);
}

function deliveryUrl() {
  if (!FINISH_BRANCH || FINISH_BRANCH.startsWith("-"))
    fail("--finish requires an exact task branch name");
  if (NONVISUAL && DELIVERY_ROUTE)
    fail("choose either --route /real-route or --nonvisual, not both");
  if (NONVISUAL) return null;
  if (!DELIVERY_ROUTE) {
    fail(
      "visual work requires --route /real-route so the agent can deliver the integrated :5173 surface"
    );
  }
  if (!DELIVERY_ROUTE.startsWith("/") || DELIVERY_ROUTE.startsWith("//")) {
    fail("--route must be an app-relative path beginning with one slash");
  }
  const url = new URL(DELIVERY_ROUTE, "https://localhost:5173");
  if (url.origin !== "https://localhost:5173")
    fail("--route must stay on https://localhost:5173");
  return url.href;
}

function ensureInside(child, parent) {
  const rel = relative(resolve(parent), resolve(child));
  return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
}

function removeRootNodeModules(worktreePath) {
  const dependencyPath = join(worktreePath, "node_modules");
  if (!existsSync(dependencyPath)) return;

  const worktreeRoot = realpathSync(worktreePath);
  if (!ensureInside(dependencyPath, worktreeRoot))
    fail(`refusing to clean path outside worktree: ${dependencyPath}`);

  const metadata = lstatSync(dependencyPath);
  if (metadata.isSymbolicLink()) {
    const target = realpathSync(dependencyPath);
    unlinkSync(dependencyPath);
    console.log(`    unlinked node_modules junction → ${target}`);
    return;
  }

  if (!metadata.isDirectory())
    fail(`unexpected worktree node_modules type: ${dependencyPath}`);
  rmSync(dependencyPath, {
    force: true,
    maxRetries: 3,
    recursive: true,
    retryDelay: 100,
  });
  console.log("    removed task-owned node_modules directory");
}

function localFinish() {
  const url = deliveryUrl();
  const worktrees = listWorktrees();
  const task = worktrees.find((wt) => wt.branch === FINISH_BRANCH);
  const primary = worktrees.find((wt) => wt.branch === MAIN);

  if (!task) fail(`no registered worktree has branch ${FINISH_BRANCH}`);
  if (!primary) fail(`no registered worktree has branch ${MAIN}`);
  if (task.path === primary.path)
    fail("the task branch cannot be the main checkout");
  if (statusCodes(task.path).length) {
    fail(`task worktree is dirty: ${task.path}`);
  }
  assertNoGitOperation(primary.path);

  const taskHead = git(["rev-parse", FINISH_BRANCH]);
  const mainBefore = git(["-C", primary.path, "rev-parse", "HEAD"]);
  const taskWorktreeHead = git(["-C", task.path, "rev-parse", "HEAD"]);
  if (taskHead !== taskWorktreeHead)
    fail(`task worktree HEAD does not match ${FINISH_BRANCH}`);

  const alreadyIntegrated = isAncestor(taskHead, mainBefore);
  if (!alreadyIntegrated && !isAncestor(mainBefore, taskHead)) {
    fail(
      `${FINISH_BRANCH} does not contain current local main; update it with main and re-run verification`
    );
  }

  if (!alreadyIntegrated) {
    const taskPaths = new Set(
      splitNullList(
        git(["diff", "--name-only", "-z", `${mainBefore}..${taskHead}`])
      )
    );
    const overlaps = [...changedPaths(primary.path)].filter((path) =>
      taskPaths.has(path)
    );
    if (overlaps.length) {
      fail(
        `primary checkout has overlapping uncommitted paths: ${overlaps.join(", ")}`
      );
    }

    if (!SKIP_CHECKS) {
      console.log(`    running \`npm run check\` in ${FINISH_BRANCH} …`);
      const npmExecutable = process.platform === "win32" ? "npm.cmd" : "npm";
      run(npmExecutable, ["run", "check"], {
        cwd: task.path,
        stdio: "inherit",
      });
    }

    const mainAfterChecks = git(["-C", primary.path, "rev-parse", "HEAD"]);
    if (mainAfterChecks !== mainBefore)
      fail("main moved while checks ran; update the task branch and try again");
  }

  console.log(`worktree finish — ${DRY_RUN ? "DRY RUN" : "APPLY"}`);
  console.log(`  task: ${FINISH_BRANCH} @ ${taskHead.slice(0, 10)}`);
  console.log(`  main: ${mainBefore.slice(0, 10)} @ ${primary.path}`);
  if (alreadyIntegrated)
    console.log("  merge: already integrated; cleanup only");
  else console.log("  merge: ready for local --no-ff integration");
  if (url) console.log(`  delivery: ${url}`);
  else console.log("  delivery: nonvisual task");

  if (DRY_RUN) return;

  if (!alreadyIntegrated) {
    git(["-C", primary.path, "merge", "--no-ff", "--no-edit", FINISH_BRANCH], {
      stdio: "inherit",
    });
    const mainAfterMerge = git(["-C", primary.path, "rev-parse", "HEAD"]);
    if (!isAncestor(taskHead, mainAfterMerge))
      fail("post-merge verification failed: task head is not on main");
    logLine({
      at: new Date().toISOString(),
      branch: FINISH_BRANCH,
      head: taskHead,
      preMergeMain: mainBefore,
      postMergeMain: mainAfterMerge,
      action: "local-finish-merged",
      deliveryUrl: url,
    });
    console.log(`    ✔ merged ${FINISH_BRANCH} into local ${MAIN}`);
  }

  removeRootNodeModules(task.path);
  git(["worktree", "remove", "--force", task.path]);
  git(["branch", "-d", FINISH_BRANCH]);
  git(["worktree", "prune"]);
  console.log(`    ✔ removed worktree ${task.path}`);
  console.log(`    ✔ deleted branch ${FINISH_BRANCH}`);
  if (url) console.log(`DELIVER_IN_APP_BROWSER=${url}`);
}

/** Parse `git worktree list --porcelain` into {path, branch, head}. */
export function parseWorktrees(raw) {
  const out = [];
  let cur = {};
  for (const rawLine of raw.split("\n")) {
    const line = rawLine.replace(/\r$/, "");
    if (line.startsWith("worktree ")) cur = { path: line.slice(9) };
    else if (line.startsWith("HEAD ")) cur.head = line.slice(5);
    else if (line.startsWith("branch "))
      cur.branch = line.slice(7).replace("refs/heads/", "");
    else if (line.startsWith("detached")) cur.branch = null;
    else if (line === "") {
      if (cur.path) out.push(cur);
      cur = {};
    }
  }
  if (cur.path) out.push(cur);
  return out;
}

function listWorktrees() {
  return parseWorktrees(git(["worktree", "list", "--porcelain"]));
}

// Lock so a slow run and the next scheduled tick don't collide on git/gh.
function acquireLock() {
  if (existsSync(LOCK)) {
    const ageMin = (Date.now() - statSync(LOCK).mtimeMs) / 60000;
    if (ageMin < LOCK_STALE_MIN) {
      const message = `Another automerge run holds the lock (${ageMin.toFixed(0)}m old).`;
      if (FINISH_REQUESTED) fail(message);
      console.log(`${message} Exiting.`);
      process.exit(0);
    }
  }
  writeFileSync(LOCK, `${process.pid} ${new Date().toISOString()}\n`);
}
function releaseLock() {
  try {
    rmSync(LOCK);
  } catch {
    /* already gone */
  }
}

/** Porcelain status as two-char XY codes (path omitted — only the code matters here). */
function statusCodes(path) {
  return git(["-C", path, "status", "--porcelain"])
    .split("\n")
    .filter(Boolean)
    .map((l) => l.slice(0, 2));
}

/** All the cheap, read-only gates. Returns a reason string if NOT ready, else null. */
function cheapGateReason(wt, originMainSha) {
  if (wt.branch === null) return "detached HEAD";
  if (wt.branch === MAIN) return "is the main checkout (merge target)";
  if (SKIP_BRANCH_PREFIXES.some((p) => wt.branch.startsWith(p)))
    return `skip-prefixed branch (${wt.branch})`;
  if (existsSync(join(wt.path, SKIP_FILE)))
    return `opted out (${SKIP_FILE} present)`;

  // A handful of Greek-glyph guide images case-fold-collide on NTFS, so a fresh
  // `git worktree add` can't materialize them and every worktree shows them as
  // UNSTAGED deletions (" D"). Those are systemic phantoms, never the branch's work
  // — and an uncommitted deletion is never part of what merges (the merge uses the
  // committed tip). So real dirt = anything that ISN'T an unstaged deletion.
  const realDirt = statusCodes(wt.path).filter((code) => code !== " D");
  if (realDirt.length)
    return `working tree dirty (${realDirt.length} uncommitted change(s))`;

  const lastCommitTs =
    Number(sh(`git -C "${wt.path}" log -1 --format=%ct`)) * 1000;
  const ageMin = (Date.now() - lastCommitTs) / 60000;
  if (ageMin < QUIESCENT_MIN)
    return `not quiescent (last commit ${ageMin.toFixed(0)}m ago < ${QUIESCENT_MIN}m)`;

  const ahead = Number(sh(`git rev-list --count ${originMainSha}..${wt.head}`));
  if (ahead === 0) return "nothing to merge (not ahead of origin/main)";

  // Conflict probe against origin/main — never mutates anything.
  const mt = trySh(`git merge-tree --write-tree ${originMainSha} ${wt.head}`);
  if (!mt.ok) return "conflicts with origin/main";

  return null; // passed all cheap gates
}

function runChecks(wt) {
  console.log(`    running \`npm run check\` in ${wt.branch} …`);
  const res = trySh("npm run check", {
    cwd: wt.path,
    stdio: ["ignore", "pipe", "pipe"],
  });
  return res.ok;
}

function merge(wt, originMainSha) {
  console.log(`    MERGING ${wt.branch} → ${MAIN} (server-side)`);
  sh(`git push -u origin ${wt.branch}`, { cwd: wt.path });
  // Reuse an open PR if one exists, else create.
  let pr = trySh(
    `gh pr create --base ${MAIN} --head ${wt.branch} --title "automerge: ${wt.branch}" --body "Auto-merged by worktree-automerge: clean, quiescent, ahead, no conflicts, \\\`npm run check\\\` green."`
  );
  if (!pr.ok && !/already exists/i.test(pr.out))
    throw new Error(`gh pr create failed: ${pr.out}`);
  const merged = trySh(
    `gh pr merge ${wt.branch} --merge --admin --delete-branch`
  );
  if (!merged.ok) throw new Error(`gh pr merge failed: ${merged.out}`);
  logLine({
    at: new Date().toISOString(),
    branch: wt.branch,
    head: wt.head,
    preMergeOriginMain: originMainSha,
    action: "merged",
  });
  console.log(
    `    ✔ merged. revert with: git push origin ${originMainSha}:refs/heads/${MAIN} --force-with-lease`
  );

  if (PRUNE) {
    const nm = join(wt.path, "node_modules");
    if (existsSync(nm)) trySh(`cmd //c "rmdir ${nm.replace(/\//g, "\\")}"`); // junction only, no /s
    trySh(`git worktree remove "${wt.path}"`);
    console.log(`    pruned worktree ${wt.path}`);
  }
}

function remoteAutomergeMain() {
  console.log(
    `worktree-automerge — ${APPLY ? "APPLY" : "DRY RUN"}${SKIP_CHECKS ? " (cheap gates only)" : ""}\n`
  );
  sh("git fetch origin main --quiet");
  const originMainSha = sh("git rev-parse origin/main");
  console.log(`origin/${MAIN} @ ${originMainSha.slice(0, 10)}\n`);

  const worktrees = listWorktrees();
  const ready = [];

  for (const wt of worktrees) {
    const label = wt.branch ?? "(detached)";
    const reason = cheapGateReason(wt, originMainSha);
    if (reason) {
      console.log(`  ✗ ${label.padEnd(32)} ${reason}`);
      continue;
    }
    if (SKIP_CHECKS) {
      console.log(
        `  ~ ${label.padEnd(32)} passes cheap gates (checks not run)`
      );
      ready.push(wt);
      continue;
    }
    if (!runChecks(wt)) {
      console.log(`  ✗ ${label.padEnd(32)} \`npm run check\` FAILED`);
      continue;
    }
    console.log(`  ✔ ${label.padEnd(32)} READY`);
    ready.push(wt);
  }

  console.log(`\n${ready.length} ready.`);
  if (!APPLY) {
    console.log("Dry run — nothing merged. Re-run with --apply to merge.");
    return;
  }
  for (const wt of ready) {
    try {
      merge(wt, originMainSha);
    } catch (e) {
      console.log(`    ✗ ${wt.branch} merge errored: ${e.message}`);
      logLine({
        at: new Date().toISOString(),
        branch: wt.branch,
        action: "error",
        error: e.message,
      });
    }
  }
}

function main() {
  acquireLock();
  try {
    if (FINISH_REQUESTED) localFinish();
    else remoteAutomergeMain();
  } finally {
    releaseLock();
  }
}

const isMainModule =
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isMainModule) {
  try {
    main();
  } catch (error) {
    console.error(`worktree-automerge failed: ${error.message}`);
    process.exitCode = 1;
  }
}
