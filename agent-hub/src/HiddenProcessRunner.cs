// Runs constrained native commands without a shell or visible console window.

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Text;

sealed class HiddenProcessResult
{
    public readonly bool Started;
    public readonly bool TimedOut;
    public readonly int ExitCode;
    public readonly string Output;
    public readonly string Error;

    public HiddenProcessResult(bool started, bool timedOut, int exitCode, string output, string error)
    {
        Started = started;
        TimedOut = timedOut;
        ExitCode = exitCode;
        Output = output ?? "";
        Error = error ?? "";
    }
}

static class HiddenProcessRunner
{
    public static HiddenProcessResult Run(
        string executable,
        string arguments,
        string workingDirectory,
        int timeoutMs,
        IDictionary<string, string> environment)
    {
        var output = new StringBuilder();
        var error = new StringBuilder();
        try
        {
            var psi = new ProcessStartInfo(executable, arguments ?? "");
            psi.WorkingDirectory = workingDirectory;
            psi.UseShellExecute = false;
            psi.CreateNoWindow = true;
            psi.RedirectStandardInput = true;
            psi.RedirectStandardOutput = true;
            psi.RedirectStandardError = true;
            if (environment != null)
            {
                foreach (var entry in environment) psi.EnvironmentVariables[entry.Key] = entry.Value;
            }

            using (var process = new Process())
            {
                process.StartInfo = psi;
                process.OutputDataReceived += delegate(object sender, DataReceivedEventArgs e)
                {
                    if (e.Data != null) output.AppendLine(e.Data);
                };
                process.ErrorDataReceived += delegate(object sender, DataReceivedEventArgs e)
                {
                    if (e.Data != null) error.AppendLine(e.Data);
                };
                if (!process.Start()) return new HiddenProcessResult(false, false, -1, "", "The command did not start.");
                process.StandardInput.Close();
                process.BeginOutputReadLine();
                process.BeginErrorReadLine();
                if (!process.WaitForExit(timeoutMs))
                {
                    try { process.Kill(); process.WaitForExit(2000); } catch { }
                    return new HiddenProcessResult(true, true, -1, output.ToString(), error.ToString());
                }
                process.WaitForExit();
                return new HiddenProcessResult(true, false, process.ExitCode, output.ToString(), error.ToString());
            }
        }
        catch (Exception ex)
        {
            return new HiddenProcessResult(false, false, -1, output.ToString(), ex.Message + Environment.NewLine + error);
        }
    }

    public static string FindExecutableOnPath(string fileName)
    {
        string path = Environment.GetEnvironmentVariable("PATH") ?? "";
        string[] entries = path.Split(new char[] { Path.PathSeparator }, StringSplitOptions.RemoveEmptyEntries);
        foreach (string entry in entries)
        {
            try
            {
                string candidate = Path.Combine(entry.Trim().Trim('"'), fileName);
                if (File.Exists(candidate)) return candidate;
            }
            catch { }
        }
        return null;
    }

    public static string QuoteArgument(string value)
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

    public static string FirstUsefulLine(string first, string second, string fallback)
    {
        foreach (string value in new string[] { first, second })
        {
            if (string.IsNullOrWhiteSpace(value)) continue;
            string[] lines = value.Split(new char[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);
            for (int i = 0; i < lines.Length; i++)
            {
                string line = lines[i].Trim();
                if (!string.IsNullOrEmpty(line)) return line;
            }
        }
        return fallback;
    }
}
