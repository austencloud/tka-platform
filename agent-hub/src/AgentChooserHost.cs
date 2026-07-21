// AgentChooserHost.exe — resident host for the agent popover.
// Starts at logon, keeps a WPF window pre-built + WPF/fonts warm, and listens on
// a named pipe. A featherweight stub (AgentChooserStub.exe, launched by the
// taskbar) pings the pipe; the host shows the pre-warmed window INSTANTLY.
// The host never exits on selection — it hides and waits for the next ping.
//
// Pipe message (UTF8 line):  project|name|icon|stampFile|stubStartTicks
// (stampFile + stubStartTicks are optional, used only for latency tests.)

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
using System.Windows.Media.Effects;
using System.Windows.Media.Imaging;
using System.Windows.Threading;

class Popup : Window
{
    [DllImport("user32.dll")] static extern bool GetCursorPos(out NativePoint p);
    [DllImport("user32.dll")] static extern IntPtr MonitorFromPoint(NativePoint pt, uint flags);
    [DllImport("user32.dll", CharSet = CharSet.Auto)] static extern bool GetMonitorInfo(IntPtr hMonitor, ref MONITORINFO mi);
    [StructLayout(LayoutKind.Sequential)] struct NativePoint { public int X; public int Y; }
    [StructLayout(LayoutKind.Sequential)] struct NativeRect { public int left; public int top; public int right; public int bottom; }
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)] struct MONITORINFO { public int cbSize; public NativeRect rcMonitor; public NativeRect rcWork; public int dwFlags; }

    const string PIPE = "AgentChooserPipe";

    string _project, _name, _icon, _lastAgent, _stampFile;
    long _stubStartTicks;
    long _deactHideTicks; string _deactHideProject = "";
    int _rawX, _rawY;
    bool _ready;
    Border _card, _claudeBtn, _codexBtn;

    [STAThread]
    static void Main(string[] argv)
    {
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
        return g("Project") + "|" + g("Name") + "|" + g("Icon") + "|" + g("StampFile") + "|" + g("StubStartTicks");
    }

    public Popup()
    {
        WindowStyle = WindowStyle.None;
        AllowsTransparency = true;
        Background = Brushes.Transparent;
        ShowInTaskbar = false;
        Topmost = true;
        ResizeMode = ResizeMode.NoResize;
        SizeToContent = SizeToContent.WidthAndHeight;
        WindowStartupLocation = WindowStartupLocation.Manual;
        Visibility = Visibility.Hidden;

        PreviewKeyDown += OnKey;
        Deactivated += delegate { Log("Deactivated ready=" + _ready + " vis=" + IsVisible); if (_ready && IsVisible) { _deactHideTicks = DateTime.Now.Ticks; _deactHideProject = _project; HideIt(); } };
        Activated += delegate { Log("Activated"); };
        IsVisibleChanged += delegate { Log("IsVisibleChanged -> " + IsVisible); };
    }

    public void Prewarm()
    {
        // Realize the HWND + JIT the layout + load fonts once, off-screen, so the
        // first real ping paints instantly like every later one.
        Log("prewarm begin");
        _project = ""; _name = "warmup"; _icon = ""; _lastAgent = "claude";
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
        ShowFor(project, name, icon, stamp, ticks);
    }

    void ShowFor(string project, string name, string icon, string stampFile, long stubStartTicks)
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

        Dispatcher.BeginInvoke((Action)Stamp, DispatcherPriority.Loaded);
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
            if (bat != null && File.Exists(bat)) { psi.FileName = "cmd.exe"; psi.Arguments = "/c \"" + bat + "\""; }
            else
            {
                string cli = agent == "codex" ? "codex --dangerously-bypass-approvals-and-sandbox" : "claude --dangerously-skip-permissions";
                psi.FileName = "cmd.exe"; psi.Arguments = "/k cd /d \"" + psi.WorkingDirectory + "\" ^&^& " + cli;
            }
            psi.UseShellExecute = true;
            Process.Start(psi);
        }
        catch { }
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

        var col = new StackPanel { Width = 430 };
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
        col.Children.Add(new TextBlock { Text = "Choose an agent", Foreground = Brush("#FF8B8B95"), FontSize = 12, HorizontalAlignment = HorizontalAlignment.Center, Margin = new Thickness(0, 0, 0, 18), FontFamily = new FontFamily("Segoe UI") });

        var grid = new Grid();
        grid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
        grid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(16) });
        grid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
        _claudeBtn = Choice("#FFD97757", "Claude", "Claude Code", "1", "claude");
        _codexBtn = Choice("#FF10A37F", "Codex", "Codex · Sol", "2", "codex");
        Grid.SetColumn(_claudeBtn, 0); Grid.SetColumn(_codexBtn, 2);
        grid.Children.Add(_claudeBtn); grid.Children.Add(_codexBtn);
        col.Children.Add(grid);

        Border hi = _lastAgent == "codex" ? _codexBtn : _claudeBtn;
        hi.BorderBrush = Brush("#FFFFFFFF"); hi.BorderThickness = new Thickness(2);

        col.Children.Add(new TextBlock { Text = "1 · Claude     2 · Codex     Enter · " + (_lastAgent ?? "claude") + "     Esc", Foreground = Brush("#FF6C6C74"), FontSize = 11, HorizontalAlignment = HorizontalAlignment.Center, Margin = new Thickness(0, 18, 0, 0), FontFamily = new FontFamily("Segoe UI") });

        _card.Child = col;
        return _card;
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
    static SolidColorBrush Brush(string hex) { return new SolidColorBrush((Color)ColorConverter.ConvertFromString(hex)); }
}
