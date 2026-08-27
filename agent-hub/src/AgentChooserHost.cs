// AgentChooserHost.exe — resident host for the agent popover.
// Starts at logon, keeps a WPF window pre-built + WPF/fonts warm, and listens on
// a named pipe. A featherweight stub (AgentChooserStub.exe, launched by the
// taskbar) pings the pipe; the host shows the pre-warmed window INSTANTLY.
// The host never exits on selection — it hides and waits for the next ping.
//
// Pipe message (UTF8 line): project|name|icon|stampFile|stubStartTicks plus
// optional development-server manager, app, config, and port fields. A legacy
// trailing app URL field is accepted and ignored for shortcut compatibility.

using System;
using System.Diagnostics;
using System.IO;
using System.IO.Pipes;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Media.Animation;
using System.Windows.Media.Imaging;
using System.Windows.Threading;

class Popup : Window
{
    static bool _visualTestMode;
    [DllImport("user32.dll")] static extern bool GetCursorPos(out NativePoint p);
    [DllImport("user32.dll")] static extern IntPtr MonitorFromPoint(NativePoint pt, uint flags);
    [DllImport("user32.dll", CharSet = CharSet.Auto)] static extern bool GetMonitorInfo(IntPtr hMonitor, ref MONITORINFO mi);
    [StructLayout(LayoutKind.Sequential)] struct NativePoint { public int X; public int Y; }
    [StructLayout(LayoutKind.Sequential)] struct NativeRect { public int left; public int top; public int right; public int bottom; }
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)] struct MONITORINFO { public int cbSize; public NativeRect rcMonitor; public NativeRect rcWork; public int dwFlags; }

    const string PIPE = "AgentChooserPipe";

    string _project, _name, _icon, _stampFile;
    string _serverManager, _serverApp, _serverConfig, _serverConfigurationError;
    int _serverPort;
    long _stubStartTicks;
    long _deactHideTicks; string _deactHideProject = "";
    int _rawX, _rawY;
    bool _ready;
    Border _card;
    ProjectCommandCenter _commandCenter;
    Pm2DevServerController _serverControl;
    DevServerState _serverState = DevServerState.Checking;
    int _serverGeneration;
    bool _serverBusy;
    string _serverActionLabel = "Starting";
    GitProjectController _gitControl;
    GitProjectStatus _gitStatus = GitProjectStatus.Checking();
    GitWorktreeInventoryController _worktreeControl;
    GitWorktreeInventory _worktreeInventory = GitWorktreeInventory.Checking();
    int _gitGeneration;

    [STAThread]
    static void Main(string[] argv)
    {
        if (HasArg(argv, "SelfTestServer"))
        {
            Environment.ExitCode = Pm2DevServerController.SelfTest();
            return;
        }
        if (HasArg(argv, "SelfTestGit"))
        {
            Environment.ExitCode = GitProjectController.SelfTest();
            return;
        }
        if (HasArg(argv, "SelfTestPrompt"))
        {
            Environment.ExitCode = AgentPromptBuilder.SelfTest();
            return;
        }
        if (HasArg(argv, "SelfTestWorktrees"))
        {
            Environment.ExitCode = GitWorktreeInventoryController.SelfTest();
            return;
        }

        string capturePath = ArgValue(argv, "CapturePath");
        if (!string.IsNullOrEmpty(capturePath))
        {
            RunVisualCapture(argv, capturePath);
            return;
        }

        _visualTestMode = HasArg(argv, "VisualTest");

        bool createdNew;
        using (var mutex = new Mutex(true, "AgentChooserHostMutex_v1", out createdNew))
        {
            if (!createdNew)
            {
                // Already running — forward our args (if any) to the live host, then exit.
                var f = ParseArgs(argv);
                if (f.ContainsKey("Project")) SendToPipe(Line(f));
                return;
            }

            EnsureColorWatchdog();
            var app = new Application();
            app.ShutdownMode = ShutdownMode.OnExplicitShutdown;
            var win = new Popup();
            win.Prewarm();

            var t = new Thread(() => PipeServerLoop(app, win));
            t.IsBackground = true;
            t.Start();

            var a = ParseArgs(argv);
            if (a.ContainsKey("Project"))
            {
                string ln = Line(a);
                app.Dispatcher.BeginInvoke(new Action(delegate { win.ShowFromLine(ln); }));
            }
            app.Run();
        }
    }

    static bool HasArg(string[] argv, string name)
    {
        for (int i = 0; i < argv.Length; i++)
            if (string.Equals(argv[i].TrimStart('-'), name, StringComparison.OrdinalIgnoreCase)) return true;
        return false;
    }

    static string ArgValue(string[] argv, string name)
    {
        for (int i = 0; i < argv.Length - 1; i++)
            if (string.Equals(argv[i].TrimStart('-'), name, StringComparison.OrdinalIgnoreCase)) return argv[i + 1];
        return "";
    }

    static void RunVisualCapture(string[] argv, string capturePath)
    {
        _visualTestMode = true;
        var fields = ParseArgs(argv);
        if (!fields.ContainsKey("Project"))
        {
            Environment.ExitCode = 2;
            return;
        }

        var app = new Application();
        app.ShutdownMode = ShutdownMode.OnExplicitShutdown;
        var win = new Popup();
        int captureDelayMs = 1800;
        string configuredDelay;
        int parsedDelay;
        if (fields.TryGetValue("CaptureDelayMs", out configuredDelay) &&
            int.TryParse(configuredDelay, out parsedDelay) && parsedDelay >= 250 && parsedDelay <= 15000)
            captureDelayMs = parsedDelay;
        var timer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(captureDelayMs) };
        timer.Tick += delegate
        {
            timer.Stop();
            try { win.CapturePng(capturePath); }
            catch (Exception ex) { Log("visual capture failed: " + ex.Message); Environment.ExitCode = 3; }
            win.Close();
            app.Shutdown();
        };
        app.Dispatcher.BeginInvoke(new Action(delegate
        {
            win.ShowFromLine(Line(fields));
            win.ApplyVisualTestState(fields);
            timer.Start();
        }));
        app.Run();
    }

    static void EnsureColorWatchdog()
    {
        try
        {
            string path = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "AgentTerminalColorWatchdog.exe");
            if (!File.Exists(path))
            {
                Log("terminal color watchdog is not installed: " + path);
                return;
            }

            var psi = new ProcessStartInfo(path, "-WatchAllColors");
            psi.UseShellExecute = false;
            psi.CreateNoWindow = true;
            using (Process process = Process.Start(psi))
            {
                if (process == null) Log("terminal color watchdog did not start");
            }
        }
        catch (Exception ex)
        {
            Log("terminal color watchdog launch failed: " + ex.Message);
        }
    }

    static void PipeServerLoop(Application app, Popup win)
    {
        while (true)
        {
            try
            {
                using (var server = new NamedPipeServerStream(PIPE, PipeDirection.In, 1, PipeTransmissionMode.Byte, PipeOptions.None))
                {
                    server.WaitForConnection();
                    string line;
                    using (var sr = new StreamReader(server)) line = sr.ReadLine();
                    Log("pipe recv: " + line);
                    if (!string.IsNullOrEmpty(line))
                        app.Dispatcher.BeginInvoke(new Action(delegate { win.ShowFromLine(line); }));
                }
            }
            catch { Thread.Sleep(50); }
        }
    }

    static void SendToPipe(string line)
    {
        try
        {
            using (var c = new NamedPipeClientStream(".", PIPE, PipeDirection.Out))
            {
                c.Connect(400);
                using (var sw = new StreamWriter(c)) { sw.WriteLine(line); sw.Flush(); }
            }
        }
        catch { }
    }

    static System.Collections.Generic.Dictionary<string, string> ParseArgs(string[] argv)
    {
        var d = new System.Collections.Generic.Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        for (int i = 0; i < argv.Length - 1; i += 2)
        {
            var k = argv[i];
            if (k.StartsWith("-")) d[k.Substring(1)] = argv[i + 1];
            else i -= 1;
        }
        return d;
    }

    static string Line(System.Collections.Generic.Dictionary<string, string> a)
    {
        Func<string, string> g = delegate(string k) { string v; return a.TryGetValue(k, out v) ? v : ""; };
        return g("Project") + "|" + g("Name") + "|" + g("Icon") + "|" + g("StampFile") + "|" + g("StubStartTicks") + "|" +
            g("ServerManager") + "|" + g("ServerApp") + "|" + g("ServerConfig") + "|" + g("ServerPort") + "|" + g("AppUrl");
    }

    public Popup()
    {
        Title = "Agent Hub";
        WindowStyle = WindowStyle.None;
        AllowsTransparency = true;
        Background = Brushes.Transparent;
        ShowInTaskbar = _visualTestMode;
        Topmost = true;
        ResizeMode = ResizeMode.NoResize;
        SizeToContent = SizeToContent.WidthAndHeight;
        WindowStartupLocation = WindowStartupLocation.Manual;
        Visibility = Visibility.Hidden;

        PreviewKeyDown += OnKey;
        Deactivated += delegate
        {
            Log("Deactivated ready=" + _ready + " vis=" + IsVisible);
            if (_visualTestMode) return;
            if (_ready && IsVisible) { _deactHideTicks = DateTime.Now.Ticks; _deactHideProject = _project; HideIt(); }
        };
        Activated += delegate { Log("Activated"); };
        IsVisibleChanged += delegate { Log("IsVisibleChanged -> " + IsVisible); };
    }

    public void CapturePng(string path)
    {
        UpdateLayout();
        double scaleX = 1.0, scaleY = 1.0;
        PresentationSource source = PresentationSource.FromVisual(this);
        if (source != null && source.CompositionTarget != null)
        {
            scaleX = source.CompositionTarget.TransformToDevice.M11;
            scaleY = source.CompositionTarget.TransformToDevice.M22;
        }
        int width = Math.Max(1, (int)Math.Ceiling(ActualWidth * scaleX));
        int height = Math.Max(1, (int)Math.Ceiling(ActualHeight * scaleY));
        var bitmap = new RenderTargetBitmap(width, height, 96.0 * scaleX, 96.0 * scaleY, PixelFormats.Pbgra32);
        bitmap.Render(this);
        var encoder = new PngBitmapEncoder();
        encoder.Frames.Add(BitmapFrame.Create(bitmap));
        string directory = Path.GetDirectoryName(Path.GetFullPath(path));
        if (!string.IsNullOrEmpty(directory)) Directory.CreateDirectory(directory);
        using (var stream = File.Create(path)) encoder.Save(stream);
    }

    public void Prewarm()
    {
        // Realize the HWND + JIT the layout + load fonts once, off-screen, so the
        // first real ping paints instantly like every later one.
        Log("prewarm begin");
        _project = ""; _name = "warmup"; _icon = "";
        _serverManager = ""; _serverApp = ""; _serverConfig = ""; _serverPort = 0; _serverControl = null;
        _gitControl = null; _gitStatus = GitProjectStatus.Checking();
        _worktreeControl = null; _worktreeInventory = GitWorktreeInventory.Checking(); _commandCenter = null;
        Content = BuildCard();
        Left = -30000; Top = -30000;
        Show(); UpdateLayout();
        Hide();
        Log("prewarm end");
    }

    public void ShowFromLine(string line)
    {
        string[] p = line.Split('|');
        string project = p.Length > 0 ? p[0] : "";
        string name = p.Length > 1 ? p[1] : "";
        string icon = p.Length > 2 ? p[2] : "";
        string stamp = p.Length > 3 ? p[3] : "";
        long ticks = 0; if (p.Length > 4) long.TryParse(p[4], out ticks);
        string serverManager = p.Length > 5 ? p[5] : "";
        string serverApp = p.Length > 6 ? p[6] : "";
        string serverConfig = p.Length > 7 ? p[7] : "";
        int serverPort = 0; if (p.Length > 8) int.TryParse(p[8], out serverPort);
        ShowFor(project, name, icon, stamp, ticks, serverManager, serverApp, serverConfig, serverPort);
    }

    void ShowFor(string project, string name, string icon, string stampFile, long stubStartTicks,
        string serverManager, string serverApp, string serverConfig, int serverPort)
    {
        // A pin click while the popover is open deactivates it (mousedown) and that
        // SAME click's stub ping lands ~150ms later, re-popping it — the user sees
        // the intro animation play twice in a row. Treat that ping as a toggle-close.
        double sinceHide = (DateTime.Now.Ticks - _deactHideTicks) / 10000.0;
        if (_deactHideTicks > 0 && sinceHide < 450 && string.Equals(project, _deactHideProject, StringComparison.OrdinalIgnoreCase))
        {
            _deactHideTicks = 0; // swallow only this one ping; the next click reopens
            Log("ShowFor suppressed (pin toggle-close, " + (int)sinceHide + "ms after deactivate-hide)");
            return;
        }
        _project = project;
        _name = string.IsNullOrEmpty(name) ? "Project" : name;
        _icon = icon;
        _stampFile = stampFile;
        _stubStartTicks = stubStartTicks;
        ConfigureServer(serverManager, serverApp, serverConfig, serverPort);
        ConfigureGit(project);
        _ready = false;
        Log("ShowFor " + _name);
        NativePoint cp; GetCursorPos(out cp); _rawX = cp.X; _rawY = cp.Y;

        Content = BuildCard();
        // Start the card invisible + shrunk BEFORE the window becomes visible, so the
        // first painted frame is NOT a full-size flash at the previous position (the
        // double-pop). PositionAndAnimate then springs it in at the right spot.
        var s0 = new ScaleTransform(0.6, 0.6);
        _card.RenderTransform = s0;
        _card.RenderTransformOrigin = new Point(0.5, 1.0);
        // Make the WHOLE window OS-transparent before it is presented. A layered
        // (AllowsTransparency) window flashes its last/first composited frame on Show
        // regardless of child opacity; Window.Opacity=0 suppresses it at the OS layer.
        // Clear any held opacity animation first, or the reset is ignored.
        BeginAnimation(Window.OpacityProperty, null);
        Opacity = 0;
        Left = -30000; Top = -30000;   // off-screen too, belt + suspenders
        Show(); Log("Show() done vis=" + IsVisible);
        UpdateLayout();
        PositionAndAnimate();
        Activate(); Log("Activate() done");
        _ready = true; Log("ready=true");

        BeginServerStatusCheck();
        BeginGitStatusCheck();

        Dispatcher.BeginInvoke((Action)Stamp, DispatcherPriority.Loaded);
    }

    void ConfigureServer(string manager, string app, string config, int port)
    {
        _serverGeneration++;
        _serverManager = manager ?? "";
        _serverApp = app ?? "";
        _serverConfig = config ?? "";
        _serverPort = port;
        _serverControl = null;
        _serverConfigurationError = "";
        _serverState = DevServerState.Checking;
        _serverBusy = false;
        _serverActionLabel = "Starting";

        if (string.IsNullOrEmpty(_serverManager)) return;
        try
        {
            if (!string.Equals(_serverManager, "pm2", StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("Unsupported server manager: " + _serverManager);
            _serverControl = new Pm2DevServerController(_project, _serverApp, _serverConfig, _serverPort);
        }
        catch (Exception ex)
        {
            _serverConfigurationError = ex.Message;
            _serverState = DevServerState.Error;
            Log("server configuration failed: " + ex.Message);
        }
    }

    void ConfigureGit(string project)
    {
        _gitGeneration++;
        _gitControl = null;
        _gitStatus = GitProjectStatus.Checking();
        _worktreeControl = null;
        _worktreeInventory = GitWorktreeInventory.Checking();
        if (string.IsNullOrEmpty(project)) return;

        try
        {
            _gitControl = new GitProjectController(project);
            _worktreeControl = new GitWorktreeInventoryController(project);
        }
        catch (Exception ex)
        {
            Log("git configuration failed: " + ex.Message);
            LogGitError(ex.Message);
        }
    }

    void PositionAndAnimate()
    {
        var src = PresentationSource.FromVisual(this);
        Matrix from = Matrix.Identity;
        if (src != null && src.CompositionTarget != null) from = src.CompositionTarget.TransformFromDevice;
        Point cur = from.Transform(new Point(_rawX, _rawY));

        Rect wa;
        try
        {
            IntPtr hMon = MonitorFromPoint(new NativePoint { X = _rawX, Y = _rawY }, 2);
            MONITORINFO mi = new MONITORINFO(); mi.cbSize = Marshal.SizeOf(typeof(MONITORINFO));
            if (GetMonitorInfo(hMon, ref mi))
            {
                Point tl = from.Transform(new Point(mi.rcWork.left, mi.rcWork.top));
                Point br = from.Transform(new Point(mi.rcWork.right, mi.rcWork.bottom));
                wa = new Rect(tl, br);
            }
            else wa = SystemParameters.WorkArea;
        }
        catch { wa = SystemParameters.WorkArea; }

        double w = ActualWidth, h = ActualHeight;
        double left = cur.X - w / 2;
        double top = cur.Y - h - 12;
        left = Math.Max(wa.Left + 8, Math.Min(left, wa.Right - w - 8));
        top = Math.Max(wa.Top + 8, Math.Min(top, wa.Bottom - h - 8));
        Left = left; Top = top;

        double ox = Clamp01((cur.X - left) / w);
        double oy = Clamp01((cur.Y - top) / h);
        _card.RenderTransformOrigin = new Point(ox, oy);

        // Reuse the transform ShowFor set to 0.6. ONE smooth motion, no overshoot
        // (BackEase caused the "bounce back and forth"); scale + fade share one
        // duration + ease so it doesn't "finish the job" in a second stage.
        var scale = _card.RenderTransform as ScaleTransform;
        if (scale == null) { scale = new ScaleTransform(0.6, 0.6); _card.RenderTransform = scale; }
        var ease = new CubicEase { EasingMode = EasingMode.EaseOut };
        var dur = new Duration(TimeSpan.FromMilliseconds(170));
        var grow = new DoubleAnimation(0.6, 1.0, dur) { EasingFunction = ease };
        scale.BeginAnimation(ScaleTransform.ScaleXProperty, grow);
        scale.BeginAnimation(ScaleTransform.ScaleYProperty, grow);
        // Fade the WINDOW opacity (not the card) — reveal happens at the OS layer.
        BeginAnimation(Window.OpacityProperty, new DoubleAnimation(0, 1, dur) { EasingFunction = ease });
    }

    void Stamp()
    {
        if (!string.IsNullOrEmpty(_stampFile) && _stubStartTicks > 0)
        {
            try
            {
                double ms = (DateTime.Now.Ticks - _stubStartTicks) / 10000.0;
                File.WriteAllText(_stampFile, ((int)ms).ToString());
            }
            catch { }
            var t = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(500) };
            t.Tick += delegate { t.Stop(); HideIt(); };
            t.Start();
        }
    }

    void HideIt() { Log("HideIt"); _ready = false; Hide(); }

    void OnKey(object sender, System.Windows.Input.KeyEventArgs e)
    {
        if (!_ready) return;
        bool control = (System.Windows.Input.Keyboard.Modifiers & System.Windows.Input.ModifierKeys.Control) != 0;
        bool editing = _commandCenter != null && _commandCenter.RequestHasKeyboardFocus;
        if (e.Key == System.Windows.Input.Key.Escape)
        {
            e.Handled = true;
            HideIt();
        }
        else if (control && (e.Key == System.Windows.Input.Key.D2 || e.Key == System.Windows.Input.Key.NumPad2))
        {
            e.Handled = true;
            CopyAgentRequest("feedback", "keyboard");
        }
        else if (control && (e.Key == System.Windows.Input.Key.D3 || e.Key == System.Windows.Input.Key.NumPad3))
        {
            e.Handled = true;
            CopyAgentRequest("commit", "keyboard");
        }
        else if (!editing && (e.Key == System.Windows.Input.Key.D1 || e.Key == System.Windows.Input.Key.NumPad1))
        {
            e.Handled = true;
            ControlServer("keyboard");
        }
    }

    Border BuildCard()
    {
        bool hasServer = !string.IsNullOrEmpty(_serverManager);
        _commandCenter = new ProjectCommandCenter(
            _name,
            _icon,
            hasServer,
            _serverPort,
            delegate { ControlServer("mouse"); },
            delegate { CopyAgentRequest("feedback", "mouse"); },
            delegate { CopyAgentRequest("commit", "mouse"); });
        _card = _commandCenter;
        UpdateServerVisual();
        UpdateWorkspaceVisual();
        return _card;
    }

    void CopyAgentRequest(string kind, string source)
    {
        if (_commandCenter == null) return;
        string note = (_commandCenter.RequestText ?? "").Trim();
        if (string.IsNullOrEmpty(note))
        {
            _commandCenter.FocusRequest("Write a short note first.");
            return;
        }

        string prompt = kind == "commit"
            ? AgentPromptBuilder.BuildCommitRequest(_project, note, _gitStatus)
            : AgentPromptBuilder.BuildFeedback(_project, note, _gitStatus);
        try
        {
            Clipboard.SetText(prompt, TextDataFormat.UnicodeText);
            string message = kind == "commit"
                ? "Commit request copied. Paste it into Claude or Codex."
                : "Feedback request copied. Paste it into Claude or Codex.";
            _commandCenter.RenderHandoffStatus(message, false);
            Log(kind + " handoff copied by " + source);
        }
        catch (Exception ex)
        {
            _commandCenter.RenderHandoffStatus("Clipboard is busy. Try again.", true);
            Log("handoff copy failed: " + ex.Message);
        }
    }

    void BeginServerStatusCheck()
    {
        if (_serverControl == null)
        {
            if (!string.IsNullOrEmpty(_serverManager)) UpdateServerVisual();
            return;
        }

        int generation = _serverGeneration;
        Pm2DevServerController control = _serverControl;
        ThreadPool.QueueUserWorkItem(delegate
        {
            DevServerStatus status = control.GetStatus();
            Dispatcher.BeginInvoke(new Action(delegate
            {
                if (generation != _serverGeneration || control != _serverControl) return;
                if (_serverBusy) return;
                _serverState = status.State;
                if (status.State == DevServerState.Error && !string.IsNullOrEmpty(status.Detail))
                    LogServerError(status.Detail);
                UpdateServerVisual(status.Detail);
            }));
        });
    }

    void ControlServer(string source)
    {
        Log("server control requested by " + source + " from state " + _serverState);
        if (string.IsNullOrEmpty(_serverManager) || _serverBusy) return;
        if (_serverControl == null)
        {
            _serverState = DevServerState.Error;
            string detail = string.IsNullOrEmpty(_serverConfigurationError) ? "Server control is not configured." : _serverConfigurationError;
            LogServerError(detail);
            UpdateServerVisual(detail);
            return;
        }
        if (_serverState == DevServerState.SetupRequired)
        {
            UpdateServerVisual("Run npm install --global pm2, then reopen Agent Hub.");
            return;
        }

        DevServerState requestedFrom = _serverState;
        int generation = ++_serverGeneration;
        Pm2DevServerController control = _serverControl;
        _serverBusy = true;
        _serverActionLabel = requestedFrom == DevServerState.Running || requestedFrom == DevServerState.Starting ? "Restarting" : "Starting";
        _serverState = DevServerState.Starting;
        UpdateServerVisual();

        ThreadPool.QueueUserWorkItem(delegate
        {
            DevServerCommandResult result = control.StartOrRestart(requestedFrom, delegate(string progress)
            {
                Dispatcher.BeginInvoke(new Action(delegate
                {
                    if (generation != _serverGeneration || control != _serverControl || !_serverBusy) return;
                    UpdateServerVisual(progress);
                }));
            });
            DevServerStatus status = result.Succeeded ? control.GetStatus() : new DevServerStatus(DevServerState.Error, result.Detail);
            Dispatcher.BeginInvoke(new Action(delegate
            {
                if (generation != _serverGeneration || control != _serverControl) return;
                _serverBusy = false;
                _serverState = status.State;
                Log("server control completed with state " + status.State);
                if (status.State == DevServerState.Error && !string.IsNullOrEmpty(status.Detail)) LogServerError(status.Detail);
                UpdateServerVisual(status.Detail);
            }));
        });
    }

    void UpdateServerVisual() { UpdateServerVisual(""); }
    void UpdateServerVisual(string detail)
    {
        if (_commandCenter != null)
            _commandCenter.RenderServer(_serverState, _serverBusy, _serverActionLabel, detail);
    }

    void LogServerError(string detail)
    {
        try
        {
            string dir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "AgentHub");
            Directory.CreateDirectory(dir);
            File.AppendAllText(Path.Combine(dir, "server-errors.log"),
                DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss.fff") + " " + (_project ?? "") + " " + detail + "\r\n");
        }
        catch { }
        Log("server control failed: " + detail);
    }

    void BeginGitStatusCheck()
    {
        if (_gitControl == null || _worktreeControl == null || _commandCenter == null) return;
        int generation = _gitGeneration;
        GitProjectController control = _gitControl;
        GitWorktreeInventoryController worktreeControl = _worktreeControl;
        UpdateWorkspaceVisual();
        ThreadPool.QueueUserWorkItem(delegate
        {
            GitProjectStatus status = control.GetStatus();
            GitWorktreeInventory inventory = worktreeControl.GetInventory();
            Dispatcher.BeginInvoke(new Action(delegate
            {
                if (generation != _gitGeneration || control != _gitControl || worktreeControl != _worktreeControl) return;
                _gitStatus = status;
                _worktreeInventory = inventory;
                if (status.State == GitProjectState.Error && !string.IsNullOrEmpty(status.Detail))
                    LogGitError(status.Detail);
                if (inventory.Items.Count == 0 && !string.IsNullOrEmpty(inventory.Detail))
                    LogGitError(inventory.Detail);
                UpdateWorkspaceVisual();
            }));
        });
    }

    void UpdateWorkspaceVisual()
    {
        if (_commandCenter != null) _commandCenter.RenderWorktrees(_worktreeInventory);
    }

    public void ApplyVisualTestState(System.Collections.Generic.Dictionary<string, string> fields)
    {
        string value;
        if (fields == null) return;
        if (fields.TryGetValue("RequestText", out value) && _commandCenter != null)
            _commandCenter.SetRequestForVisualTest(value);
        if (!fields.TryGetValue("ServerVisualState", out value) || string.IsNullOrEmpty(value)) return;
        try
        {
            _serverGeneration++;
            _serverState = (DevServerState)Enum.Parse(typeof(DevServerState), value, true);
            _serverBusy = _serverState == DevServerState.Starting;
            _serverActionLabel = fields.ContainsKey("ServerActionLabel") ? fields["ServerActionLabel"] : "Restarting";
            string detail = fields.ContainsKey("ServerVisualDetail") ? fields["ServerVisualDetail"] : "";
            UpdateServerVisual(detail);
        }
        catch (Exception ex)
        {
            Log("visual server state rejected: " + ex.Message);
        }
    }

    void LogGitError(string detail)
    {
        try
        {
            string dir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "AgentHub");
            Directory.CreateDirectory(dir);
            File.AppendAllText(Path.Combine(dir, "git-errors.log"),
                DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss.fff") + " " + (_project ?? "") + " " + detail + "\r\n");
        }
        catch { }
        Log("git control failed: " + detail);
    }

    // Logging is opt-in: create %LOCALAPPDATA%\AgentHub\debug.flag to enable it.
    // The flag is re-checked (at most every 2s) so it takes effect without a
    // host restart — you turn it on, click, and the log is already there.
    static string _stateDir, _pid;
    static bool _logOn; static long _logCheckedTicks;
    static void Log(string m)
    {
        try
        {
            if (_stateDir == null)
            {
                _stateDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "AgentHub");
                _pid = Process.GetCurrentProcess().Id.ToString();
            }
            long now = DateTime.Now.Ticks;
            if (now - _logCheckedTicks > 20000000L)
            {
                _logCheckedTicks = now;
                _logOn = File.Exists(Path.Combine(_stateDir, "debug.flag"));
            }
            if (!_logOn) return;
            File.AppendAllText(Path.Combine(_stateDir, "host.log"),
                DateTime.Now.ToString("HH:mm:ss.fff") + " pid=" + _pid + " " + m + "\r\n");
        }
        catch { }
    }

    static double Clamp01(double v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }
}
