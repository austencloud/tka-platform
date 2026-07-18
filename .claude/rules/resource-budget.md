# Resource Budget — ENFORCED

## The Problem This Solves

2026-07-17 incident: the machine (32 GB RAM) hit 2.9 GB free and started paging.
Austen's dev server (:5173) served pages in 9–14 seconds at request concurrency
of 1 — pure memory starvation. The census: **7 concurrent vite dev servers**
(four of them leftovers on :5174/:5176/:5177/:5178 pointed at the main checkout,
abandoned after their verification loops ended), **a 5 GB `svelte-check`**
(ceiling 8 GB via `--max-old-space-size=8192`) running concurrently with a
second `npm run check`, 8 Claude sessions, and ~30 Chrome processes.

Worktrees were suspected first. Wrong target: only 2 of the 7 servers were in
worktrees, and the 5 GB check costs the same wherever it runs. Worktrees remain
mandatory (`worktree-workflow.md`). The real cost centers are **dev servers and
type-checks**, which agents spawn freely and never reap.

## The Rule

Before spawning anything heavy (vite server, `svelte-check`/`npm run check`,
full build), run the matching gate below. All gates use PowerShell — never Git
Bash for process queries (`CLAUDE.md` → Bash Gotchas).

### 1. Dev-server cap: reuse before you spawn

```powershell
Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.CommandLine -match 'vite\\bin\\vite\.js' } |
  Select-Object ProcessId, CommandLine
```

- `:5173` (`--host 0.0.0.0`) is Austen's. It never counts as yours and is never
  touched.
- If **2 or more agent servers** (anything ≠ :5173) are already running, do NOT
  start another. `curl` an existing one — any running server serves its
  checkout's current files, which is all read-only verification needs.
- Only spawn your own when your checkout genuinely isn't served (e.g. your
  worktree has no server) AND the free-RAM gate (#3) passes.

### 2. Reap what you spawn

A dev server you started is yours to kill. Before ending the turn in which
verification finished, `Stop-Process` it (kill the `npx` wrapper too — it
lingers as a parent). The four abandoned servers in the incident were exactly
this failure. A server left "in case I need it later" is a leak, not a
convenience.

### 3. Free-RAM gate before any heavy spawn

```powershell
(Get-Counter '\Memory\Available MBytes').CounterSamples[0].CookedValue
```

Under **4096 MB available**: do not spawn a new server, check, or build. Reuse
an existing server, wait for a running check to finish, or surface the
contention to Austen. (Use `Available MBytes`, not
`Win32_OperatingSystem.FreePhysicalMemory` — the latter excludes standby cache
and undercounts.)

### 4. One svelte-check machine-wide

`svelte-check` runs 5–8 GB. Before `npm run check` / `check:fast`:

```powershell
Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.CommandLine -match 'svelte-check' }
```

If one is already running — in ANY session, ANY worktree — wait for it instead
of starting a second. This is the cross-session extension of
`fast-iteration-loop.md`'s "one check per turn": that rule caps a session; this
one caps the machine.

## What this rule does NOT do

- It does not gate worktrees. Worktrees are directories; they cost nothing
  until a server or check runs inside them. `worktree-workflow.md` stands.
- It does not license killing OTHER sessions' processes. A live session's
  server or in-flight check belongs to that session; contention gets surfaced
  to Austen, not resolved by fratricide.

## Forbidden

- Spawning a vite server without the count check in the same turn.
- Ending a session/turn with a server you spawned still running.
- Starting a `svelte-check` while another is running anywhere on the machine.
- Any heavy spawn when available memory is under 4 GB.
- Killing `:5173` or another live session's processes to free budget.
- "Fixing" overload by avoiding worktrees — wrong lever; see incident above.

## Related

- `fast-iteration-loop.md` — capture-once-grep-many; one check per turn
- `worktree-workflow.md` — worktrees stay mandatory; own server on a free port
- `CLAUDE.md` → Dev Server (:5173 is Austen's), Bash Gotchas (no Git Bash
  process queries)
