// AgentChooserHost.exe — resident host for the agent popover.
// Starts at logon, keeps a WPF window pre-built + WPF/fonts warm, and listens on
// a named pipe. A featherweight stub (AgentChooserStub.exe, launched by the
// taskbar) pings the pipe; the host shows the pre-warmed window INSTANTLY.
// The host never exits on selection — it hides and waits for the next ping.
//
// Pipe message (UTF8 line): project|name|icon|stampFile|stubStartTicks plus
// optional development-server manager, app, config, port, and app URL fields.

using System;
using System.Diagnostics;
using System.IO;
using System.IO.Pipes;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Media.Animation;
using System.Windows.Media.Effects;
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

    string _project, _name, _icon, _lastAgent, _stampFile;
    string _serverManager, _serverApp, _serverConfig, _serverConfigurationError;
    int _serverPort;
    string _appUrl = "";
    long _stubStartTicks;
    long _deactHideTicks; string _deactHideProject = "";
    int _rawX, _rawY;
    bool _ready;
    Border _card, _claudeBtn, _codexBtn, _serverBtn;
    TextBlock _serverTitle, _serverSubtitle;
    Pm2DevServerController _serverControl;
    DevServerState _serverState = DevServerState.Checking;
    int _serverGeneration;
    bool _serverBusy;
    string _serverActionLabel = "Starting";
    GitProjectController _gitControl;
    GitProjectStatus _gitStatus = GitProjectStatus.Checking();
    GitActionPanel _gitPanel;
    int _gitGeneration;
    bool _gitBusy;
    string _gitBusyAction = "";
    string _gitFeedback = "";
    bool _gitFeedbackIsError;

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
        var timer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(1800) };
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
        _project = ""; _name = "warmup"; _icon = ""; _lastAgent = "claude";
        _serverManager = ""; _serverApp = ""; _serverConfig = ""; _serverPort = 0; _serverControl = null;
        _appUrl = "";
        _gitControl = null; _gitPanel = null; _gitStatus = GitProjectStatus.Checking();
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
        string appUrl = p.Length > 9 ? p[9] : "";
        ShowFor(project, name, icon, stamp, ticks, serverManager, serverApp, serverConfig, serverPort, appUrl);
    }

    void ShowFor(string project, string name, string icon, string stampFile, long stubStartTicks,
        string serverManager, string serverApp, string serverConfig, int serverPort, string appUrl)
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
        ConfigureApp(appUrl);
        ConfigureGit(project);
        _lastAgent = ReadLast();
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

    void ConfigureApp(string url)
    {
        _appUrl = "";
        if (string.IsNullOrEmpty(url)) return;
        Uri parsed;
        if (Uri.TryCreate(url, UriKind.Absolute, out parsed) &&
            (parsed.Scheme == Uri.UriSchemeHttp || parsed.Scheme == Uri.UriSchemeHttps))
            _appUrl = parsed.AbsoluteUri;
        else
            Log("app url rejected: " + url);
    }

    void ConfigureGit(string project)
    {
        _gitGeneration++;
        _gitControl = null;
        _gitPanel = null;
        _gitStatus = GitProjectStatus.Checking();
        _gitBusy = false;
        _gitBusyAction = "";
        _gitFeedback = "";
        _gitFeedbackIsError = false;
        if (string.IsNullOrEmpty(project)) return;

        try { _gitControl = new GitProjectController(project); }
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
        if (e.Key == System.Windows.Input.Key.D1 || e.Key == System.Windows.Input.Key.NumPad1) Launch("claude");
        else if (e.Key == System.Windows.Input.Key.D2 || e.Key == System.Windows.Input.Key.NumPad2) Launch("codex");
        else if (e.Key == System.Windows.Input.Key.D3 || e.Key == System.Windows.Input.Key.NumPad3) ControlServer("keyboard");
        else if (e.Key == System.Windows.Input.Key.D4 || e.Key == System.Windows.Input.Key.NumPad4) OpenApp("keyboard");
        else if (e.Key == System.Windows.Input.Key.D5 || e.Key == System.Windows.Input.Key.NumPad5) ControlGit("pull", "keyboard");
        else if (e.Key == System.Windows.Input.Key.D6 || e.Key == System.Windows.Input.Key.NumPad6) ControlGit("push", "keyboard");
        else if (e.Key == System.Windows.Input.Key.Enter) Launch(string.IsNullOrEmpty(_lastAgent) ? "claude" : _lastAgent);
        else if (e.Key == System.Windows.Input.Key.Escape) HideIt();
    }

    void Launch(string agent)
    {
        try
        {
            string bat = string.IsNullOrEmpty(_project) ? null : Path.Combine(_project, "launchers\\start-" + agent + ".bat");
            var psi = new ProcessStartInfo();
            psi.WorkingDirectory = string.IsNullOrEmpty(_project) ? Environment.CurrentDirectory : _project;
            string terminalLauncher = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "AgentTerminalLauncher.exe");
            if (File.Exists(terminalLauncher))
            {
                psi.FileName = terminalLauncher;
                psi.Arguments = "-Agent " + QuoteProcessArg(agent) + " -Project " + QuoteProcessArg(psi.WorkingDirectory);
                if (bat != null && File.Exists(bat)) psi.Arguments += " -Bat " + QuoteProcessArg(bat);
                psi.UseShellExecute = false;
                psi.CreateNoWindow = true;
            }
            else if (bat != null && File.Exists(bat)) { psi.FileName = "cmd.exe"; psi.Arguments = "/c \"" + bat + "\""; psi.UseShellExecute = true; }
            else
            {
                string cli = agent == "codex" ? "codex --dangerously-bypass-approvals-and-sandbox" : "claude --dangerously-skip-permissions";
                psi.FileName = "cmd.exe"; psi.Arguments = "/k cd /d \"" + psi.WorkingDirectory + "\" ^&^& " + cli;
                psi.UseShellExecute = true;
            }
            Process.Start(psi);
            Log("launched " + agent + " for " + psi.WorkingDirectory + (File.Exists(terminalLauncher) ? " through colored terminal" : " through fallback"));
        }
        catch (Exception ex) { Log("launch failed: " + ex.Message); }
        WriteLast(agent);
        HideIt();
    }

    Border BuildCard()
    {
        _card = new Border();
        _card.CornerRadius = new CornerRadius(18);
        _card.Background = Brush("#FF16171B");
        _card.BorderBrush = Brush("#40FFFFFF");
        _card.BorderThickness = new Thickness(1);
        _card.Padding = new Thickness(24);
        _card.Effect = new DropShadowEffect { BlurRadius = 16, ShadowDepth = 5, Opacity = 0.5, Color = Colors.Black };
        // Rasterize the card+shadow ONCE so the scale animation transforms a cached
        // bitmap instead of re-blurring the shadow every frame (kills the stutter).
        _card.CacheMode = new BitmapCache();

        bool hasServer = !string.IsNullOrEmpty(_serverManager);
        bool hasApp = !string.IsNullOrEmpty(_appUrl);
        bool hasGit = _gitControl != null;

        var col = new StackPanel { Width = hasServer && hasApp ? 560 : 430 };
        var head = new StackPanel { Orientation = Orientation.Horizontal, HorizontalAlignment = HorizontalAlignment.Center, Margin = new Thickness(0, 0, 0, 4) };
        if (!string.IsNullOrEmpty(_icon) && File.Exists(_icon))
        {
            try
            {
                var bmp = new BitmapImage(); bmp.BeginInit(); bmp.UriSource = new Uri(Path.GetFullPath(_icon)); bmp.CacheOption = BitmapCacheOption.OnLoad; bmp.EndInit();
                var img = new Image { Source = bmp, Width = 34, Height = 34, Margin = new Thickness(0, 0, 12, 0) };
                RenderOptions.SetBitmapScalingMode(img, BitmapScalingMode.HighQuality);
                head.Children.Add(img);
            }
            catch { }
        }
        head.Children.Add(new TextBlock { Text = _name, Foreground = Brush("#FFF3F3F6"), FontSize = 20, FontWeight = FontWeights.SemiBold, VerticalAlignment = VerticalAlignment.Center, FontFamily = new FontFamily("Segoe UI") });
        col.Children.Add(head);
        col.Children.Add(new TextBlock { Text = hasServer || hasApp || hasGit ? "Choose an agent or project action" : "Choose an agent", Foreground = Brush("#FF8B8B95"), FontSize = 12, HorizontalAlignment = HorizontalAlignment.Center, Margin = new Thickness(0, 0, 0, 18), FontFamily = new FontFamily("Segoe UI") });

        _claudeBtn = Choice("#FFD97757", "Claude", "Claude Code", "1", "claude");
        _codexBtn = Choice("#FF10A37F", "Codex", "Codex · Sol", "2", "codex");
        var tiles = new System.Collections.Generic.List<Border>();
        tiles.Add(_claudeBtn);
        tiles.Add(_codexBtn);
        if (hasServer) { _serverBtn = ServerChoice(); tiles.Add(_serverBtn); }
        if (hasApp) tiles.Add(AppChoice());

        var grid = new Grid();
        double gap = tiles.Count == 2 ? 16 : 12;
        for (int i = 0; i < tiles.Count; i++)
        {
            if (i > 0) grid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(gap) });
            grid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            Grid.SetColumn(tiles[i], i * 2);
            grid.Children.Add(tiles[i]);
        }
        col.Children.Add(grid);

        if (hasGit)
        {
            _gitPanel = new GitActionPanel(
                delegate { ControlGit("pull", "mouse"); },
                delegate { ControlGit("push", "mouse"); });
            col.Children.Add(_gitPanel);
        }

        Border hi = _lastAgent == "codex" ? _codexBtn : _claudeBtn;
        hi.BorderBrush = Brush("#FFFFFFFF"); hi.BorderThickness = new Thickness(2);

        var keyHelp = new StringBuilder("1 Claude   ·   2 Codex");
        if (hasServer) keyHelp.Append("   ·   3 Server");
        if (hasApp) keyHelp.Append("   ·   4 Open");
        keyHelp.Append("   ·   Enter last   ·   Esc");
        string shortcutText = hasServer || hasApp
            ? keyHelp.ToString()
            : "1 · Claude     2 · Codex     Enter · " + (_lastAgent ?? "claude") + "     Esc";
        col.Children.Add(new TextBlock { Text = shortcutText, Foreground = Brush("#FF6C6C74"), FontSize = 11, HorizontalAlignment = HorizontalAlignment.Center, Margin = new Thickness(0, 18, 0, 0), FontFamily = new FontFamily("Segoe UI") });

        _card.Child = col;
        return _card;
    }

    Border ServerChoice()
    {
        var b = new Border { CornerRadius = new CornerRadius(14), Height = 104, Cursor = System.Windows.Input.Cursors.Hand };
        var sp = new StackPanel { VerticalAlignment = VerticalAlignment.Center };
        _serverTitle = new TextBlock { Foreground = Brushes.White, FontSize = 19, FontWeight = FontWeights.SemiBold, HorizontalAlignment = HorizontalAlignment.Center, FontFamily = new FontFamily("Segoe UI") };
        _serverSubtitle = new TextBlock { Foreground = Brushes.White, Opacity = 0.85, FontSize = 11, HorizontalAlignment = HorizontalAlignment.Center, Margin = new Thickness(0, 3, 0, 0), FontFamily = new FontFamily("Segoe UI") };
        sp.Children.Add(_serverTitle);
        sp.Children.Add(_serverSubtitle);
        sp.Children.Add(new TextBlock { Text = "3", Foreground = Brushes.White, Opacity = 0.6, FontSize = 11, HorizontalAlignment = HorizontalAlignment.Center, Margin = new Thickness(0, 7, 0, 0), FontFamily = new FontFamily("Segoe UI") });
        b.Child = sp;
        b.MouseEnter += delegate { if (!_serverBusy) b.Opacity = 0.86; };
        b.MouseLeave += delegate { b.Opacity = 1.0; };
        b.MouseLeftButtonUp += delegate { ControlServer("mouse"); };
        UpdateServerVisual();
        return b;
    }

    Border AppChoice()
    {
        Uri parsed;
        string host = Uri.TryCreate(_appUrl, UriKind.Absolute, out parsed) ? parsed.Authority : "";
        var b = new Border { CornerRadius = new CornerRadius(14), Height = 104, Cursor = System.Windows.Input.Cursors.Hand, Background = Brush("#FF5B5BD6") };
        var sp = new StackPanel { VerticalAlignment = VerticalAlignment.Center };
        sp.Children.Add(new TextBlock { Text = "Open app", Foreground = Brushes.White, FontSize = 19, FontWeight = FontWeights.SemiBold, HorizontalAlignment = HorizontalAlignment.Center, FontFamily = new FontFamily("Segoe UI") });
        sp.Children.Add(new TextBlock { Text = host, Foreground = Brushes.White, Opacity = 0.85, FontSize = 11, HorizontalAlignment = HorizontalAlignment.Center, Margin = new Thickness(0, 3, 0, 0), FontFamily = new FontFamily("Segoe UI") });
        sp.Children.Add(new TextBlock { Text = "4", Foreground = Brushes.White, Opacity = 0.6, FontSize = 11, HorizontalAlignment = HorizontalAlignment.Center, Margin = new Thickness(0, 7, 0, 0), FontFamily = new FontFamily("Segoe UI") });
        b.Child = sp;
        b.ToolTip = "Open " + _appUrl + " in your default browser";
        b.MouseEnter += delegate { b.Opacity = 0.86; };
        b.MouseLeave += delegate { b.Opacity = 1.0; };
        b.MouseLeftButtonUp += delegate { OpenApp("mouse"); };
        return b;
    }

    // Opens the page, nothing else. Starting or restarting the server is the
    // server tile's job — one action per tile, no overlap.
    void OpenApp(string source)
    {
        if (string.IsNullOrEmpty(_appUrl)) return;
        Log("open app requested by " + source);
        OpenBrowser(_appUrl);
        HideIt();
    }

    void OpenBrowser(string url)
    {
        try
        {
            Uri parsed;
            // ShellExecute on an arbitrary pipe-supplied string could run anything;
            // only ever hand it an absolute http(s) URL.
            if (!Uri.TryCreate(url, UriKind.Absolute, out parsed) ||
                (parsed.Scheme != Uri.UriSchemeHttp && parsed.Scheme != Uri.UriSchemeHttps))
            {
                Log("browser open refused for non-http url: " + url);
                return;
            }
            var psi = new ProcessStartInfo(parsed.AbsoluteUri);
            psi.UseShellExecute = true;
            Process.Start(psi);
            Log("opened " + parsed.AbsoluteUri + " in the default browser");
        }
        catch (Exception ex) { Log("browser open failed: " + ex.Message); }
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
        int generation = _serverGeneration;
        Pm2DevServerController control = _serverControl;
        _serverBusy = true;
        _serverActionLabel = requestedFrom == DevServerState.Running || requestedFrom == DevServerState.Starting ? "Restarting" : "Starting";
        _serverState = DevServerState.Starting;
        UpdateServerVisual();

        ThreadPool.QueueUserWorkItem(delegate
        {
            DevServerCommandResult result = control.StartOrRestart(requestedFrom);
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
        if (_serverBtn == null || _serverTitle == null || _serverSubtitle == null) return;
        string title, subtitle, color, help;
        if (_serverState == DevServerState.Running)
        {
            title = "Restart"; subtitle = "Running · :" + _serverPort; color = "#FF247A52"; help = "Restart the development server";
        }
        else if (_serverState == DevServerState.Offline)
        {
            title = "Start"; subtitle = "Offline · :" + _serverPort; color = "#FF2F6FED"; help = "Start the development server";
        }
        else if (_serverState == DevServerState.Starting)
        {
            title = _serverActionLabel; subtitle = "Server · :" + _serverPort; color = "#FF6657A7"; help = _serverActionLabel + " the development server";
        }
        else if (_serverState == DevServerState.External)
        {
            title = "Take over"; subtitle = "Running outside PM2"; color = "#FF9A6700"; help = "Move the running development server under PM2";
        }
        else if (_serverState == DevServerState.SetupRequired)
        {
            title = "PM2 needed"; subtitle = "Install PM2 globally"; color = "#FF555A66"; help = string.IsNullOrEmpty(detail) ? "Run npm install --global pm2, then reopen Agent Hub" : detail;
        }
        else if (_serverState == DevServerState.Error)
        {
            title = "Retry"; subtitle = "Server failed"; color = "#FFAD343E"; help = string.IsNullOrEmpty(detail) ? "Retry the development server" : detail;
        }
        else
        {
            title = "Server"; subtitle = "Checking · :" + _serverPort; color = "#FF414652"; help = "Checking the development server";
        }

        _serverTitle.Text = title;
        _serverSubtitle.Text = subtitle;
        _serverBtn.Background = Brush(color);
        _serverBtn.Opacity = _serverBusy ? 0.78 : 1.0;
        _serverBtn.Cursor = _serverState == DevServerState.SetupRequired || _serverBusy
            ? System.Windows.Input.Cursors.Arrow
            : System.Windows.Input.Cursors.Hand;
        _serverBtn.ToolTip = help;
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
        if (_gitControl == null || _gitPanel == null) return;
        int generation = _gitGeneration;
        GitProjectController control = _gitControl;
        UpdateGitVisual();
        ThreadPool.QueueUserWorkItem(delegate
        {
            GitProjectStatus status = control.GetStatus();
            Dispatcher.BeginInvoke(new Action(delegate
            {
                if (generation != _gitGeneration || control != _gitControl) return;
                _gitStatus = status;
                if (status.State == GitProjectState.Error && !string.IsNullOrEmpty(status.Detail))
                    LogGitError(status.Detail);
                UpdateGitVisual();
            }));
        });
    }

    void ControlGit(string action, string source)
    {
        Log("git " + action + " requested by " + source + " from state " + _gitStatus.State);
        if (_gitControl == null || _gitPanel == null || _gitBusy) return;

        bool allowed = action == "pull" ? _gitStatus.CanPull : _gitStatus.CanPush;
        if (!allowed)
        {
            _gitFeedback = action == "pull" ? _gitStatus.PullBlockedReason : _gitStatus.PushBlockedReason;
            _gitFeedbackIsError = false;
            UpdateGitVisual();
            return;
        }

        int generation = _gitGeneration;
        GitProjectController control = _gitControl;
        _gitBusy = true;
        _gitBusyAction = action;
        _gitFeedback = "";
        _gitFeedbackIsError = false;
        UpdateGitVisual();

        ThreadPool.QueueUserWorkItem(delegate
        {
            GitProjectCommandResult result = action == "pull" ? control.Pull() : control.Push();
            Dispatcher.BeginInvoke(new Action(delegate
            {
                if (generation != _gitGeneration || control != _gitControl) return;
                _gitBusy = false;
                _gitBusyAction = "";
                _gitStatus = result.Status ?? control.GetStatus();
                _gitFeedback = result.Detail;
                _gitFeedbackIsError = !result.Succeeded;
                Log("git " + action + " completed success=" + result.Succeeded + " state=" + _gitStatus.State);
                if (!result.Succeeded) LogGitError(action + ": " + result.Detail);
                UpdateGitVisual();
            }));
        });
    }

    void UpdateGitVisual()
    {
        if (_gitPanel != null) _gitPanel.Render(_gitStatus, _gitBusy ? _gitBusyAction : "", _gitFeedback, _gitFeedbackIsError);
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

    Border Choice(string bg, string title, string sub, string num, string agent)
    {
        var b = new Border { CornerRadius = new CornerRadius(14), Background = Brush(bg), Height = 104, Cursor = System.Windows.Input.Cursors.Hand };
        var sp = new StackPanel { VerticalAlignment = VerticalAlignment.Center };
        sp.Children.Add(new TextBlock { Text = title, Foreground = Brushes.White, FontSize = 19, FontWeight = FontWeights.SemiBold, HorizontalAlignment = HorizontalAlignment.Center, FontFamily = new FontFamily("Segoe UI") });
        sp.Children.Add(new TextBlock { Text = sub, Foreground = Brushes.White, Opacity = 0.85, FontSize = 11, HorizontalAlignment = HorizontalAlignment.Center, Margin = new Thickness(0, 3, 0, 0), FontFamily = new FontFamily("Segoe UI") });
        sp.Children.Add(new TextBlock { Text = num, Foreground = Brushes.White, Opacity = 0.6, FontSize = 11, HorizontalAlignment = HorizontalAlignment.Center, Margin = new Thickness(0, 7, 0, 0), FontFamily = new FontFamily("Segoe UI") });
        b.Child = sp;
        b.MouseEnter += delegate { b.Opacity = 0.86; };
        b.MouseLeave += delegate { b.Opacity = 1.0; };
        b.MouseLeftButtonUp += delegate { Launch(agent); };
        return b;
    }

    static string LastFilePath()
    {
        string dir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "AgentHub");
        return Path.Combine(dir, "last.ini");
    }

    string ReadLast()
    {
        try
        {
            string f = LastFilePath();
            if (!string.IsNullOrEmpty(_project) && File.Exists(f))
            {
                string key = _project.ToLowerInvariant();
                foreach (var line in File.ReadAllLines(f))
                {
                    int eq = line.IndexOf('=');
                    if (eq > 0 && line.Substring(0, eq).Trim().ToLowerInvariant() == key) return line.Substring(eq + 1).Trim();
                }
            }
        }
        catch { }
        return "claude";
    }

    void WriteLast(string agent)
    {
        try
        {
            string f = LastFilePath();
            Directory.CreateDirectory(Path.GetDirectoryName(f));
            string key = (_project ?? "").ToLowerInvariant();
            var lines = File.Exists(f) ? new System.Collections.Generic.List<string>(File.ReadAllLines(f)) : new System.Collections.Generic.List<string>();
            bool found = false;
            for (int i = 0; i < lines.Count; i++)
            {
                int eq = lines[i].IndexOf('=');
                if (eq > 0 && lines[i].Substring(0, eq).Trim().ToLowerInvariant() == key) { lines[i] = key + "=" + agent; found = true; break; }
            }
            if (!found) lines.Add(key + "=" + agent);
            File.WriteAllLines(f, lines.ToArray());
        }
        catch { }
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
    static string QuoteProcessArg(string value)
    {
        if (string.IsNullOrEmpty(value)) return "\"\"";
        var result = new StringBuilder();
        result.Append('"');
        int slashes = 0;
        foreach (char ch in value)
        {
            if (ch == '\\') slashes++;
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
    static SolidColorBrush Brush(string hex) { return new SolidColorBrush((Color)ColorConverter.ConvertFromString(hex)); }
}
