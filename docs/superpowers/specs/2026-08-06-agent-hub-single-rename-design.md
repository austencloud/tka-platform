# Agent Hub Single Rename Design

Date: 2026-08-06
Status: Implemented

## Outcome

Claude's `/rename` targets the current Agent Hub session through its stable
owner process ID. It no longer depends on a stored name matching a visible
window title, and it does not synthesize keyboard input.

Codex keeps its native `/rename` implementation. No rename skill shadows that
path.

## Contract

- Accept a two-to-four-word title that passes the shared Agent Hub validator.
- Identify exactly one live Claude session owned by the inherited
  `TKA_AGENT_TERMINAL_SESSION_PID`.
- Verify that owner process is an ancestor of the running rename helper.
- Append Claude's native `custom-title` transcript record.
- Apply the same title to that owner's live terminal through
  `AgentTerminalSession.exe`.
- Re-inventory the session and fail unless the persisted title matches.
- Never use the session registry's derived `name` as a window locator.
- Never focus a window, clear draft input, send keystrokes, or ask the user to
  paste `/name`.

## Reuse

The single-session helper imports the installed `/renameall` implementation for
process discovery, title validation, Claude persistence, live title updates,
and verification. The wrapper adds only current-owner selection and permits a
deliberate rename of an already named session.

## Failure Boundaries

The helper stops when it is not running under Agent Hub, when the inherited
owner PID is outside the helper's ancestry, when the owner does not map to
exactly one Claude session, or when persistence cannot be confirmed. A
live-title failure can occur after Claude's native title record
has been appended. Re-running `/rename` safely reapplies the same title without
adding a duplicate record.

## Verification

- Unit tests cover stale registry names, exact owner selection, ancestry
  enforcement, idempotent reapplication, invalid inherited PIDs, and failed
  persistence verification.
- Skill validation checks both managed skill folders.
- Runtime inventory confirms that the installed helper resolves the live Agent
  Hub process set without title matching.
