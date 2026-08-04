#!/usr/bin/env python3
"""Inventory and name live Agent Hub Claude and Codex sessions."""

from __future__ import annotations

import argparse
import dataclasses
import datetime as dt
import glob
import json
import os
import queue
import re
import shutil
import sqlite3
import subprocess
import sys
import threading
import time
from pathlib import Path
from typing import Any, Iterable


SESSION_ID_PATTERN = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    re.IGNORECASE,
)
SESSION_PROCESS_PATTERN = re.compile(
    r"^AgentTerminalSession-[0-9a-f]{32}\.exe$", re.IGNORECASE
)
CONTINUATION_MESSAGES = {
    "confirm",
    "continue",
    "full send",
    "get er done",
    "go",
    "keep going",
    "proceed",
    "yes",
}
MAX_EXCERPT_CHARS = 600
MAX_TITLE_CHARS = 48


class RenameAllError(RuntimeError):
    pass


@dataclasses.dataclass(frozen=True)
class ProcessRecord:
    pid: int
    parent_pid: int
    name: str
    command_line: str


@dataclasses.dataclass
class LiveSession:
    agent: str
    agent_pid: int
    owner_pid: int
    project: str
    session_id: str
    transcript_path: Path | None
    current_name: str | None
    topic_messages: list[str]

    @property
    def key(self) -> str:
        return f"{self.agent}:{self.session_id}"

    @property
    def status(self) -> str:
        if self.current_name:
            return "named"
        if self.topic_messages:
            return "needs-name"
        return "no-content"

    def public_dict(self) -> dict[str, Any]:
        return {
            "key": self.key,
            "agent": self.agent,
            "sessionId": self.session_id,
            "ownerPid": self.owner_pid,
            "project": self.project,
            "currentName": self.current_name,
            "status": self.status,
            "topicMessages": self.topic_messages,
        }


def powershell_processes() -> list[ProcessRecord]:
    command = (
        "Get-CimInstance Win32_Process | "
        "Select-Object ProcessId,ParentProcessId,Name,CommandLine | "
        "ConvertTo-Json -Compress -Depth 3"
    )
    completed = subprocess.run(
        [
            "powershell.exe",
            "-NoLogo",
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            command,
        ],
        check=False,
        capture_output=True,
        encoding="utf-8-sig",
        timeout=20,
    )
    if completed.returncode != 0:
        detail = completed.stderr.strip() or completed.stdout.strip()
        raise RenameAllError(f"Could not inspect live Agent Hub sessions: {detail}")
    try:
        raw = json.loads(completed.stdout)
    except json.JSONDecodeError as error:
        raise RenameAllError("Windows returned invalid process inventory JSON.") from error
    if isinstance(raw, dict):
        raw = [raw]
    return [
        ProcessRecord(
            pid=int(item["ProcessId"]),
            parent_pid=int(item.get("ParentProcessId") or 0),
            name=str(item.get("Name") or ""),
            command_line=str(item.get("CommandLine") or ""),
        )
        for item in raw or []
    ]


def find_owner(process: ProcessRecord, process_by_id: dict[int, ProcessRecord]) -> ProcessRecord | None:
    current: ProcessRecord | None = process
    seen: set[int] = set()
    for _ in range(12):
        if current is None or current.pid in seen:
            break
        seen.add(current.pid)
        if SESSION_PROCESS_PATTERN.fullmatch(current.name):
            return current
        current = process_by_id.get(current.parent_pid)
    return None


def project_from_owner(owner: ProcessRecord) -> str | None:
    quoted = re.search(r'(?i)(?:^|\s)-Project\s+"([^"]+)"', owner.command_line)
    if quoted:
        return quoted.group(1)
    plain = re.search(
        r"(?i)(?:^|\s)-Project\s+(.+?)(?=\s+-Bat(?:\s|$)|\s+-Executable(?:\s|$)|$)",
        owner.command_line,
    )
    return plain.group(1).strip().strip('"') if plain else None


def agent_from_owner(owner: ProcessRecord) -> str | None:
    match = re.search(r"(?i)(?:^|\s)-Agent\s+(claude|codex)(?:\s|$)", owner.command_line)
    return match.group(1).lower() if match else None


def sqlite_read_only(path: Path) -> sqlite3.Connection:
    return sqlite3.connect(f"file:{path.as_posix()}?mode=ro", uri=True, timeout=5)


def codex_session_ids(process_ids: Iterable[int], codex_home: Path) -> dict[int, str]:
    ids = list(process_ids)
    database = codex_home / "logs_2.sqlite"
    if not ids or not database.is_file():
        return {}
    result: dict[int, str] = {}
    connection = sqlite_read_only(database)
    try:
        for pid in ids:
            process_row = connection.execute(
                """
                SELECT process_uuid
                FROM logs
                WHERE process_uuid LIKE ?
                GROUP BY process_uuid
                ORDER BY MAX(ts) DESC, MAX(ts_nanos) DESC
                LIMIT 1
                """,
                (f"pid:{pid}:%",),
            ).fetchone()
            if process_row is None:
                continue
            session_row = connection.execute(
                """
                SELECT thread_id
                FROM logs
                WHERE process_uuid = ? AND thread_id IS NOT NULL
                GROUP BY thread_id
                ORDER BY COUNT(*) DESC, MIN(ts) ASC, MIN(ts_nanos) ASC
                LIMIT 1
                """,
                (process_row[0],),
            ).fetchone()
            if session_row and SESSION_ID_PATTERN.fullmatch(str(session_row[0])):
                result[pid] = str(session_row[0]).lower()
    finally:
        connection.close()
    return result


def codex_explicit_names(session_ids: Iterable[str], codex_home: Path) -> dict[str, str | None]:
    wanted = {session_id.lower() for session_id in session_ids}
    if not wanted:
        return {}
    index_path = codex_home / "session_index.jsonl"
    if not index_path.is_file():
        return {}
    names: dict[str, str | None] = {}
    for record in read_json_lines(index_path):
        session_id = str(record.get("id") or "").lower()
        if session_id in wanted:
            names[session_id] = clean_name(record.get("thread_name"))
    return names


def codex_thread_rows(session_ids: Iterable[str], codex_home: Path) -> dict[str, tuple[Path, str | None]]:
    ids = list(session_ids)
    database = codex_home / "state_5.sqlite"
    if not ids or not database.is_file():
        return {}
    placeholders = ",".join("?" for _ in ids)
    connection = sqlite_read_only(database)
    try:
        columns = {
            str(row[1]) for row in connection.execute("PRAGMA table_info(threads)").fetchall()
        }
        history_expression = "history_mode" if "history_mode" in columns else "NULL"
        rows = connection.execute(
            f"SELECT id, rollout_path, name, {history_expression} "
            f"FROM threads WHERE id IN ({placeholders})",
            ids,
        ).fetchall()
    finally:
        connection.close()
    legacy_names = codex_explicit_names(
        [str(row[0]) for row in rows if str(row[3] or "").lower() == "legacy"],
        codex_home,
    )
    return {
        str(thread_id).lower(): (
            Path(str(rollout_path)),
            legacy_names.get(str(thread_id).lower())
            if str(history_mode or "").lower() == "legacy"
            else clean_name(name),
        )
        for thread_id, rollout_path, name, history_mode in rows
    }


def clean_name(value: Any) -> str | None:
    if value is None:
        return None
    normalized = " ".join(str(value).split())
    return normalized or None


def read_json_lines(path: Path) -> Iterable[dict[str, Any]]:
    try:
        with path.open("r", encoding="utf-8-sig", errors="replace") as stream:
            for line in stream:
                try:
                    record = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if isinstance(record, dict):
                    yield record
    except OSError as error:
        raise RenameAllError(f"Could not read session transcript {path}: {error}") from error


def flatten_text(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict) and item.get("type") in {"text", "input_text"}:
                text = item.get("text")
                if isinstance(text, str):
                    parts.append(text)
        return "\n".join(parts)
    return ""


def is_context_noise(text: str) -> bool:
    stripped = text.lstrip()
    return stripped.startswith(
        (
            "# AGENTS.md instructions for ",
            "<environment_context>",
            "<permissions instructions>",
            "<collaboration_mode>",
            "<command-name>",
            "<command-message>",
            "<local-command-",
            "<task-notification>",
        )
    )


def normalize_excerpt(text: str) -> str | None:
    normalized = " ".join(text.split())
    if not normalized or is_context_noise(normalized):
        return None
    if re.fullmatch(r"[/$][A-Za-z0-9_-]+", normalized):
        return None
    if normalized.casefold() in CONTINUATION_MESSAGES:
        return None
    if len(normalized) > MAX_EXCERPT_CHARS:
        normalized = normalized[: MAX_EXCERPT_CHARS - 1].rstrip() + "…"
    return normalized


def topic_messages(messages: Iterable[str]) -> list[str]:
    meaningful: list[str] = []
    for message in messages:
        excerpt = normalize_excerpt(message)
        if excerpt and excerpt not in meaningful:
            meaningful.append(excerpt)
    if len(meaningful) <= 4:
        return meaningful
    return meaningful[:2] + meaningful[-2:]


def claude_transcript_data(path: Path) -> tuple[str | None, list[str]]:
    current_name: str | None = None
    messages: list[str] = []
    assistant_messages: list[str] = []
    ai_title: str | None = None
    for record in read_json_lines(path):
        if record.get("type") == "custom-title":
            current_name = clean_name(record.get("customTitle"))
            continue
        if record.get("type") == "ai-title":
            ai_title = clean_name(record.get("aiTitle"))
            continue
        if record.get("type") == "assistant" and record.get("isSidechain") is not True:
            assistant_message = record.get("message")
            if isinstance(assistant_message, dict):
                assistant_text = flatten_text(assistant_message.get("content"))
                if assistant_text:
                    assistant_messages.append(assistant_text)
            continue
        if (
            record.get("type") != "user"
            or record.get("isMeta") is True
            or record.get("isSidechain") is True
            or "sourceToolAssistantUUID" in record
            or "sourceToolUseID" in record
        ):
            continue
        message = record.get("message")
        if isinstance(message, dict):
            text = flatten_text(message.get("content"))
            if text:
                messages.append(text)
    topics = topic_messages(messages)
    if not topics and ai_title:
        topics = [ai_title]
    if not topics:
        topics = topic_messages(assistant_messages[-4:])
    return current_name, topics


def codex_transcript_messages(path: Path) -> list[str]:
    messages: list[str] = []
    for record in read_json_lines(path):
        if record.get("type") != "event_msg":
            continue
        payload = record.get("payload")
        if isinstance(payload, dict) and payload.get("type") == "user_message":
            message = payload.get("message")
            if isinstance(message, str):
                messages.append(message)
    return topic_messages(messages)


def find_claude_transcript(claude_home: Path, session_id: str) -> Path | None:
    matches = glob.glob(str(claude_home / "projects" / "*" / f"{session_id}.jsonl"))
    return Path(matches[0]) if matches else None


def find_codex_transcript(codex_home: Path, session_id: str) -> Path | None:
    matches = glob.glob(
        str(codex_home / "sessions" / "**" / f"rollout-*{session_id}.jsonl"),
        recursive=True,
    )
    return Path(matches[0]) if matches else None


def discover_live_sessions(
    processes: list[ProcessRecord] | None = None,
    claude_home: Path | None = None,
    codex_home: Path | None = None,
) -> list[LiveSession]:
    processes = processes if processes is not None else powershell_processes()
    claude_home = claude_home or Path.home() / ".claude"
    codex_home = codex_home or Path.home() / ".codex"
    process_by_id = {process.pid: process for process in processes}

    candidates: list[tuple[str, ProcessRecord, ProcessRecord, str]] = []
    for process in processes:
        lowered = process.name.lower()
        if lowered == "claude.exe":
            agent = "claude"
        elif lowered in {"codex.exe", "codex-tka.exe"}:
            agent = "codex"
        else:
            continue
        owner = find_owner(process, process_by_id)
        if owner is None:
            continue
        if agent_from_owner(owner) != agent:
            continue
        project = project_from_owner(owner)
        if project:
            candidates.append((agent, process, owner, project))

    unresolved_codex = [
        process.pid
        for agent, process, _, _ in candidates
        if agent == "codex"
        and not re.search(r"(?i)(?:^|\s)resume\s+([0-9a-f-]{36})(?:\s|$)", process.command_line)
    ]
    mapped_codex = codex_session_ids(unresolved_codex, codex_home)

    identities: list[tuple[str, ProcessRecord, ProcessRecord, str, str]] = []
    for agent, process, owner, project in candidates:
        session_id: str | None = None
        if agent == "codex":
            resumed = re.search(
                r"(?i)(?:^|\s)resume\s+([0-9a-f-]{36})(?:\s|$)", process.command_line
            )
            session_id = resumed.group(1).lower() if resumed else mapped_codex.get(process.pid)
        else:
            metadata_path = claude_home / "sessions" / f"{process.pid}.json"
            try:
                metadata = json.loads(metadata_path.read_text(encoding="utf-8-sig"))
                session_id = str(metadata.get("sessionId") or "").lower()
                project = str(metadata.get("cwd") or project)
            except (OSError, json.JSONDecodeError):
                session_id = None
        if session_id and SESSION_ID_PATTERN.fullmatch(session_id):
            identities.append((agent, process, owner, project, session_id))

    codex_rows = codex_thread_rows(
        [identity[4] for identity in identities if identity[0] == "codex"], codex_home
    )
    sessions: list[LiveSession] = []
    seen: set[str] = set()
    for agent, process, owner, project, session_id in identities:
        key = f"{agent}:{session_id}"
        if key in seen:
            continue
        seen.add(key)
        if agent == "claude":
            transcript = find_claude_transcript(claude_home, session_id)
            current_name, messages = (
                claude_transcript_data(transcript) if transcript else (None, [])
            )
        else:
            row = codex_rows.get(session_id)
            transcript = row[0] if row and row[0].is_file() else find_codex_transcript(codex_home, session_id)
            current_name = row[1] if row else None
            messages = codex_transcript_messages(transcript) if transcript else []
        sessions.append(
            LiveSession(
                agent=agent,
                agent_pid=process.pid,
                owner_pid=owner.pid,
                project=project,
                session_id=session_id,
                transcript_path=transcript,
                current_name=current_name,
                topic_messages=messages,
            )
        )
    return sorted(sessions, key=lambda session: (session.agent, session.session_id))


def normalize_title(value: str) -> str:
    if any(ord(character) < 32 or ord(character) == 127 for character in value):
        raise RenameAllError("Session titles cannot contain control characters.")
    normalized = " ".join(value.split())
    words = normalized.split(" ") if normalized else []
    if not 2 <= len(words) <= 4:
        raise RenameAllError(f"Session title must contain two to four words: {value!r}")
    if len(normalized) > MAX_TITLE_CHARS:
        raise RenameAllError(
            f"Session title cannot exceed {MAX_TITLE_CHARS} characters: {value!r}"
        )
    return normalized


def parse_rename(value: str) -> tuple[str, str]:
    key, separator, title = value.partition("=")
    if not separator:
        raise RenameAllError("Each --rename value must use agent:session-id=Title.")
    agent, separator, session_id = key.partition(":")
    if (
        not separator
        or agent not in {"claude", "codex"}
        or not SESSION_ID_PATTERN.fullmatch(session_id)
    ):
        raise RenameAllError(f"Invalid live session key: {key!r}")
    return f"{agent}:{session_id.lower()}", normalize_title(title)


def append_claude_title(session: LiveSession, title: str) -> None:
    if session.transcript_path is None:
        raise RenameAllError(f"Claude transcript is missing for {session.key}.")
    record = {
        "type": "custom-title",
        "customTitle": title,
        "sessionId": session.session_id,
    }
    encoded = (json.dumps(record, separators=(",", ":"), ensure_ascii=False) + "\n").encode(
        "utf-8"
    )
    try:
        descriptor = os.open(session.transcript_path, os.O_APPEND | os.O_WRONLY)
        try:
            os.write(descriptor, encoded)
        finally:
            os.close(descriptor)
    except OSError as error:
        raise RenameAllError(f"Could not persist Claude title for {session.key}: {error}") from error


def resolve_codex_executable(explicit: str | None = None) -> str:
    candidates = [
        explicit,
        os.environ.get("TKA_CODEX"),
        str(Path(os.environ.get("LOCALAPPDATA", "")) / "TKA" / "codex-tka" / "bin" / "codex-tka.exe"),
        shutil.which("codex.exe"),
        shutil.which("codex"),
    ]
    for candidate in candidates:
        if candidate and Path(candidate).is_file():
            return str(Path(candidate).resolve())
    raise RenameAllError("Could not find a Codex executable for thread/name/set.")


def codex_title_requests(
    renames: list[tuple[LiveSession, str]],
) -> tuple[list[dict[str, Any]], dict[int, str]]:
    requests: list[dict[str, Any]] = [
        {
            "method": "initialize",
            "id": 1,
            "params": {
                "clientInfo": {
                    "name": "agent_hub_renameall",
                    "title": "Agent Hub Rename All",
                    "version": "1.0.0",
                }
            },
        },
        {"method": "initialized", "params": {}},
    ]
    request_ids: dict[int, str] = {}
    for index, (session, title) in enumerate(renames, start=100):
        request_ids[index] = session.key
        requests.append(
            {
                "method": "thread/name/set",
                "id": index,
                "params": {"threadId": session.session_id, "name": title},
            }
        )
    return requests, request_ids


def persist_codex_titles(renames: list[tuple[LiveSession, str]], executable: str) -> None:
    if not renames:
        return
    requests, request_ids = codex_title_requests(renames)
    creation_flags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
    try:
        process = subprocess.Popen(
            [executable, "app-server"],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            encoding="utf-8",
            text=True,
            bufsize=1,
            creationflags=creation_flags,
        )
    except OSError as error:
        raise RenameAllError(f"Codex app-server could not start: {error}") from error

    if process.stdin is None or process.stdout is None or process.stderr is None:
        process.kill()
        raise RenameAllError("Codex app-server did not expose its JSONL transport.")

    messages: queue.Queue[dict[str, Any]] = queue.Queue()
    stderr_lines: list[str] = []

    def read_stdout() -> None:
        assert process.stdout is not None
        for line in process.stdout:
            try:
                message = json.loads(line)
            except json.JSONDecodeError:
                continue
            if isinstance(message, dict):
                messages.put(message)

    def read_stderr() -> None:
        assert process.stderr is not None
        stderr_lines.extend(line.rstrip() for line in process.stderr)

    stdout_reader = threading.Thread(target=read_stdout, name="renameall-codex-stdout", daemon=True)
    stderr_reader = threading.Thread(target=read_stderr, name="renameall-codex-stderr", daemon=True)
    stdout_reader.start()
    stderr_reader.start()

    responses: dict[int, dict[str, Any]] = {}

    def send(request: dict[str, Any]) -> None:
        assert process.stdin is not None
        process.stdin.write(json.dumps(request, separators=(",", ":")) + "\n")
        process.stdin.flush()

    def wait_for(request_ids_to_wait_for: set[int], deadline: float) -> None:
        pending = set(request_ids_to_wait_for)
        while pending:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                return
            try:
                message = messages.get(timeout=remaining)
            except queue.Empty:
                return
            message_id = message.get("id")
            if isinstance(message_id, int):
                responses[message_id] = message
                pending.discard(message_id)

    try:
        send(requests[0])
        wait_for({1}, time.monotonic() + 10)
        initialize = responses.get(1)
        if not initialize or "error" in initialize:
            detail = (initialize or {}).get("error") or "no response"
            raise RenameAllError(f"Codex rejected app-server initialization: {detail}")

        for request in requests[1:]:
            send(request)
        wait_for(set(request_ids), time.monotonic() + 30)
    except (BrokenPipeError, OSError) as error:
        raise RenameAllError(f"Codex app-server transport failed: {error}") from error
    finally:
        try:
            process.stdin.close()
        except OSError:
            pass
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=5)
        stdout_reader.join(timeout=1)
        stderr_reader.join(timeout=1)

    failures: list[str] = []
    for request_id, key in request_ids.items():
        response = responses.get(request_id)
        if not response or "error" in response:
            failures.append(f"{key}: {(response or {}).get('error') or 'no response'}")
    if process.returncode != 0 and not failures:
        failures.append("\n".join(stderr_lines).strip() or f"exit code {process.returncode}")
    if failures:
        raise RenameAllError("Codex rejected session rename requests: " + "; ".join(failures))


def apply_live_title(session: LiveSession, title: str, helper_path: Path | None = None) -> None:
    helper = helper_path or Path(os.environ.get("LOCALAPPDATA", "")) / "AgentHub" / "bin" / "AgentTerminalSession.exe"
    if not helper.is_file():
        raise RenameAllError(f"Agent Hub's session title helper is missing: {helper}")
    creation_flags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
    completed = subprocess.run(
        [
            str(helper),
            "-ApplySessionTitle",
            "-OwnerPid",
            str(session.owner_pid),
            "-Title",
            title,
        ],
        check=False,
        capture_output=True,
        encoding="utf-8",
        timeout=15,
        creationflags=creation_flags,
    )
    if completed.returncode != 0:
        detail = completed.stderr.strip() or completed.stdout.strip() or f"exit code {completed.returncode}"
        raise RenameAllError(f"Could not update the live terminal for {session.key}: {detail}")


def inventory_payload(sessions: list[LiveSession]) -> dict[str, Any]:
    return {
        "schemaVersion": 1,
        "capturedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
        "summary": {
            "live": len(sessions),
            "named": sum(session.status == "named" for session in sessions),
            "needsName": sum(session.status == "needs-name" for session in sessions),
            "noContent": sum(session.status == "no-content" for session in sessions),
        },
        "sessions": [session.public_dict() for session in sessions],
    }


def apply_renames(
    requested: dict[str, str],
    sessions: list[LiveSession],
    codex_executable: str | None = None,
    helper_path: Path | None = None,
) -> dict[str, Any]:
    by_key = {session.key: session for session in sessions}
    missing = sorted(set(requested) - set(by_key))
    if missing:
        raise RenameAllError("These Agent Hub sessions are no longer live: " + ", ".join(missing))

    eligible = {
        session.key
        for session in sessions
        if not session.current_name and session.topic_messages
    }
    omitted = sorted(eligible - set(requested))
    if omitted:
        raise RenameAllError(
            "Every unnamed session with conversation content must be included: "
            + ", ".join(omitted)
        )

    planned: list[tuple[LiveSession, str]] = []
    existing_names = {
        session.current_name.casefold()
        for session in sessions
        if session.current_name
    }
    planned_names: set[str] = set()
    for key, title in requested.items():
        session = by_key[key]
        if session.current_name:
            raise RenameAllError(f"{key} already has the name {session.current_name!r}; it was preserved.")
        if not session.topic_messages:
            raise RenameAllError(f"{key} has no conversation content to name yet.")
        folded = title.casefold()
        if folded in existing_names or folded in planned_names:
            raise RenameAllError(f"Session names must be distinct across the live set: {title!r}")
        planned_names.add(folded)
        planned.append((session, title))

    codex = [(session, title) for session, title in planned if session.agent == "codex"]
    claude = [(session, title) for session, title in planned if session.agent == "claude"]
    if codex:
        persist_codex_titles(codex, resolve_codex_executable(codex_executable))
    for session, title in claude:
        append_claude_title(session, title)

    applied: list[dict[str, str]] = []
    errors: list[str] = []
    for session, title in planned:
        try:
            apply_live_title(session, title, helper_path)
            applied.append({"key": session.key, "name": title})
        except RenameAllError as error:
            errors.append(str(error))
    if errors:
        raise RenameAllError("; ".join(errors))
    return {"applied": applied, "count": len(applied)}


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser("inventory", help="List live Agent Hub sessions and naming context.")
    apply_parser = subparsers.add_parser("apply", help="Persist and apply validated session names.")
    apply_parser.add_argument(
        "--rename",
        action="append",
        default=[],
        metavar="AGENT:SESSION-ID=TITLE",
        help="Name one unnamed live session. Repeat for each session.",
    )
    apply_parser.add_argument("--codex-exe", help=argparse.SUPPRESS)
    apply_parser.add_argument("--helper", type=Path, help=argparse.SUPPRESS)
    return parser


def main(argv: list[str] | None = None) -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    arguments = build_parser().parse_args(argv)
    try:
        sessions = discover_live_sessions()
        if arguments.command == "inventory":
            print(json.dumps(inventory_payload(sessions), ensure_ascii=False, indent=2))
            return 0

        requested: dict[str, str] = {}
        for value in arguments.rename:
            key, title = parse_rename(value)
            if key in requested:
                raise RenameAllError(f"Duplicate --rename target: {key}")
            requested[key] = title
        if not requested:
            raise RenameAllError("No --rename values were provided.")
        result = apply_renames(
            requested,
            sessions,
            codex_executable=arguments.codex_exe,
            helper_path=arguments.helper,
        )
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0
    except RenameAllError as error:
        print(f"renameall failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
