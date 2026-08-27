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
    readonly Button _feedbackButton;
    readonly Button _specButton;
    readonly Button _sessionsButton;
    readonly TextBlock _workflowStatus;
    readonly TextBlock _worktreeSummary;
    readonly TextBlock _worktreeNextActions;
    readonly TextBlock _worktreeStatus;
    readonly StackPanel _worktreeRows;
    readonly ScrollViewer _worktreeScroll;
    readonly ScrollViewer _outerScroll;
    readonly StackPanel _content;
    readonly Button _worktreeToggle;
    readonly Action _layoutChanged;
    readonly Action<GitWorktreeItem> _openWorktreeInCodex;
    readonly System.Collections.Generic.List<Button> _worktreeButtons = new System.Collections.Generic.List<Button>();
    bool _worktreesExpanded = true;

    public ProjectCommandCenter(
        string name,
        string icon,
        bool hasServer,
        int serverPort,
        Action serverAction,
        Action openFeedback,
        Action openSpec,
        Action openSessions,
        Action<GitWorktreeItem> openWorktreeInCodex,
        Action layoutChanged)
    {
        _hasServer = hasServer;
        _serverPort = serverPort;
        _layoutChanged = layoutChanged;
        _openWorktreeInCodex = openWorktreeInCodex;
        CornerRadius = new CornerRadius(18);
        Background = Brush("#FF16171B");
        BorderBrush = Brush("#40FFFFFF");
        BorderThickness = new Thickness(1);
        Padding = new Thickness(24, 22, 24, 20);
        Effect = new DropShadowEffect { BlurRadius = 16, ShadowDepth = 5, Opacity = 0.5, Color = Colors.Black };
        CacheMode = new BitmapCache();

        _content = new StackPanel { Width = 520 };
        _content.Children.Add(BuildHeader(name, icon));

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
        _content.Children.Add(server);

        var workflows = new Border
        {
            CornerRadius = new CornerRadius(14),
            Background = Brush("#FF202126"),
            BorderBrush = Brush("#30FFFFFF"),
            BorderThickness = new Thickness(1),
            Padding = new Thickness(16, 14, 16, 14),
            Margin = new Thickness(0, 12, 0, 0)
        };
        var workflowContent = new StackPanel();
        workflowContent.Children.Add(new TextBlock
        {
            Text = "Project workflows",
            Foreground = Brush("#FFF3F3F6"),
            FontSize = 14,
            FontWeight = FontWeights.SemiBold,
            FontFamily = Font()
        });
        workflowContent.Children.Add(new TextBlock
        {
            Text = "Each action opens a project-scoped Codex session.",
            Foreground = Brush("#FF9899A2"),
            FontSize = 12,
            FontFamily = Font(),
            Margin = new Thickness(0, 3, 0, 10)
        });

        var workflowButtons = new Grid();
        workflowButtons.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
        workflowButtons.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(9) });
        workflowButtons.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
        workflowButtons.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(9) });
        workflowButtons.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
        _feedbackButton = WorkflowButton("Feedback", "Open the queue and choose an item", "#FF2F6FED", openFeedback);
        _specButton = WorkflowButton("Spec", "Review active and backlog specs", "#FF6B4FB3", openSpec);
        _sessionsButton = WorkflowButton("Sessions", "Analyze sessions not reviewed yet", "#FFB45B35", openSessions);
        Grid.SetColumn(_feedbackButton, 0);
        Grid.SetColumn(_specButton, 2);
        Grid.SetColumn(_sessionsButton, 4);
        workflowButtons.Children.Add(_feedbackButton);
        workflowButtons.Children.Add(_specButton);
        workflowButtons.Children.Add(_sessionsButton);
        workflowContent.Children.Add(workflowButtons);

        _workflowStatus = new TextBlock
        {
            Text = "Uses the existing project skills. No desktop task is claimed.",
            Foreground = Brush("#FF7E8089"),
            FontSize = 12,
            FontFamily = Font(),
            Height = 18,
            Margin = new Thickness(0, 9, 0, 0),
            TextTrimming = TextTrimming.CharacterEllipsis
        };
        workflowContent.Children.Add(_workflowStatus);
        workflows.Child = workflowContent;
        _content.Children.Add(workflows);

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
        workspaceHeader.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(10) });
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
        _worktreeToggle = CompactButton("Hide", "Collapse Git worktrees", delegate { SetWorktreesExpanded(!_worktreesExpanded); });
        Grid.SetColumn(workspaceTitle, 0);
        Grid.SetColumn(_worktreeSummary, 1);
        Grid.SetColumn(_worktreeToggle, 3);
        workspaceHeader.Children.Add(workspaceTitle);
        workspaceHeader.Children.Add(_worktreeSummary);
        workspaceHeader.Children.Add(_worktreeToggle);
        workspaceContent.Children.Add(workspaceHeader);

        _worktreeNextActions = new TextBlock
        {
            Text = "Next actions are loading",
            Foreground = Brush("#FF9899A2"),
            FontSize = 11,
            FontFamily = Font(),
            Margin = new Thickness(0, 5, 0, 0),
            TextTrimming = TextTrimming.CharacterEllipsis
        };
        workspaceContent.Children.Add(_worktreeNextActions);

        _worktreeStatus = new TextBlock
        {
            Text = "Open Codex opens the worktree workspace; no Desktop task is claimed.",
            Foreground = Brush("#FF7E8089"),
            FontSize = 11,
            FontFamily = Font(),
            Margin = new Thickness(0, 3, 0, 0),
            TextTrimming = TextTrimming.CharacterEllipsis
        };
        workspaceContent.Children.Add(_worktreeStatus);

        _worktreeRows = new StackPanel { Margin = new Thickness(0, 9, 0, 0) };
        _worktreeScroll = new ScrollViewer
        {
            Content = _worktreeRows,
            MaxHeight = 188,
            VerticalScrollBarVisibility = ScrollBarVisibility.Auto,
            HorizontalScrollBarVisibility = ScrollBarVisibility.Disabled
        };
        workspaceContent.Children.Add(_worktreeScroll);
        workspace.Child = workspaceContent;
        _content.Children.Add(workspace);

        _content.Children.Add(new TextBlock
        {
            Text = "1 server   ·   2 feedback   ·   3 spec   ·   4 sessions   ·   Esc close",
            Foreground = Brush("#FF6F717A"),
            FontSize = 12,
            FontFamily = Font(),
            HorizontalAlignment = HorizontalAlignment.Center,
            Margin = new Thickness(0, 15, 0, 0)
        });

        _outerScroll = new ScrollViewer
        {
            Content = _content,
            VerticalScrollBarVisibility = ScrollBarVisibility.Disabled,
            HorizontalScrollBarVisibility = ScrollBarVisibility.Disabled,
            PanningMode = PanningMode.VerticalOnly
        };
        Child = _outerScroll;
        RenderWorkflow(false, "", false);
        RenderServer(DevServerState.Checking, false, "Starting", "");
        RenderWorktrees(GitWorktreeInventory.Checking());
    }

    public void RenderWorkflow(bool busy, string message, bool isError)
    {
        SetWorkflowButtonEnabled(_feedbackButton, !busy, "#FF2F6FED");
        SetWorkflowButtonEnabled(_specButton, !busy, "#FF6B4FB3");
        SetWorkflowButtonEnabled(_sessionsButton, !busy, "#FFB45B35");
        _workflowStatus.Text = string.IsNullOrEmpty(message)
            ? "Uses the existing project skills. No desktop task is claimed."
            : message;
        _workflowStatus.Foreground = Brush(isError ? "#FFFF8A94" : busy ? "#FFB9A3FF" : "#FF9FD7B6");
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
        _worktreeButtons.Clear();
        if (inventory.IsChecking)
        {
            _worktreeSummary.Text = "Checking";
            _worktreeNextActions.Text = "Checking Git state";
            _worktreeRows.Children.Add(WorktreeMessage("Reading primary and task worktrees", false));
            NotifyLayoutChanged();
            return;
        }
        if (inventory.Items.Count == 0)
        {
            _worktreeSummary.Text = "Unavailable";
            _worktreeNextActions.Text = "No worktree action is available";
            _worktreeRows.Children.Add(WorktreeMessage(
                string.IsNullOrEmpty(inventory.Detail) ? "Worktree inventory unavailable" : inventory.Detail, true));
            NotifyLayoutChanged();
            return;
        }

        int taskCount = Math.Max(0, inventory.Items.Count - 1);
        _worktreeSummary.Text = taskCount == 1 ? "1 task worktree" : taskCount + " task worktrees";
        _worktreeNextActions.Text = NextActionSummary(inventory.Items);
        for (int i = 0; i < inventory.Items.Count; i++)
            _worktreeRows.Children.Add(BuildWorktreeRow(inventory.Items[i], i == inventory.Items.Count - 1));
        ToolTip = inventory.Detail;
        NotifyLayoutChanged();
    }

    public void RenderWorktreeLaunch(bool busy, string message, bool isError)
    {
        for (int i = 0; i < _worktreeButtons.Count; i++)
            _worktreeButtons[i].IsEnabled = !busy;
        _worktreeStatus.Text = string.IsNullOrEmpty(message)
            ? "Open Codex opens the worktree workspace; no Desktop task is claimed."
            : message;
        _worktreeStatus.Foreground = Brush(isError ? "#FFFF8A94" : busy ? "#FFB9A3FF" : "#FF9FD7B6");
    }

    public bool WorktreesExpanded { get { return _worktreesExpanded; } }
    public double WorktreeViewportHeight { get { return _worktreeScroll.ViewportHeight; } }
    public double WorktreeExtentHeight { get { return _worktreeScroll.ExtentHeight; } }
    public double WorktreeScrollableHeight { get { return _worktreeScroll.ScrollableHeight; } }

    public void ScrollWorktreesToEndForVisualTest()
    {
        _worktreeScroll.ScrollToEnd();
        _worktreeScroll.UpdateLayout();
    }

    public void SetWorktreesExpanded(bool expanded)
    {
        if (_worktreesExpanded == expanded) return;
        _worktreesExpanded = expanded;
        _worktreeScroll.Visibility = expanded ? Visibility.Visible : Visibility.Collapsed;
        _worktreeToggle.Content = expanded ? "Hide" : "Show";
        AutomationProperties.SetName(_worktreeToggle, expanded ? "Collapse Git worktrees" : "Expand Git worktrees");
        NotifyLayoutChanged();
    }

    public void ConstrainToHeight(double maximumHeight)
    {
        if (double.IsNaN(maximumHeight) || double.IsInfinity(maximumHeight) || maximumHeight <= 0) return;
        MaxHeight = maximumHeight;
        _worktreeScroll.MaxHeight = 188;
        _outerScroll.VerticalScrollBarVisibility = ScrollBarVisibility.Disabled;

        _content.Measure(new Size(_content.Width, double.PositiveInfinity));
        double contentHeight = _content.DesiredSize.Height + Padding.Top + Padding.Bottom + BorderThickness.Top + BorderThickness.Bottom;
        double currentWorktreeHeight = _worktreeScroll.Visibility == Visibility.Visible ? _worktreeScroll.DesiredSize.Height : 0;
        if (_worktreesExpanded && contentHeight > maximumHeight)
        {
            double available = maximumHeight - (contentHeight - currentWorktreeHeight);
            _worktreeScroll.MaxHeight = Math.Max(72, Math.Min(188, available));
            _content.Measure(new Size(_content.Width, double.PositiveInfinity));
            contentHeight = _content.DesiredSize.Height + Padding.Top + Padding.Bottom + BorderThickness.Top + BorderThickness.Bottom;
        }

        // Only very short work areas need this fallback. Normal desktop monitors
        // keep the fixed controls still while the worktree rows own the scrolling.
        _outerScroll.VerticalScrollBarVisibility = contentHeight > maximumHeight + 0.5
            ? ScrollBarVisibility.Auto
            : ScrollBarVisibility.Disabled;
    }

    void NotifyLayoutChanged()
    {
        if (_layoutChanged != null) _layoutChanged();
    }

    FrameworkElement BuildWorktreeRow(GitWorktreeItem item, bool last)
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
        grid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(88) });

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
            Text = item.Detail,
            Foreground = Brush("#FF93959E"),
            FontSize = 10,
            FontFamily = Font(),
            TextWrapping = TextWrapping.Wrap,
            MaxWidth = 225,
            Margin = new Thickness(0, 3, 0, 0)
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
        var open = CompactButton("Open Codex", "Open " + item.Branch + " worktree in Codex Desktop", delegate
        {
            if (_openWorktreeInCodex != null) _openWorktreeInCodex(item);
        });
        open.Width = 82;
        open.Height = 30;
        open.FontSize = 10;
        open.Background = Brush("#FF2F6FED");
        open.IsEnabled = item.Activity != GitWorktreeActivity.Missing;
        Grid.SetColumn(open, 3);
        grid.Children.Add(open);
        _worktreeButtons.Add(open);
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
        if (item.Activity == GitWorktreeActivity.CleanupCandidate) return "Cleanup candidate";
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
        if (activity == GitWorktreeActivity.CleanupCandidate) return "#FF9B9DA6";
        return "#FFFF7E88";
    }

    static string NextActionSummary(System.Collections.Generic.IList<GitWorktreeItem> items)
    {
        int continueCount = 0;
        int reviewCount = 0;
        int cleanupCount = 0;
        for (int i = 0; i < items.Count; i++)
        {
            GitWorktreeActivity activity = items[i].Activity;
            if (activity == GitWorktreeActivity.InProgress || activity == GitWorktreeActivity.Conflicts ||
                activity == GitWorktreeActivity.OperationInProgress || activity == GitWorktreeActivity.Detached)
                continueCount++;
            else if (activity == GitWorktreeActivity.ReadyToMerge || activity == GitWorktreeActivity.WaitingForPrimary ||
                activity == GitWorktreeActivity.Diverged || activity == GitWorktreeActivity.PrimaryBlocked ||
                activity == GitWorktreeActivity.Locked || activity == GitWorktreeActivity.Missing || activity == GitWorktreeActivity.Error)
                reviewCount++;
            else if (activity == GitWorktreeActivity.CleanupCandidate) cleanupCount++;
        }
        var parts = new System.Collections.Generic.List<string>();
        if (continueCount > 0) parts.Add(continueCount + " continue");
        if (reviewCount > 0) parts.Add(reviewCount + " review/integrate");
        if (cleanupCount > 0) parts.Add(cleanupCount + " cleanup candidate");
        return parts.Count == 0 ? "No task worktree needs action" : "Next: " + string.Join(" · ", parts.ToArray());
    }

    static void SetWorkflowButtonEnabled(Button button, bool enabled, string color)
    {
        button.IsEnabled = enabled;
        button.Background = Brush(enabled ? color : "#FF34363E");
        button.Foreground = Brush(enabled ? "#FFFFFFFF" : "#FF858791");
        button.Cursor = enabled ? Cursors.Hand : Cursors.Arrow;
        button.Opacity = 1.0;
    }

    static Button WorkflowButton(string title, string description, string color, Action action)
    {
        var content = new StackPanel { VerticalAlignment = VerticalAlignment.Center };
        content.Children.Add(new TextBlock
        {
            Text = title,
            Foreground = Brushes.White,
            FontSize = 14,
            FontWeight = FontWeights.SemiBold,
            FontFamily = Font(),
            HorizontalAlignment = HorizontalAlignment.Center
        });
        content.Children.Add(new TextBlock
        {
            Text = description,
            Foreground = Brush("#D9FFFFFF"),
            FontSize = 12,
            FontFamily = Font(),
            TextWrapping = TextWrapping.Wrap,
            TextAlignment = TextAlignment.Center,
            HorizontalAlignment = HorizontalAlignment.Center,
            Margin = new Thickness(7, 5, 7, 0)
        });
        var button = ActionButton(content, "Open the " + title + " workflow in a new Codex session", action);
        button.Height = 88;
        button.Background = Brush(color);
        return button;
    }

    static Button CompactButton(string label, string accessibleName, Action action)
    {
        var button = ActionButton(label, accessibleName, action);
        button.Width = 62;
        button.Height = 34;
        button.Padding = new Thickness(8, 0, 8, 0);
        button.FontSize = 12;
        return button;
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
        return ActionButton((object)label, accessibleName, action);
    }

    static Button ActionButton(object content, string accessibleName, Action action)
    {
        var button = new Button
        {
            Content = content,
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
