// Builds the clipboard text that moves a short note into an existing desktop
// agent task. The popover never claims an agent is online and never sends work
// on the user's behalf.

using System;
using System.Text;

static class AgentPromptBuilder
{
    public static string BuildFeedback(string project, string note, GitProjectStatus status)
    {
        var text = new StringBuilder();
        text.AppendLine("Work in " + SafeProject(project) + ".");
        text.AppendLine();
        text.AppendLine("Feedback to handle:");
        text.AppendLine(CleanNote(note));
        text.AppendLine();
        AppendWorkspaceSnapshot(text, status);
        text.Append("Inspect the current implementation before editing. Protect unrelated work. ");
        text.Append("Make a focused, production-ready change that resolves the feedback, verify it with objective evidence, and report what changed. ");
        text.Append("Do not commit or push unless this task explicitly asks for it.");
        return text.ToString();
    }

    public static string BuildCommitRequest(string project, string note, GitProjectStatus status)
    {
        var text = new StringBuilder();
        text.AppendLine("Work in " + SafeProject(project) + ".");
        text.AppendLine();
        text.AppendLine("Prepare one focused commit for:");
        text.AppendLine(CleanNote(note));
        text.AppendLine();
        AppendWorkspaceSnapshot(text, status);
        text.Append("Inspect git status and the diff first. Include only paths that belong to this request, preserve unrelated work, run the relevant verification, and commit with explicit pathspecs. ");
        text.Append("Do not push. If the described scope does not match the current diff, stop and report the mismatch instead of guessing.");
        return text.ToString();
    }

    static void AppendWorkspaceSnapshot(StringBuilder text, GitProjectStatus status)
    {
        if (status == null || status.State == GitProjectState.Checking) return;

        text.Append("Agent Hub snapshot: ");
        if (!string.IsNullOrEmpty(status.Branch)) text.Append("branch " + status.Branch + "; ");
        text.Append(status.ChangedFiles + (status.ChangedFiles == 1 ? " changed file" : " changed files"));
        if (status.Ahead > 0 || status.Behind > 0)
            text.Append("; ahead " + status.Ahead + "; behind " + status.Behind);
        text.AppendLine(". Re-check this state before acting.");
        text.AppendLine();
    }

    static string SafeProject(string project)
    {
        string value = (project ?? "").Trim();
        return string.IsNullOrEmpty(value) ? "the current project" : value;
    }

    static string CleanNote(string note)
    {
        string value = (note ?? "").Trim();
        return string.IsNullOrEmpty(value) ? "[Describe the requested work]" : value;
    }

    public static int SelfTest()
    {
        int failures = 0;
        var status = new GitProjectStatus(
            GitProjectState.Ready, "main", "origin/main", 2, 0, 3,
            false, false, false, true, "", "", "");

        string feedback = BuildFeedback("E:\\repo", "Fix the delayed server state.", status);
        if (feedback.IndexOf("E:\\repo", StringComparison.Ordinal) < 0) failures++;
        if (feedback.IndexOf("Fix the delayed server state.", StringComparison.Ordinal) < 0) failures++;
        if (feedback.IndexOf("Do not commit or push", StringComparison.Ordinal) < 0) failures++;

        string commit = BuildCommitRequest("E:\\repo", "Agent Hub only", status);
        if (commit.IndexOf("explicit pathspecs", StringComparison.Ordinal) < 0) failures++;
        if (commit.IndexOf("ahead 2", StringComparison.Ordinal) < 0) failures++;
        if (commit.IndexOf("Do not push", StringComparison.Ordinal) < 0) failures++;
        return failures;
    }
}
