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
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.Management;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Security.Principal;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;

class AgentTerminalLauncher
{
    const string LeasePrefix = "Local\\AgentHub.TerminalColor.v1.";
    const string ReadyPrefix = "Local\\AgentHub.TerminalColorReady.v1.";
    const string ManualAssignmentPrefix = "Local\\AgentHub.TerminalColorAssignment.v1.";
    const string ManualAssignmentLockPrefix = "Local\\AgentHub.TerminalColorAssignmentLock.v1.";
    const string RecoveryLogLockName = "Local\\AgentHub.TerminalColorRecoveryLog.v1";
    const string WatchdogMutexName = "Local\\AgentHub.TerminalColorWatchdog.v1";
    const int ReadyTimeoutMs = 10000;
    const int ColorMonitorIntervalMs = 2000;
    const int GlobalColorMonitorIntervalMs = 5000;
    const int ColorMonitorFallbackIntervalMs = 30000;
    const int ColorRepairVerificationTimeoutMs = 1000;
    const int SessionColorCount = 16;
    const string InitialTitle = "Starting Session";
    const uint Th32csSnapProcess = 0x00000002;
    const uint GenericRead = 0x80000000;
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

    [StructLayout(LayoutKind.Sequential)]
    struct Coord
    {
        public short X;
        public short Y;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct SmallRect
    {
        public short Left;
        public short Top;
        public short Right;
        public short Bottom;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct ConsoleScreenBufferInfoEx
    {
        public uint Size;
        public Coord BufferSize;
        public Coord CursorPosition;
        public ushort Attributes;
        public SmallRect Window;
        public Coord MaximumWindowSize;
        public ushort PopupAttributes;

        [MarshalAs(UnmanagedType.Bool)]
        public bool FullscreenSupported;

        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 16)]
        public uint[] ColorTable;
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

    sealed class ColorTarget
    {
        public readonly int SourceProcessId;
        public readonly int ConsoleProcessId;
        public readonly int ColorIndex;

        public ColorTarget(int sourceProcessId, int consoleProcessId, int colorIndex)
        {
            SourceProcessId = sourceProcessId;
            ConsoleProcessId = consoleProcessId;
            ColorIndex = colorIndex;
        }
    }

    sealed class ColorTargetDiscovery
    {
        public readonly List<ColorTarget> Targets = new List<ColorTarget>();
        public readonly List<int> InaccessibleProcessIds = new List<int>();
        public readonly List<int> UnrecognizedProcessIds = new List<int>();
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
    static extern bool GetConsoleScreenBufferInfoEx(
        IntPtr consoleOutput,
        ref ConsoleScreenBufferInfoEx info
    );

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

    sealed class TerminalColorMonitor : IDisposable
    {
        readonly string _background;
        readonly ManualResetEvent _stop = new ManualResetEvent(false);
        Thread _thread;
        bool _probeWarningLogged;
        bool _monitorFailureLogged;

        public TerminalColorMonitor(string background)
        {
            _background = NormalizeBackground(background);
        }

        public void Start()
        {
            if (_thread != null) throw new InvalidOperationException("The terminal color monitor is already running.");
            CheckAndRepair("startup");
            _thread = new Thread(MonitorLoop);
            _thread.IsBackground = true;
            _thread.Name = "Agent Hub terminal color monitor";
            _thread.Start();
        }

        void MonitorLoop()
        {
            int interval = ColorMonitorIntervalMs;
            while (!_stop.WaitOne(interval))
            {
                try
                {
                    bool probeAvailable = CheckAndRepair("watchdog");
                    interval = probeAvailable ? ColorMonitorIntervalMs : ColorMonitorFallbackIntervalMs;
                    _monitorFailureLogged = false;
                }
                catch (Exception ex)
                {
                    interval = ColorMonitorFallbackIntervalMs;
                    if (!_monitorFailureLogged)
                    {
                        LogError("Terminal color monitor failed; it will retry. " + ex);
                        _monitorFailureLogged = true;
                    }
                }
            }
        }

        bool CheckAndRepair(string reason)
        {
            uint observed;
            int probeError;
            if (!TryReadAttachedPaletteColor(0, out observed, out probeError))
            {
                WriteAttachedTerminalBackground(_background);
                if (!_probeWarningLogged)
                {
                    LogError(
                        "Terminal color monitor could not read the ANSI palette (Windows error " +
                        probeError +
                        "); it will use a periodic fallback repaint."
                    );
                    _probeWarningLogged = true;
                }
                return false;
            }

            _probeWarningLogged = false;
            if (PaletteColorMatches(observed, _background)) return true;

            string observedBackground = ColorRefToHex(observed);
            WriteAttachedTerminalBackground(_background);
            if (!WaitForAttachedPaletteColor(_background, ColorRepairVerificationTimeoutMs))
                throw new InvalidOperationException(
                    "The terminal accepted a color repaint but its ANSI palette did not converge to " +
                    _background +
                    "."
                );

            LogColorRecovery(reason, observedBackground, _background);
            return true;
        }

        public void Dispose()
        {
            _stop.Set();
            if (_thread != null && _thread.IsAlive) _thread.Join(ColorMonitorIntervalMs + 1000);
            _stop.Dispose();
        }
    }

    static int Main(string[] argv)
    {
        try
        {
            Dictionary<string, string> args = ParseArgs(argv);
            if (args.ContainsKey("SelfTest")) return SelfTest();
            if (args.ContainsKey("SelfTestLeaseChild")) return SelfTestLeaseChild(args);
            if (args.ContainsKey("SelfTestColorMonitor")) return SelfTestColorMonitor(args);
            if (args.ContainsKey("SelfTestLegacyColorTarget")) return SelfTestLegacyColorTarget(args);
            if (args.ContainsKey("WatchAllColors")) return WatchAllColors();
            if (args.ContainsKey("ApplyAllColorsElevated")) return ApplyAllColorsElevated(args);
            if (args.ContainsKey("ApplyAllColors")) return ApplyAllColors();
            if (args.ContainsKey("ApplyCurrentColor")) return ApplyCurrentColor();
            if (args.ContainsKey("ApplySessionTitle")) return ApplySessionTitle(args);
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
        string project = SanitizeProjectPath(GetRequired(args, "Project"));
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
                    string requestedTitle;
                    if (args.TryGetValue("Title", out requestedTitle) && !string.IsNullOrWhiteSpace(requestedTitle))
                        title = SessionTitleManager.NormalizeTitle(requestedTitle);
                    var inner = new List<string> {
                        sessionExe,
                        "-HoldColor", lease.Index.ToString(),
                        "-ReadyEvent", readyName,
                        "-Agent", agent,
                        "-Project", project
                    };
                    AddOptionalPair(inner, args, "Bat");
                    AddOptionalPair(inner, args, "Executable");
                    AddOptionalPair(inner, args, "Prompt");
                    AddOptionalPair(inner, args, "Title");

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
        string project = SanitizeProjectPath(GetRequired(args, "Project"));
        using (EventWaitHandle lease = EventWaitHandle.OpenExisting(LeaseName(colorIndex)))
        {
            Environment.SetEnvironmentVariable("TKA_AGENT_TERMINAL", "1");
            Environment.SetEnvironmentVariable("TKA_AGENT_COLOR_SCHEME", SessionSchemeName(colorIndex));
            Environment.SetEnvironmentVariable(
                "TKA_AGENT_TERMINAL_SESSION_PID",
                Process.GetCurrentProcess().Id.ToString()
            );
            string initialTitle = InitialTitle;
            string requestedTitle;
            if (args.TryGetValue("Title", out requestedTitle) && !string.IsNullOrWhiteSpace(requestedTitle))
            {
                initialTitle = SessionTitleManager.NormalizeTitle(requestedTitle);
                SessionTitleManager.Assign(Process.GetCurrentProcess().Id, initialTitle);
            }

            using (var monitor = new TerminalColorMonitor(ReadSessionBackground(colorIndex)))
            using (var titleManager = SessionTitleManager.ForCurrentSession(WriteAttachedTerminalTitle))
            {
                monitor.Start();
                titleManager.Start();
                using (EventWaitHandle ready = EventWaitHandle.OpenExisting(GetRequired(args, "ReadyEvent"))) ready.Set();

                ClearInheritedAgentSessionMarkers();
                try { Console.Title = initialTitle; } catch { }
                return RunAgent(agent, project, args);
            }
        }
    }

    static int ApplySessionTitle(Dictionary<string, string> args)
    {
        int processId;
        if (!int.TryParse(GetRequired(args, "OwnerPid"), out processId) || processId <= 0)
            throw new ArgumentException("OwnerPid must identify a live Agent Hub session.");

        string title = SessionTitleManager.Assign(processId, GetRequired(args, "Title"));
        ProcessContext origin = FindProcessContext();
        try { WriteTerminalTitle(processId, title); }
        finally
        {
            FreeConsole();
            AttachConsole((uint)origin.ConsoleProcessId);
        }
        Console.WriteLine("Named Agent Hub session {0}: {1}", processId, title);
        return 0;
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

    static int ApplyAllColors()
    {
        TextWriter report = Console.Out;
        ColorTargetDiscovery discovery = DiscoverColorTargets();
        if (discovery.InaccessibleProcessIds.Count > 0 && !IsAdministrator())
            return RunElevatedColorRestore(report);

        ProcessContext origin = FindProcessContext();
        int exitCode;
        using (var details = new StringWriter())
        {
            try
            {
                exitCode = ApplyDiscoveredColors(discovery, details);
            }
            finally
            {
                FreeConsole();
                AttachConsole((uint)origin.ConsoleProcessId);
            }
            report.Write(details.ToString());
        }
        report.Flush();
        return exitCode;
    }

    static int ApplyAllColorsElevated(Dictionary<string, string> args)
    {
        string resultPath = ValidateBulkResultPath(GetRequired(args, "ResultFile"));
        int exitCode = 1;
        using (var report = new StringWriter())
        {
            try
            {
                if (!IsAdministrator())
                    throw new InvalidOperationException("Administrator access is required to recolor elevated terminals.");
                exitCode = ApplyDiscoveredColors(DiscoverColorTargets(), report);
            }
            catch (Exception ex)
            {
                LogError(ex.ToString());
                report.WriteLine("Could not restore all Agent Hub terminal colors: " + ex.Message);
            }
            File.WriteAllText(resultPath, report.ToString(), new UTF8Encoding(false));
        }
        return exitCode;
    }

    static int RunElevatedColorRestore(TextWriter report)
    {
        string resultPath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "AgentHub",
            "colorall-result-" + Guid.NewGuid().ToString("N") + ".txt"
        );
        string launcherPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "AgentTerminalLauncher.exe");
        if (!File.Exists(launcherPath))
            throw new FileNotFoundException("Agent Hub's elevation helper is missing.", launcherPath);

        try
        {
            var psi = new ProcessStartInfo(
                launcherPath,
                JoinArguments(new string[] {
                    "-ApplyAllColorsElevated",
                    "-ResultFile", resultPath
                })
            );
            psi.UseShellExecute = true;
            psi.Verb = "runas";
            psi.WindowStyle = ProcessWindowStyle.Hidden;
            Process child;
            try
            {
                child = Process.Start(psi);
            }
            catch (Win32Exception ex)
            {
                if (ex.NativeErrorCode == 1223)
                {
                    report.WriteLine(
                        "Administrator approval was canceled, so elevated Agent Hub terminals were not recolored."
                    );
                    report.Flush();
                    return 1;
                }
                throw;
            }
            if (child == null) throw new InvalidOperationException("Agent Hub's elevation helper did not start.");

            int exitCode;
            using (child)
            {
                child.WaitForExit();
                exitCode = child.ExitCode;
            }
            if (!File.Exists(resultPath))
                throw new InvalidOperationException("Agent Hub's elevation helper returned no result.");

            report.Write(File.ReadAllText(resultPath));
            report.Flush();
            return exitCode;
        }
        finally
        {
            TryDelete(resultPath);
        }
    }

    static string ValidateBulkResultPath(string value)
    {
        return ValidateAgentHubResultPath(
            value,
            "^colorall-result-[0-9a-f]{32}\\.txt$",
            "The bulk color result path must stay inside Agent Hub's install directory."
        );
    }

    static string ValidateColorMonitorResultPath(string value)
    {
        return ValidateAgentHubResultPath(
            value,
            "^color-monitor-test-[0-9a-f]{32}\\.txt$",
            "The color monitor test result path must stay inside Agent Hub's install directory."
        );
    }

    static string ValidateAgentHubResultPath(string value, string fileNamePattern, string errorMessage)
    {
        string agentHubDir = Path.GetFullPath(Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "AgentHub"
        ));
        Directory.CreateDirectory(agentHubDir);
        string resultPath = Path.GetFullPath(value);
        string requiredPrefix = agentHubDir.TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
        string resultFileName = Path.GetFileName(resultPath);
        if (!resultPath.StartsWith(requiredPrefix, StringComparison.OrdinalIgnoreCase) ||
            !Regex.IsMatch(
                resultFileName,
                fileNamePattern,
                RegexOptions.IgnoreCase | RegexOptions.CultureInvariant
            ))
            throw new InvalidOperationException(errorMessage);
        return resultPath;
    }

    static bool IsAdministrator()
    {
        using (WindowsIdentity identity = WindowsIdentity.GetCurrent())
        {
            return new WindowsPrincipal(identity).IsInRole(WindowsBuiltInRole.Administrator);
        }
    }

    static ColorTargetDiscovery DiscoverColorTargets()
    {
        var discovery = new ColorTargetDiscovery();
        var seenConsoles = new HashSet<int>();
        using (var searcher = new ManagementObjectSearcher(
            "SELECT ProcessId, Name, CommandLine FROM Win32_Process " +
            "WHERE Name LIKE 'AgentTerminalSession-%.exe'"
        ))
        using (ManagementObjectCollection processes = searcher.Get())
        {
            foreach (ManagementObject process in processes)
            {
                try
                {
                    int processId = Convert.ToInt32(process["ProcessId"]);
                    string name = Convert.ToString(process["Name"]) ?? "";
                    if (!IsTerminalSessionProcess(name)) continue;

                    string commandLine = process["CommandLine"] as string;
                    if (string.IsNullOrWhiteSpace(commandLine))
                    {
                        discovery.InaccessibleProcessIds.Add(processId);
                        continue;
                    }

                    ColorTarget target;
                    if (!TryParseColorTarget(processId, commandLine, out target))
                    {
                        discovery.UnrecognizedProcessIds.Add(processId);
                        continue;
                    }
                    if (seenConsoles.Add(target.ConsoleProcessId)) discovery.Targets.Add(target);
                }
                finally
                {
                    process.Dispose();
                }
            }
        }
        discovery.Targets.Sort(delegate(ColorTarget left, ColorTarget right) {
            return left.ColorIndex.CompareTo(right.ColorIndex);
        });
        return discovery;
    }

    static bool TryParseColorTarget(int sourceProcessId, string commandLine, out ColorTarget target)
    {
        target = null;
        int colorIndex;
        if (TryReadIntegerArgument(commandLine, "HoldColor", out colorIndex))
        {
            if (colorIndex < 0 || colorIndex >= SessionColorCount) return false;
            target = new ColorTarget(sourceProcessId, sourceProcessId, colorIndex);
            return true;
        }

        int ownerProcessId;
        if (HasArgument(commandLine, "HoldManualColor") &&
            TryReadIntegerArgument(commandLine, "ColorIndex", out colorIndex) &&
            TryReadIntegerArgument(commandLine, "OwnerPid", out ownerProcessId))
        {
            if (colorIndex < 0 || colorIndex >= SessionColorCount || ownerProcessId <= 0) return false;
            target = new ColorTarget(sourceProcessId, ownerProcessId, colorIndex);
            return true;
        }
        return false;
    }

    static bool HasArgument(string commandLine, string name)
    {
        return Regex.IsMatch(
            commandLine ?? "",
            "(?:^|\\s)-" + Regex.Escape(name) + "(?=\\s|$)",
            RegexOptions.IgnoreCase | RegexOptions.CultureInvariant
        );
    }

    static bool TryReadIntegerArgument(string commandLine, string name, out int value)
    {
        value = 0;
        Match match = Regex.Match(
            commandLine ?? "",
            "(?:^|\\s)-" + Regex.Escape(name) + "\\s+([0-9]+)(?=\\s|$)",
            RegexOptions.IgnoreCase | RegexOptions.CultureInvariant
        );
        return match.Success && int.TryParse(match.Groups[1].Value, out value);
    }

    static int ApplyDiscoveredColors(ColorTargetDiscovery discovery, TextWriter report)
    {
        int total =
            discovery.Targets.Count +
            discovery.InaccessibleProcessIds.Count +
            discovery.UnrecognizedProcessIds.Count;
        if (total == 0)
        {
            report.WriteLine("No live Agent Hub terminals were found.");
            return 0;
        }

        int applied = 0;
        var errors = new List<string>();
        foreach (ColorTarget target in discovery.Targets)
        {
            try
            {
                string background = ReadSessionBackground(target.ColorIndex);
                WriteTerminalBackground(target.ConsoleProcessId, background);
                applied++;
            }
            catch (Exception ex)
            {
                errors.Add(
                    "session process " + target.SourceProcessId +
                    " (" + SessionSchemeName(target.ColorIndex) + "): " + ex.Message
                );
            }
        }
        foreach (int processId in discovery.InaccessibleProcessIds)
            errors.Add("session process " + processId + ": its command line could not be inspected");
        foreach (int processId in discovery.UnrecognizedProcessIds)
            errors.Add("session process " + processId + ": its color lease could not be identified");

        if (errors.Count == 0)
        {
            if (applied == 1)
                report.WriteLine("Restored 1 live Agent Hub terminal color from its existing lease.");
            else
                report.WriteLine(
                    "Restored {0} live Agent Hub terminal colors from {0} existing leases.",
                    applied
                );
            return 0;
        }

        report.WriteLine("Restored {0} of {1} live Agent Hub terminal colors.", applied, total);
        foreach (string error in errors) report.WriteLine("Could not restore " + error + ".");
        return 1;
    }

    static int WatchAllColors()
    {
        bool created;
        using (var watchdog = new Mutex(false, WatchdogMutexName, out created))
        {
            if (!created) return 0;

            var backgrounds = new string[SessionColorCount];
            for (int i = 0; i < backgrounds.Length; i++)
                backgrounds[i] = ReadSessionBackground(i);

            var inaccessibleLogged = new HashSet<int>();
            var unrecognizedLogged = new HashSet<int>();
            var targetFailuresLogged = new HashSet<int>();
            bool discoveryFailureLogged = false;

            while (true)
            {
                try
                {
                    ColorTargetDiscovery discovery = DiscoverColorTargets();
                    discoveryFailureLogged = false;

                    foreach (int processId in discovery.InaccessibleProcessIds)
                    {
                        if (inaccessibleLogged.Add(processId))
                            LogError(
                                "Terminal color watchdog cannot inspect session process " +
                                processId +
                                "; a same-integrity session monitor must repair it."
                            );
                    }
                    foreach (int processId in discovery.UnrecognizedProcessIds)
                    {
                        if (unrecognizedLogged.Add(processId))
                            LogError(
                                "Terminal color watchdog found session process " +
                                processId +
                                " but could not identify its lease."
                            );
                    }

                    foreach (ColorTarget target in discovery.Targets)
                    {
                        inaccessibleLogged.Remove(target.SourceProcessId);
                        unrecognizedLogged.Remove(target.SourceProcessId);
                        try
                        {
                            RepairDiscoveredColorIfNeeded(target, backgrounds[target.ColorIndex]);
                            RepairDiscoveredTitleIfAssigned(target);
                            targetFailuresLogged.Remove(target.SourceProcessId);
                        }
                        catch (Exception ex)
                        {
                            if (targetFailuresLogged.Add(target.SourceProcessId))
                                LogError(
                                    "Terminal color watchdog failed for session process " +
                                    target.SourceProcessId +
                                    "; it will retry. " +
                                    ex
                                );
                        }
                    }
                }
                catch (Exception ex)
                {
                    if (!discoveryFailureLogged)
                    {
                        LogError("Terminal color watchdog discovery failed; it will retry. " + ex);
                        discoveryFailureLogged = true;
                    }
                }

                Thread.Sleep(GlobalColorMonitorIntervalMs);
            }
        }
    }

    static void RepairDiscoveredColorIfNeeded(ColorTarget target, string expected)
    {
        FreeConsole();
        try
        {
            if (!AttachConsole((uint)target.ConsoleProcessId))
                throw new InvalidOperationException(
                    "Could not attach to this terminal (Windows error " + Marshal.GetLastWin32Error() + ")."
                );

            uint observed;
            int probeError;
            if (!TryReadAttachedPaletteColor(0, out observed, out probeError))
                throw new InvalidOperationException(
                    "Could not read this terminal's ANSI palette (Windows error " + probeError + ")."
                );
            if (PaletteColorMatches(observed, expected)) return;

            string observedBackground = ColorRefToHex(observed);
            WriteAttachedTerminalBackground(expected);
            if (!WaitForAttachedPaletteColor(expected, ColorRepairVerificationTimeoutMs))
                throw new InvalidOperationException(
                    "The terminal accepted a color repaint but its ANSI palette did not converge to " +
                    expected +
                    "."
                );
            LogColorRecovery(
                "global-watchdog",
                observedBackground,
                expected,
                target.SourceProcessId,
                SessionSchemeName(target.ColorIndex),
                ""
            );
        }
        finally
        {
            FreeConsole();
        }
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
        using (var monitor = new TerminalColorMonitor(ReadSessionBackground(colorIndex)))
        {
            monitor.Start();
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

        IntPtr output = OpenTerminalOutput(GenericWrite);
        try { WriteTerminalBackground(output, background); }
        finally { CloseHandle(output); }
    }

    static void WriteAttachedTerminalBackground(string background)
    {
        IntPtr output = OpenTerminalOutput(GenericWrite);
        try { WriteTerminalBackground(output, background); }
        finally { CloseHandle(output); }
    }

    static void RepairDiscoveredTitleIfAssigned(ColorTarget target)
    {
        string title;
        if (!SessionTitleManager.TryReadAssignment(target.SourceProcessId, out title)) return;
        WriteTerminalTitle(target.ConsoleProcessId, title);
    }

    static void WriteTerminalTitle(int consoleProcessId, string title)
    {
        FreeConsole();
        if (!AttachConsole((uint)consoleProcessId))
            throw new InvalidOperationException(
                "Could not attach to this terminal (Windows error " + Marshal.GetLastWin32Error() + ")."
            );

        IntPtr output = OpenTerminalOutput(GenericWrite);
        try { WriteTerminalTitle(output, title); }
        finally { CloseHandle(output); }
    }

    static void WriteAttachedTerminalTitle(string title)
    {
        IntPtr output = OpenTerminalOutput(GenericWrite);
        try { WriteTerminalTitle(output, title); }
        finally { CloseHandle(output); }
    }

    static IntPtr OpenTerminalOutput(uint access)
    {
        IntPtr output = CreateFile(
            "CONOUT$",
            access,
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
        return output;
    }

    static void WriteTerminalBackground(IntPtr output, string background)
    {
        background = NormalizeBackground(background);
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
        }
    }

    static void WriteTerminalTitle(IntPtr output, string title)
    {
        WriteTerminalSequence(
            output,
            BuildTerminalTitleSequence(SessionTitleManager.NormalizeTitle(title)),
            "title"
        );
    }

    static void WriteTerminalSequence(IntPtr output, string sequence, string operation)
    {
        uint originalMode;
        bool haveMode = GetConsoleMode(output, out originalMode);
        bool changedMode = haveMode && (originalMode & EnableVirtualTerminalProcessing) == 0;
        try
        {
            if (changedMode && !SetConsoleMode(output, originalMode | EnableVirtualTerminalProcessing))
                throw new InvalidOperationException(
                    "Could not enable terminal " + operation + " output (Windows error " + Marshal.GetLastWin32Error() + ")."
                );

            byte[] bytes = Encoding.UTF8.GetBytes(sequence);
            uint written;
            if (!WriteFile(output, bytes, (uint)bytes.Length, out written, IntPtr.Zero) ||
                written != bytes.Length)
                throw new IOException(
                    "Could not write this terminal's " + operation + " (Windows error " + Marshal.GetLastWin32Error() + ")."
                );
        }
        finally
        {
            if (changedMode) SetConsoleMode(output, originalMode);
        }
    }

    static bool TryReadAttachedPaletteColor(int colorIndex, out uint color, out int error)
    {
        color = 0;
        error = 0;
        if (colorIndex < 0 || colorIndex >= 16) return false;

        IntPtr output = CreateFile(
            "CONOUT$",
            GenericRead,
            FileShareRead | FileShareWrite,
            IntPtr.Zero,
            OpenExisting,
            0,
            IntPtr.Zero
        );
        if (output == IntPtr.Zero || output == InvalidHandleValue)
        {
            error = Marshal.GetLastWin32Error();
            return false;
        }

        try
        {
            var info = new ConsoleScreenBufferInfoEx();
            info.Size = (uint)Marshal.SizeOf(typeof(ConsoleScreenBufferInfoEx));
            info.ColorTable = new uint[16];
            if (!GetConsoleScreenBufferInfoEx(output, ref info))
            {
                error = Marshal.GetLastWin32Error();
                return false;
            }
            color = info.ColorTable[colorIndex] & 0x00FFFFFF;
            return true;
        }
        finally
        {
            CloseHandle(output);
        }
    }

    static bool WaitForAttachedPaletteColor(string background, int timeoutMs)
    {
        var elapsed = Stopwatch.StartNew();
        do
        {
            uint observed;
            int error;
            if (TryReadAttachedPaletteColor(0, out observed, out error) &&
                PaletteColorMatches(observed, background))
                return true;
            Thread.Sleep(25);
        }
        while (elapsed.ElapsedMilliseconds < timeoutMs);
        return false;
    }

    static string NormalizeBackground(string background)
    {
        string normalized = (background ?? "").Trim().ToUpperInvariant();
        if (!Regex.IsMatch(normalized, "^#[0-9A-F]{6}$", RegexOptions.CultureInvariant))
            throw new ArgumentException("Invalid terminal background color.");
        return normalized;
    }

    static uint BackgroundToColorRef(string background)
    {
        string normalized = NormalizeBackground(background);
        uint rgb = Convert.ToUInt32(normalized.Substring(1), 16);
        uint red = (rgb >> 16) & 0xFF;
        uint green = (rgb >> 8) & 0xFF;
        uint blue = rgb & 0xFF;
        return red | (green << 8) | (blue << 16);
    }

    static string ColorRefToHex(uint color)
    {
        uint red = color & 0xFF;
        uint green = (color >> 8) & 0xFF;
        uint blue = (color >> 16) & 0xFF;
        return "#" + ((red << 16) | (green << 8) | blue).ToString("X6");
    }

    static bool PaletteColorMatches(uint observed, string expectedBackground)
    {
        return (observed & 0x00FFFFFF) == BackgroundToColorRef(expectedBackground);
    }

    static string BuildTerminalBackgroundSequence(string background)
    {
        return
            "\x1b]11;" + background + "\x07" +
            "\x1b]4;0;" + background + "\x07";
    }

    static string BuildTerminalTitleSequence(string title)
    {
        return "\x1b]0;" + SessionTitleManager.NormalizeTitle(title) + "\x07";
    }

    static int RunAgent(string agent, string project, Dictionary<string, string> args)
    {
        string promptArguments = BuildPromptArguments(args);
        string bat;
        if (args.TryGetValue("Bat", out bat) && !string.IsNullOrWhiteSpace(bat) && File.Exists(bat))
        {
            return RunProcess(
                Environment.GetEnvironmentVariable("ComSpec") ?? "cmd.exe",
                "/d /c call " + QuoteArgument(Path.GetFullPath(bat)) + promptArguments,
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
                    "/d /c call " + QuoteArgument(executable) + " " + flags + promptArguments,
                    project
                );
            }
            return RunProcess(executable, flags + promptArguments, project);
        }

        string command = agent == "codex"
            ? "codex --dangerously-bypass-approvals-and-sandbox"
            : "claude --dangerously-skip-permissions";
        return RunProcess(
            Environment.GetEnvironmentVariable("ComSpec") ?? "cmd.exe",
            "/d /c " + command + promptArguments,
            project
        );
    }

    static string BuildPromptArguments(Dictionary<string, string> args)
    {
        string prompt;
        if (args == null || !args.TryGetValue("Prompt", out prompt) || string.IsNullOrWhiteSpace(prompt)) return "";
        return " " + QuoteArgument(prompt);
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

    // Explorer expands a context-menu %1/%V verbatim, so a folder whose path ends
    // in a backslash (drive roots, and %V in some shell views) produces
    // -Project "E:\" on the command line. CommandLineToArgvW reads that trailing
    // \" as an escaped quote, not a closing one, so the argument arrives carrying
    // a literal quote plus whatever followed it -- and Path.GetFullPath rejects it
    // with "Illegal characters in path". Recover the real directory instead of
    // failing the launch: everything before the stray quote is the path.
    static string SanitizeProjectPath(string value)
    {
        string path = value;
        int stray = path.IndexOf('"');
        if (stray >= 0) path = path.Substring(0, stray);
        path = path.Trim();
        // "E:" alone means "current directory on E:", never the drive root.
        if (path.Length == 2 && path[1] == ':') path += Path.DirectorySeparatorChar;
        if (path.Length == 0) throw new ArgumentException("Missing -Project.");
        return Path.GetFullPath(path);
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

    internal static void LogSessionTitleError(Exception error)
    {
        LogError("Session title monitor failed. " + error);
    }

    static void LogColorRecovery(string reason, string observed, string expected)
    {
        LogColorRecovery(
            reason,
            observed,
            expected,
            Process.GetCurrentProcess().Id,
            Environment.GetEnvironmentVariable("TKA_AGENT_COLOR_SCHEME") ?? "",
            Environment.GetEnvironmentVariable("WT_SESSION") ?? ""
        );
    }

    static void LogColorRecovery(
        string reason,
        string observed,
        string expected,
        int sessionProcessId,
        string scheme,
        string wtSession
    )
    {
        try
        {
            string localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            string agentHubDir = Path.Combine(localAppData, "AgentHub");
            string settingsPath = Path.Combine(
                localAppData,
                "Packages",
                "Microsoft.WindowsTerminal_8wekyb3d8bbwe",
                "LocalState",
                "settings.json"
            );
            string fragmentPath = Path.Combine(
                localAppData,
                "Microsoft",
                "Windows Terminal",
                "Fragments",
                "AgentHub",
                "session-backgrounds.json"
            );
            Directory.CreateDirectory(agentHubDir);

            bool lockCreated;
            using (var logLock = new Mutex(false, RecoveryLogLockName, out lockCreated))
            {
                bool lockTaken = false;
                try
                {
                    try { lockTaken = logLock.WaitOne(ReadyTimeoutMs); }
                    catch (AbandonedMutexException) { lockTaken = true; }
                    if (!lockTaken) return;

                    File.AppendAllText(
                        Path.Combine(agentHubDir, "terminal-color-recoveries.log"),
                        string.Format(
                            "{0:o} pid={1} reason={2} observed={3} expected={4} scheme=\"{5}\" wtSession={6} settingsWriteUtc={7} fragmentWriteUtc={8}\r\n",
                            DateTime.Now,
                            sessionProcessId,
                            reason,
                            observed,
                            expected,
                            scheme,
                            wtSession,
                            FileTimestamp(settingsPath),
                            FileTimestamp(fragmentPath)
                        ),
                        new UTF8Encoding(false)
                    );
                }
                finally
                {
                    if (lockTaken) logLock.ReleaseMutex();
                }
            }
        }
        catch { }
    }

    static string FileTimestamp(string path)
    {
        return File.Exists(path) ? File.GetLastWriteTimeUtc(path).ToString("o") : "missing";
    }

    static int SelfTestColorMonitor(Dictionary<string, string> args)
    {
        string resultPath = ValidateColorMonitorResultPath(GetRequired(args, "ResultFile"));
        try
        {
            string expected = NormalizeBackground(GetRequired(args, "ExpectedBackground"));
            string injected = string.Equals(expected, "#010203", StringComparison.OrdinalIgnoreCase)
                ? "#030201"
                : "#010203";

            Thread.Sleep(3000);
            uint initialColor;
            int initialProbeError;
            if (!TryReadAttachedPaletteColor(0, out initialColor, out initialProbeError))
                throw new InvalidOperationException(
                    "The test could not read the initial terminal palette (Windows error " +
                    initialProbeError +
                    ")."
                );
            string initial = ColorRefToHex(initialColor);

            using (var monitor = new TerminalColorMonitor(expected))
            {
                monitor.Start();
                if (!WaitForAttachedPaletteColor(expected, ColorRepairVerificationTimeoutMs))
                    throw new InvalidOperationException("The terminal color monitor did not repair the startup palette.");
                WriteAttachedTerminalBackground(injected);
                if (!WaitForAttachedPaletteColor(injected, ColorRepairVerificationTimeoutMs))
                    throw new InvalidOperationException("The test color fault did not reach the terminal palette.");
                if (!WaitForAttachedPaletteColor(
                        expected,
                        ColorMonitorIntervalMs + ColorRepairVerificationTimeoutMs + 5000
                    ))
                    throw new InvalidOperationException("The terminal color monitor did not repair the injected drift.");
            }

            File.WriteAllText(
                resultPath,
                "PASS: terminal palette started at " + initial + ", drifted to " + injected +
                ", and automatically returned to " + expected + ".\r\n",
                new UTF8Encoding(false)
            );
            return 0;
        }
        catch (Exception ex)
        {
            LogError("Terminal color monitor integration test failed. " + ex);
            File.WriteAllText(
                resultPath,
                "FAIL: " + ex.Message + "\r\n",
                new UTF8Encoding(false)
            );
            return 1;
        }
    }

    static int SelfTestLegacyColorTarget(Dictionary<string, string> args)
    {
        string resultPath = ValidateColorMonitorResultPath(GetRequired(args, "ResultFile"));
        try
        {
            string expected = NormalizeBackground(GetRequired(args, "ExpectedBackground"));
            string injected = string.Equals(expected, "#010203", StringComparison.OrdinalIgnoreCase)
                ? "#030201"
                : "#010203";

            Thread.Sleep(3000);
            uint initialColor;
            int initialProbeError;
            if (!TryReadAttachedPaletteColor(0, out initialColor, out initialProbeError))
                throw new InvalidOperationException(
                    "The test could not read the initial terminal palette (Windows error " +
                    initialProbeError +
                    ")."
                );
            string initial = ColorRefToHex(initialColor);

            WriteAttachedTerminalBackground(injected);
            if (!WaitForAttachedPaletteColor(injected, ColorRepairVerificationTimeoutMs))
                throw new InvalidOperationException("The legacy-session test color fault did not reach the palette.");
            if (!WaitForAttachedPaletteColor(
                    expected,
                    GlobalColorMonitorIntervalMs + ColorRepairVerificationTimeoutMs + 5000
                ))
                throw new InvalidOperationException("The global terminal color watchdog did not repair the injected drift.");

            File.WriteAllText(
                resultPath,
                "PASS: legacy terminal palette started at " + initial + ", drifted to " + injected +
                ", and the global watchdog returned it to " + expected + ".\r\n",
                new UTF8Encoding(false)
            );
            return 0;
        }
        catch (Exception ex)
        {
            LogError("Global terminal color watchdog integration test failed. " + ex);
            File.WriteAllText(
                resultPath,
                "FAIL: " + ex.Message + "\r\n",
                new UTF8Encoding(false)
            );
            return 1;
        }
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
            var workflowArgs = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                { "Prompt", "$fb list" },
                { "Title", "Feedback Queue" }
            };
            if (BuildPromptArguments(workflowArgs) != " \"$fb list\"" ||
                SessionTitleManager.NormalizeTitle(workflowArgs["Title"]) != "Feedback Queue")
                throw new Exception("Workflow prompt or title arguments were not preserved.");
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

            string mangled = SanitizeProjectPath(
                "C:\\Windows\" -Executable C:\\tools\\claude.exe"
            );
            if (!string.Equals(mangled, "C:\\Windows", StringComparison.OrdinalIgnoreCase) ||
                !string.Equals(SanitizeProjectPath("C:\""), "C:\\", StringComparison.OrdinalIgnoreCase) ||
                !string.Equals(SanitizeProjectPath("C:\\Windows"), "C:\\Windows", StringComparison.OrdinalIgnoreCase))
                throw new Exception("Trailing-backslash project paths from Explorer were not recovered.");

            int parsedColor;
            if (!TryParseSessionScheme("Agent Hub Session 04", out parsedColor) ||
                parsedColor != 3 ||
                TryParseSessionScheme("Agent Hub Session 17", out parsedColor))
                throw new Exception("Session color scheme parsing accepted an invalid assignment.");
            ColorTarget parsedTarget;
            if (!TryParseColorTarget(
                    4242,
                    "session.exe -HoldColor 8 -Agent codex",
                    out parsedTarget
                ) ||
                parsedTarget.SourceProcessId != 4242 ||
                parsedTarget.ConsoleProcessId != 4242 ||
                parsedTarget.ColorIndex != 8)
                throw new Exception("Bulk color parsing lost a launched session's lease.");
            if (!TryParseColorTarget(
                    5252,
                    "session.exe -HoldManualColor -ColorIndex 6 -OwnerPid 6262",
                    out parsedTarget
                ) ||
                parsedTarget.SourceProcessId != 5252 ||
                parsedTarget.ConsoleProcessId != 6262 ||
                parsedTarget.ColorIndex != 6 ||
                TryParseColorTarget(7272, "session.exe -HoldColor 16", out parsedTarget))
                throw new Exception("Bulk color parsing lost or accepted an invalid manual session lease.");
            string validResultPath = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "AgentHub",
                "colorall-result-" + Guid.NewGuid().ToString("N") + ".txt"
            );
            if (!string.Equals(
                    ValidateBulkResultPath(validResultPath),
                    Path.GetFullPath(validResultPath),
                    StringComparison.OrdinalIgnoreCase
                ))
                throw new Exception("Bulk color elevation rejected its generated result path.");
            bool unsafeResultPathRejected = false;
            try
            {
                ValidateBulkResultPath(Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "AgentHub",
                    "last.ini"
                ));
            }
            catch (InvalidOperationException)
            {
                unsafeResultPathRejected = true;
            }
            if (!unsafeResultPathRejected)
                throw new Exception("Bulk color elevation accepted an unsafe result path.");
            string validMonitorResultPath = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "AgentHub",
                "color-monitor-test-" + Guid.NewGuid().ToString("N") + ".txt"
            );
            if (!string.Equals(
                    ValidateColorMonitorResultPath(validMonitorResultPath),
                    Path.GetFullPath(validMonitorResultPath),
                    StringComparison.OrdinalIgnoreCase
                ))
                throw new Exception("Color monitor testing rejected its generated result path.");
            string colorSequence = BuildTerminalBackgroundSequence("#123456");
            if (colorSequence.IndexOf("\x1b]11;#123456\x07", StringComparison.Ordinal) < 0 ||
                colorSequence.IndexOf("\x1b]4;0;#123456\x07", StringComparison.Ordinal) < 0)
                throw new Exception("Terminal background output is missing its default-background or ANSI black update.");
            string normalizedTitle = SessionTitleManager.NormalizeTitle("  Agent Hub Naming  ");
            string titleSequence = BuildTerminalTitleSequence(normalizedTitle);
            if (!string.Equals(normalizedTitle, "Agent Hub Naming", StringComparison.Ordinal) ||
                titleSequence.IndexOf("\x1b]0;Agent Hub Naming\x07", StringComparison.Ordinal) < 0)
                throw new Exception("Session title normalization or terminal output is invalid.");
            bool unsafeTitleRejected = false;
            try { SessionTitleManager.NormalizeTitle("Unsafe\x1b Title"); }
            catch (ArgumentException) { unsafeTitleRejected = true; }
            if (!unsafeTitleRejected)
                throw new Exception("Session title validation accepted a terminal control character.");
            bool nonSessionExecutableRejected = false;
            try { SessionTitleManager.AssignmentPathForExecutable("C:\\AgentTerminalSession.exe"); }
            catch (InvalidOperationException) { nonSessionExecutableRejected = true; }
            if (!nonSessionExecutableRejected)
                throw new Exception("Session title storage accepted a non-session executable.");
            uint colorRef = BackgroundToColorRef("#123456");
            if (colorRef != 0x00563412 ||
                !string.Equals(ColorRefToHex(colorRef), "#123456", StringComparison.Ordinal) ||
                !PaletteColorMatches(colorRef, "#123456") ||
                PaletteColorMatches(colorRef, "#654321"))
                throw new Exception("Terminal palette COLORREF conversion or drift detection failed.");

            Console.WriteLine("PASS: all " + SessionColorCount + " session colors were unique, exhaustion-safe, and reusable after release.");
            Console.WriteLine("PASS: Windows Terminal window, background-matched tab, color scheme, live-title, and quoting arguments validated.");
            Console.WriteLine("PASS: current and bulk color parsing, palette drift detection, and live terminal background output validated.");
            Console.WriteLine("PASS: session title validation, storage targeting, and terminal output validated.");
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
