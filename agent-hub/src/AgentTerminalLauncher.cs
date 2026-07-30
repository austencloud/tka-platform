// Opens one Claude or Codex session in its own Windows Terminal window.
//
// The outer process atomically claims a named color lease, launches Windows
// Terminal with that session's dark background scheme, and transfers the lease
// to a per-session copy of this executable. The inner process holds the lease
// until the CLI exits. Named kernel objects make release automatic even when
// the terminal is closed forcefully, and they coordinate every Agent Hub
// process in the logon session.

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;

class AgentTerminalLauncher
{
    const string LeasePrefix = "Local\\AgentHub.TerminalColor.v1.";
    const string ReadyPrefix = "Local\\AgentHub.TerminalColorReady.v1.";
    const string ManualAssignmentPrefix = "Local\\AgentHub.TerminalColorAssignment.v1.";
    const string ManualAssignmentLockPrefix = "Local\\AgentHub.TerminalColorAssignmentLock.v1.";
    const int ReadyTimeoutMs = 10000;
    const int SessionColorCount = 16;
    const string InitialTitle = "Starting Session";
    const uint Th32csSnapProcess = 0x00000002;
    const uint GenericWrite = 0x40000000;
    const uint FileShareRead = 0x00000001;
    const uint FileShareWrite = 0x00000002;
    const uint OpenExisting = 3;
    const uint EnableVirtualTerminalProcessing = 0x00000004;
    const int MaxPath = 260;
    static readonly IntPtr InvalidHandleValue = new IntPtr(-1);

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)]
    struct ProcessEntry32
    {
        public uint Size;
        public uint Usage;
        public uint ProcessId;
        public IntPtr DefaultHeapId;
        public uint ModuleId;
        public uint Threads;
        public uint ParentProcessId;
        public int BasePriority;
        public uint Flags;

        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = MaxPath)]
        public string ExeFile;
    }

    sealed class ProcessEntry
    {
        public readonly int ParentProcessId;
        public readonly string ExeFile;

        public ProcessEntry(int parentProcessId, string exeFile)
        {
            ParentProcessId = parentProcessId;
            ExeFile = exeFile;
        }
    }

    sealed class ProcessContext
    {
        public readonly int OwnerProcessId;
        public readonly int ConsoleProcessId;

        public ProcessContext(int ownerProcessId, int consoleProcessId)
        {
            OwnerProcessId = ownerProcessId;
            ConsoleProcessId = consoleProcessId;
        }
    }

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern IntPtr CreateToolhelp32Snapshot(uint flags, uint processId);

    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    static extern bool Process32First(IntPtr snapshot, ref ProcessEntry32 entry);

    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    static extern bool Process32Next(IntPtr snapshot, ref ProcessEntry32 entry);

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool FreeConsole();

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool AttachConsole(uint processId);

    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    static extern IntPtr CreateFile(
        string fileName,
        uint desiredAccess,
        uint shareMode,
        IntPtr securityAttributes,
        uint creationDisposition,
        uint flagsAndAttributes,
        IntPtr templateFile
    );

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool GetConsoleMode(IntPtr handle, out uint mode);

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool SetConsoleMode(IntPtr handle, uint mode);

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool WriteFile(
        IntPtr handle,
        byte[] buffer,
        uint bytesToWrite,
        out uint bytesWritten,
        IntPtr overlapped
    );

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool CloseHandle(IntPtr handle);

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
            if (args.ContainsKey("ApplyCurrentColor")) return ApplyCurrentColor();
            if (args.ContainsKey("HoldManualColor")) return HoldManualColor(args);
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

                    List<string> terminalArgs = BuildTerminalArguments(
                        project,
                        title,
                        SessionSchemeName(lease.Index),
                        inner
                    );

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
        if (!int.TryParse(GetRequired(args, "HoldColor"), out colorIndex) || colorIndex < 0 || colorIndex >= SessionColorCount)
            throw new ArgumentException("Invalid terminal color lease index.");

        string agent = NormalizeAgent(GetRequired(args, "Agent"));
        string project = Path.GetFullPath(GetRequired(args, "Project"));
        using (EventWaitHandle lease = EventWaitHandle.OpenExisting(LeaseName(colorIndex)))
        {
            using (EventWaitHandle ready = EventWaitHandle.OpenExisting(GetRequired(args, "ReadyEvent"))) ready.Set();

            Environment.SetEnvironmentVariable("TKA_AGENT_TERMINAL", "1");
            Environment.SetEnvironmentVariable("TKA_AGENT_COLOR_SCHEME", SessionSchemeName(colorIndex));
            Environment.SetEnvironmentVariable(
                "TKA_AGENT_TERMINAL_SESSION_PID",
                Process.GetCurrentProcess().Id.ToString()
            );
            ClearInheritedAgentSessionMarkers();
            try { Console.Title = InitialTitle; } catch { }
            return RunAgent(agent, project, args);
        }
    }

    static int ApplyCurrentColor()
    {
        TextWriter report = Console.Out;
        ProcessContext context = FindProcessContext();

        int colorIndex;
        string source;
        if (TryGetInheritedColor(out colorIndex))
        {
            source = "existing lease";
        }
        else
        {
            colorIndex = GetOrClaimManualColor(context.OwnerProcessId);
            source = "new lease";
        }

        string background = ReadSessionBackground(colorIndex);
        WriteTerminalBackground(context.ConsoleProcessId, background);
        report.WriteLine(
            "Applied {0} ({1}) to this terminal using its {2}.",
            SessionSchemeName(colorIndex),
            background,
            source
        );
        report.Flush();
        return 0;
    }

    static bool TryGetInheritedColor(out int colorIndex)
    {
        string value = Environment.GetEnvironmentVariable("TKA_AGENT_COLOR_SCHEME") ?? "";
        return TryParseSessionScheme(value, out colorIndex);
    }

    static bool TryParseSessionScheme(string value, out int colorIndex)
    {
        colorIndex = -1;
        Match match = Regex.Match(
            (value ?? "").Trim(),
            "^Agent Hub Session ([0-9]{2})$",
            RegexOptions.CultureInvariant
        );
        int number;
        if (!match.Success || !int.TryParse(match.Groups[1].Value, out number)) return false;
        colorIndex = number - 1;
        return colorIndex >= 0 && colorIndex < SessionColorCount;
    }

    static int GetOrClaimManualColor(int ownerProcessId)
    {
        string sessionKey = CurrentTerminalSessionKey(ownerProcessId);
        string lockName = ManualAssignmentLockPrefix + sessionKey;
        bool lockCreated;
        using (var assignmentLock = new Mutex(false, lockName, out lockCreated))
        {
            bool lockTaken = false;
            try
            {
                try { lockTaken = assignmentLock.WaitOne(ReadyTimeoutMs); }
                catch (AbandonedMutexException) { lockTaken = true; }
                if (!lockTaken) throw new TimeoutException("Timed out while assigning this terminal a color.");

                int existingIndex;
                if (TryFindManualAssignment(sessionKey, out existingIndex)) return existingIndex;
                return StartManualColorHolder(sessionKey, ownerProcessId);
            }
            finally
            {
                if (lockTaken) assignmentLock.ReleaseMutex();
            }
        }
    }

    static bool TryFindManualAssignment(string sessionKey, out int colorIndex)
    {
        colorIndex = -1;
        for (int i = 0; i < SessionColorCount; i++)
        {
            try
            {
                using (EventWaitHandle assignment = EventWaitHandle.OpenExisting(ManualAssignmentName(sessionKey, i)))
                {
                    colorIndex = i;
                    return true;
                }
            }
            catch (WaitHandleCannotBeOpenedException) { }
        }
        return false;
    }

    static int StartManualColorHolder(string sessionKey, int ownerProcessId)
    {
        using (ColorLease lease = ClaimColor())
        {
            string assignmentName = ManualAssignmentName(sessionKey, lease.Index);
            bool assignmentCreated;
            using (var assignment = new EventWaitHandle(
                false,
                EventResetMode.ManualReset,
                assignmentName,
                out assignmentCreated
            ))
            {
                if (!assignmentCreated) throw new InvalidOperationException("This terminal already has a color assignment.");

                string readyName = ReadyPrefix + Guid.NewGuid().ToString("N");
                bool readyCreated;
                using (var ready = new EventWaitHandle(false, EventResetMode.ManualReset, readyName, out readyCreated))
                {
                    if (!readyCreated) throw new InvalidOperationException("Could not create the manual color handshake.");

                    string holderPath = CreateSessionCopy();
                    Process holder = null;
                    try
                    {
                        var psi = new ProcessStartInfo(
                            holderPath,
                            JoinArguments(new string[] {
                                "-HoldManualColor",
                                "-ColorIndex", lease.Index.ToString(),
                                "-AssignmentEvent", assignmentName,
                                "-ReadyEvent", readyName,
                                "-OwnerPid", ownerProcessId.ToString()
                            })
                        );
                        psi.UseShellExecute = false;
                        psi.CreateNoWindow = true;
                        holder = Process.Start(psi);
                        if (holder == null) throw new InvalidOperationException("Manual color lease holder did not start.");
                        if (!ready.WaitOne(ReadyTimeoutMs))
                        {
                            try { holder.Kill(); } catch { }
                            throw new TimeoutException("The manual color lease holder did not initialize within 10 seconds.");
                        }
                        return lease.Index;
                    }
                    catch
                    {
                        TryDelete(holderPath);
                        throw;
                    }
                }
            }
        }
    }

    static int HoldManualColor(Dictionary<string, string> args)
    {
        int colorIndex;
        int ownerProcessId;
        if (!int.TryParse(GetRequired(args, "ColorIndex"), out colorIndex) ||
            colorIndex < 0 ||
            colorIndex >= SessionColorCount)
            throw new ArgumentException("Invalid manual terminal color lease index.");
        if (!int.TryParse(GetRequired(args, "OwnerPid"), out ownerProcessId) || ownerProcessId <= 0)
            throw new ArgumentException("Invalid manual terminal color owner process.");

        using (EventWaitHandle lease = EventWaitHandle.OpenExisting(LeaseName(colorIndex)))
        using (EventWaitHandle assignment = EventWaitHandle.OpenExisting(GetRequired(args, "AssignmentEvent")))
        {
            using (EventWaitHandle ready = EventWaitHandle.OpenExisting(GetRequired(args, "ReadyEvent"))) ready.Set();
            try
            {
                using (Process owner = Process.GetProcessById(ownerProcessId)) owner.WaitForExit();
            }
            catch (ArgumentException) { }
        }
        return 0;
    }

    static string ManualAssignmentName(string sessionKey, int colorIndex)
    {
        return ManualAssignmentPrefix + sessionKey + "." + colorIndex;
    }

    static string CurrentTerminalSessionKey(int ownerProcessId)
    {
        string raw = Environment.GetEnvironmentVariable("WT_SESSION") ?? "";
        var safe = new StringBuilder();
        foreach (char ch in raw)
        {
            if (char.IsLetterOrDigit(ch)) safe.Append(char.ToLowerInvariant(ch));
        }
        if (safe.Length == 0) safe.Append("pid").Append(ownerProcessId);
        if (safe.Length > 80) safe.Length = 80;
        return safe.ToString();
    }

    static ProcessContext FindProcessContext()
    {
        Dictionary<int, ProcessEntry> processes = SnapshotProcesses();
        int self = Process.GetCurrentProcess().Id;
        ProcessEntry selfEntry;
        if (!processes.TryGetValue(self, out selfEntry))
            throw new InvalidOperationException("Could not inspect the color helper's process tree.");

        int ownerProcessId = 0;
        int consoleProcessId = 0;
        int childBelowTerminalSession = 0;
        int current = selfEntry.ParentProcessId;
        for (int depth = 0; current > 0 && depth < 64; depth++)
        {
            ProcessEntry entry;
            if (!processes.TryGetValue(current, out entry)) break;
            if (ownerProcessId == 0 && IsAgentProcess(entry.ExeFile)) ownerProcessId = current;
            if (IsTerminalSessionProcess(entry.ExeFile))
            {
                consoleProcessId = current;
                if (ownerProcessId == 0) ownerProcessId = childBelowTerminalSession;
                break;
            }
            childBelowTerminalSession = current;
            current = entry.ParentProcessId;
        }

        int inheritedSessionProcessId;
        if (TryGetPositiveEnvironmentInteger("TKA_AGENT_TERMINAL_SESSION_PID", out inheritedSessionProcessId) &&
            processes.ContainsKey(inheritedSessionProcessId))
            consoleProcessId = inheritedSessionProcessId;

        if (ownerProcessId <= 0)
            throw new InvalidOperationException("Could not identify the current Claude or Codex process.");
        if (consoleProcessId <= 0) consoleProcessId = ownerProcessId;
        return new ProcessContext(ownerProcessId, consoleProcessId);
    }

    static Dictionary<int, ProcessEntry> SnapshotProcesses()
    {
        var result = new Dictionary<int, ProcessEntry>();
        IntPtr snapshot = CreateToolhelp32Snapshot(Th32csSnapProcess, 0);
        if (snapshot == InvalidHandleValue)
            throw new InvalidOperationException("Could not inspect running agent processes.");
        try
        {
            var entry = new ProcessEntry32();
            entry.Size = (uint)Marshal.SizeOf(typeof(ProcessEntry32));
            if (!Process32First(snapshot, ref entry)) return result;
            do
            {
                result[(int)entry.ProcessId] = new ProcessEntry(
                    (int)entry.ParentProcessId,
                    entry.ExeFile ?? ""
                );
            }
            while (Process32Next(snapshot, ref entry));
            return result;
        }
        finally
        {
            CloseHandle(snapshot);
        }
    }

    static bool IsAgentProcess(string fileName)
    {
        string name = Path.GetFileNameWithoutExtension(fileName ?? "").ToLowerInvariant();
        return name.StartsWith("claude", StringComparison.Ordinal) ||
               name.StartsWith("codex", StringComparison.Ordinal);
    }

    static bool IsTerminalSessionProcess(string fileName)
    {
        string name = Path.GetFileNameWithoutExtension(fileName ?? "");
        return name.StartsWith("AgentTerminalSession-", StringComparison.OrdinalIgnoreCase);
    }

    static bool TryGetPositiveEnvironmentInteger(string name, out int value)
    {
        value = 0;
        string raw = Environment.GetEnvironmentVariable(name);
        return int.TryParse(raw, out value) && value > 0;
    }

    static string ReadSessionBackground(int colorIndex)
    {
        string fragmentPath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "Microsoft",
            "Windows Terminal",
            "Fragments",
            "AgentHub",
            "session-backgrounds.json"
        );
        if (!File.Exists(fragmentPath))
            throw new FileNotFoundException("Agent Hub's Windows Terminal color fragment is missing.", fragmentPath);

        string json = File.ReadAllText(fragmentPath);
        Match scheme = Regex.Match(
            json,
            "\"name\"\\s*:\\s*\"" + Regex.Escape(SessionSchemeName(colorIndex)) + "\"",
            RegexOptions.IgnoreCase | RegexOptions.CultureInvariant
        );
        if (!scheme.Success) throw new InvalidDataException("The assigned Agent Hub color scheme is missing.");
        int objectEnd = json.IndexOf('}', scheme.Index);
        if (objectEnd < 0) throw new InvalidDataException("The Agent Hub color fragment is malformed.");
        string schemeObject = json.Substring(scheme.Index, objectEnd - scheme.Index);
        Match background = Regex.Match(
            schemeObject,
            "\"background\"\\s*:\\s*\"(#[0-9a-fA-F]{6})\"",
            RegexOptions.CultureInvariant
        );
        if (!background.Success) throw new InvalidDataException("The assigned Agent Hub background is missing.");
        return background.Groups[1].Value.ToUpperInvariant();
    }

    static void WriteTerminalBackground(int consoleProcessId, string background)
    {
        FreeConsole();
        if (!AttachConsole((uint)consoleProcessId))
            throw new InvalidOperationException(
                "Could not attach to this terminal (Windows error " + Marshal.GetLastWin32Error() + ")."
            );

        IntPtr output = CreateFile(
            "CONOUT$",
            GenericWrite,
            FileShareRead | FileShareWrite,
            IntPtr.Zero,
            OpenExisting,
            0,
            IntPtr.Zero
        );
        if (output == IntPtr.Zero || output == InvalidHandleValue)
            throw new InvalidOperationException(
                "Could not open this terminal's output channel (Windows error " + Marshal.GetLastWin32Error() + ")."
            );

        uint originalMode;
        bool haveMode = GetConsoleMode(output, out originalMode);
        bool changedMode = haveMode && (originalMode & EnableVirtualTerminalProcessing) == 0;
        try
        {
            if (changedMode && !SetConsoleMode(output, originalMode | EnableVirtualTerminalProcessing))
                throw new InvalidOperationException(
                    "Could not enable terminal color output (Windows error " + Marshal.GetLastWin32Error() + ")."
                );

            string sequence = BuildTerminalBackgroundSequence(background);
            byte[] bytes = Encoding.UTF8.GetBytes(sequence);
            uint written;
            if (!WriteFile(output, bytes, (uint)bytes.Length, out written, IntPtr.Zero) ||
                written != bytes.Length)
                throw new IOException(
                    "Could not write this terminal's background (Windows error " + Marshal.GetLastWin32Error() + ")."
                );
        }
        finally
        {
            if (changedMode) SetConsoleMode(output, originalMode);
            CloseHandle(output);
        }
    }

    static string BuildTerminalBackgroundSequence(string background)
    {
        return
            "\x1b]11;" + background + "\x07" +
            "\x1b]4;0;" + background + "\x07";
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

    // The resident tray host can be started from inside an agent session and
    // freezes that session's environment into every terminal it spawns. Claude
    // Code treats an inherited CLAUDE_CODE_CHILD_SESSION as "I am a nested
    // session" and silently disables transcript saving, so those sessions never
    // show up in /resume. Every launch here is a real top-level session, so the
    // markers are cleared before the agent starts.
    static readonly string[] InheritedAgentSessionMarkers = {
        "CLAUDE_CODE_CHILD_SESSION",
        "CLAUDE_CODE_SESSION_ID",
        "CLAUDE_CODE_BRIDGE_SESSION_ID",
        "CLAUDE_CODE_ENTRYPOINT",
        "CLAUDECODE",
        "CLAUDE_PID",
        "CODEX_SANDBOX",
        "CODEX_SANDBOX_NETWORK_DISABLED"
    };

    static void ClearInheritedAgentSessionMarkers()
    {
        foreach (string name in InheritedAgentSessionMarkers)
        {
            try { Environment.SetEnvironmentVariable(name, null); } catch { }
        }
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
        for (int i = 0; i < SessionColorCount; i++)
        {
            bool created;
            EventWaitHandle handle = new EventWaitHandle(false, EventResetMode.ManualReset, LeaseName(prefix, i), out created);
            if (created) return new ColorLease(i, handle);
            handle.Dispose();
        }
        throw new InvalidOperationException("All " + SessionColorCount + " agent terminal colors are already in use.");
    }

    static string LeaseName(int index)
    {
        return LeaseName(LeasePrefix, index);
    }

    static string LeaseName(string prefix, int index)
    {
        return prefix + index;
    }

    static string SessionSchemeName(int index)
    {
        return "Agent Hub Session " + (index + 1).ToString("00");
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
        string colorScheme,
        IEnumerable<string> inner
    )
    {
        var result = new List<string> {
            "-w", "new",
            "new-tab",
            "--startingDirectory", project,
            "--title", title,
            "--colorScheme", colorScheme,
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
            for (int i = 0; i < SessionColorCount; i++)
            {
                ColorLease lease = ClaimColor(testPrefix);
                leases.Add(lease);
                if (!indexes.Add(lease.Index)) throw new Exception("Color leases collided.");
            }
            bool exhausted = false;
            try { ClaimColor(testPrefix).Dispose(); }
            catch (InvalidOperationException) { exhausted = true; }
            if (!exhausted) throw new Exception("Session tint exhaustion reused an active color.");

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
                SessionSchemeName(0),
                new string[] { "session.exe", "-Agent", "codex" }
            ));
            if (terminalArgs.IndexOf("-w new new-tab", StringComparison.Ordinal) < 0 ||
                terminalArgs.IndexOf("--tabColor", StringComparison.Ordinal) >= 0 ||
                terminalArgs.IndexOf("--colorScheme \"Agent Hub Session 01\"", StringComparison.Ordinal) < 0 ||
                terminalArgs.IndexOf("--useApplicationTitle", StringComparison.Ordinal) < 0)
                throw new Exception("Windows Terminal arguments are missing the window, background-matched tab, color scheme, or live-title option.");

            int parsedColor;
            if (!TryParseSessionScheme("Agent Hub Session 04", out parsedColor) ||
                parsedColor != 3 ||
                TryParseSessionScheme("Agent Hub Session 17", out parsedColor))
                throw new Exception("Session color scheme parsing accepted an invalid assignment.");
            string colorSequence = BuildTerminalBackgroundSequence("#123456");
            if (colorSequence.IndexOf("\x1b]11;#123456\x07", StringComparison.Ordinal) < 0 ||
                colorSequence.IndexOf("\x1b]4;0;#123456\x07", StringComparison.Ordinal) < 0)
                throw new Exception("Terminal background output is missing its default-background or ANSI black update.");

            Console.WriteLine("PASS: all " + SessionColorCount + " session colors were unique, exhaustion-safe, and reusable after release.");
            Console.WriteLine("PASS: Windows Terminal window, background-matched tab, color scheme, live-title, and quoting arguments validated.");
            Console.WriteLine("PASS: inherited color parsing and live terminal background output validated.");
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
