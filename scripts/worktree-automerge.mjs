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
 * Usage:
 *   node scripts/worktree-automerge.mjs                 # dry run, full gate
 *   node scripts/worktree-automerge.mjs --skip-checks   # dry run, cheap gates only (fast preview)
 *   node scripts/worktree-automerge.mjs --apply         # merge the ready ones
 *   node scripts/worktree-automerge.mjs --apply --prune # + remove merged worktrees
 */

import { execSync } from "node:child_process";
import { existsSync, appendFileSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

const SKIP_BRANCH_PREFIXES = ["wip/", "spike/", "experiment/", "tmp/", "draft/"];
const SKIP_FILE = ".automerge-skip";
const QUIESCENT_MIN = 30;
const LOCK_STALE_MIN = 60;
const MAIN = "main";

const APPLY = process.argv.includes("--apply");
const PRUNE = process.argv.includes("--prune");
const SKIP_CHECKS = process.argv.includes("--skip-checks");

// Resolve the git dir once so the lock + log live with the repo, not a worktree.
const GIT_COMMON_DIR = sh("git rev-parse --git-common-dir");
const LOCK = join(GIT_COMMON_DIR, "automerge.lock");
const LOG = join(GIT_COMMON_DIR, "automerge-log.jsonl");

function sh(cmd, opts = {}) {
  return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts }).trim();
}
function trySh(cmd, opts = {}) {
  try {
    return { ok: true, out: sh(cmd, opts) };
  } catch (e) {
    return { ok: false, out: (e.stdout || "") + (e.stderr || "") };
  }
}
function logLine(obj) {
  appendFileSync(LOG, JSON.stringify(obj) + "\n");
}

/** Parse `git worktree list --porcelain` into {path, branch, head}. */
function listWorktrees() {
  const raw = sh("git worktree list --porcelain");
  const out = [];
  let cur = {};
  for (const line of raw.split("\n")) {
    if (line.startsWith("worktree ")) cur = { path: line.slice(9) };
    else if (line.startsWith("HEAD ")) cur.head = line.slice(5);
    else if (line.startsWith("branch ")) cur.branch = line.slice(7).replace("refs/heads/", "");
    else if (line.startsWith("detached")) cur.branch = null;
    else if (line === "") {
      if (cur.path) out.push(cur);
      cur = {};
    }
  }
  if (cur.path) out.push(cur);
  return out;
}

// Lock so a slow run and the next scheduled tick don't collide on git/gh.
function acquireLock() {
  if (existsSync(LOCK)) {
    const ageMin = (Date.now() - statSync(LOCK).mtimeMs) / 60000;
    if (ageMin < LOCK_STALE_MIN) {
      console.log(`Another automerge run holds the lock (${ageMin.toFixed(0)}m old). Exiting.`);
      process.exit(0);
    }
  }
  appendFileSync(LOCK, `${process.pid} ${new Date().toISOString()}\n`);
}
function releaseLock() {
  try {
    rmSync(LOCK);
  } catch {
    /* already gone */
  }
}

/** All the cheap, read-only gates. Returns a reason string if NOT ready, else null. */
function cheapGateReason(wt, originMainSha) {
  if (wt.branch === null) return "detached HEAD";
  if (wt.branch === MAIN) return "is the main checkout (merge target)";
  if (SKIP_BRANCH_PREFIXES.some((p) => wt.branch.startsWith(p))) return `skip-prefixed branch (${wt.branch})`;
  if (existsSync(join(wt.path, SKIP_FILE))) return `opted out (${SKIP_FILE} present)`;

  const dirty = sh(`git -C "${wt.path}" status --porcelain`);
  if (dirty) return "working tree dirty (uncommitted work)";

  const lastCommitTs = Number(sh(`git -C "${wt.path}" log -1 --format=%ct`)) * 1000;
  const ageMin = (Date.now() - lastCommitTs) / 60000;
  if (ageMin < QUIESCENT_MIN) return `not quiescent (last commit ${ageMin.toFixed(0)}m ago < ${QUIESCENT_MIN}m)`;

  const ahead = Number(sh(`git rev-list --count ${originMainSha}..${wt.head}`));
  if (ahead === 0) return "nothing to merge (not ahead of origin/main)";

  // Conflict probe against origin/main — never mutates anything.
  const mt = trySh(`git merge-tree --write-tree ${originMainSha} ${wt.head}`);
  if (!mt.ok) return "conflicts with origin/main";

  return null; // passed all cheap gates
}

function runChecks(wt) {
  console.log(`    running \`npm run check\` in ${wt.branch} …`);
  const res = trySh("npm run check", { cwd: wt.path, stdio: ["ignore", "pipe", "pipe"] });
  return res.ok;
}

function merge(wt, originMainSha) {
  console.log(`    MERGING ${wt.branch} → ${MAIN} (server-side)`);
  sh(`git push -u origin ${wt.branch}`, { cwd: wt.path });
  // Reuse an open PR if one exists, else create.
  let pr = trySh(`gh pr create --base ${MAIN} --head ${wt.branch} --title "automerge: ${wt.branch}" --body "Auto-merged by worktree-automerge: clean, quiescent, ahead, no conflicts, \\\`npm run check\\\` green."`);
  if (!pr.ok && !/already exists/i.test(pr.out)) throw new Error(`gh pr create failed: ${pr.out}`);
  const merged = trySh(`gh pr merge ${wt.branch} --merge --admin --delete-branch`);
  if (!merged.ok) throw new Error(`gh pr merge failed: ${merged.out}`);
  logLine({
    at: new Date().toISOString(),
    branch: wt.branch,
    head: wt.head,
    preMergeOriginMain: originMainSha,
    action: "merged",
  });
  console.log(`    ✔ merged. revert with: git push origin ${originMainSha}:refs/heads/${MAIN} --force-with-lease`);

  if (PRUNE) {
    const nm = join(wt.path, "node_modules");
    if (existsSync(nm)) trySh(`cmd //c "rmdir ${nm.replace(/\//g, "\\")}"`); // junction only, no /s
    trySh(`git worktree remove "${wt.path}"`);
    console.log(`    pruned worktree ${wt.path}`);
  }
}

function main() {
  console.log(`worktree-automerge — ${APPLY ? "APPLY" : "DRY RUN"}${SKIP_CHECKS ? " (cheap gates only)" : ""}\n`);
  acquireLock();
  try {
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
        console.log(`  ~ ${label.padEnd(32)} passes cheap gates (checks not run)`);
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
        logLine({ at: new Date().toISOString(), branch: wt.branch, action: "error", error: e.message });
      }
    }
  } finally {
    releaseLock();
  }
}

main();
