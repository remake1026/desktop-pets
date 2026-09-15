using System;
using System.Collections;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Reflection;
using System.Text.RegularExpressions;
using System.Threading.Tasks;

// Read-only Windows media sessions. No audio capture, playback commands, or volume changes.
internal static class MusicListener
{
    private static readonly AudioMusicTracker AudioTracker = new AudioMusicTracker();
    private static readonly Type ManagerType = MediaType("GlobalSystemMediaTransportControlsSessionManager");
    private static readonly Type PropertiesType = MediaType("GlobalSystemMediaTransportControlsSessionMediaProperties");
    private static readonly MethodInfo AsTask = typeof(System.WindowsRuntimeSystemExtensions).GetMethods().First(m =>
        m.Name == "AsTask" && m.IsGenericMethod && m.GetParameters().Length == 1 &&
        m.GetGenericArguments().Length == 1 && m.GetParameters()[0].ParameterType.Name == "IAsyncOperation`1");

    private static Type MediaType(string name)
    {
        // Runtime projection avoids requiring a Windows SDK on the user's computer.
        return Type.GetType("Windows.Media.Control." + name + ", Windows.Media.Control, ContentType=WindowsRuntime", true);
    }

    private static async Task<object> AwaitOperation(object operation, Type resultType)
    {
        var task = (Task)AsTask.MakeGenericMethod(resultType).Invoke(null, new[] { operation });
        if (await Task.WhenAny(task, Task.Delay(3000)) != task) throw new TimeoutException("Media session query timed out.");
        await task;
        return task.GetType().GetProperty("Result").GetValue(task);
    }

    private static object Property(object target, string name)
    {
        return target.GetType().GetProperty(name).GetValue(target);
    }

    private static async Task<string> ReadState(object manager)
    {
        var snapshots = new List<MusicSession>();
        foreach (var session in (IEnumerable)ManagerType.GetMethod("GetSessions").Invoke(manager, null))
        {
            var info = session.GetType().GetMethod("GetPlaybackInfo").Invoke(session, null);
            string status = Convert.ToString(Property(info, "PlaybackStatus"));
            if (status != "Playing" && status != "Paused") continue;
            string source = Convert.ToString(Property(session, "SourceAppUserModelId"));
            string type = "";
            if (MusicClassifier.IsSupportedSource(source))
            {
                var properties = await AwaitOperation(session.GetType().GetMethod("TryGetMediaPropertiesAsync").Invoke(session, null), PropertiesType);
                type = Convert.ToString(Property(properties, "PlaybackType"));
            }
            snapshots.Add(new MusicSession(source, type, status));
        }
        return MusicClassifier.Evaluate(snapshots);
    }

    private static async Task Run(int parentId)
    {
        using (var parent = Process.GetProcessById(parentId))
        {
            var manager = await AwaitOperation(ManagerType.GetMethod("RequestAsync").Invoke(null, null), ManagerType);
            Console.WriteLine("ready");
            string last = null;
            while (!parent.HasExited)
            {
                string state;
                try { state = await ReadCombinedState(manager); }
                catch { state = "unknown"; }
                if (state != last) { Console.WriteLine(state); last = state; }
                await Task.Delay(250);
            }
        }
    }

    private static async Task<string> ReadCombinedState(object manager)
    {
        string media;
        try { media = await ReadState(manager); }
        catch { media = "unknown"; }
        string output;
        try { output = AudioTracker.Evaluate(AudioSessions.Read()); }
        catch { output = "unknown"; }
        if (media == "blocked" || output == "blocked") return "blocked";
        if (media == "playing" || output == "playing") return "playing";
        if (media == "paused" || output == "paused") return "paused";
        return media == "unknown" && output == "unknown" ? "unknown" : "idle";
    }

    private static async Task Probe()
    {
        var manager = await AwaitOperation(ManagerType.GetMethod("RequestAsync").Invoke(null, null), ManagerType);
        Console.WriteLine(await ReadCombinedState(manager));
    }

    private static int Main(string[] args)
    {
        try {
            if (args[0] == "--probe") Probe().GetAwaiter().GetResult();
            else Run(int.Parse(args[0])).GetAwaiter().GetResult();
            return 0;
        }
        catch (Exception error) { Console.Error.WriteLine(error.Message); return 1; }
    }
}

internal sealed class MusicSession
{
    internal readonly string Source, Type, Status;
    internal MusicSession(string source, string type, string status) { Source = source; Type = type; Status = status; }
}

internal static class MusicClassifier
{
    internal static bool IsSupportedSource(string source)
    {
        if (String.IsNullOrEmpty(source)) return false;
        return Regex.IsMatch(source, @"(^|[\\/.!_ -])(qqmusic|cloudmusic|kugou|itunes)(\.exe|$|[.!_ -])", RegexOptions.IgnoreCase)
            || source.StartsWith("AppleInc.AppleMusic", StringComparison.OrdinalIgnoreCase);
    }

    internal static string Evaluate(IEnumerable<MusicSession> sessions)
    {
        bool playing = false, paused = false;
        foreach (var session in sessions)
        {
            bool music = IsSupportedSource(session.Source) && session.Type == "Music";
            // Explicit video and unrelated sources are excluded; missing music metadata uses the audio fallback.
            if (session.Status == "Playing" && (!IsSupportedSource(session.Source) || session.Type == "Video")) return "blocked";
            if (!music) continue;
            playing |= session.Status == "Playing";
            paused |= session.Status == "Paused";
        }
        return playing ? "playing" : paused ? "paused" : "idle";
    }
}
