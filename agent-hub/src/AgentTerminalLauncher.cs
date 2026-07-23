// Opens one Claude or Codex session in its own Windows Terminal window.
//
// The outer process atomically claims a named color lease, launches Windows
// Terminal with that tab color, and transfers the lease to a per-session copy
// of this executable. The inner process holds the lease until the CLI exits.
// Named kernel objects make release automatic even when the terminal is closed
// forcefully, and they coordinate every Agent Hub process in the logon session.

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Text;
using System.Threading;

class AgentTerminalLauncher
{
    const string LeasePrefix = "Local\\AgentHub.TerminalColor.v1.";
    const string ReadyPrefix = "Local\\AgentHub.TerminalColorReady.v1.";
    const int ReadyTimeoutMs = 10000;
    const string InitialTitle = "Starting Session";

    // Generated with:
    // glasbey.create_palette(16, grid_space="JCh", lightness_bounds=(42, 75),
    //     chroma_bounds=(35, 85), optimize_palette=True)
    // The bounds keep every color visible against Windows Terminal's dark chrome.
    static readonly string[] Palette = new string[] {
        "#f75f01", "#06970b", "#8c5dfe", "#04d3eb",
        "#f4ae00", "#ffa4f1", "#05ee9f", "#9a7717",
        "#b5b7fe", "#da0b9b", "#ffaa95", "#0885df",
        "#ab79b1", "#a8de01", "#378e85", "#b36260"
    };

    sealed class ColorLease : IDisposable
    {
        public readonly int Index;
        public readonly EventWaitHandle Handle;

        public ColorLease(int index, EventWaitHandle handle)
        {
            Index = index;
            Handle = handle;
        }

        public void Dispose()
        {
            Handle.Dispose();
        }
    }

    static int Main(string[] argv)
    {
        try
        {
            Dictionary<string, string> args = ParseArgs(argv);
            if (args.ContainsKey("SelfTest")) return SelfTest();
            if (args.ContainsKey("SelfTestLeaseChild")) return SelfTestLeaseChild(args);
            if (args.ContainsKey("HoldColor")) return RunInsideTerminal(args);
            return LaunchTerminal(args);
        }
        catch (Exception ex)
        {
            LogError(ex.ToString());
            try { Console.Error.WriteLine("Agent terminal launch failed: " + ex.Message); } catch { }
            return 1;
        }
    }

    static int LaunchTerminal(Dictionary<string, string> args)
    {
        string agent = NormalizeAgent(GetRequired(args, "Agent"));
        string project = Path.GetFullPath(GetRequired(args, "Project"));
        if (!Directory.Exists(project)) throw new DirectoryNotFoundException("Project directory not found: " + project);

        using (ColorLease lease = ClaimColor())
        {
            string readyName = ReadyPrefix + Guid.NewGuid().ToString("N");
            bool readyCreated;
            using (var ready = new EventWaitHandle(false, EventResetMode.ManualReset, readyName, out readyCreated))
            {
                if (!readyCreated) throw new InvalidOperationException("Could not create the terminal color handshake.");

                string sessionExe = CreateSessionCopy();
                try
                {
                    string wt = ResolveWindowsTerminal();
                    string title = InitialTitle;
                    var inner = new List<string> {
                        sessionExe,
                        "-HoldColor", lease.Index.ToString(),
                        "-ReadyEvent", readyName,
                        "-Agent", agent,
                        "-Project", project
                    };
                    AddOptionalPair(inner, args, "Bat");
                    AddOptionalPair(inner, args, "Executable");

                    List<string> terminalArgs = BuildTerminalArguments(project, title, Palette[lease.Index], inner);

                    var psi = new ProcessStartInfo(wt, JoinArguments(terminalArgs));
                    psi.WorkingDirectory = project;
                    psi.UseShellExecute = false;
                    psi.CreateNoWindow = true;
                    Process terminal = Process.Start(psi);
                    if (terminal == null) throw new InvalidOperationException("Windows Terminal did not start.");

                    if (!ready.WaitOne(ReadyTimeoutMs))
                    {
                        string detail = terminal.HasExited ? " Exit code: " + terminal.ExitCode + "." : "";
                        throw new TimeoutException("The colored terminal did not initialize within 10 seconds." + detail);
                    }
                    return 0;
                }
                catch
                {
                    TryDelete(sessionExe);
                    throw;
                }
            }
        }
    }

    static int RunInsideTerminal(Dictionary<string, string> args)
    {
        int colorIndex;
        if (!int.TryParse(GetRequired(args, "HoldColor"), out colorIndex) || colorIndex < 0 || colorIndex >= Palette.Length)
            throw new ArgumentException("Invalid terminal color lease index.");

        string agent = NormalizeAgent(GetRequired(args, "Agent"));
        string project = Path.GetFullPath(GetRequired(args, "Project"));
        using (EventWaitHandle lease = EventWaitHandle.OpenExisting(LeaseName(colorIndex)))
        {
            using (EventWaitHandle ready = EventWaitHandle.OpenExisting(GetRequired(args, "ReadyEvent"))) ready.Set();

            Environment.SetEnvironmentVariable("TKA_AGENT_TERMINAL", "1");
            Environment.SetEnvironmentVariable("TKA_AGENT_TAB_COLOR", Palette[colorIndex]);
            try { Console.Title = InitialTitle; } catch { }
            return RunAgent(agent, project, args);
        }
    }

    static int RunAgent(string agent, string project, Dictionary<string, string> args)
    {
        string bat;
        if (args.TryGetValue("Bat", out bat) && !string.IsNullOrWhiteSpace(bat) && File.Exists(bat))
        {
            return RunProcess(
                Environment.GetEnvironmentVariable("ComSpec") ?? "cmd.exe",
                "/d /c call " + QuoteArgument(Path.GetFullPath(bat)),
                project
            );
        }

        string executable;
        if (args.TryGetValue("Executable", out executable) && !string.IsNullOrWhiteSpace(executable))
        {
            string flags = agent == "codex"
                ? "--dangerously-bypass-approvals-and-sandbox"
                : "--dangerously-skip-permissions";
            if (executable.EndsWith(".cmd", StringComparison.OrdinalIgnoreCase) ||
                executable.EndsWith(".bat", StringComparison.OrdinalIgnoreCase))
            {
                return RunProcess(
                    Environment.GetEnvironmentVariable("ComSpec") ?? "cmd.exe",
                    "/d /c call " + QuoteArgument(executable) + " " + flags,
                    project
                );
            }
            return RunProcess(executable, flags, project);
        }

        string command = agent == "codex"
            ? "codex --dangerously-bypass-approvals-and-sandbox"
            : "claude --dangerously-skip-permissions";
        return RunProcess(
            Environment.GetEnvironmentVariable("ComSpec") ?? "cmd.exe",
            "/d /c " + command,
            project
        );
    }

    static int RunProcess(string fileName, string arguments, string workingDirectory)
    {
        var psi = new ProcessStartInfo(fileName, arguments);
        psi.WorkingDirectory = workingDirectory;
        psi.UseShellExecute = false;
        Process child = Process.Start(psi);
        if (child == null) throw new InvalidOperationException("Agent process did not start.");
        child.WaitForExit();
        return child.ExitCode;
    }

    static ColorLease ClaimColor()
    {
        return ClaimColor(LeasePrefix);
    }

    static ColorLease ClaimColor(string prefix)
    {
        for (int i = 0; i < Palette.Length; i++)
        {
            bool created;
            EventWaitHandle handle = new EventWaitHandle(false, EventResetMode.ManualReset, LeaseName(prefix, i), out created);
            if (created) return new ColorLease(i, handle);
            handle.Dispose();
        }
        throw new InvalidOperationException("All " + Palette.Length + " agent terminal colors are already in use.");
    }

    static string LeaseName(int index)
    {
        return LeaseName(LeasePrefix, index);
    }

    static string LeaseName(string prefix, int index)
    {
        return prefix + index;
    }

    static string CreateSessionCopy()
    {
        string dir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "AgentHub",
            "sessions"
        );
        Directory.CreateDirectory(dir);
        CleanupSessionCopies(dir);
        string destination = Path.Combine(dir, "AgentTerminalSession-" + Guid.NewGuid().ToString("N") + ".exe");
        string source = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "AgentTerminalSession.exe");
        if (!File.Exists(source)) source = Assembly.GetExecutingAssembly().Location;
        File.Copy(source, destination, false);
        return destination;
    }

    static void CleanupSessionCopies(string dir)
    {
        foreach (string path in Directory.GetFiles(dir, "AgentTerminalSession-*.exe"))
        {
            try
            {
                if (File.GetLastWriteTimeUtc(path) < DateTime.UtcNow.AddMinutes(-1)) File.Delete(path);
            }
            catch { }
        }
    }

    static string ResolveWindowsTerminal()
    {
        string alias = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "Microsoft",
            "WindowsApps",
            "wt.exe"
        );
        if (File.Exists(alias)) return alias;

        string path = FindOnPath("wt.exe");
        if (path != null) return path;
        throw new FileNotFoundException("Windows Terminal (wt.exe) is required.");
    }

    static string FindOnPath(string fileName)
    {
        string value = Environment.GetEnvironmentVariable("PATH") ?? "";
        foreach (string raw in value.Split(Path.PathSeparator))
        {
            string dir = raw.Trim().Trim('"');
            if (dir.Length == 0) continue;
            try
            {
                string candidate = Path.Combine(dir, fileName);
                if (File.Exists(candidate)) return candidate;
            }
            catch { }
        }
        return null;
    }

    static Dictionary<string, string> ParseArgs(string[] argv)
    {
        var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        for (int i = 0; i < argv.Length; i++)
        {
            string token = argv[i];
            if (!token.StartsWith("-", StringComparison.Ordinal)) continue;
            string key = token.TrimStart('-');
            string value = "true";
            if (i + 1 < argv.Length && !argv[i + 1].StartsWith("-", StringComparison.Ordinal)) value = argv[++i];
            result[key] = value;
        }
        return result;
    }

    static string GetRequired(Dictionary<string, string> args, string name)
    {
        string value;
        if (!args.TryGetValue(name, out value) || string.IsNullOrWhiteSpace(value))
            throw new ArgumentException("Missing -" + name + ".");
        return value;
    }

    static void AddOptionalPair(List<string> destination, Dictionary<string, string> args, string name)
    {
        string value;
        if (args.TryGetValue(name, out value) && !string.IsNullOrWhiteSpace(value))
        {
            destination.Add("-" + name);
            destination.Add(value);
        }
    }

    static string NormalizeAgent(string agent)
    {
        string normalized = agent.Trim().ToLowerInvariant();
        if (normalized != "claude" && normalized != "codex")
            throw new ArgumentException("Agent must be claude or codex.");
        return normalized;
    }

    static string JoinArguments(IEnumerable<string> args)
    {
        var quoted = new List<string>();
        foreach (string arg in args) quoted.Add(QuoteArgument(arg));
        return string.Join(" ", quoted.ToArray());
    }

    static List<string> BuildTerminalArguments(
        string project,
        string title,
        string color,
        IEnumerable<string> inner
    )
    {
        var result = new List<string> {
            "-w", "new",
            "new-tab",
            "--startingDirectory", project,
            "--title", title,
            "--tabColor", color,
            "--useApplicationTitle",
            "--inheritEnvironment"
        };
        result.AddRange(inner);
        return result;
    }

    // Implements the CommandLineToArgvW-compatible quoting rules used by
    // ProcessStartInfo.Arguments on .NET Framework.
    static string QuoteArgument(string value)
    {
        if (value == null || value.Length == 0) return "\"\"";
        bool needsQuotes = false;
        for (int i = 0; i < value.Length; i++)
        {
            char ch = value[i];
            if (char.IsWhiteSpace(ch) || ch == '"') { needsQuotes = true; break; }
        }
        if (!needsQuotes) return value;

        var result = new StringBuilder();
        result.Append('"');
        int slashes = 0;
        foreach (char ch in value)
        {
            if (ch == '\\')
            {
                slashes++;
            }
            else if (ch == '"')
            {
                result.Append('\\', slashes * 2 + 1);
                result.Append('"');
                slashes = 0;
            }
            else
            {
                result.Append('\\', slashes);
                result.Append(ch);
                slashes = 0;
            }
        }
        result.Append('\\', slashes * 2);
        result.Append('"');
        return result.ToString();
    }

    static void TryDelete(string path)
    {
        try { if (File.Exists(path)) File.Delete(path); } catch { }
    }

    static void LogError(string message)
    {
        try
        {
            string dir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "AgentHub");
            Directory.CreateDirectory(dir);
            File.AppendAllText(
                Path.Combine(dir, "launch-errors.log"),
                DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss.fff") + " " + message + "\r\n"
            );
        }
        catch { }
    }

    static int SelfTest()
    {
        string testPrefix = "Local\\AgentHub.TerminalColorTest." + Guid.NewGuid().ToString("N") + ".";
        var leases = new List<ColorLease>();
        try
        {
            var indexes = new HashSet<int>();
            for (int i = 0; i < Palette.Length; i++)
            {
                ColorLease lease = ClaimColor(testPrefix);
                leases.Add(lease);
                if (!indexes.Add(lease.Index)) throw new Exception("Color leases collided.");
            }
            bool exhausted = false;
            try { ClaimColor(testPrefix).Dispose(); }
            catch (InvalidOperationException) { exhausted = true; }
            if (!exhausted) throw new Exception("Palette exhaustion reused an active color.");

            int releasedIndex = leases[5].Index;
            leases[5].Dispose();
            leases.RemoveAt(5);
            using (ColorLease replacement = ClaimColor(testPrefix))
            {
                if (replacement.Index != releasedIndex) throw new Exception("Released color was not reusable.");
            }

            string encoded = JoinArguments(new string[] { "plain", "path with spaces", "ends\\", "quote\"inside" });
            if (encoded.IndexOf("\"path with spaces\"", StringComparison.Ordinal) < 0)
                throw new Exception("Argument quoting lost a spaced value.");
            string terminalArgs = JoinArguments(BuildTerminalArguments(
                "C:\\project with spaces",
                InitialTitle,
                Palette[0],
                new string[] { "session.exe", "-Agent", "codex" }
            ));
            if (terminalArgs.IndexOf("-w new new-tab", StringComparison.Ordinal) < 0 ||
                terminalArgs.IndexOf("--tabColor " + Palette[0], StringComparison.Ordinal) < 0 ||
                terminalArgs.IndexOf("--useApplicationTitle", StringComparison.Ordinal) < 0)
                throw new Exception("Windows Terminal arguments are missing the window, color, or live-title option.");

            Console.WriteLine("PASS: all " + Palette.Length + " colors were unique, exhaustion-safe, and reusable after release.");
            Console.WriteLine("PASS: Windows Terminal window, color, live-title, and quoting arguments validated.");
        }
        finally
        {
            foreach (ColorLease lease in leases) lease.Dispose();
        }

        string crossPrefix = "Local\\AgentHub.TerminalColorProcessTest." + Guid.NewGuid().ToString("N") + ".";
        string releaseName = "Local\\AgentHub.TerminalColorProcessTestRelease." + Guid.NewGuid().ToString("N");
        bool releaseCreated;
        using (var release = new EventWaitHandle(false, EventResetMode.ManualReset, releaseName, out releaseCreated))
        {
            if (!releaseCreated) throw new Exception("Could not create the cross-process test event.");
            var psi = new ProcessStartInfo(
                Assembly.GetExecutingAssembly().Location,
                JoinArguments(new string[] {
                    "-SelfTestLeaseChild",
                    "-LeasePrefix", crossPrefix,
                    "-ReleaseEvent", releaseName
                })
            );
            psi.UseShellExecute = false;
            psi.CreateNoWindow = true;
            psi.RedirectStandardOutput = true;
            Process child = Process.Start(psi);
            if (child == null) throw new Exception("Cross-process lease test did not start.");
            string line = child.StandardOutput.ReadLine();
            int childIndex;
            if (!int.TryParse(line, out childIndex)) throw new Exception("Cross-process lease test returned no color index.");

            using (ColorLease sibling = ClaimColor(crossPrefix))
            {
                if (sibling.Index == childIndex) throw new Exception("Cross-process color leases collided.");
                child.Kill();
                if (!child.WaitForExit(5000)) throw new Exception("Cross-process lease holder did not stop.");
                using (ColorLease replacement = ClaimColor(crossPrefix))
                {
                    if (replacement.Index != childIndex)
                        throw new Exception("A terminated child process did not release its color lease.");
                }
            }
        }
        Console.WriteLine("PASS: cross-process color leases stayed distinct and released after forced process exit.");
        return 0;
    }

    static int SelfTestLeaseChild(Dictionary<string, string> args)
    {
        using (ColorLease lease = ClaimColor(GetRequired(args, "LeasePrefix")))
        {
            Console.WriteLine(lease.Index);
            Console.Out.Flush();
            using (EventWaitHandle release = EventWaitHandle.OpenExisting(GetRequired(args, "ReleaseEvent")))
            {
                if (!release.WaitOne(5000)) return 2;
            }
        }
        return 0;
    }
}
