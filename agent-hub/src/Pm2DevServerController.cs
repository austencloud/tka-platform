// PM2-backed lifecycle control for one configured development server.
// AgentChooserHost owns the UI; this class owns process discovery, status,
// constrained PM2 commands, and the port-readiness boundary.

using System;
using System.Globalization;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Threading;

enum DevServerState
{
    Checking,
    Offline,
    Starting,
    Running,
    External,
    SetupRequired,
    Error
}

sealed class DevServerStatus
{
    public readonly DevServerState State;
    public readonly string Detail;

    public DevServerStatus(DevServerState state, string detail)
    {
        State = state;
        Detail = detail ?? "";
    }
}

sealed class DevServerCommandResult
{
    public readonly bool Succeeded;
    public readonly string Detail;

    public DevServerCommandResult(bool succeeded, string detail)
    {
        Succeeded = succeeded;
        Detail = detail ?? "";
    }
}

sealed class Pm2DevServerController
{
    const int StatusTimeoutMs = 10000;
    const int ActionTimeoutMs = 30000;

    readonly string _project;
    readonly string _app;
    readonly string _config;
    readonly int _port;

    sealed class Pm2Runtime
    {
        public readonly string NodePath;
        public readonly string RootPath;
        public readonly string BridgePath;

        public Pm2Runtime(string nodePath, string rootPath, string bridgePath)
        {
            NodePath = nodePath;
            RootPath = rootPath;
            BridgePath = bridgePath;
        }
    }

    public Pm2DevServerController(string project, string app, string config, int port)
    {
        if (!IsValidAppName(app)) throw new ArgumentException("Invalid PM2 app name.", "app");
        if (port < 1 || port > 65535) throw new ArgumentOutOfRangeException("port");

        string projectRoot = Path.GetFullPath(project ?? "").TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        string configPath = Path.GetFullPath(config ?? "");
        string projectPrefix = projectRoot + Path.DirectorySeparatorChar;
        if (!configPath.StartsWith(projectPrefix, StringComparison.OrdinalIgnoreCase))
            throw new ArgumentException("The PM2 config must stay inside the project.", "config");
        if (!File.Exists(configPath)) throw new FileNotFoundException("The PM2 config was not found.", configPath);

        _project = projectRoot;
        _app = app;
        _config = configPath;
        _port = port;
    }

    public DevServerStatus GetStatus()
    {
        bool listening = IsPortListening(_port, 300);
        Pm2Runtime runtime = FindPm2Runtime();
        if (runtime == null)
            return new DevServerStatus(
                listening ? DevServerState.External : DevServerState.SetupRequired,
                listening ? "Port " + _port + " is owned outside PM2." : "PM2 is not installed."
            );

        HiddenProcessResult result = RunBridge(runtime, "status " + HiddenProcessRunner.QuoteArgument(runtime.RootPath) + " " + HiddenProcessRunner.QuoteArgument(_app), StatusTimeoutMs);
        int pid;
        string pm2State;
        ParseBridgeStatus(result.Output, out pid, out pm2State);
        bool commandSucceeded = result.Started && !result.TimedOut && result.ExitCode == 0;
        DevServerState state = ClassifyStatus(true, commandSucceeded, pid, pm2State, listening);
        string detail = "";
        if (state == DevServerState.Error) detail = HiddenProcessRunner.FirstUsefulLine(result.Error, result.Output, "PM2 status failed.");
        else if (listening && !commandSucceeded) detail = "Port " + _port + " is ready; PM2 status is unavailable.";
        else if (state == DevServerState.External) detail = "Port " + _port + " is owned outside PM2.";
        return new DevServerStatus(state, detail);
    }

    public DevServerCommandResult StartOrRestart(DevServerState currentState, Action<string> progress)
    {
        Pm2Runtime runtime = FindPm2Runtime();
        if (runtime == null) return new DevServerCommandResult(false, "PM2 is not installed.");

        DevServerStatus observed = currentState == DevServerState.Checking ? GetStatus() : null;
        DevServerState resolvedState = observed == null ? currentState : observed.State;
        if (resolvedState == DevServerState.SetupRequired)
            return new DevServerCommandResult(false, "PM2 is not installed.");
        if (resolvedState == DevServerState.External)
            return new DevServerCommandResult(false, "Port " + _port + " is running outside PM2. Stop that process before Agent Hub can manage it.");

        bool restart = resolvedState == DevServerState.Running || resolvedState == DevServerState.Starting;
        string args = restart
            ? "restart " + HiddenProcessRunner.QuoteArgument(runtime.RootPath) + " " + HiddenProcessRunner.QuoteArgument(_app)
            : "start " + HiddenProcessRunner.QuoteArgument(runtime.RootPath) + " " + HiddenProcessRunner.QuoteArgument(_config) + " " + HiddenProcessRunner.QuoteArgument(_app);
        HiddenProcessResult action = RunBridge(runtime, args, ActionTimeoutMs);
        if (!action.Started || action.TimedOut || action.ExitCode != 0)
            return new DevServerCommandResult(false, HiddenProcessRunner.FirstUsefulLine(action.Error, action.Output, "PM2 could not start the server."));

        if (progress != null) progress("PM2 accepted the request. Waiting for port " + _port + ".");
        Thread.Sleep(250);
        DateTime deadline = DateTime.UtcNow.AddSeconds(180);
        while (DateTime.UtcNow < deadline)
        {
            if (IsPortListening(_port, 350)) return new DevServerCommandResult(true, "");
            Thread.Sleep(650);
        }
        return new DevServerCommandResult(false, "PM2 started the process, but port " + _port + " did not become ready within 180 seconds.");
    }

    static DevServerState ClassifyStatus(bool runtimeAvailable, bool statusCommandSucceeded, int pid, string pm2State, bool portListening)
    {
        if (!runtimeAvailable) return portListening ? DevServerState.External : DevServerState.SetupRequired;
        if (!statusCommandSucceeded) return portListening ? DevServerState.Running : DevServerState.Error;
        if (pid > 0 || string.Equals(pm2State, "online", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(pm2State, "launching", StringComparison.OrdinalIgnoreCase))
            return portListening ? DevServerState.Running : DevServerState.Starting;
        if (portListening) return DevServerState.External;
        return DevServerState.Offline;
    }

    static void ParseBridgeStatus(string output, out int pid, out string state)
    {
        pid = 0;
        state = "";
        if (string.IsNullOrWhiteSpace(output)) return;
        string firstLine = output.Split(new char[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries)[0];
        string[] fields = firstLine.Split('\t');
        if (fields.Length > 0) int.TryParse(fields[0], NumberStyles.None, CultureInfo.InvariantCulture, out pid);
        if (fields.Length > 1) state = fields[1].Trim();
        if (pid < 0) pid = 0;
    }

    static bool IsValidAppName(string value)
    {
        if (string.IsNullOrEmpty(value) || value.Length > 64) return false;
        for (int i = 0; i < value.Length; i++)
        {
            char ch = value[i];
            bool ok = (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') ||
                      (ch >= '0' && ch <= '9') || ch == '_' || ch == '-';
            if (!ok || (i == 0 && (ch == '_' || ch == '-'))) return false;
        }
        return true;
    }

    static bool IsPortListening(int port, int timeoutMs)
    {
        using (var client = new TcpClient(AddressFamily.InterNetwork))
        {
            IAsyncResult pending = null;
            try
            {
                pending = client.BeginConnect(IPAddress.Loopback, port, null, null);
                if (!pending.AsyncWaitHandle.WaitOne(timeoutMs)) return false;
                client.EndConnect(pending);
                return client.Connected;
            }
            catch { return false; }
            finally { if (pending != null) pending.AsyncWaitHandle.Close(); }
        }
    }

    static Pm2Runtime FindPm2Runtime()
    {
        string node = HiddenProcessRunner.FindExecutableOnPath("node.exe");
        if (string.IsNullOrEmpty(node))
        {
            string programFiles = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
            string candidate = Path.Combine(programFiles, "nodejs", "node.exe");
            if (File.Exists(candidate)) node = candidate;
        }
        if (string.IsNullOrEmpty(node)) return null;

        string appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
        string root = Path.Combine(appData, "npm", "node_modules", "pm2");
        string bridge = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Pm2Bridge.cjs");
        if (!File.Exists(bridge)) return null;
        if (File.Exists(Path.Combine(root, "index.js"))) return new Pm2Runtime(node, root, bridge);

        string shim = HiddenProcessRunner.FindExecutableOnPath("pm2.cmd");
        if (!string.IsNullOrEmpty(shim))
        {
            root = Path.Combine(Path.GetDirectoryName(shim), "node_modules", "pm2");
            if (File.Exists(Path.Combine(root, "index.js"))) return new Pm2Runtime(node, root, bridge);
        }
        return null;
    }

    HiddenProcessResult RunBridge(Pm2Runtime runtime, string args, int timeoutMs)
    {
        return HiddenProcessRunner.Run(
            runtime.NodePath,
            HiddenProcessRunner.QuoteArgument(runtime.BridgePath) + " " + args,
            _project,
            timeoutMs,
            null);
    }

    public static int SelfTest()
    {
        int failures = 0;
        if (!IsValidAppName("tka-dev")) failures++;
        if (IsValidAppName("-bad")) failures++;
        if (IsValidAppName("bad name")) failures++;
        int pid; string state;
        ParseBridgeStatus("43812\tonline\r\n", out pid, out state);
        if (pid != 43812 || state != "online") failures++;
        ParseBridgeStatus("0\tmissing\r\n", out pid, out state);
        if (pid != 0 || state != "missing") failures++;
        if (ClassifyStatus(false, false, 0, "", false) != DevServerState.SetupRequired) failures++;
        if (ClassifyStatus(false, false, 0, "", true) != DevServerState.External) failures++;
        if (ClassifyStatus(true, true, 0, "missing", false) != DevServerState.Offline) failures++;
        if (ClassifyStatus(true, true, 100, "online", false) != DevServerState.Starting) failures++;
        if (ClassifyStatus(true, true, 100, "online", true) != DevServerState.Running) failures++;
        if (ClassifyStatus(true, false, 0, "", false) != DevServerState.Error) failures++;
        if (ClassifyStatus(true, false, 0, "", true) != DevServerState.Running) failures++;
        if (HiddenProcessRunner.QuoteArgument("C:\\path with space\\") != "\"C:\\path with space\\\\\"") failures++;
        return failures;
    }
}
