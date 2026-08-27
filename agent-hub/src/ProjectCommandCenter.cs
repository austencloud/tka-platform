// Native presentation for the lean Agent Hub command center. Process and Git
// behavior stay with their existing controllers; this class owns only the
// visible controls and their stable state transitions.

using System;
using System.IO;
using System.Windows;
using System.Windows.Automation;
using System.Windows.Controls;
using System.Windows.Data;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Effects;
using System.Windows.Media.Imaging;

sealed class ProjectCommandCenter : Border
{
    readonly bool _hasServer;
    readonly int _serverPort;
    readonly System.Windows.Shapes.Ellipse _serverDot;
    readonly TextBlock _serverState;
    readonly TextBlock _serverDetail;
    readonly Button _serverButton;
    readonly TextBox _request;
    readonly TextBlock _requestHint;
    readonly Button _feedbackButton;
    readonly Button _commitButton;
    readonly TextBlock _handoffStatus;
    readonly TextBlock _worktreeSummary;
    readonly StackPanel _worktreeRows;

    public ProjectCommandCenter(
        string name,
        string icon,
        bool hasServer,
        int serverPort,
        Action serverAction,
        Action copyFeedback,
        Action copyCommit)
    {
        _hasServer = hasServer;
        _serverPort = serverPort;
        CornerRadius = new CornerRadius(18);
        Background = Brush("#FF16171B");
        BorderBrush = Brush("#40FFFFFF");
        BorderThickness = new Thickness(1);
        Padding = new Thickness(24, 22, 24, 20);
        Effect = new DropShadowEffect { BlurRadius = 16, ShadowDepth = 5, Opacity = 0.5, Color = Colors.Black };
        CacheMode = new BitmapCache();

        var content = new StackPanel { Width = 520 };
        content.Children.Add(BuildHeader(name, icon));

        var server = new Border
        {
            CornerRadius = new CornerRadius(14),
            Background = Brush("#FF202126"),
            BorderBrush = Brush("#30FFFFFF"),
            BorderThickness = new Thickness(1),
            Padding = new Thickness(16, 14, 14, 14),
            Margin = new Thickness(0, 18, 0, 0)
        };
        var serverGrid = new Grid();
        serverGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
        serverGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(14) });
        serverGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(174) });

        var serverCopy = new StackPanel { VerticalAlignment = VerticalAlignment.Center };
        serverCopy.Children.Add(new TextBlock
        {
            Text = "Development server",
            Foreground = Brush("#FFF3F3F6"),
            FontSize = 14,
            FontWeight = FontWeights.SemiBold,
            FontFamily = Font()
        });
        var stateRow = new StackPanel { Orientation = Orientation.Horizontal, Margin = new Thickness(0, 8, 0, 0) };
        _serverDot = new System.Windows.Shapes.Ellipse { Width = 9, Height = 9, Fill = Brush("#FF737680"), Margin = new Thickness(0, 4, 8, 0) };
        _serverState = new TextBlock
        {
            Text = "Checking server",
            Foreground = Brush("#FFD5D5DA"),
            FontSize = 13,
            FontFamily = Font()
        };
        stateRow.Children.Add(_serverDot);
        stateRow.Children.Add(_serverState);
        serverCopy.Children.Add(stateRow);
        _serverDetail = new TextBlock
        {
            Text = "Port " + serverPort + " · Managed by PM2",
            Foreground = Brush("#FF9899A2"),
            FontSize = 12,
            FontFamily = Font(),
            Margin = new Thickness(17, 4, 0, 0),
            TextTrimming = TextTrimming.CharacterEllipsis
        };
        serverCopy.Children.Add(_serverDetail);
        Grid.SetColumn(serverCopy, 0);
        serverGrid.Children.Add(serverCopy);

        _serverButton = ActionButton("Checking...", "Check or control the development server", serverAction);
        _serverButton.Width = 174;
        _serverButton.Height = 58;
        Grid.SetColumn(_serverButton, 2);
        serverGrid.Children.Add(_serverButton);
        server.Child = serverGrid;
        content.Children.Add(server);

        var handoff = new Border
        {
            CornerRadius = new CornerRadius(14),
            Background = Brush("#FF202126"),
            BorderBrush = Brush("#30FFFFFF"),
            BorderThickness = new Thickness(1),
            Padding = new Thickness(16, 14, 16, 14),
            Margin = new Thickness(0, 12, 0, 0)
        };
        var handoffContent = new StackPanel();
        handoffContent.Children.Add(new TextBlock
        {
            Text = "Send to an agent",
            Foreground = Brush("#FFF3F3F6"),
            FontSize = 14,
            FontWeight = FontWeights.SemiBold,
            FontFamily = Font()
        });
        handoffContent.Children.Add(new TextBlock
        {
            Text = "Type the issue once. Copy the request you need.",
            Foreground = Brush("#FF9899A2"),
            FontSize = 12,
            FontFamily = Font(),
            Margin = new Thickness(0, 3, 0, 10)
        });

        var editor = new Grid();
        _request = new TextBox
        {
            Height = 72,
            AcceptsReturn = true,
            TextWrapping = TextWrapping.Wrap,
            VerticalScrollBarVisibility = ScrollBarVisibility.Auto,
            Background = Brush("#FF17181C"),
            Foreground = Brush("#FFF3F3F6"),
            BorderBrush = Brush("#45FFFFFF"),
            BorderThickness = new Thickness(1),
            Padding = new Thickness(11, 9, 11, 9),
            FontSize = 13,
            FontFamily = Font(),
            CaretBrush = Brushes.White,
            SelectionBrush = Brush("#FF365A8D")
        };
        AutomationProperties.SetName(_request, "Feedback or commit scope");
        _requestHint = new TextBlock
        {
            Text = "What should the agent handle?",
            Foreground = Brush("#FF747680"),
            FontSize = 13,
            FontFamily = Font(),
            Margin = new Thickness(12, 10, 12, 0),
            IsHitTestVisible = false,
            VerticalAlignment = VerticalAlignment.Top
        };
        _request.TextChanged += delegate
        {
            _requestHint.Visibility = string.IsNullOrWhiteSpace(_request.Text) ? Visibility.Visible : Visibility.Hidden;
            UpdateHandoffButtons();
        };
        editor.Children.Add(_request);
        editor.Children.Add(_requestHint);
        handoffContent.Children.Add(editor);

        var handoffButtons = new Grid { Margin = new Thickness(0, 10, 0, 0) };
        handoffButtons.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
        handoffButtons.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(10) });
        handoffButtons.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
        _feedbackButton = ActionButton("Copy feedback", "Copy an implementation request for Claude or Codex", copyFeedback);
        _commitButton = ActionButton("Copy commit request", "Copy a guarded commit request for Claude or Codex", copyCommit);
        _feedbackButton.Height = 48;
        _commitButton.Height = 48;
        Grid.SetColumn(_feedbackButton, 0);
        Grid.SetColumn(_commitButton, 2);
        handoffButtons.Children.Add(_feedbackButton);
        handoffButtons.Children.Add(_commitButton);
        handoffContent.Children.Add(handoffButtons);

        _handoffStatus = new TextBlock
        {
            Text = "Copies text only. Paste it into Claude or Codex.",
            Foreground = Brush("#FF7E8089"),
            FontSize = 12,
            FontFamily = Font(),
            Height = 18,
            Margin = new Thickness(0, 9, 0, 0),
            TextTrimming = TextTrimming.CharacterEllipsis
        };
        handoffContent.Children.Add(_handoffStatus);
        handoff.Child = handoffContent;
        content.Children.Add(handoff);

        var workspace = new Border
        {
            CornerRadius = new CornerRadius(12),
            Background = Brush("#FF1B1C21"),
            BorderBrush = Brush("#24FFFFFF"),
            BorderThickness = new Thickness(1),
            Padding = new Thickness(13, 10, 13, 10),
            Margin = new Thickness(0, 12, 0, 0)
        };
        var workspaceContent = new StackPanel();
        var workspaceHeader = new Grid();
        workspaceHeader.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
        workspaceHeader.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
        var workspaceTitle = new TextBlock
        {
            Text = "Git worktrees",
            Foreground = Brush("#FFE6E6EA"),
            FontSize = 14,
            FontWeight = FontWeights.SemiBold,
            FontFamily = Font()
        };
        _worktreeSummary = new TextBlock
        {
            Text = "Checking",
            Foreground = Brush("#FF93959E"),
            FontSize = 12,
            FontFamily = Font(),
            TextAlignment = TextAlignment.Right
        };
        Grid.SetColumn(workspaceTitle, 0);
        Grid.SetColumn(_worktreeSummary, 1);
        workspaceHeader.Children.Add(workspaceTitle);
        workspaceHeader.Children.Add(_worktreeSummary);
        workspaceContent.Children.Add(workspaceHeader);

        _worktreeRows = new StackPanel { Margin = new Thickness(0, 9, 0, 0) };
        var worktreeScroll = new ScrollViewer
        {
            Content = _worktreeRows,
            MaxHeight = 188,
            VerticalScrollBarVisibility = ScrollBarVisibility.Auto,
            HorizontalScrollBarVisibility = ScrollBarVisibility.Disabled
        };
        workspaceContent.Children.Add(worktreeScroll);
        workspace.Child = workspaceContent;
        content.Children.Add(workspace);

        content.Children.Add(new TextBlock
        {
            Text = "1 server   ·   Ctrl+2 feedback   ·   Ctrl+3 commit   ·   Esc close",
            Foreground = Brush("#FF6F717A"),
            FontSize = 12,
            FontFamily = Font(),
            HorizontalAlignment = HorizontalAlignment.Center,
            Margin = new Thickness(0, 15, 0, 0)
        });

        Child = content;
        UpdateHandoffButtons();
        RenderServer(DevServerState.Checking, false, "Starting", "");
        RenderWorktrees(GitWorktreeInventory.Checking());
    }

    public string RequestText { get { return _request.Text; } }
    public bool RequestHasKeyboardFocus { get { return _request.IsKeyboardFocusWithin; } }

    public void SetRequestForVisualTest(string value)
    {
        _request.Text = value ?? "";
    }

    public void FocusRequest(string message)
    {
        if (!string.IsNullOrEmpty(message)) RenderHandoffStatus(message, false);
        _request.Focus();
        _request.CaretIndex = _request.Text.Length;
    }

    public void RenderHandoffStatus(string message, bool isError)
    {
        _handoffStatus.Text = message;
        _handoffStatus.Foreground = Brush(isError ? "#FFFF8A94" : "#FF9FD7B6");
    }

    public void RenderServer(DevServerState state, bool busy, string actionLabel, string detail)
    {
        string stateText;
        string buttonText;
        string buttonColor;
        string dotColor;
        bool enabled;
        string help;

        if (!_hasServer)
        {
            stateText = "Not configured";
            buttonText = "No server";
            buttonColor = "#FF34363E";
            dotColor = "#FF737680";
            enabled = false;
            help = "This project has no development server configuration.";
            detail = "Add a server entry to projects.json.";
        }
        else if (busy)
        {
            bool restarting = string.Equals(actionLabel, "Restarting", StringComparison.OrdinalIgnoreCase);
            stateText = restarting ? "Restarting" : "Starting";
            buttonText = restarting ? "Restart requested" : "Start requested";
            buttonColor = "#FF4A3F73";
            dotColor = "#FFB9A3FF";
            enabled = false;
            help = stateText + " the development server.";
            if (string.IsNullOrEmpty(detail)) detail = "PM2 request in progress · Port " + _serverPort;
        }
        else if (state == DevServerState.Starting)
        {
            stateText = "Starting";
            buttonText = "Waiting for server";
            buttonColor = "#FF4A3F73";
            dotColor = "#FFB9A3FF";
            enabled = false;
            help = "PM2 is waiting for the development server to accept connections.";
            if (string.IsNullOrEmpty(detail)) detail = "PM2 is online · Waiting for port " + _serverPort;
        }
        else if (state == DevServerState.Running)
        {
            stateText = "Running";
            buttonText = "1  Restart server";
            buttonColor = "#FF247A52";
            dotColor = "#FF59D790";
            enabled = true;
            help = "Restart the development server.";
            if (string.IsNullOrEmpty(detail)) detail = "Port " + _serverPort + " · Managed by PM2";
        }
        else if (state == DevServerState.Offline)
        {
            stateText = "Offline";
            buttonText = "1  Start server";
            buttonColor = "#FF2F6FED";
            dotColor = "#FF75A3FF";
            enabled = true;
            help = "Start the development server.";
            if (string.IsNullOrEmpty(detail)) detail = "Port " + _serverPort + " is not listening";
        }
        else if (state == DevServerState.External)
        {
            stateText = "Port in use";
            buttonText = "Server unavailable";
            buttonColor = "#FF4D4231";
            dotColor = "#FFFFBE63";
            enabled = false;
            help = "The configured port is owned outside PM2.";
            if (string.IsNullOrEmpty(detail)) detail = "Stop the other process before using Agent Hub.";
        }
        else if (state == DevServerState.SetupRequired)
        {
            stateText = "PM2 needed";
            buttonText = "Setup required";
            buttonColor = "#FF34363E";
            dotColor = "#FF8B8D96";
            enabled = false;
            help = "Install PM2 globally, then reopen Agent Hub.";
            if (string.IsNullOrEmpty(detail)) detail = "Install PM2 globally, then reopen Agent Hub.";
        }
        else if (state == DevServerState.Error)
        {
            stateText = "Failed";
            buttonText = "1  Try again";
            buttonColor = "#FFAD343E";
            dotColor = "#FFFF6E78";
            enabled = true;
            help = string.IsNullOrEmpty(detail) ? "Try the development server again." : detail;
            if (string.IsNullOrEmpty(detail)) detail = "The last server request failed.";
        }
        else
        {
            stateText = "Checking server";
            buttonText = "Checking...";
            buttonColor = "#FF34363E";
            dotColor = "#FF92949E";
            enabled = false;
            help = "Checking the development server.";
            if (string.IsNullOrEmpty(detail)) detail = "Reading PM2 and port " + _serverPort;
        }

        _serverState.Text = stateText;
        _serverDetail.Text = detail;
        _serverDot.Fill = Brush(dotColor);
        _serverButton.Content = buttonText;
        _serverButton.Background = Brush(buttonColor);
        _serverButton.IsEnabled = enabled;
        _serverButton.Cursor = enabled ? Cursors.Hand : Cursors.Arrow;
        _serverButton.ToolTip = help;
        _serverButton.Opacity = 1.0;
    }

    public void RenderWorktrees(GitWorktreeInventory inventory)
    {
        if (inventory == null) inventory = GitWorktreeInventory.Checking();
        _worktreeRows.Children.Clear();
        if (inventory.IsChecking)
        {
            _worktreeSummary.Text = "Checking";
            _worktreeRows.Children.Add(WorktreeMessage("Reading primary and task worktrees", false));
            return;
        }
        if (inventory.Items.Count == 0)
        {
            _worktreeSummary.Text = "Unavailable";
            _worktreeRows.Children.Add(WorktreeMessage(
                string.IsNullOrEmpty(inventory.Detail) ? "Worktree inventory unavailable" : inventory.Detail, true));
            return;
        }

        int taskCount = Math.Max(0, inventory.Items.Count - 1);
        _worktreeSummary.Text = taskCount == 1 ? "1 task worktree" : taskCount + " task worktrees";
        for (int i = 0; i < inventory.Items.Count; i++)
            _worktreeRows.Children.Add(BuildWorktreeRow(inventory.Items[i], i == inventory.Items.Count - 1));
        ToolTip = inventory.Detail;
    }

    static FrameworkElement BuildWorktreeRow(GitWorktreeItem item, bool last)
    {
        var row = new Border
        {
            Background = Brush(item.IsPrimary ? "#182F6FED" : "#10FFFFFF"),
            CornerRadius = new CornerRadius(8),
            Padding = new Thickness(9, 7, 9, 7),
            Margin = new Thickness(0, 0, 0, last ? 0 : 6),
            ToolTip = item.Path + Environment.NewLine + item.Detail
        };
        AutomationProperties.SetName(row, (item.IsPrimary ? "Primary checkout " : "Task worktree ") + item.Branch + ". " + ActivityLabel(item));

        var grid = new Grid();
        grid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(57) });
        grid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
        grid.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });

        var role = new TextBlock
        {
            Text = item.IsPrimary ? "PRIMARY" : "TASK",
            Foreground = Brush(item.IsPrimary ? "#FF8DB6FF" : "#FF9B9DA6"),
            FontSize = 10,
            FontWeight = FontWeights.Bold,
            FontFamily = Font(),
            VerticalAlignment = VerticalAlignment.Center
        };
        var identity = new StackPanel { VerticalAlignment = VerticalAlignment.Center };
        identity.Children.Add(new TextBlock
        {
            Text = item.Branch,
            Foreground = Brush("#FFE9E9ED"),
            FontSize = 12,
            FontWeight = FontWeights.SemiBold,
            FontFamily = Font(),
            TextTrimming = TextTrimming.CharacterEllipsis
        });
        identity.Children.Add(new TextBlock
        {
            Text = ShortPath(item.Path),
            Foreground = Brush("#FF7E8089"),
            FontSize = 10,
            FontFamily = Font(),
            TextTrimming = TextTrimming.CharacterEllipsis
        });
        var state = new TextBlock
        {
            Text = ActivityLabel(item),
            Foreground = Brush(ActivityColor(item.Activity)),
            FontSize = 11,
            FontWeight = FontWeights.SemiBold,
            FontFamily = Font(),
            TextAlignment = TextAlignment.Right,
            VerticalAlignment = VerticalAlignment.Center,
            Margin = new Thickness(12, 0, 0, 0)
        };
        Grid.SetColumn(role, 0);
        Grid.SetColumn(identity, 1);
        Grid.SetColumn(state, 2);
        grid.Children.Add(role);
        grid.Children.Add(identity);
        grid.Children.Add(state);
        row.Child = grid;
        return row;
    }

    static FrameworkElement WorktreeMessage(string text, bool error)
    {
        return new TextBlock
        {
            Text = text,
            Foreground = Brush(error ? "#FFFF8A94" : "#FF93959E"),
            FontSize = 12,
            FontFamily = Font(),
            TextWrapping = TextWrapping.Wrap
        };
    }

    static string ShortPath(string path)
    {
        if (string.IsNullOrEmpty(path)) return "Path unavailable";
        try
        {
            string trimmed = path.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
            string leaf = Path.GetFileName(trimmed);
            string parent = Path.GetFileName(Path.GetDirectoryName(trimmed));
            if (!string.IsNullOrEmpty(parent) && !string.IsNullOrEmpty(leaf)) return parent + "\\" + leaf;
        }
        catch { }
        return path;
    }

    static string ActivityLabel(GitWorktreeItem item)
    {
        if (item.Activity == GitWorktreeActivity.PrimaryClean) return "Clean";
        if (item.Activity == GitWorktreeActivity.PrimaryBlocked) return item.ChangedFiles + " changed · blocked";
        if (item.Activity == GitWorktreeActivity.ReadyToMerge) return "Ready to merge";
        if (item.Activity == GitWorktreeActivity.WaitingForPrimary) return "Waiting on primary";
        if (item.Activity == GitWorktreeActivity.InProgress) return item.ChangedFiles + " changed · in progress";
        if (item.Activity == GitWorktreeActivity.Stale) return "Stale · review";
        if (item.Activity == GitWorktreeActivity.Diverged) return "Diverged ↑" + item.AheadOfMain + " ↓" + item.BehindMain;
        if (item.Activity == GitWorktreeActivity.Conflicts) return "Conflicts";
        if (item.Activity == GitWorktreeActivity.OperationInProgress) return "Git operation active";
        if (item.Activity == GitWorktreeActivity.Detached) return "Detached";
        if (item.Activity == GitWorktreeActivity.Locked) return "Locked";
        if (item.Activity == GitWorktreeActivity.Missing) return "Missing · review";
        return "Needs review";
    }

    static string ActivityColor(GitWorktreeActivity activity)
    {
        if (activity == GitWorktreeActivity.PrimaryClean || activity == GitWorktreeActivity.ReadyToMerge) return "#FF69D79A";
        if (activity == GitWorktreeActivity.PrimaryBlocked || activity == GitWorktreeActivity.InProgress ||
            activity == GitWorktreeActivity.WaitingForPrimary || activity == GitWorktreeActivity.Locked) return "#FFFFBE63";
        if (activity == GitWorktreeActivity.Stale) return "#FF9B9DA6";
        return "#FFFF7E88";
    }

    void UpdateHandoffButtons()
    {
        bool enabled = !string.IsNullOrWhiteSpace(_request.Text);
        SetActionButtonEnabled(_feedbackButton, enabled, "#FF2F6FED");
        SetActionButtonEnabled(_commitButton, enabled, "#FF6B4FB3");
    }

    static void SetActionButtonEnabled(Button button, bool enabled, string color)
    {
        button.IsEnabled = enabled;
        button.Background = Brush(enabled ? color : "#FF34363E");
        button.Foreground = Brush(enabled ? "#FFFFFFFF" : "#FF858791");
        button.Cursor = enabled ? Cursors.Hand : Cursors.Arrow;
        button.Opacity = 1.0;
    }

    static StackPanel BuildHeader(string name, string icon)
    {
        var header = new StackPanel();
        var titleRow = new StackPanel { Orientation = Orientation.Horizontal, HorizontalAlignment = HorizontalAlignment.Center };
        if (!string.IsNullOrEmpty(icon) && File.Exists(icon))
        {
            try
            {
                var bitmap = new BitmapImage();
                bitmap.BeginInit();
                bitmap.UriSource = new Uri(Path.GetFullPath(icon));
                bitmap.CacheOption = BitmapCacheOption.OnLoad;
                bitmap.EndInit();
                var image = new Image { Source = bitmap, Width = 34, Height = 34, Margin = new Thickness(0, 0, 12, 0) };
                RenderOptions.SetBitmapScalingMode(image, BitmapScalingMode.HighQuality);
                titleRow.Children.Add(image);
            }
            catch { }
        }
        titleRow.Children.Add(new TextBlock
        {
            Text = string.IsNullOrEmpty(name) ? "Project" : name,
            Foreground = Brush("#FFF3F3F6"),
            FontSize = 20,
            FontWeight = FontWeights.SemiBold,
            VerticalAlignment = VerticalAlignment.Center,
            FontFamily = Font()
        });
        header.Children.Add(titleRow);
        header.Children.Add(new TextBlock
        {
            Text = "Project command center",
            Foreground = Brush("#FF8B8B95"),
            FontSize = 12,
            FontFamily = Font(),
            HorizontalAlignment = HorizontalAlignment.Center,
            Margin = new Thickness(0, 4, 0, 0)
        });
        return header;
    }

    static Button ActionButton(string label, string accessibleName, Action action)
    {
        var button = new Button
        {
            Content = label,
            Height = 44,
            Foreground = Brushes.White,
            Background = Brush("#FF34363E"),
            BorderBrush = Brush("#30FFFFFF"),
            BorderThickness = new Thickness(1),
            FontSize = 12,
            FontWeight = FontWeights.SemiBold,
            FontFamily = Font(),
            Cursor = Cursors.Hand,
            OverridesDefaultStyle = true,
            Padding = new Thickness(10, 0, 10, 0)
        };
        AutomationProperties.SetName(button, accessibleName);

        var template = new ControlTemplate(typeof(Button));
        var border = new FrameworkElementFactory(typeof(Border));
        border.SetValue(Border.CornerRadiusProperty, new CornerRadius(10));
        border.SetBinding(Border.BackgroundProperty, new Binding("Background") { RelativeSource = new RelativeSource(RelativeSourceMode.TemplatedParent) });
        border.SetBinding(Border.BorderBrushProperty, new Binding("BorderBrush") { RelativeSource = new RelativeSource(RelativeSourceMode.TemplatedParent) });
        border.SetBinding(Border.BorderThicknessProperty, new Binding("BorderThickness") { RelativeSource = new RelativeSource(RelativeSourceMode.TemplatedParent) });
        var presenter = new FrameworkElementFactory(typeof(ContentPresenter));
        presenter.SetValue(ContentPresenter.HorizontalAlignmentProperty, HorizontalAlignment.Center);
        presenter.SetValue(ContentPresenter.VerticalAlignmentProperty, VerticalAlignment.Center);
        border.AppendChild(presenter);
        template.VisualTree = border;
        button.Template = template;

        button.MouseEnter += delegate { if (button.IsEnabled) button.Opacity = 0.86; };
        button.MouseLeave += delegate { button.Opacity = 1.0; };
        button.Click += delegate { if (button.IsEnabled && action != null) action(); };
        return button;
    }

    static FontFamily Font() { return new FontFamily("Segoe UI"); }
    static SolidColorBrush Brush(string hex) { return new SolidColorBrush((Color)ColorConverter.ConvertFromString(hex)); }
}
