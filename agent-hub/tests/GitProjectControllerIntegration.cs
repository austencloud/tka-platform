using System;
using System.IO;

static class GitProjectControllerIntegration
{
    static string _git;

    public static int Main(string[] args)
    {
        if (args.Length == 2 && args[0] == "--cleanup")
        {
            try { DeleteValidatedTempRoot(args[1]); return 0; }
            catch (Exception ex) { Console.Error.WriteLine("FAIL: " + ex.Message); return 1; }
        }

        string root = Path.Combine(Path.GetTempPath(), "agent-hub-git-integration-" + Guid.NewGuid().ToString("N"));
        try
        {
            _git = HiddenProcessRunner.FindExecutableOnPath("git.exe");
            if (string.IsNullOrEmpty(_git)) throw new InvalidOperationException("Git was not found on PATH.");
            Directory.CreateDirectory(root);

            string remote = Path.Combine(root, "remote.git");
            string seed = Path.Combine(root, "seed");
            string hub = Path.Combine(root, "hub");
            string peer = Path.Combine(root, "peer");

            Git(root, "init --bare --initial-branch=main " + Q(remote));
            Directory.CreateDirectory(seed);
            Git(seed, "init --initial-branch=main");
            ConfigureIdentity(seed);
            File.WriteAllText(Path.Combine(seed, "seed.txt"), "seed\r\n");
            Git(seed, "add seed.txt");
            Git(seed, "commit -m seed");
            Git(seed, "remote add origin " + Q(remote));
            Git(seed, "push -u origin main");

            Git(root, "clone " + Q(remote) + " " + Q(hub));
            Git(root, "clone " + Q(remote) + " " + Q(peer));
            ConfigureIdentity(hub);
            ConfigureIdentity(peer);

            var controller = new GitProjectController(hub);
            GitProjectStatus initial = controller.GetStatus();
            Assert(initial.State == GitProjectState.Ready, "initial state is Ready");
            Assert(initial.Branch == "main" && initial.Upstream == "origin/main", "branch and upstream parsed");
            Assert(initial.CanPull && !initial.CanPush, "initial capabilities are safe");

            File.WriteAllText(Path.Combine(peer, "from-peer.txt"), "peer\r\n");
            Git(peer, "add from-peer.txt");
            Git(peer, "commit -m peer-change");
            Git(peer, "push");

            GitProjectCommandResult pull = controller.Pull();
            Assert(pull.Succeeded, "clean pull succeeds");
            Assert(File.Exists(Path.Combine(hub, "from-peer.txt")), "pull fast-forwards the file");

            File.WriteAllText(Path.Combine(hub, "from-hub.txt"), "hub\r\n");
            Git(hub, "add from-hub.txt");
            Git(hub, "commit -m hub-change");
            GitProjectStatus ahead = controller.GetStatus();
            Assert(ahead.Ahead == 1 && ahead.CanPush, "ahead commit enables push");
            GitProjectCommandResult push = controller.Push();
            Assert(push.Succeeded, "upstream push succeeds");
            Git(peer, "pull --ff-only");
            Assert(File.Exists(Path.Combine(peer, "from-hub.txt")), "push reaches the remote");

            File.WriteAllText(Path.Combine(peer, "remote-second.txt"), "remote second\r\n");
            Git(peer, "add remote-second.txt");
            Git(peer, "commit -m remote-second");
            Git(peer, "push");
            File.WriteAllText(Path.Combine(hub, "dirty.txt"), "dirty\r\n");
            GitProjectCommandResult dirtyPull = controller.Pull();
            Assert(!dirtyPull.Succeeded, "dirty pull is blocked");
            Assert(!File.Exists(Path.Combine(hub, "remote-second.txt")), "blocked pull does not update files");

            Git(hub, "fetch --quiet");
            GitProjectStatus behind = controller.GetStatus();
            Assert(behind.IsDirty && behind.Behind == 1 && !behind.CanPull, "dirty and behind state is reported");
            Git(hub, "add dirty.txt");
            Git(hub, "commit -m local-divergence");
            GitProjectStatus diverged = controller.GetStatus();
            Assert(diverged.Ahead == 1 && diverged.Behind == 1 && !diverged.CanPush, "divergence blocks push");
            string remoteBefore = Git(remote, "rev-parse refs/heads/main").Output.Trim();
            GitProjectCommandResult divergedPush = controller.Push();
            string remoteAfter = Git(remote, "rev-parse refs/heads/main").Output.Trim();
            Assert(!divergedPush.Succeeded && remoteBefore == remoteAfter, "blocked push leaves remote unchanged");

            Console.WriteLine("PASS: pull fast-forwarded, push reached the remote, dirty pull was blocked, and divergent push left the remote unchanged.");
            return 0;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine("FAIL: " + ex.Message);
            return 1;
        }
        finally
        {
            try { DeleteValidatedTempRoot(root); }
            catch { }
        }
    }

    static void ConfigureIdentity(string directory)
    {
        Git(directory, "config user.name AgentHubTest");
        Git(directory, "config user.email agent-hub-test@example.invalid");
    }

    static HiddenProcessResult Git(string directory, string arguments)
    {
        HiddenProcessResult result = HiddenProcessRunner.Run(_git, arguments, directory, 30000, null);
        if (!result.Started || result.TimedOut || result.ExitCode != 0)
            throw new InvalidOperationException(arguments + ": " +
                HiddenProcessRunner.FirstUsefulLine(result.Error, result.Output, "Git command failed."));
        return result;
    }

    static string Q(string value)
    {
        return HiddenProcessRunner.QuoteArgument(value);
    }

    static void Assert(bool condition, string message)
    {
        if (!condition) throw new InvalidOperationException(message);
    }

    static void DeleteValidatedTempRoot(string root)
    {
        string full = Path.GetFullPath(root).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        string temp = Path.GetFullPath(Path.GetTempPath()).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar) + Path.DirectorySeparatorChar;
        if (!full.StartsWith(temp, StringComparison.OrdinalIgnoreCase) ||
            !Path.GetFileName(full).StartsWith("agent-hub-git-integration-", StringComparison.Ordinal))
            throw new InvalidOperationException("Refusing to clean an unexpected path: " + full);
        if (!Directory.Exists(full)) return;

        foreach (string file in Directory.GetFiles(full, "*", SearchOption.AllDirectories))
            File.SetAttributes(file, FileAttributes.Normal);
        Directory.Delete(full, true);
    }
}
