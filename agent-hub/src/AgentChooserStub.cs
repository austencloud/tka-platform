// AgentChooserStub.exe — featherweight signaler the taskbar launches.
// Connects to the resident host's named pipe and hands off project metadata.
// If the host isn't running, cold-starts it with the same args (it shows
// immediately and stays resident for next time). No WPF — starts in ~tens of ms.
//
//   AgentChooserStub.exe -Project "E:\tka-platform" -Name "TKA Platform" -Icon "...\x.ico"
//   (-StampFile <f> optional: latency test; host writes stub-start→paint ms there.)

using System;
using System.Diagnostics;
using System.IO;
using System.IO.Pipes;
using System.Runtime.InteropServices;

class AgentChooserStub
{
    const string PIPE = "AgentChooserPipe";
    [DllImport("user32.dll")] static extern bool AllowSetForegroundWindow(int pid);
    const int ASFW_ANY = -1;

    static void Main(string[] argv)
    {
        var a = ParseArgs(argv);
        Func<string, string> g = delegate(string k) { string v; return a.TryGetValue(k, out v) ? v : ""; };

        // We were launched by the taskbar click, so we briefly hold foreground
        // rights — grant them to the resident host so its popup can take focus.
        try { AllowSetForegroundWindow(ASFW_ANY); } catch { }

        long startTicks = Process.GetCurrentProcess().StartTime.Ticks;
        string line = Line(g, startTicks.ToString());

        try
        {
            using (var c = new NamedPipeClientStream(".", PIPE, PipeDirection.Out))
            {
                c.Connect(350);
                using (var sw = new StreamWriter(c)) { sw.WriteLine(line); sw.Flush(); }
            }
        }
        catch
        {
            // Host not running — cold-start it with our args; it shows now + stays warm.
            try
            {
                string host = Path.Combine(Path.GetDirectoryName(System.Reflection.Assembly.GetExecutingAssembly().Location), "AgentChooserHost.exe");
                var psi = new ProcessStartInfo(host);
                psi.Arguments = A("Project", g("Project")) + A("Name", g("Name")) + A("Icon", g("Icon")) +
                    A("StampFile", g("StampFile")) + A("StubStartTicks", startTicks.ToString()) +
                    A("ServerManager", g("ServerManager")) + A("ServerApp", g("ServerApp")) +
                    A("ServerConfig", g("ServerConfig")) + A("ServerPort", g("ServerPort"));
                psi.UseShellExecute = false;
                Process.Start(psi);
            }
            catch { }
        }
    }

    static string Line(Func<string, string> g, string startTicks)
    {
        return g("Project") + "|" + g("Name") + "|" + g("Icon") + "|" + g("StampFile") + "|" + startTicks + "|" +
            g("ServerManager") + "|" + g("ServerApp") + "|" + g("ServerConfig") + "|" + g("ServerPort");
    }

    static string A(string k, string v) { return string.IsNullOrEmpty(v) ? "" : ("-" + k + " \"" + v + "\" "); }

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
}
