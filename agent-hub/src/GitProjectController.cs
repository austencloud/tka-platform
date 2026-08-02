// Reads Git project state and performs only the two approved remote actions:
// fast-forward-only pull and upstream-only push. No shell, force, stash,
// rebase, branch creation, or automatic conflict resolution is permitted.

using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;

enum GitProjectState
{
    Checking,
    Ready,
    GitMissing,
    NotRepository,
    Detached,
    NoUpstream,
    OperationInProgress,
    Conflicts,
    Error
}

sealed class GitProjectStatus
{
    public readonly GitProjectState State;
    public readonly string Branch;
    public readonly string Upstream;
    public readonly int Ahead;
    public readonly int Behind;
    public readonly int ChangedFiles;
    public readonly bool HasConflicts;
    public readonly bool OperationInProgress;
    public readonly bool CanPull;
    public readonly bool CanPush;
    public readonly string PullBlockedReason;
    public readonly string PushBlockedReason;
    public readonly string Detail;

    public bool IsDirty { get { return ChangedFiles > 0; } }

    public GitProjectStatus(
        GitProjectState state,
        string branch,
        string upstream,
        int ahead,
        int behind,
        int changedFiles,
        bool hasConflicts,
        bool operationInProgress,
        bool canPull,
        bool canPush,
        string pullBlockedReason,
        string pushBlockedReason,
        string detail)
    {
        State = state;
        Branch = branch ?? "";
        Upstream = upstream ?? "";
        Ahead = Math.Max(0, ahead);
        Behind = Math.Max(0, behind);
        ChangedFiles = Math.Max(0, changedFiles);
        HasConflicts = hasConflicts;
        OperationInProgress = operationInProgress;
        CanPull = canPull;
        CanPush = canPush;
        PullBlockedReason = pullBlockedReason ?? "";
        PushBlockedReason = pushBlockedReason ?? "";
        Detail = detail ?? "";
    }

    public static GitProjectStatus Checking()
    {
        return new GitProjectStatus(GitProjectState.Checking, "", "", 0, 0, 0, false, false, false, false,
            "Checking Git status.", "Checking Git status.", "");
    }
}

sealed class GitProjectCommandResult
{
    public readonly bool Succeeded;
    public readonly string Detail;
    public readonly GitProjectStatus Status;

    public GitProjectCommandResult(bool succeeded, string detail, GitProjectStatus status)
    {
        Succeeded = succeeded;
        Detail = detail ?? "";
        Status = status;
    }
}

sealed class GitProjectController
{
    const int StatusTimeoutMs = 10000;
    const int ActionTimeoutMs = 120000;

    readonly string _project;
    readonly string _git;
    readonly IDictionary<string, string> _environment;
    string _gitDirectory;

    sealed class ParsedStatus
    {
        public string Branch = "";
        public string Upstream = "";
        public int Ahead;
        public int Behind;
        public int ChangedFiles;
        public bool HasConflicts;
    }

    public GitProjectController(string project)
    {
        _project = Path.GetFullPath(project ?? "");
        _git = FindGit();
        _environment = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            { "GIT_TERMINAL_PROMPT", "0" }
        };
    }

    public GitProjectStatus GetStatus()
    {
        if (string.IsNullOrEmpty(_git)) return Unavailable(GitProjectState.GitMissing, "Git is not installed.");
        if (!Directory.Exists(_project)) return Unavailable(GitProjectState.NotRepository, "The project folder does not exist.");

        HiddenProcessResult result = RunGit("--no-optional-locks status --porcelain=v2 --branch -z", StatusTimeoutMs);
        if (!Succeeded(result))
        {
            string detail = HiddenProcessRunner.FirstUsefulLine(result.Error, result.Output, "Git status failed.");
            GitProjectState state = detail.IndexOf("not a git repository", StringComparison.OrdinalIgnoreCase) >= 0
                ? GitProjectState.NotRepository
                : GitProjectState.Error;
            return Unavailable(state, detail);
        }

        ParsedStatus parsed = ParsePorcelain(result.Output);
        bool operation = IsOperationInProgress();
        GitProjectState projectState = Classify(parsed.Branch, parsed.Upstream, parsed.HasConflicts, operation);
        return BuildStatus(projectState, parsed, operation, "");
    }

    public GitProjectCommandResult Pull()
    {
        GitProjectStatus before = GetStatus();
        if (!before.CanPull) return new GitProjectCommandResult(false, before.PullBlockedReason, before);

        HiddenProcessResult result = RunGit("pull --ff-only", ActionTimeoutMs);
        GitProjectStatus after = GetStatus();
        if (!Succeeded(result))
        {
            string detail = result.TimedOut
                ? "Pull timed out."
                : HiddenProcessRunner.FirstUsefulLine(result.Error, result.Output, "Pull failed.");
            return new GitProjectCommandResult(false, detail, after);
        }
        return new GitProjectCommandResult(true, "Pull complete", after);
    }

    public GitProjectCommandResult Push()
    {
        GitProjectStatus before = GetStatus();
        if (!before.CanPush) return new GitProjectCommandResult(false, before.PushBlockedReason, before);

        HiddenProcessResult result = RunGit("push --porcelain", ActionTimeoutMs);
        GitProjectStatus after = GetStatus();
        if (!Succeeded(result))
        {
            string detail = result.TimedOut
                ? "Push timed out."
                : HiddenProcessRunner.FirstUsefulLine(result.Error, result.Output, "Push failed.");
            return new GitProjectCommandResult(false, detail, after);
        }
        return new GitProjectCommandResult(true, "Push complete", after);
    }

    static GitProjectStatus BuildStatus(GitProjectState state, ParsedStatus parsed, bool operation, string detail)
    {
        string common = CommonBlockedReason(state);
        bool canPull = state == GitProjectState.Ready && parsed.ChangedFiles == 0;
        bool canPush = state == GitProjectState.Ready && parsed.Ahead > 0 && parsed.Behind == 0;

        string pullReason = common;
        if (string.IsNullOrEmpty(pullReason) && parsed.ChangedFiles > 0)
            pullReason = "Commit or discard local changes before pulling.";

        string pushReason = common;
        if (string.IsNullOrEmpty(pushReason) && parsed.Behind > 0 && parsed.Ahead > 0)
            pushReason = "The branch has diverged. Resolve it in a Git client.";
        else if (string.IsNullOrEmpty(pushReason) && parsed.Behind > 0)
            pushReason = "Pull the remote changes first.";
        else if (string.IsNullOrEmpty(pushReason) && parsed.Ahead == 0)
            pushReason = "No commits to push.";

        return new GitProjectStatus(state, parsed.Branch, parsed.Upstream, parsed.Ahead, parsed.Behind,
            parsed.ChangedFiles, parsed.HasConflicts, operation, canPull, canPush,
            pullReason, pushReason, detail);
    }

    static string CommonBlockedReason(GitProjectState state)
    {
        if (state == GitProjectState.Checking) return "Checking Git status.";
        if (state == GitProjectState.GitMissing) return "Install Git to use project sync.";
        if (state == GitProjectState.NotRepository) return "This folder is not a Git repository.";
        if (state == GitProjectState.Detached) return "Switch to a branch before syncing.";
        if (state == GitProjectState.NoUpstream) return "Set an upstream branch before syncing.";
        if (state == GitProjectState.OperationInProgress) return "Finish the current Git operation first.";
        if (state == GitProjectState.Conflicts) return "Resolve merge conflicts before syncing.";
        if (state == GitProjectState.Error) return "Git status failed.";
        return "";
    }

    static GitProjectState Classify(string branch, string upstream, bool conflicts, bool operation)
    {
        if (conflicts) return GitProjectState.Conflicts;
        if (operation) return GitProjectState.OperationInProgress;
        if (string.IsNullOrEmpty(branch) || branch == "(detached)") return GitProjectState.Detached;
        if (string.IsNullOrEmpty(upstream)) return GitProjectState.NoUpstream;
        return GitProjectState.Ready;
    }

    static GitProjectStatus Unavailable(GitProjectState state, string detail)
    {
        var parsed = new ParsedStatus();
        return BuildStatus(state, parsed, false, detail);
    }

    static ParsedStatus ParsePorcelain(string output)
    {
        var parsed = new ParsedStatus();
        if (string.IsNullOrEmpty(output)) return parsed;
        string[] records = output.Split(new char[] { '\0', '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);
        for (int i = 0; i < records.Length; i++)
        {
            string record = records[i];
            if (record.StartsWith("# branch.head ", StringComparison.Ordinal))
                parsed.Branch = record.Substring(14).Trim();
            else if (record.StartsWith("# branch.upstream ", StringComparison.Ordinal))
                parsed.Upstream = record.Substring(18).Trim();
            else if (record.StartsWith("# branch.ab ", StringComparison.Ordinal))
                ParseAheadBehind(record.Substring(12), parsed);
            else if (record.StartsWith("1 ", StringComparison.Ordinal) ||
                     record.StartsWith("2 ", StringComparison.Ordinal) ||
                     record.StartsWith("? ", StringComparison.Ordinal))
                parsed.ChangedFiles++;
            else if (record.StartsWith("u ", StringComparison.Ordinal))
            {
                parsed.ChangedFiles++;
                parsed.HasConflicts = true;
            }
        }
        return parsed;
    }

    static void ParseAheadBehind(string value, ParsedStatus parsed)
    {
        string[] parts = value.Split(new char[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
        for (int i = 0; i < parts.Length; i++)
        {
            int count;
            if (parts[i].Length > 1 && parts[i][0] == '+' &&
                int.TryParse(parts[i].Substring(1), NumberStyles.None, CultureInfo.InvariantCulture, out count)) parsed.Ahead = count;
            else if (parts[i].Length > 1 && parts[i][0] == '-' &&
                int.TryParse(parts[i].Substring(1), NumberStyles.None, CultureInfo.InvariantCulture, out count)) parsed.Behind = count;
        }
    }

    bool IsOperationInProgress()
    {
        if (string.IsNullOrEmpty(_gitDirectory))
        {
            HiddenProcessResult result = RunGit("rev-parse --absolute-git-dir", StatusTimeoutMs);
            if (Succeeded(result)) _gitDirectory = result.Output.Trim();
        }
        if (string.IsNullOrEmpty(_gitDirectory)) return false;
        foreach (string relative in new string[]
        {
            "MERGE_HEAD", "CHERRY_PICK_HEAD", "REVERT_HEAD", "rebase-merge", "rebase-apply", "sequencer"
        })
        {
            string path = Path.Combine(_gitDirectory, relative);
            if (File.Exists(path) || Directory.Exists(path)) return true;
        }
        return false;
    }

    HiddenProcessResult RunGit(string arguments, int timeoutMs)
    {
        return HiddenProcessRunner.Run(_git, arguments, _project, timeoutMs, _environment);
    }

    static bool Succeeded(HiddenProcessResult result)
    {
        return result.Started && !result.TimedOut && result.ExitCode == 0;
    }

    static string FindGit()
    {
        string git = HiddenProcessRunner.FindExecutableOnPath("git.exe");
        if (!string.IsNullOrEmpty(git)) return git;

        foreach (string candidate in new string[]
        {
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Git", "cmd", "git.exe"),
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Git", "cmd", "git.exe"),
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "Git", "cmd", "git.exe")
        })
        {
            if (File.Exists(candidate)) return candidate;
        }
        return null;
    }

    public static int SelfTest()
    {
        int failures = 0;
        string sample = "# branch.oid abc\0# branch.head main\0# branch.upstream origin/main\0" +
            "# branch.ab +16 -3\01 .M N... 100644 file.txt\0? new.txt\0";
        ParsedStatus parsed = ParsePorcelain(sample);
        if (parsed.Branch != "main" || parsed.Upstream != "origin/main") failures++;
        if (parsed.Ahead != 16 || parsed.Behind != 3 || parsed.ChangedFiles != 2) failures++;

        ParsedStatus clean = ParsePorcelain("# branch.head main\0# branch.upstream origin/main\0# branch.ab +2 -0\0");
        GitProjectStatus cleanStatus = BuildStatus(Classify(clean.Branch, clean.Upstream, false, false), clean, false, "");
        if (!cleanStatus.CanPull || !cleanStatus.CanPush) failures++;

        ParsedStatus dirty = ParsePorcelain("# branch.head main\0# branch.upstream origin/main\0# branch.ab +1 -0\0? file.txt\0");
        GitProjectStatus dirtyStatus = BuildStatus(Classify(dirty.Branch, dirty.Upstream, false, false), dirty, false, "");
        if (dirtyStatus.CanPull || !dirtyStatus.CanPush) failures++;

        ParsedStatus diverged = ParsePorcelain("# branch.head main\0# branch.upstream origin/main\0# branch.ab +1 -1\0");
        GitProjectStatus divergedStatus = BuildStatus(Classify(diverged.Branch, diverged.Upstream, false, false), diverged, false, "");
        if (divergedStatus.CanPush || divergedStatus.PushBlockedReason.IndexOf("diverged", StringComparison.OrdinalIgnoreCase) < 0) failures++;

        ParsedStatus conflict = ParsePorcelain("# branch.head main\0# branch.upstream origin/main\0u UU N... file.txt\0");
        if (!conflict.HasConflicts || Classify(conflict.Branch, conflict.Upstream, true, false) != GitProjectState.Conflicts) failures++;

        ParsedStatus noUpstream = ParsePorcelain("# branch.head feature\0");
        if (Classify(noUpstream.Branch, noUpstream.Upstream, false, false) != GitProjectState.NoUpstream) failures++;
        if (Classify("(detached)", "", false, false) != GitProjectState.Detached) failures++;
        return failures;
    }
}
