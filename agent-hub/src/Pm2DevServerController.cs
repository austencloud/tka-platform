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
        public readonly string CliPath;

        public Pm2Runtime(string nodePath, string cliPath)
        {
            NodePath = nodePath;
            CliPath = cliPath;
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

        HiddenProcessResult result = RunPm2(runtime, "pid " + _app, StatusTimeoutMs);
        int pid = ParsePositivePid(result.Output);
        DevServerState state = ClassifyStatus(true, result.Started && !result.TimedOut && result.ExitCode == 0, pid, listening);
        string detail = "";
        if (state == DevServerState.Error) detail = HiddenProcessRunner.FirstUsefulLine(result.Error, result.Output, "PM2 status failed.");
        else if (state == DevServerState.External) detail = "Port " + _port + " is owned outside PM2.";
        return new DevServerStatus(state, detail);
    }

    public DevServerCommandResult StartOrRestart(DevServerState currentState)
    {
        Pm2Runtime runtime = FindPm2Runtime();
        if (runtime == null) return new DevServerCommandResult(false, "PM2 is not installed.");

        bool restart = currentState == DevServerState.Running || currentState == DevServerState.Starting;
        string args = restart
            ? "restart " + _app + " --update-env"
            : "start " + HiddenProcessRunner.QuoteArgument(_config) + " --only " + _app + " --update-env";
        HiddenProcessResult action = RunPm2(runtime, args, ActionTimeoutMs);
        if (!action.Started || action.TimedOut || action.ExitCode != 0)
            return new DevServerCommandResult(false, HiddenProcessRunner.FirstUsefulLine(action.Error, action.Output, "PM2 could not start the server."));

        if (!restart)
        {
            HiddenProcessResult save = RunPm2(runtime, "save", ActionTimeoutMs);
            if (!save.Started || save.TimedOut || save.ExitCode != 0)
                return new DevServerCommandResult(false, HiddenProcessRunner.FirstUsefulLine(save.Error, save.Output, "The server started, but PM2 could not save its process list."));
        }

        Thread.Sleep(750);
        DateTime deadline = DateTime.UtcNow.AddSeconds(180);
        while (DateTime.UtcNow < deadline)
        {
            if (IsPortListening(_port, 350)) return new DevServerCommandResult(true, "");
            Thread.Sleep(650);
        }
        return new DevServerCommandResult(false, "PM2 started the process, but port " + _port + " did not become ready within 180 seconds.");
    }

    static DevServerState ClassifyStatus(bool runtimeAvailable, bool pidCommandSucceeded, int pid, bool portListening)
    {
        if (!runtimeAvailable) return portListening ? DevServerState.External : DevServerState.SetupRequired;
        if (pid > 0) return portListening ? DevServerState.Running : DevServerState.Starting;
        if (portListening) return DevServerState.External;
        return pidCommandSucceeded ? DevServerState.Offline : DevServerState.Error;
    }

    static int ParsePositivePid(string output)
    {
        if (string.IsNullOrEmpty(output)) return 0;
        string[] tokens = output.Split(new char[] { '\r', '\n', ' ', '\t' }, StringSplitOptions.RemoveEmptyEntries);
        for (int i = tokens.Length - 1; i >= 0; i--)
        {
            int value;
            if (int.TryParse(tokens[i], NumberStyles.None, CultureInfo.InvariantCulture, out value) && value > 0) return value;
        }
        return 0;
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
        string cli = Path.Combine(appData, "npm", "node_modules", "pm2", "bin", "pm2");
        if (File.Exists(cli)) return new Pm2Runtime(node, cli);

        string shim = HiddenProcessRunner.FindExecutableOnPath("pm2.cmd");
        if (!string.IsNullOrEmpty(shim))
        {
            cli = Path.Combine(Path.GetDirectoryName(shim), "node_modules", "pm2", "bin", "pm2");
            if (File.Exists(cli)) return new Pm2Runtime(node, cli);
        }
        return null;
    }

    HiddenProcessResult RunPm2(Pm2Runtime runtime, string args, int timeoutMs)
    {
        return HiddenProcessRunner.Run(
            runtime.NodePath,
            HiddenProcessRunner.QuoteArgument(runtime.CliPath) + " " + args,
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
        if (ParsePositivePid("[PM2] pid\r\n43812\r\n") != 43812) failures++;
        if (ParsePositivePid("0\r\n") != 0) failures++;
        if (ClassifyStatus(false, false, 0, false) != DevServerState.SetupRequired) failures++;
        if (ClassifyStatus(false, false, 0, true) != DevServerState.External) failures++;
        if (ClassifyStatus(true, true, 0, false) != DevServerState.Offline) failures++;
        if (ClassifyStatus(true, true, 100, false) != DevServerState.Starting) failures++;
        if (ClassifyStatus(true, true, 100, true) != DevServerState.Running) failures++;
        if (ClassifyStatus(true, false, 0, false) != DevServerState.Error) failures++;
        if (HiddenProcessRunner.QuoteArgument("C:\\path with space\\") != "\"C:\\path with space\\\\\"") failures++;
        return failures;
    }
}
