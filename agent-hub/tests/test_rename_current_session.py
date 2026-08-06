import importlib.util
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace


SCRIPT_PATH = (
    Path(__file__).parents[1]
    / "skills"
    / "rename"
    / "scripts"
    / "rename_current_session.py"
)
SPEC = importlib.util.spec_from_file_location("rename_current_session", SCRIPT_PATH)
rename = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
sys.modules[SPEC.name] = rename
SPEC.loader.exec_module(rename)


class FakeRenameAll:
    def __init__(self, before, after=None):
        self.before = before
        self.after = after or before
        self.discovery_count = 0
        self.appended = []
        self.applied = []
        self.processes = [
            SimpleNamespace(pid=3948, parent_pid=1),
            SimpleNamespace(pid=5000, parent_pid=3948),
        ]

    @staticmethod
    def normalize_title(title):
        return " ".join(title.split())

    def powershell_processes(self):
        return self.processes

    def discover_live_sessions(self, processes=None):
        self.discovery_count += 1
        return self.before if self.discovery_count == 1 else self.after

    def append_claude_title(self, session, title):
        self.appended.append((session.session_id, title))

    def apply_live_title(self, session, title):
        self.applied.append((session.owner_pid, title))


def session(agent="claude", owner_pid=3948, current_name=None):
    return SimpleNamespace(
        agent=agent,
        current_name=current_name,
        owner_pid=owner_pid,
        session_id="1af184bb-9bcf-4348-8e75-a7a60bc0003d",
    )


class CurrentRenameTests(unittest.TestCase):
    def test_stale_registry_title_is_not_used_to_target_the_session(self):
        before = session(current_name=None)
        after = session(current_name="Ghost Presenter")
        fake = FakeRenameAll([before], [after])

        result = rename.rename_current_session(
            3948, "Ghost Presenter", fake, current_pid=5000
        )

        self.assertEqual(fake.appended, [(before.session_id, "Ghost Presenter")])
        self.assertEqual(fake.applied, [(3948, "Ghost Presenter")])
        self.assertEqual(result["previousName"], None)
        self.assertEqual(result["name"], "Ghost Presenter")

    def test_existing_name_is_reapplied_without_duplicate_persistence(self):
        current = session(current_name="Ghost Presenter")
        fake = FakeRenameAll([current])

        rename.rename_current_session(3948, "Ghost Presenter", fake, current_pid=5000)

        self.assertEqual(fake.appended, [])
        self.assertEqual(fake.applied, [(3948, "Ghost Presenter")])

    def test_owner_pid_must_resolve_to_exactly_one_claude_session(self):
        fake = FakeRenameAll([session(agent="codex")])

        with self.assertRaisesRegex(rename.CurrentRenameError, "found 0"):
            rename.rename_current_session(
                3948, "Ghost Presenter", fake, current_pid=5000
            )

    def test_persistence_must_be_visible_on_reinventory(self):
        fake = FakeRenameAll([session()], [session(current_name="Wrong Name")])

        with self.assertRaisesRegex(rename.CurrentRenameError, "persisted"):
            rename.rename_current_session(
                3948, "Ghost Presenter", fake, current_pid=5000
            )

    def test_owner_pid_must_be_an_ancestor_of_the_helper(self):
        fake = FakeRenameAll([session()])
        fake.processes = [
            SimpleNamespace(pid=3948, parent_pid=1),
            SimpleNamespace(pid=5000, parent_pid=2222),
        ]

        with self.assertRaisesRegex(rename.CurrentRenameError, "not an ancestor"):
            rename.rename_current_session(
                3948, "Ghost Presenter", fake, current_pid=5000
            )

    def test_owner_pid_rejects_missing_or_invalid_environment_values(self):
        environments = (
            {},
            {"TKA_AGENT_TERMINAL_SESSION_PID": "nope"},
            {"TKA_AGENT_TERMINAL_SESSION_PID": "0"},
        )
        for environment in environments:
            with self.subTest(environment=environment):
                with self.assertRaises(rename.CurrentRenameError):
                    rename.owner_pid_from_environment(environment)


if __name__ == "__main__":
    unittest.main()
