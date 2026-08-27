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
using System.Globalization;
using System.IO;
using System.IO.Pipes;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Media.Animation;
using System.Windows.Media.Imaging;
using System.Windows.Threading;

class Popup : Window
{
    static bool _visualTestMode;
    static bool _forceReducedMotion;
    static int _visualAnimationDurationMs = 160;
    [DllImport("user32.dll")] static extern bool GetCursorPos(out NativePoint p);
    [DllImport("user32.dll")] static extern IntPtr MonitorFromPoint(NativePoint pt, uint flags);
    [DllImport("user32.dll", CharSet = CharSet.Auto)] static extern bool GetMonitorInfo(IntPtr hMonitor, ref MONITORINFO mi);
    [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr hWnd, out NativeRect rect);
    [DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr hWnd, IntPtr insertAfter, int x, int y, int width, int height, uint flags);
    [StructLayout(LayoutKind.Sequential)] struct NativePoint { public int X; public int Y; }
    [StructLayout(LayoutKind.Sequential)] struct NativeRect { public int left; public int top; public int right; public int bottom; }
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)] struct MONITORINFO { public int cbSize; public NativeRect rcMonitor; public NativeRect rcWork; public int dwFlags; }

    const string PIPE = "AgentChooserPipe";
    const uint SWP_NOSIZE = 0x0001;
    const uint SWP_NOZORDER = 0x0004;
    const uint SWP_NOACTIVATE = 0x0010;

    string _project, _name, _icon, _stampFile;
    string _serverManager, _serverApp, _serverConfig, _serverConfigurationError;
    int _serverPort;
    long _stubStartTicks;
    long _deactHideTicks; string _deactHideProject = "";
    int _rawX, _rawY;
    Rect _lastWorkArea;
    Point _lastAnchor;
    bool _ready;
    bool _layoutReflowPending;
    bool _hasVisualAnchor;
    bool _visualStartWorktreesCollapsed;
    bool _visualScrollWorktreesToEnd;
    int _visualAnchorX, _visualAnchorY;
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
    int _workflowGeneration;
    bool _workflowBusy;

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
        if (HasArg(argv, "SelfTestWorkflow"))
        {
            Environment.ExitCode = AgentWorkflowLauncher.SelfTest();
            return;
        }
        if (HasArg(argv, "SelfTestWorktrees"))
        {
            Environment.ExitCode = GitWorktreeInventoryController.SelfTest();
            return;
        }
        if (HasArg(argv, "SelfTestPlacement"))
        {
            Environment.ExitCode = PopupPlacement.SelfTest();
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
                win.ConfigureVisualTest(a);
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
            int.TryParse(configuredDelay, out parsedDelay) && parsedDelay >= 25 && parsedDelay <= 15000)
            captureDelayMs = parsedDelay;
        var timer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(captureDelayMs) };
        timer.Tick += delegate
        {
            timer.Stop();
            try
            {
                win.CapturePng(capturePath);
                string boundsPath;
                if (fields.TryGetValue("BoundsPath", out boundsPath) && !string.IsNullOrEmpty(boundsPath))
                    win.WriteBoundsReport(boundsPath);
            }
            catch (Exception ex) { Log("visual capture failed: " + ex.Message); Environment.ExitCode = 3; }
            win.Close();
            app.Shutdown();
        };
        app.Dispatcher.BeginInvoke(new Action(delegate
        {
            win.ConfigureVisualTest(fields);
            win.ShowFromLine(Line(fields));
            win.ApplyVisualTestState(fields);
            timer.Start();
        }));
        app.Run();
    }

    public void ConfigureVisualTest(System.Collections.Generic.Dictionary<string, string> fields)
    {
        if (!_visualTestMode || fields == null) return;
        string xValue, yValue, reducedValue, durationValue, collapsedValue, scrollValue;
        int x, y, duration;
        if (fields.TryGetValue("VisualAnchorX", out xValue) &&
            fields.TryGetValue("VisualAnchorY", out yValue) &&
            int.TryParse(xValue, out x) && int.TryParse(yValue, out y))
        {
            _hasVisualAnchor = true;
            _visualAnchorX = x;
            _visualAnchorY = y;
        }
        _forceReducedMotion = fields.TryGetValue("ReducedMotion", out reducedValue) &&
            string.Equals(reducedValue, "true", StringComparison.OrdinalIgnoreCase);
        if (fields.TryGetValue("AnimationDurationMs", out durationValue) &&
            int.TryParse(durationValue, out duration) && duration >= 80 && duration <= 5000)
            _visualAnimationDurationMs = duration;
        _visualStartWorktreesCollapsed = fields.TryGetValue("StartWorktreesCollapsed", out collapsedValue) &&
            string.Equals(collapsedValue, "true", StringComparison.OrdinalIgnoreCase);
        _visualScrollWorktreesToEnd = fields.TryGetValue("ScrollWorktreesToEnd", out scrollValue) &&
            string.Equals(scrollValue, "true", StringComparison.OrdinalIgnoreCase);
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
        SizeChanged += delegate { RequestLayoutReflow(); };
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

    public void WriteBoundsReport(string path)
    {
        string directory = Path.GetDirectoryName(Path.GetFullPath(path));
        if (!string.IsNullOrEmpty(directory)) Directory.CreateDirectory(directory);
        Func<double, string> n = delegate(double value) { return value.ToString("0.###", CultureInfo.InvariantCulture); };
        NativeRect windowRect = new NativeRect();
        NativeRect workRect = new NativeRect();
        bool nativeGeometry = GetWindowRect(new WindowInteropHelper(this).Handle, out windowRect) && TryGetActiveWorkArea(out workRect);
        double left = nativeGeometry ? windowRect.left : Left;
        double top = nativeGeometry ? windowRect.top : Top;
        double width = nativeGeometry ? windowRect.right - windowRect.left : ActualWidth;
        double height = nativeGeometry ? windowRect.bottom - windowRect.top : ActualHeight;
        double workLeft = nativeGeometry ? workRect.left : _lastWorkArea.Left;
        double workTop = nativeGeometry ? workRect.top : _lastWorkArea.Top;
        double workRight = nativeGeometry ? workRect.right : _lastWorkArea.Right;
        double workBottom = nativeGeometry ? workRect.bottom : _lastWorkArea.Bottom;
        string json =
            "{\"left\":" + n(left) +
            ",\"top\":" + n(top) +
            ",\"width\":" + n(width) +
            ",\"height\":" + n(height) +
            ",\"anchorX\":" + n(_rawX) +
            ",\"anchorY\":" + n(_rawY) +
            ",\"workLeft\":" + n(workLeft) +
            ",\"workTop\":" + n(workTop) +
            ",\"workRight\":" + n(workRight) +
            ",\"workBottom\":" + n(workBottom) +
            ",\"worktreesExpanded\":" + (_commandCenter != null && _commandCenter.WorktreesExpanded ? "true" : "false") +
            ",\"worktreeViewport\":" + n(_commandCenter == null ? 0 : _commandCenter.WorktreeViewportHeight) +
            ",\"worktreeExtent\":" + n(_commandCenter == null ? 0 : _commandCenter.WorktreeExtentHeight) +
            ",\"worktreeScrollable\":" + n(_commandCenter == null ? 0 : _commandCenter.WorktreeScrollableHeight) + "}";
        File.WriteAllText(path, json);
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
        _workflowGeneration++;
        _workflowBusy = false;
        _layoutReflowPending = false;
        _ready = false;
        Log("ShowFor " + _name);
        NativePoint cp; GetCursorPos(out cp); _rawX = cp.X; _rawY = cp.Y;
        if (_visualTestMode && _hasVisualAnchor) { _rawX = _visualAnchorX; _rawY = _visualAnchorY; }

        MaxWidth = double.PositiveInfinity;
        MaxHeight = double.PositiveInfinity;
        Content = BuildCard();
        if (_visualTestMode && _visualStartWorktreesCollapsed) _commandCenter.SetWorktreesExpanded(false);
        // Start the card invisible + shrunk BEFORE the window becomes visible, so the
        // first painted frame is NOT a full-size flash at the previous position (the
        // double-pop). PositionAndAnimate then expands it from the taskbar edge.
        double initialScale = MotionEnabled() ? 0.94 : 1.0;
        var s0 = new ScaleTransform(initialScale, initialScale);
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
        FitAndPlaceNative();

        // Windows' animation preference is the reduced-motion contract for this
        // native surface. With motion disabled, the card appears fully formed.
        var scale = _card.RenderTransform as ScaleTransform;
        if (!MotionEnabled())
        {
            if (scale == null) { scale = new ScaleTransform(1, 1); _card.RenderTransform = scale; }
            scale.BeginAnimation(ScaleTransform.ScaleXProperty, null);
            scale.BeginAnimation(ScaleTransform.ScaleYProperty, null);
            scale.ScaleX = 1;
            scale.ScaleY = 1;
            BeginAnimation(Window.OpacityProperty, null);
            Opacity = 1;
            return;
        }

        if (scale == null) { scale = new ScaleTransform(0.94, 0.94); _card.RenderTransform = scale; }
        var ease = new CubicEase { EasingMode = EasingMode.EaseOut };
        var dur = new Duration(TimeSpan.FromMilliseconds(_visualTestMode ? _visualAnimationDurationMs : 160));
        var grow = new DoubleAnimation(0.94, 1.0, dur) { EasingFunction = ease };
        scale.BeginAnimation(ScaleTransform.ScaleXProperty, grow);
        scale.BeginAnimation(ScaleTransform.ScaleYProperty, grow);
        // Fade the WINDOW opacity (not the card) — reveal happens at the OS layer.
        BeginAnimation(Window.OpacityProperty, new DoubleAnimation(0, 1, dur) { EasingFunction = ease });
    }

    bool TryGetActiveWorkArea(out NativeRect workArea)
    {
        workArea = new NativeRect();
        IntPtr monitor = MonitorFromPoint(new NativePoint { X = _rawX, Y = _rawY }, 2);
        if (monitor == IntPtr.Zero) return false;
        MONITORINFO info = new MONITORINFO();
        info.cbSize = Marshal.SizeOf(typeof(MONITORINFO));
        if (!GetMonitorInfo(monitor, ref info)) return false;
        workArea = info.rcWork;
        return true;
    }

    void FitAndPlaceNative()
    {
        IntPtr hwnd = new WindowInteropHelper(this).Handle;
        NativeRect workArea;
        NativeRect windowRect;
        if (hwnd == IntPtr.Zero || !TryGetActiveWorkArea(out workArea) || !GetWindowRect(hwnd, out windowRect)) return;

        double pixelWidth = Math.Max(1, windowRect.right - windowRect.left);
        double pixelHeight = Math.Max(1, windowRect.bottom - windowRect.top);
        double dipPerPixelX = ActualWidth > 0 ? ActualWidth / pixelWidth : 1;
        double dipPerPixelY = ActualHeight > 0 ? ActualHeight / pixelHeight : 1;
        double maximumWidth = Math.Max(1, (workArea.right - workArea.left - 16) * dipPerPixelX);
        double maximumHeight = Math.Max(1, (workArea.bottom - workArea.top - 16) * dipPerPixelY);

        MaxWidth = maximumWidth;
        MaxHeight = maximumHeight;
        if (_commandCenter != null) _commandCenter.ConstrainToHeight(maximumHeight);
        UpdateLayout();
        if (!GetWindowRect(hwnd, out windowRect)) return;

        double width = Math.Max(1, windowRect.right - windowRect.left);
        double height = Math.Max(1, windowRect.bottom - windowRect.top);
        double pixelsPerDip = dipPerPixelY > 0 ? 1 / dipPerPixelY : 1;
        Rect work = new Rect(workArea.left, workArea.top, workArea.right - workArea.left, workArea.bottom - workArea.top);
        Point anchor = new Point(_rawX, _rawY);
        Point placement = PopupPlacement.Calculate(work, anchor, new Size(width, height), 12 * pixelsPerDip, 8 * pixelsPerDip);
        SetWindowPos(hwnd, IntPtr.Zero, (int)Math.Round(placement.X), (int)Math.Round(placement.Y), 0, 0,
            SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE);

        _lastWorkArea = work;
        _lastAnchor = anchor;
        _card.RenderTransformOrigin = new Point(
            Clamp01((anchor.X - placement.X) / width),
            Clamp01((anchor.Y - placement.Y) / height));
    }

    void RequestLayoutReflow()
    {
        if (!_ready || !IsVisible || _layoutReflowPending) return;
        _layoutReflowPending = true;
        Dispatcher.BeginInvoke(new Action(delegate
        {
            _layoutReflowPending = false;
            if (!_ready || !IsVisible) return;
            FitAndPlaceNative();
        }), DispatcherPriority.Loaded);
    }

    static bool MotionEnabled()
    {
        return !_forceReducedMotion && SystemParameters.ClientAreaAnimation;
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
        if (e.Key == System.Windows.Input.Key.Escape)
        {
            e.Handled = true;
            HideIt();
        }
        else if (e.Key == System.Windows.Input.Key.D1 || e.Key == System.Windows.Input.Key.NumPad1)
        {
            e.Handled = true;
            ControlServer("keyboard");
        }
        else if (e.Key == System.Windows.Input.Key.D2 || e.Key == System.Windows.Input.Key.NumPad2)
        {
            e.Handled = true;
            LaunchWorkflow(AgentWorkflowKind.Feedback, "keyboard");
        }
        else if (e.Key == System.Windows.Input.Key.D3 || e.Key == System.Windows.Input.Key.NumPad3)
        {
            e.Handled = true;
            LaunchWorkflow(AgentWorkflowKind.Spec, "keyboard");
        }
        else if (e.Key == System.Windows.Input.Key.D4 || e.Key == System.Windows.Input.Key.NumPad4)
        {
            e.Handled = true;
            LaunchWorkflow(AgentWorkflowKind.Sessions, "keyboard");
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
            delegate { LaunchWorkflow(AgentWorkflowKind.Feedback, "mouse"); },
            delegate { LaunchWorkflow(AgentWorkflowKind.Spec, "mouse"); },
            delegate { LaunchWorkflow(AgentWorkflowKind.Sessions, "mouse"); },
            RequestLayoutReflow);
        _card = _commandCenter;
        UpdateServerVisual();
        UpdateWorkspaceVisual();
        return _card;
    }

    void LaunchWorkflow(AgentWorkflowKind kind, string source)
    {
        if (_commandCenter == null || _workflowBusy) return;
        AgentWorkflowDefinition workflow = AgentWorkflowLauncher.Get(kind);
        int generation = ++_workflowGeneration;
        string project = _project;
        _workflowBusy = true;
        _commandCenter.RenderWorkflow(true, "Opening " + workflow.Name + " workflow...", false);
        Log(workflow.Name + " workflow requested by " + source);

        ThreadPool.QueueUserWorkItem(delegate
        {
            AgentWorkflowLaunchResult result = AgentWorkflowLauncher.Launch(project, kind);
            Dispatcher.BeginInvoke(new Action(delegate
            {
                if (generation != _workflowGeneration || !string.Equals(project, _project, StringComparison.OrdinalIgnoreCase)) return;
                _workflowBusy = false;
                if (_commandCenter == null) return;
                _commandCenter.RenderWorkflow(false, result.Detail, !result.Succeeded);
                Log(workflow.Name + " workflow launch " + (result.Succeeded ? "succeeded" : "failed") + ": " + result.Detail);
                if (!result.Succeeded) return;

                var closeTimer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(300) };
                closeTimer.Tick += delegate
                {
                    closeTimer.Stop();
                    if (generation == _workflowGeneration && IsVisible) HideIt();
                };
                closeTimer.Start();
            }));
        });
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
        if (_commandCenter == null) return;
        _commandCenter.RenderWorktrees(_worktreeInventory);
        if (_visualTestMode && _visualScrollWorktreesToEnd)
            Dispatcher.BeginInvoke(new Action(delegate { _commandCenter.ScrollWorktreesToEndForVisualTest(); }), DispatcherPriority.Loaded);
    }

    public void ApplyVisualTestState(System.Collections.Generic.Dictionary<string, string> fields)
    {
        string value;
        if (fields == null) return;
        if (fields.TryGetValue("WorktreesExpanded", out value) && _commandCenter != null)
            _commandCenter.SetWorktreesExpanded(string.Equals(value, "true", StringComparison.OrdinalIgnoreCase));
        string workflowState;
        if (fields.TryGetValue("WorkflowVisualState", out workflowState) && _commandCenter != null)
        {
            string workflowName = fields.ContainsKey("WorkflowVisualKind") ? fields["WorkflowVisualKind"] : "Feedback";
            if (string.Equals(workflowState, "Opening", StringComparison.OrdinalIgnoreCase))
                _commandCenter.RenderWorkflow(true, "Opening " + workflowName + " workflow...", false);
            else if (string.Equals(workflowState, "Error", StringComparison.OrdinalIgnoreCase))
                _commandCenter.RenderWorkflow(false, "Codex could not start the " + workflowName + " workflow.", true);
        }
        if (fields.TryGetValue("ServerVisualState", out value) && !string.IsNullOrEmpty(value))
        {
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
