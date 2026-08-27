// Keeps the native card inside the active monitor's usable work area. Taskbar
// clicks land near an edge, so the side with the most useful space wins.

using System;
using System.Windows;

static class PopupPlacement
{
    public static Point Calculate(Rect workArea, Point anchor, Size popup, double gap, double margin)
    {
        double leftEdge = workArea.Left + margin;
        double topEdge = workArea.Top + margin;
        double rightEdge = Math.Max(leftEdge, workArea.Right - margin);
        double bottomEdge = Math.Max(topEdge, workArea.Bottom - margin);
        double width = Math.Min(Math.Max(0, popup.Width), Math.Max(0, rightEdge - leftEdge));
        double height = Math.Min(Math.Max(0, popup.Height), Math.Max(0, bottomEdge - topEdge));

        double left = Clamp(anchor.X - width / 2, leftEdge, rightEdge - width);
        double above = anchor.Y - topEdge;
        double below = bottomEdge - anchor.Y;
        bool preferAbove = anchor.Y >= workArea.Top + workArea.Height / 2;
        double top;

        if (preferAbove && height + gap <= above)
            top = anchor.Y - height - gap;
        else if (!preferAbove && height + gap <= below)
            top = anchor.Y + gap;
        else if (height + gap <= above)
            top = anchor.Y - height - gap;
        else if (height + gap <= below)
            top = anchor.Y + gap;
        else
            top = above >= below ? topEdge : bottomEdge - height;

        return new Point(
            Clamp(left, leftEdge, rightEdge - width),
            Clamp(top, topEdge, bottomEdge - height));
    }

    static double Clamp(double value, double minimum, double maximum)
    {
        if (maximum < minimum) return minimum;
        return Math.Max(minimum, Math.Min(value, maximum));
    }

    public static int SelfTest()
    {
        int failures = 0;
        Rect work = new Rect(0, 0, 1920, 1040);
        Size popup = new Size(560, 700);

        Point bottom = Calculate(work, new Point(960, 1038), popup, 12, 8);
        if (bottom.Y >= 338 || bottom.Y < 8 || bottom.Y + popup.Height > 1032) failures++;

        Point top = Calculate(work, new Point(30, 2), new Size(560, 420), 12, 8);
        if (top.X != 8 || top.Y < 8 || top.Y + 420 > 1032) failures++;

        Point oversized = Calculate(work, new Point(1919, 1039), new Size(3000, 2000), 12, 8);
        if (oversized.X != 8 || oversized.Y != 8) failures++;
        return failures;
    }
}
