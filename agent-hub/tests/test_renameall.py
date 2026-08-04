import importlib.util
import contextlib
import json
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPT_PATH = (
    Path(__file__).parents[1]
    / "skills"
    / "renameall"
    / "scripts"
    / "rename_all_sessions.py"
)
SPEC = importlib.util.spec_from_file_location("rename_all_sessions", SCRIPT_PATH)
renameall = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
sys.modules[SPEC.name] = renameall
SPEC.loader.exec_module(renameall)


class RenameAllTests(unittest.TestCase):
    def test_inventory_maps_only_primary_agent_processes(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            claude_home = root / ".claude"
            codex_home = root / ".codex"
            (claude_home / "sessions").mkdir(parents=True)
            (claude_home / "projects" / "E--project").mkdir(parents=True)
            (codex_home / "sessions" / "2026" / "08" / "01").mkdir(parents=True)

            claude_id = "11111111-1111-4111-8111-111111111111"
            codex_id = "22222222-2222-4222-8222-222222222222"
            (claude_home / "sessions" / "101.json").write_text(
                json.dumps({"sessionId": claude_id, "cwd": "E:\\project"}),
                encoding="utf-8",
            )
            claude_transcript = claude_home / "projects" / "E--project" / f"{claude_id}.jsonl"
            claude_transcript.write_text(
                json.dumps(
                    {
                        "type": "user",
                        "sessionId": claude_id,
                        "message": {"role": "user", "content": "Build the launch controls"},
                    }
                )
                + "\n",
                encoding="utf-8",
            )

            codex_transcript = (
                codex_home
                / "sessions"
                / "2026"
                / "08"
                / "01"
                / f"rollout-test-{codex_id}.jsonl"
            )
            codex_transcript.write_text(
                json.dumps(
                    {
                        "type": "event_msg",
                        "payload": {"type": "user_message", "message": "Repair gallery filtering"},
                    }
                )
                + "\n",
                encoding="utf-8",
            )
            with contextlib.closing(sqlite3.connect(codex_home / "logs_2.sqlite")) as database:
                database.execute(
                    "CREATE TABLE logs(process_uuid TEXT, thread_id TEXT, ts INTEGER, ts_nanos INTEGER)"
                )
                database.execute(
                    "INSERT INTO logs VALUES (?, ?, 1, 1)", ("pid:201:run", codex_id)
                )
                database.commit()
            with contextlib.closing(sqlite3.connect(codex_home / "state_5.sqlite")) as database:
                database.execute(
                    "CREATE TABLE threads(id TEXT, rollout_path TEXT, name TEXT)"
                )
                database.execute(
                    "INSERT INTO threads VALUES (?, ?, NULL)", (codex_id, str(codex_transcript))
                )
                database.commit()

            processes = [
                renameall.ProcessRecord(
                    100,
                    1,
                    "AgentTerminalSession-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.exe",
                    "session.exe -Agent claude -Project E:\\project -Bat start-claude.bat",
                ),
                renameall.ProcessRecord(101, 100, "claude.exe", "claude.exe"),
                renameall.ProcessRecord(102, 101, "codex.exe", "codex.exe"),
                renameall.ProcessRecord(
                    200,
                    1,
                    "AgentTerminalSession-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.exe",
                    "session.exe -Agent codex -Project E:\\project -Bat start-codex.bat",
                ),
                renameall.ProcessRecord(201, 200, "codex-tka.exe", "codex-tka.exe"),
            ]

            sessions = renameall.discover_live_sessions(
                processes=processes, claude_home=claude_home, codex_home=codex_home
            )

            self.assertEqual([session.key for session in sessions], [f"claude:{claude_id}", f"codex:{codex_id}"])
            self.assertEqual(sessions[0].topic_messages, ["Build the launch controls"])
            self.assertEqual(sessions[1].topic_messages, ["Repair gallery filtering"])

    def test_claude_topic_extraction_ignores_command_noise_and_uses_ai_title(self):
        with tempfile.TemporaryDirectory() as temporary:
            transcript = Path(temporary) / "session.jsonl"
            records = [
                {
                    "type": "user",
                    "message": {
                        "role": "user",
                        "content": "<command-name>/model</command-name>",
                    },
                },
                {"type": "ai-title", "aiTitle": "Weekly application audit"},
            ]
            transcript.write_text(
                "".join(json.dumps(record) + "\n" for record in records), encoding="utf-8"
            )

            current_name, messages = renameall.claude_transcript_data(transcript)

            self.assertIsNone(current_name)
            self.assertEqual(messages, ["Weekly application audit"])
            self.assertEqual(
                renameall.topic_messages(["$colorall", "$museum build the lobby"]),
                ["$museum build the lobby"],
            )

    def test_codex_legacy_names_come_from_the_native_session_index(self):
        with tempfile.TemporaryDirectory() as temporary:
            codex_home = Path(temporary)
            session_id = "22222222-2222-4222-8222-222222222222"
            rollout = codex_home / "rollout.jsonl"
            rollout.write_text("", encoding="utf-8")
            with contextlib.closing(sqlite3.connect(codex_home / "state_5.sqlite")) as database:
                database.execute(
                    "CREATE TABLE threads("
                    "id TEXT, rollout_path TEXT, name TEXT, title TEXT, history_mode TEXT)"
                )
                database.execute(
                    "INSERT INTO threads VALUES (?, ?, NULL, ?, 'legacy')",
                    (session_id, str(rollout), "Automatic Preview"),
                )
                database.commit()
            (codex_home / "session_index.jsonl").write_text(
                json.dumps(
                    {
                        "id": session_id,
                        "thread_name": "Deliberate Session Name",
                        "updated_at": "2026-08-01T00:00:00Z",
                    }
                )
                + "\n",
                encoding="utf-8",
            )

            rows = renameall.codex_thread_rows([session_id], codex_home)

            self.assertEqual(rows[session_id], (rollout, "Deliberate Session Name"))

    def test_title_validation_and_duplicate_protection_are_fail_closed(self):
        self.assertEqual(renameall.normalize_title("  Agent Hub Naming  "), "Agent Hub Naming")
        with self.assertRaises(renameall.RenameAllError):
            renameall.normalize_title("One")
        with self.assertRaises(renameall.RenameAllError):
            renameall.normalize_title("Unsafe\x1b Title")

        named = renameall.LiveSession(
            "claude",
            10,
            11,
            "E:\\project",
            "11111111-1111-4111-8111-111111111111",
            Path("transcript"),
            "Existing Name",
            ["Topic"],
        )
        with self.assertRaisesRegex(renameall.RenameAllError, "was preserved"):
            renameall.apply_renames({named.key: "Replacement Name"}, [named])

    def test_apply_requires_every_eligible_unnamed_session(self):
        first = renameall.LiveSession(
            "claude",
            10,
            11,
            "E:\\project",
            "11111111-1111-4111-8111-111111111111",
            Path("first.jsonl"),
            None,
            ["First topic"],
        )
        second = renameall.LiveSession(
            "codex",
            20,
            21,
            "E:\\project",
            "22222222-2222-4222-8222-222222222222",
            Path("second.jsonl"),
            None,
            ["Second topic"],
        )

        with self.assertRaisesRegex(renameall.RenameAllError, "Every unnamed session"):
            renameall.apply_renames({first.key: "First Session Topic"}, [first, second])

    def test_codex_persistence_uses_documented_app_server_method(self):
        session = renameall.LiveSession(
            "codex",
            20,
            21,
            "E:\\project",
            "22222222-2222-4222-8222-222222222222",
            Path("rollout.jsonl"),
            None,
            ["Topic"],
        )
        messages, request_ids = renameall.codex_title_requests(
            [(session, "Gallery Filter Repair")]
        )
        self.assertEqual(messages[0]["method"], "initialize")
        self.assertEqual(messages[1]["method"], "initialized")
        self.assertEqual(messages[2]["method"], "thread/name/set")
        self.assertEqual(
            messages[2]["params"],
            {"threadId": session.session_id, "name": "Gallery Filter Repair"},
        )
        self.assertEqual(request_ids, {100: session.key})

    def test_claude_persistence_appends_native_custom_title_record(self):
        with tempfile.TemporaryDirectory() as temporary:
            transcript = Path(temporary) / "session.jsonl"
            transcript.write_text('{"type":"user"}\n', encoding="utf-8")
            session = renameall.LiveSession(
                "claude",
                10,
                11,
                "E:\\project",
                "11111111-1111-4111-8111-111111111111",
                transcript,
                None,
                ["Topic"],
            )

            renameall.append_claude_title(session, "Launch Control Design")

            records = [json.loads(line) for line in transcript.read_text(encoding="utf-8").splitlines()]
            self.assertEqual(
                records[-1],
                {
                    "type": "custom-title",
                    "customTitle": "Launch Control Design",
                    "sessionId": session.session_id,
                },
            )


if __name__ == "__main__":
    unittest.main()
