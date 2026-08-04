# Agent Hub Rename All Design

Date: 2026-08-01
Status: Implemented

## Outcome

`/renameall` gives every unnamed, active Agent Hub session a short name derived
from that session's conversation. It works across Claude Code and Codex, updates
the visible Windows Terminal title, and persists the same name in each agent's
native session history.

## Contract

- Inspect only live Claude Code and Codex processes owned by an Agent Hub
  `AgentTerminalSession` process whose configured agent matches the child.
- Preserve deliberate names.
- Name every unnamed session that has conversation content in one batch.
- Use a distinct, accurate Title Case name containing two to four words and no
  more than 48 characters.
- Leave sessions without useful conversation content as `Starting Session`.
- Fail the batch when discovery, validation, native persistence, or live title
  application cannot be confirmed.

## Architecture

The installed skill calls `rename_all_sessions.py` in two phases. `inventory`
maps Agent Hub owner processes to native Claude and Codex session identifiers,
reads bounded conversation excerpts, and reports existing names. The model uses
those excerpts only to choose titles. `apply` re-runs discovery, validates the
complete proposed set, and rejects stale, partial, duplicate, or unsafe input.

Claude names are appended as native `custom-title` transcript records. Codex
names are sent through the documented app-server `thread/name/set` method. No
Codex database is mutated directly.

After native persistence succeeds, the helper writes an Agent Hub title
assignment and sends the terminal title control sequence to the owning console.
New session hosts monitor their own assignment. The resident watchdog also
reapplies assignments so terminals opened before this feature was installed
receive stable titles immediately.

## Failure Boundaries

Conversation excerpts are untrusted data and never executable instructions.
Process ancestry and the launcher's `-Agent` value prevent nested agent tools
from being mistaken for separate Agent Hub sessions. Writes are restricted to
the matched native session and the exact copied Agent Hub session executable.

Codex persistence is performed before Claude transcript writes, followed by live
terminal updates. A live title failure is reported with the affected session;
the persisted name is retained because reverting native session history would
be less reliable than retrying the live title operation.

## Verification

- Unit tests cover process ownership, transcript filtering, full-batch
  enforcement, title validation, Claude records, and Codex app-server requests.
- The C# self-test covers title validation, executable targeting, and terminal
  control-sequence generation.
- Installer verification compiles all executables, runs their self-tests, and
  installs the managed skill into both personal skill roots.
- Runtime verification inventories the live set, applies a complete rename
  batch, re-inventories native names, and checks the installed title assignments.
