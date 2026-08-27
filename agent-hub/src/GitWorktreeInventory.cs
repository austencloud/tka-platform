// Read-only inventory of the repository's primary checkout and linked
// worktrees. This class never creates, moves, prunes, merges, or deletes them.

using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;

enum GitWorktreeActivity
{
    PrimaryClean,
    PrimaryBlocked,
    ReadyToMerge,
    WaitingForPrimary,
    InProgress,
    CleanupCandidate,
    Stale,
    Diverged,
    Conflicts,
    OperationInProgress,
    Detached,
    Locked,
    Missing,
    Error
}

sealed class GitWorktreeItem
{
    public readonly string Path;
    public readonly string Branch;
    public readonly bool IsPrimary;
    public readonly int ChangedFiles;
    public readonly int AheadOfMain;
    public readonly int BehindMain;
    public readonly GitWorktreeActivity Activity;
    public readonly string Detail;

    public GitWorktreeItem(string path, string branch, bool isPrimary, int changedFiles,
        int aheadOfMain, int behindMain, GitWorktreeActivity activity, string detail)
    {
        Path = path ?? "";
        Branch = branch ?? "";
        IsPrimary = isPrimary;
        ChangedFiles = Math.Max(0, changedFiles);
        AheadOfMain = Math.Max(0, aheadOfMain);
        BehindMain = Math.Max(0, behindMain);
        Activity = activity;
        Detail = detail ?? "";
    }
}

sealed class GitWorktreeInventory
{
    public readonly IList<GitWorktreeItem> Items;
    public readonly bool IsChecking;
    public readonly string Detail;

    public GitWorktreeInventory(IList<GitWorktreeItem> items, bool isChecking, string detail)
    {
        Items = items ?? new List<GitWorktreeItem>();
        IsChecking = isChecking;
        Detail = detail ?? "";
    }

    public static GitWorktreeInventory Checking()
    {
        return new GitWorktreeInventory(new List<GitWorktreeItem>(), true, "Reading Git worktrees");
    }
}

sealed class GitWorktreeInventoryController
{
    const int GitTimeoutMs = 10000;

    readonly string _project;
    readonly string _git;
    readonly IDictionary<string, string> _environment;

    sealed class ParsedWorktree
    {
        public string Path = "";
        public string Head = "";
        public string Branch = "";
        public bool Locked;
        public bool Prunable;
    }

    public GitWorktreeInventoryController(string project)
    {
        _project = Path.GetFullPath(project ?? "");
        _git = FindGit();
        _environment = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            { "GIT_TERMINAL_PROMPT", "0" }
        };
    }

    public GitWorktreeInventory GetInventory()
    {
        if (string.IsNullOrEmpty(_git)) return Failure("Git is not installed.");
        if (!Directory.Exists(_project)) return Failure("The project folder does not exist.");

        HiddenProcessResult listResult = RunGit("worktree list --porcelain -z");
        if (!Succeeded(listResult))
            return Failure(HiddenProcessRunner.FirstUsefulLine(listResult.Error, listResult.Output, "Git worktree inventory failed."));

        IList<ParsedWorktree> parsed = ParsePorcelain(listResult.Output);
        if (parsed.Count == 0) return Failure("Git returned no worktrees.");

        var statuses = new List<GitProjectStatus>();
        for (int i = 0; i < parsed.Count; i++)
        {
            ParsedWorktree record = parsed[i];
            if (!Directory.Exists(record.Path))
            {
                statuses.Add(null);
                continue;
            }

            try { statuses.Add(new GitProjectController(record.Path).GetStatus()); }
            catch { statuses.Add(null); }
        }

        ParsedWorktree primary = parsed[0];
        GitProjectStatus primaryStatus = statuses[0];
        bool primaryOnMain = string.Equals(primary.Branch, "main", StringComparison.OrdinalIgnoreCase);
        bool primaryReady = primaryOnMain && primaryStatus != null && primaryStatus.ChangedFiles == 0 &&
            !primaryStatus.HasConflicts && !primaryStatus.OperationInProgress &&
            primaryStatus.State != GitProjectState.Error;

        string mainHead = ReadMainHead(primary.Head);
        var items = new List<GitWorktreeItem>();
        for (int i = 0; i < parsed.Count; i++)
        {
            ParsedWorktree record = parsed[i];
            GitProjectStatus status = statuses[i];
            int ahead = 0;
            int behind = 0;
            bool compared = i == 0 || TryCompare(mainHead, record.Head, out behind, out ahead);
            GitWorktreeActivity activity = Classify(
                i == 0,
                Directory.Exists(record.Path),
                record.Locked,
                record.Prunable,
                string.IsNullOrEmpty(record.Branch),
                status,
                compared,
                ahead,
                behind,
                primaryReady);
            items.Add(new GitWorktreeItem(
                record.Path,
                string.IsNullOrEmpty(record.Branch) ? "(detached)" : record.Branch,
                i == 0,
                status == null ? 0 : status.ChangedFiles,
                ahead,
                behind,
                activity,
                ActivityDetail(activity, status, ahead, behind, primaryOnMain)));
        }

        string detail = primaryOnMain
            ? "Read-only inventory relative to main"
            : "Primary checkout is on " + (string.IsNullOrEmpty(primary.Branch) ? "a detached commit" : primary.Branch) + "; merge readiness is blocked";
        return new GitWorktreeInventory(items, false, detail);
    }

    string ReadMainHead(string fallback)
    {
        HiddenProcessResult result = RunGit("rev-parse --verify refs/heads/main^{commit}");
        if (Succeeded(result))
        {
            string value = result.Output.Trim();
            if (IsObjectId(value)) return value;
        }
        return fallback ?? "";
    }

    bool TryCompare(string mainHead, string worktreeHead, out int behind, out int ahead)
    {
        behind = 0;
        ahead = 0;
        if (!IsObjectId(mainHead) || !IsObjectId(worktreeHead)) return false;
        HiddenProcessResult result = RunGit("rev-list --left-right --count " + mainHead + "..." + worktreeHead);
        if (!Succeeded(result)) return false;
        string[] parts = result.Output.Split(new char[] { ' ', '\t', '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);
        return parts.Length >= 2 &&
            int.TryParse(parts[0], NumberStyles.None, CultureInfo.InvariantCulture, out behind) &&
            int.TryParse(parts[1], NumberStyles.None, CultureInfo.InvariantCulture, out ahead);
    }

    HiddenProcessResult RunGit(string arguments)
    {
        return HiddenProcessRunner.Run(_git, "--no-optional-locks " + arguments, _project, GitTimeoutMs, _environment);
    }

    static GitWorktreeActivity Classify(bool primary, bool exists, bool locked, bool prunable,
        bool detached, GitProjectStatus status, bool compared, int ahead, int behind, bool primaryReady)
    {
        if (!exists) return GitWorktreeActivity.Missing;
        if (prunable) return GitWorktreeActivity.Missing;
        if (locked) return GitWorktreeActivity.Locked;
        if (status == null || status.State == GitProjectState.Error || !compared) return GitWorktreeActivity.Error;
        if (status.HasConflicts) return GitWorktreeActivity.Conflicts;
        if (status.OperationInProgress) return GitWorktreeActivity.OperationInProgress;
        if (primary) return status.ChangedFiles == 0 ? GitWorktreeActivity.PrimaryClean : GitWorktreeActivity.PrimaryBlocked;
        if (detached) return GitWorktreeActivity.Detached;
        if (status.ChangedFiles > 0) return GitWorktreeActivity.InProgress;
        if (ahead == 0) return GitWorktreeActivity.CleanupCandidate;
        if (behind > 0) return GitWorktreeActivity.Diverged;
        return primaryReady ? GitWorktreeActivity.ReadyToMerge : GitWorktreeActivity.WaitingForPrimary;
    }

    static string ActivityDetail(GitWorktreeActivity activity, GitProjectStatus status,
        int ahead, int behind, bool primaryOnMain)
    {
        int changed = status == null ? 0 : status.ChangedFiles;
        if (activity == GitWorktreeActivity.PrimaryClean) return "Primary checkout is clean and on main.";
        if (activity == GitWorktreeActivity.PrimaryBlocked)
            return changed + " changed file(s) in the primary checkout; automatic integration must wait.";
        if (activity == GitWorktreeActivity.ReadyToMerge)
            return "Clean, " + ahead + " commit(s) ahead of main, and fast-forwardable. Test results are not inferred.";
        if (activity == GitWorktreeActivity.WaitingForPrimary)
            return primaryOnMain
                ? "Clean and fast-forwardable, but the primary checkout is dirty. Preserve this worktree."
                : "Clean and fast-forwardable, but the primary checkout is not on main. Preserve this worktree.";
        if (activity == GitWorktreeActivity.InProgress) return changed + " changed file(s) are still in progress.";
        if (activity == GitWorktreeActivity.CleanupCandidate)
            return "Clean with no commits beyond main. Review before deliberate cleanup; Agent Hub will not remove it.";
        if (activity == GitWorktreeActivity.Stale) return "Preserved for review. Agent Hub cannot infer owner activity.";
        if (activity == GitWorktreeActivity.Diverged)
            return ahead + " commit(s) ahead and " + behind + " behind main. Integration needs review.";
        if (activity == GitWorktreeActivity.Conflicts) return "Conflicts need attention. Preserve this worktree.";
        if (activity == GitWorktreeActivity.OperationInProgress) return "A Git operation is in progress. Preserve this worktree.";
        if (activity == GitWorktreeActivity.Detached) return "Detached HEAD. Attach or preserve the commit before cleanup.";
        if (activity == GitWorktreeActivity.Locked) return "Git marks this worktree as locked.";
        if (activity == GitWorktreeActivity.Missing) return "Git marks this worktree registration as prunable or its path is missing. Review it before pruning.";
        return "Git could not classify this worktree safely.";
    }

    static IList<ParsedWorktree> ParsePorcelain(string output)
    {
        var records = new List<ParsedWorktree>();
        if (string.IsNullOrEmpty(output)) return records;
        char separator = output.IndexOf('\0') >= 0 ? '\0' : '\n';
        string[] lines = output.Replace("\r", "").Split(new char[] { separator }, StringSplitOptions.None);
        ParsedWorktree current = null;
        for (int i = 0; i < lines.Length; i++)
        {
            string line = lines[i].TrimEnd('\n');
            if (line.StartsWith("worktree ", StringComparison.Ordinal))
            {
                current = new ParsedWorktree();
                current.Path = line.Substring(9);
                records.Add(current);
            }
            else if (current != null && line.StartsWith("HEAD ", StringComparison.Ordinal))
                current.Head = line.Substring(5).Trim();
            else if (current != null && line.StartsWith("branch refs/heads/", StringComparison.Ordinal))
                current.Branch = line.Substring(18);
            else if (current != null && line == "detached")
                current.Branch = "";
            else if (current != null && line.StartsWith("locked", StringComparison.Ordinal))
                current.Locked = true;
            else if (current != null && line.StartsWith("prunable", StringComparison.Ordinal))
                current.Prunable = true;
        }
        return records;
    }

    static bool IsObjectId(string value)
    {
        if (string.IsNullOrEmpty(value) || value.Length < 7 || value.Length > 64) return false;
        for (int i = 0; i < value.Length; i++)
            if (!Uri.IsHexDigit(value[i])) return false;
        return true;
    }

    static bool Succeeded(HiddenProcessResult result)
    {
        return result.Started && !result.TimedOut && result.ExitCode == 0;
    }

    static GitWorktreeInventory Failure(string detail)
    {
        return new GitWorktreeInventory(new List<GitWorktreeItem>(), false, detail);
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
            if (File.Exists(candidate)) return candidate;
        return null;
    }

    public static int SelfTest()
    {
        int failures = 0;
        string sample = "worktree E:/repo\0HEAD aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\0branch refs/heads/main\0\0" +
            "worktree C:/tasks/one\0HEAD bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\0branch refs/heads/codex/one\0locked reason\0\0";
        IList<ParsedWorktree> parsed = ParsePorcelain(sample);
        if (parsed.Count != 2 || parsed[0].Path != "E:/repo" || parsed[0].Branch != "main") failures++;
        if (!parsed[1].Locked || parsed[1].Branch != "codex/one") failures++;

        GitProjectStatus clean = TestStatus(0, false, false);
        GitProjectStatus dirty = TestStatus(3, false, false);
        if (Classify(true, true, false, false, false, clean, true, 0, 0, true) != GitWorktreeActivity.PrimaryClean) failures++;
        if (Classify(true, true, false, false, false, dirty, true, 0, 0, false) != GitWorktreeActivity.PrimaryBlocked) failures++;
        if (Classify(false, true, false, false, false, dirty, true, 1, 0, true) != GitWorktreeActivity.InProgress) failures++;
        if (Classify(false, true, false, false, false, clean, true, 2, 0, true) != GitWorktreeActivity.ReadyToMerge) failures++;
        if (Classify(false, true, false, false, false, clean, true, 2, 0, false) != GitWorktreeActivity.WaitingForPrimary) failures++;
        if (Classify(false, true, false, false, false, clean, true, 0, 4, true) != GitWorktreeActivity.CleanupCandidate) failures++;
        if (Classify(false, true, false, false, false, clean, true, 2, 1, true) != GitWorktreeActivity.Diverged) failures++;
        if (Classify(false, true, false, false, false, clean, true, 0, 0, true) != GitWorktreeActivity.CleanupCandidate) failures++;
        return failures;
    }

    static GitProjectStatus TestStatus(int changedFiles, bool conflicts, bool operation)
    {
        return new GitProjectStatus(GitProjectState.Ready, "branch", "origin/branch", 0, 0, changedFiles,
            conflicts, operation, false, false, "", "", "");
    }
}
