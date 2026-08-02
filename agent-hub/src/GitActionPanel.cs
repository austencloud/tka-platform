// Compact native Git status and action row for the Agent Hub popover.

using System;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Data;
using System.Windows.Media;

sealed class GitActionPanel : Border
{
    readonly TextBlock _branch;
    readonly TextBlock _detail;
    readonly Button _pull;
    readonly Button _push;

    public GitActionPanel(Action pull, Action push)
    {
        CornerRadius = new CornerRadius(12);
        Background = Brush("#FF202126");
        BorderBrush = Brush("#30FFFFFF");
        BorderThickness = new Thickness(1);
        Padding = new Thickness(12, 10, 10, 10);
        Margin = new Thickness(0, 14, 0, 0);

        var grid = new Grid();
        grid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
        grid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(84) });
        grid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(8) });
        grid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(84) });

        var status = new StackPanel { VerticalAlignment = VerticalAlignment.Center, Margin = new Thickness(0, 0, 10, 0) };
        _branch = new TextBlock
        {
            Text = "Git status",
            Foreground = Brush("#FFF3F3F6"),
            FontSize = 13,
            FontWeight = FontWeights.SemiBold,
            FontFamily = new FontFamily("Segoe UI"),
            TextTrimming = TextTrimming.CharacterEllipsis
        };
        _detail = new TextBlock
        {
            Text = "Checking",
            Foreground = Brush("#FFA2A2AA"),
            FontSize = 11,
            FontFamily = new FontFamily("Segoe UI"),
            Margin = new Thickness(0, 3, 0, 0),
            TextTrimming = TextTrimming.CharacterEllipsis
        };
        status.Children.Add(_branch);
        status.Children.Add(_detail);
        Grid.SetColumn(status, 0);
        grid.Children.Add(status);

        _pull = ActionButton("4  Pull", pull);
        _push = ActionButton("5  Push", push);
        Grid.SetColumn(_pull, 1);
        Grid.SetColumn(_push, 3);
        grid.Children.Add(_pull);
        grid.Children.Add(_push);
        Child = grid;

        Render(GitProjectStatus.Checking(), "", "", false);
    }

    public void Render(GitProjectStatus status, string busyAction, string feedback, bool feedbackIsError)
    {
        if (status == null) status = GitProjectStatus.Checking();
        bool busy = !string.IsNullOrEmpty(busyAction);

        _branch.Text = BranchLabel(status);
        _detail.Text = !string.IsNullOrEmpty(feedback) ? feedback : StatusDetail(status);
        _detail.Foreground = Brush(feedbackIsError ? "#FFFF8A94" : "#FFA2A2AA");
        ToolTip = FullTooltip(status, feedback);

        SetButton(_pull, busyAction == "pull" ? "Pulling" : "4  Pull",
            !busy && status.CanPull, "#FF2F6FED", status.PullBlockedReason);
        SetButton(_push, busyAction == "push" ? "Pushing" : "5  Push",
            !busy && status.CanPush, "#FF247A52", status.PushBlockedReason);
    }

    static string BranchLabel(GitProjectStatus status)
    {
        if (!string.IsNullOrEmpty(status.Branch) && status.Branch != "(detached)") return status.Branch;
        if (status.State == GitProjectState.Detached) return "Detached HEAD";
        if (status.State == GitProjectState.NotRepository) return "Not a Git repository";
        if (status.State == GitProjectState.GitMissing) return "Git needed";
        if (status.State == GitProjectState.Error) return "Git failed";
        return "Git status";
    }

    static string StatusDetail(GitProjectStatus status)
    {
        if (!string.IsNullOrEmpty(status.Detail)) return status.Detail;
        if (status.State == GitProjectState.Checking) return "Checking";
        if (status.State == GitProjectState.Conflicts) return "Resolve conflicts before syncing";
        if (status.State == GitProjectState.OperationInProgress) return "Finish the current Git operation";
        if (status.State == GitProjectState.Detached) return "Switch to a branch before syncing";
        if (status.State == GitProjectState.NoUpstream) return "No upstream branch";
        if (status.State != GitProjectState.Ready) return "Git controls unavailable";

        string changes = status.ChangedFiles == 0
            ? "Clean"
            : status.ChangedFiles + (status.ChangedFiles == 1 ? " change" : " changes");
        return "\u2191" + status.Ahead + "  \u00B7  \u2193" + status.Behind + "  \u00B7  " + changes;
    }

    static string FullTooltip(GitProjectStatus status, string feedback)
    {
        string result = string.IsNullOrEmpty(status.Upstream)
            ? BranchLabel(status)
            : status.Branch + " tracks " + status.Upstream;
        if (!string.IsNullOrEmpty(feedback)) result += Environment.NewLine + feedback;
        return result;
    }

    static Button ActionButton(string label, Action action)
    {
        var button = new Button
        {
            Content = label,
            Height = 44,
            Foreground = Brushes.White,
            BorderBrush = Brush("#30FFFFFF"),
            BorderThickness = new Thickness(1),
            FontSize = 12,
            FontWeight = FontWeights.SemiBold,
            FontFamily = new FontFamily("Segoe UI"),
            Cursor = System.Windows.Input.Cursors.Hand,
            OverridesDefaultStyle = true
        };

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
        button.Click += delegate { if (action != null) action(); };
        return button;
    }

    static void SetButton(Button button, string label, bool enabled, string activeColor, string blockedReason)
    {
        button.Content = label;
        button.IsEnabled = enabled;
        button.Background = Brush(enabled ? activeColor : "#FF393B43");
        button.Foreground = Brush(enabled ? "#FFFFFFFF" : "#FF8B8D96");
        button.Cursor = enabled ? System.Windows.Input.Cursors.Hand : System.Windows.Input.Cursors.Arrow;
        button.ToolTip = enabled ? label : blockedReason;
        button.Opacity = 1.0;
    }

    static Brush Brush(string hex)
    {
        return new SolidColorBrush((Color)ColorConverter.ConvertFromString(hex));
    }
}
