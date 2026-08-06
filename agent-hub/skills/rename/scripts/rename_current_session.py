from __future__ import annotations

import argparse
import importlib.util
import json
import os
import sys
from pathlib import Path
from types import ModuleType
from typing import Any


class CurrentRenameError(RuntimeError):
    pass


def renameall_script_path() -> Path:
    return Path(__file__).resolve().parents[2] / "renameall" / "scripts" / "rename_all_sessions.py"


def load_renameall_module(path: Path | None = None) -> ModuleType:
    source = path or renameall_script_path()
    if not source.is_file():
        raise CurrentRenameError(f"Agent Hub's rename helper is missing: {source}")
    spec = importlib.util.spec_from_file_location("agent_hub_renameall", source)
    if spec is None or spec.loader is None:
        raise CurrentRenameError(f"Could not load Agent Hub's rename helper: {source}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def owner_pid_from_environment(environment: dict[str, str] | None = None) -> int:
    source = os.environ if environment is None else environment
    raw = source.get("TKA_AGENT_TERMINAL_SESSION_PID", "")
    try:
        owner_pid = int(raw)
    except ValueError as error:
        raise CurrentRenameError(
            "This session has no valid Agent Hub owner PID. Launch Claude through Agent Hub."
        ) from error
    if owner_pid <= 0:
        raise CurrentRenameError(
            "This session has no valid Agent Hub owner PID. Launch Claude through Agent Hub."
        )
    return owner_pid


def current_claude_session(sessions: list[Any], owner_pid: int) -> Any:
    matches = [
        session
        for session in sessions
        if session.agent == "claude" and session.owner_pid == owner_pid
    ]
    if len(matches) != 1:
        raise CurrentRenameError(
            f"Expected one live Claude session for Agent Hub owner {owner_pid}; found {len(matches)}."
        )
    return matches[0]


def require_owner_ancestor(processes: list[Any], current_pid: int, owner_pid: int) -> None:
    process_by_id = {process.pid: process for process in processes}
    current = process_by_id.get(current_pid)
    seen: set[int] = set()
    for _ in range(64):
        if current is None or current.pid in seen:
            break
        if current.pid == owner_pid:
            return
        seen.add(current.pid)
        current = process_by_id.get(current.parent_pid)
    raise CurrentRenameError(
        f"Agent Hub owner {owner_pid} is not an ancestor of rename helper {current_pid}."
    )


def rename_current_session(
    owner_pid: int,
    title: str,
    renameall: ModuleType,
    current_pid: int | None = None,
) -> dict[str, Any]:
    normalized = renameall.normalize_title(title)
    processes = renameall.powershell_processes()
    helper_pid = os.getpid() if current_pid is None else current_pid
    require_owner_ancestor(processes, helper_pid, owner_pid)
    session = current_claude_session(
        renameall.discover_live_sessions(processes=processes), owner_pid
    )
    previous_name = session.current_name

    if previous_name != normalized:
        renameall.append_claude_title(session, normalized)
    renameall.apply_live_title(session, normalized)

    verified = current_claude_session(
        renameall.discover_live_sessions(processes=processes), owner_pid
    )
    if verified.current_name != normalized:
        raise CurrentRenameError(
            f"Claude persisted {verified.current_name!r} instead of {normalized!r}."
        )

    return {
        "agent": "claude",
        "name": normalized,
        "ownerPid": owner_pid,
        "previousName": previous_name,
        "sessionId": session.session_id,
    }


def parse_arguments(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Rename the current Agent Hub Claude session."
    )
    parser.add_argument("--title", required=True)
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    arguments = parse_arguments(sys.argv[1:] if argv is None else argv)
    renameall: ModuleType | None = None
    try:
        renameall = load_renameall_module()
        result = rename_current_session(
            owner_pid_from_environment(),
            arguments.title,
            renameall,
        )
    except CurrentRenameError as error:
        print(f"rename failed: {error}", file=sys.stderr)
        return 1
    except Exception as error:
        if renameall is None or not isinstance(error, renameall.RenameAllError):
            raise
        print(f"rename failed: {error}", file=sys.stderr)
        return 1
    print(json.dumps(result, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
