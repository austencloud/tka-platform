import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const SCRIPT = join(process.cwd(), "scripts", "worktree-automerge.mjs");
const BRANCH = "codex/test-finish";

function git(cwd: string, ...args: string[]) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

describe("worktree finish lifecycle", () => {
  let root: string;
  let repo: string;
  let task: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "tka-worktree-finish-"));
    repo = join(root, "repo");
    task = join(root, "task");
    mkdirSync(repo);

    git(repo, "init", "-b", "main");
    git(repo, "config", "user.email", "worktree-test@example.com");
    git(repo, "config", "user.name", "Worktree Test");
    git(repo, "config", "core.autocrlf", "false");
    writeFileSync(join(repo, ".gitignore"), "node_modules/\n");
    writeFileSync(join(repo, "shared.txt"), "base\n");
    git(repo, "add", ".gitignore", "shared.txt");
    git(repo, "commit", "-m", "base");
    git(repo, "branch", BRANCH);
    git(repo, "worktree", "add", task, BRANCH);
  });

  afterEach(() => {
    rmSync(root, {
      force: true,
      maxRetries: 3,
      recursive: true,
      retryDelay: 100,
    });
  });

  function commitTaskFile(path: string, contents: string) {
    writeFileSync(join(task, path), contents);
    git(task, "add", path);
    git(task, "commit", "-m", `change ${path}`);
  }

  function finish(...extraArgs: string[]) {
    return spawnSync(
      process.execPath,
      [
        SCRIPT,
        "--finish",
        BRANCH,
        "--nonvisual",
        "--skip-checks",
        ...extraArgs,
      ],
      { cwd: repo, encoding: "utf8" }
    );
  }

  it("merges to local main, preserves unrelated dirt, and removes the task worktree and branch", () => {
    commitTaskFile("feature.txt", "finished\n");
    writeFileSync(join(repo, "local-note.txt"), "keep me\n");
    mkdirSync(join(task, "node_modules", "cache"), { recursive: true });
    writeFileSync(join(task, "node_modules", "cache", "artifact"), "ignored\n");

    const result = finish();

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(readFileSync(join(repo, "feature.txt"), "utf8")).toBe("finished\n");
    expect(readFileSync(join(repo, "local-note.txt"), "utf8")).toBe(
      "keep me\n"
    );
    expect(existsSync(task)).toBe(false);
    expect(
      spawnSync("git", ["show-ref", "--verify", `refs/heads/${BRANCH}`], {
        cwd: repo,
      }).status
    ).not.toBe(0);
    expect(git(repo, "log", "-1", "--format=%P").split(" ")).toHaveLength(2);
  });

  it("blocks overlapping primary-checkout edits without removing anything", () => {
    commitTaskFile("shared.txt", "task version\n");
    writeFileSync(join(repo, "shared.txt"), "primary version\n");
    const mainBefore = git(repo, "rev-parse", "HEAD");

    const result = finish();

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "overlapping uncommitted paths: shared.txt"
    );
    expect(git(repo, "rev-parse", "HEAD")).toBe(mainBefore);
    expect(readFileSync(join(repo, "shared.txt"), "utf8")).toBe(
      "primary version\n"
    );
    expect(existsSync(task)).toBe(true);
    expect(git(repo, "show-ref", "--verify", `refs/heads/${BRANCH}`)).toContain(
      BRANCH
    );
  });

  it("blocks a branch that does not contain current local main", () => {
    commitTaskFile("feature.txt", "task version\n");
    writeFileSync(join(repo, "main-only.txt"), "main moved\n");
    git(repo, "add", "main-only.txt");
    git(repo, "commit", "-m", "advance main");
    const mainBefore = git(repo, "rev-parse", "HEAD");

    const result = finish();

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("does not contain current local main");
    expect(git(repo, "rev-parse", "HEAD")).toBe(mainBefore);
    expect(existsSync(task)).toBe(true);
    expect(git(repo, "show-ref", "--verify", `refs/heads/${BRANCH}`)).toContain(
      BRANCH
    );
  });

  it("blocks any uncommitted task deletion and preserves the worktree", () => {
    commitTaskFile("feature.txt", "committed\n");
    rmSync(join(task, "feature.txt"));
    const mainBefore = git(repo, "rev-parse", "HEAD");

    const result = finish();

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("task worktree is dirty");
    expect(git(repo, "rev-parse", "HEAD")).toBe(mainBefore);
    expect(existsSync(task)).toBe(true);
    expect(git(repo, "show-ref", "--verify", `refs/heads/${BRANCH}`)).toContain(
      BRANCH
    );
  });

  it("requires a real :5173 route unless the task is explicitly nonvisual", () => {
    const result = spawnSync(
      process.execPath,
      [SCRIPT, "--finish", BRANCH, "--skip-checks"],
      { cwd: repo, encoding: "utf8" }
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("visual work requires --route /real-route");
    expect(existsSync(task)).toBe(true);
  });
});
