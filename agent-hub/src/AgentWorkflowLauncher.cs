// Maps Agent Hub's three project workflows to the skills that already own
// them. Session creation stays with AgentTerminalLauncher; this class only
// selects a workflow and waits for the launcher to acknowledge it.

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;

enum AgentWorkflowKind
{
    Feedback,
    Spec,
    Sessions
}

sealed class AgentWorkflowDefinition
{
    public readonly AgentWorkflowKind Kind;
    public readonly string Name;
    public readonly string Description;
    public readonly string Prompt;
    public readonly string SessionTitle;

    public AgentWorkflowDefinition(AgentWorkflowKind kind, string name, string description, string prompt, string sessionTitle)
    {
        Kind = kind;
        Name = name ?? "";
        Description = description ?? "";
        Prompt = prompt ?? "";
        SessionTitle = sessionTitle ?? "";
    }
}

sealed class AgentWorkflowLaunchResult
{
    public readonly bool Succeeded;
    public readonly string Detail;

    public AgentWorkflowLaunchResult(bool succeeded, string detail)
    {
        Succeeded = succeeded;
        Detail = detail ?? "";
    }
}

static class AgentWorkflowLauncher
{
    const int LaunchTimeoutMs = 15000;

    static readonly IDictionary<AgentWorkflowKind, AgentWorkflowDefinition> Definitions =
        new Dictionary<AgentWorkflowKind, AgentWorkflowDefinition>
        {
            {
                AgentWorkflowKind.Feedback,
                new AgentWorkflowDefinition(
                    AgentWorkflowKind.Feedback,
                    "Feedback",
                    "Open the queue and choose an item",
                    "$fb list",
                    "Feedback Queue")
            },
            {
                AgentWorkflowKind.Spec,
                new AgentWorkflowDefinition(
                    AgentWorkflowKind.Spec,
                    "Spec",
                    "Review active and backlog specs",
                    "$queue list",
                    "Spec Queue")
            },
            {
                AgentWorkflowKind.Sessions,
                new AgentWorkflowDefinition(
                    AgentWorkflowKind.Sessions,
                    "Sessions",
                    "Analyze sessions not reviewed yet",
                    "$sessions",
                    "Session Triage")
            }
        };

    public static AgentWorkflowDefinition Get(AgentWorkflowKind kind)
    {
        AgentWorkflowDefinition definition;
        if (!Definitions.TryGetValue(kind, out definition))
            throw new ArgumentOutOfRangeException("kind");
        return definition;
    }

    public static AgentWorkflowLaunchResult Launch(string project, AgentWorkflowKind kind)
    {
        string projectPath;
        try { projectPath = Path.GetFullPath(project ?? ""); }
        catch (Exception ex) { return new AgentWorkflowLaunchResult(false, ex.Message); }
        if (!Directory.Exists(projectPath))
            return new AgentWorkflowLaunchResult(false, "The project folder is unavailable.");

        string terminalLauncher = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "AgentTerminalLauncher.exe");
        if (!File.Exists(terminalLauncher))
            return new AgentWorkflowLaunchResult(false, "Agent Hub's terminal launcher is not installed.");

        string codex = ResolveCodexExecutable();
        if (string.IsNullOrEmpty(codex))
            return new AgentWorkflowLaunchResult(false, "Codex is not installed.");

        AgentWorkflowDefinition workflow = Get(kind);
        string arguments = BuildArguments(projectPath, codex, workflow);
        try
        {
            var start = new ProcessStartInfo(terminalLauncher, arguments);
            start.WorkingDirectory = projectPath;
            start.UseShellExecute = false;
            start.CreateNoWindow = true;
            using (Process process = Process.Start(start))
            {
                if (process == null) return new AgentWorkflowLaunchResult(false, "The workflow launcher did not start.");
                if (!process.WaitForExit(LaunchTimeoutMs))
                {
                    try { process.Kill(); } catch { }
                    return new AgentWorkflowLaunchResult(false, "The workflow session did not acknowledge startup within 15 seconds.");
                }
                if (process.ExitCode != 0)
                    return new AgentWorkflowLaunchResult(false, "The workflow launcher exited with code " + process.ExitCode + ".");
            }
            return new AgentWorkflowLaunchResult(true, workflow.Name + " workflow opened in a new Codex session.");
        }
        catch (Exception ex)
        {
            return new AgentWorkflowLaunchResult(false, ex.Message);
        }
    }

    static string BuildArguments(string project, string codex, AgentWorkflowDefinition workflow)
    {
        return
            "-Agent codex" +
            " -Project " + HiddenProcessRunner.QuoteArgument(project) +
            " -Executable " + HiddenProcessRunner.QuoteArgument(codex) +
            " -Prompt " + HiddenProcessRunner.QuoteArgument(workflow.Prompt) +
            " -Title " + HiddenProcessRunner.QuoteArgument(workflow.SessionTitle);
    }

    internal static string ResolveCodexExecutable()
    {
        string tkaCodex = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "TKA", "codex-tka", "bin", "codex-tka.exe");
        if (File.Exists(tkaCodex)) return tkaCodex;

        string pathExecutable = HiddenProcessRunner.FindExecutableOnPath("codex.exe");
        if (!string.IsNullOrEmpty(pathExecutable)) return pathExecutable;
        string pathCommand = HiddenProcessRunner.FindExecutableOnPath("codex.cmd");
        if (!string.IsNullOrEmpty(pathCommand)) return pathCommand;

        string npmCommand = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
            "npm", "codex.cmd");
        return File.Exists(npmCommand) ? npmCommand : null;
    }

    public static int SelfTest()
    {
        int failures = 0;
        AgentWorkflowDefinition feedback = Get(AgentWorkflowKind.Feedback);
        AgentWorkflowDefinition spec = Get(AgentWorkflowKind.Spec);
        AgentWorkflowDefinition sessions = Get(AgentWorkflowKind.Sessions);
        if (feedback.Prompt != "$fb list" || feedback.SessionTitle != "Feedback Queue") failures++;
        if (spec.Prompt != "$queue list" || spec.SessionTitle != "Spec Queue") failures++;
        if (sessions.Prompt != "$sessions" || sessions.SessionTitle != "Session Triage") failures++;

        string args = BuildArguments("E:\\project with space", "C:\\tools\\codex.exe", sessions);
        if (args.IndexOf("-Prompt \"$sessions\"", StringComparison.Ordinal) < 0) failures++;
        if (args.IndexOf("-Project \"E:\\project with space\"", StringComparison.Ordinal) < 0) failures++;
        if (args.IndexOf("-Title \"Session Triage\"", StringComparison.Ordinal) < 0) failures++;
        return failures;
    }
}

// `codex app <path>` is the public local handoff that opens a workspace in
// Codex Desktop. It intentionally does not claim to resume or create a task:
// the installed CLI exposes no Desktop navigation-by-thread contract.
sealed class CodexDesktopWorkspaceLaunchResult
{
    public readonly bool Succeeded;
    public readonly string Detail;

    public CodexDesktopWorkspaceLaunchResult(bool succeeded, string detail)
    {
        Succeeded = succeeded;
        Detail = detail ?? "";
    }
}

static class CodexDesktopWorkspaceLauncher
{
    public static CodexDesktopWorkspaceLaunchResult Launch(string worktreePath)
    {
        string path;
        try { path = Path.GetFullPath(worktreePath ?? ""); }
        catch (Exception ex) { return new CodexDesktopWorkspaceLaunchResult(false, ex.Message); }
        if (!Directory.Exists(path))
            return new CodexDesktopWorkspaceLaunchResult(false, "This worktree folder is unavailable.");

        string codex = AgentWorkflowLauncher.ResolveCodexExecutable();
        if (string.IsNullOrEmpty(codex))
            return new CodexDesktopWorkspaceLaunchResult(false, "Codex is not installed.");

        try
        {
            var start = new ProcessStartInfo(codex, BuildArguments(path));
            start.WorkingDirectory = path;
            start.UseShellExecute = true;
            Process process = Process.Start(start);
            if (process == null)
                return new CodexDesktopWorkspaceLaunchResult(false, "Codex Desktop did not accept the workspace request.");
            return new CodexDesktopWorkspaceLaunchResult(true, "Asked Codex Desktop to open this worktree.");
        }
        catch (Exception ex)
        {
            return new CodexDesktopWorkspaceLaunchResult(false, ex.Message);
        }
    }

    internal static string BuildArguments(string worktreePath)
    {
        return "app " + HiddenProcessRunner.QuoteArgument(worktreePath);
    }

    public static int SelfTest()
    {
        string arguments = BuildArguments("C:\\worktrees\\task one");
        return arguments == "app \"C:\\worktrees\\task one\"" ? 0 : 1;
    }
}
