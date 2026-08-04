using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;

sealed class SessionTitleManager : IDisposable
{
    const int MonitorIntervalMs = 1000;
    const int MaxTitleLength = 48;
    static readonly Regex SessionExecutablePattern = new Regex(
        "^AgentTerminalSession-[0-9a-f]{32}\\.exe$",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant
    );

    readonly string _assignmentPath;
    readonly Action<string> _applyTitle;
    readonly EventWaitHandle _stop = new EventWaitHandle(false, EventResetMode.ManualReset);
    Thread _thread;

    SessionTitleManager(string assignmentPath, Action<string> applyTitle)
    {
        _assignmentPath = assignmentPath;
        _applyTitle = applyTitle;
    }

    public static SessionTitleManager ForCurrentSession(Action<string> applyTitle)
    {
        if (applyTitle == null) throw new ArgumentNullException("applyTitle");
        string executablePath = Assembly.GetExecutingAssembly().Location;
        return new SessionTitleManager(AssignmentPathForExecutable(executablePath), applyTitle);
    }

    public static string Assign(int sessionProcessId, string title)
    {
        string normalized = NormalizeTitle(title);
        string executablePath = SessionExecutablePath(sessionProcessId);
        string assignmentPath = AssignmentPathForExecutable(executablePath);
        WriteAtomically(assignmentPath, normalized);
        return normalized;
    }

    public static bool TryReadAssignment(int sessionProcessId, out string title)
    {
        title = "";
        string executablePath = SessionExecutablePath(sessionProcessId);
        string assignmentPath = AssignmentPathForExecutable(executablePath);
        if (!File.Exists(assignmentPath)) return false;
        title = NormalizeTitle(ReadSharedText(assignmentPath));
        return true;
    }

    public void Start()
    {
        if (_thread != null) throw new InvalidOperationException("The session title monitor is already running.");
        ApplyCurrentAssignment();
        _thread = new Thread(MonitorLoop);
        _thread.IsBackground = true;
        _thread.Name = "Agent Hub session title monitor";
        _thread.Start();
    }

    void MonitorLoop()
    {
        while (!_stop.WaitOne(MonitorIntervalMs))
        {
            try { ApplyCurrentAssignment(); }
            catch (Exception ex) { AgentTerminalLauncher.LogSessionTitleError(ex); }
        }
    }

    void ApplyCurrentAssignment()
    {
        if (!File.Exists(_assignmentPath)) return;
        string title = NormalizeTitle(ReadSharedText(_assignmentPath));
        _applyTitle(title);
    }

    public void Dispose()
    {
        _stop.Set();
        if (_thread != null && _thread.IsAlive) _thread.Join(MonitorIntervalMs + 1000);
        _stop.Dispose();
        TryDelete(_assignmentPath);
    }

    internal static string NormalizeTitle(string value)
    {
        if (value == null) throw new ArgumentNullException("value");
        var words = Regex.Split(value.Trim(), "\\s+");
        var kept = new System.Collections.Generic.List<string>();
        foreach (string word in words)
        {
            if (word.Length == 0) continue;
            foreach (char character in word)
            {
                if (char.IsControl(character))
                    throw new ArgumentException("Session titles cannot contain control characters.");
            }
            kept.Add(word);
        }

        if (kept.Count < 2 || kept.Count > 4)
            throw new ArgumentException("Session titles must contain two to four words.");
        string normalized = string.Join(" ", kept.ToArray());
        if (normalized.Length > MaxTitleLength)
            throw new ArgumentException("Session titles cannot exceed " + MaxTitleLength + " characters.");
        return normalized;
    }

    internal static string AssignmentPathForExecutable(string executablePath)
    {
        string fileName = Path.GetFileName(executablePath);
        if (!SessionExecutablePattern.IsMatch(fileName))
            throw new InvalidOperationException("The target is not a live Agent Hub session executable.");

        string directory = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "AgentHub",
            "session-titles"
        );
        Directory.CreateDirectory(directory);
        return Path.Combine(directory, fileName + ".title");
    }

    static string SessionExecutablePath(int processId)
    {
        if (processId <= 0) throw new ArgumentOutOfRangeException("processId");
        try
        {
            using (Process process = Process.GetProcessById(processId))
            {
                if (process.HasExited)
                    throw new InvalidOperationException("The Agent Hub session has already exited.");
                return process.MainModule.FileName;
            }
        }
        catch (ArgumentException)
        {
            throw new InvalidOperationException("The Agent Hub session has already exited.");
        }
    }

    static string ReadSharedText(string path)
    {
        using (var stream = new FileStream(
            path,
            FileMode.Open,
            FileAccess.Read,
            FileShare.ReadWrite | FileShare.Delete
        ))
        using (var reader = new StreamReader(stream, Encoding.UTF8, true))
        {
            return reader.ReadToEnd();
        }
    }

    static void WriteAtomically(string path, string value)
    {
        string temporaryPath = path + "." + Guid.NewGuid().ToString("N") + ".tmp";
        try
        {
            File.WriteAllText(temporaryPath, value, new UTF8Encoding(false));
            if (File.Exists(path))
                File.Replace(temporaryPath, path, null);
            else
                File.Move(temporaryPath, path);
        }
        finally
        {
            TryDelete(temporaryPath);
        }
    }

    static void TryDelete(string path)
    {
        try { if (File.Exists(path)) File.Delete(path); }
        catch { }
    }
}
