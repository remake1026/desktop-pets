using System;

internal static class MusicClassifierTests
{
    private static void Check(string expected, params MusicSession[] sessions)
    {
        string actual = MusicClassifier.Evaluate(sessions);
        if (actual != expected) throw new Exception("Expected " + expected + ", got " + actual);
    }

    private static int Main()
    {
        foreach (string source in new[] { "QQMusic.exe", "cloudmusic.exe", "KuGou.exe", "AppleInc.AppleMusicWin_nzyj5cx40ttqa!App" })
        {
            Check("playing", new MusicSession(source, "Music", "Playing"));
            Check("paused", new MusicSession(source, "Music", "Paused"));
            Check("blocked", new MusicSession(source, "Video", "Playing"));
            Check("idle", new MusicSession(source, "", "Playing")); // Per-process audio fallback handles missing metadata.
        }
        Check("idle");
        Check("blocked", new MusicSession("chrome.exe", "Music", "Playing"));
        Check("blocked", new MusicSession("msedge.exe", "Video", "Playing"));
        Check("blocked", new MusicSession("QQMusic.exe", "Music", "Playing"), new MusicSession("vlc.exe", "Video", "Playing"));
        Check("playing", new MusicSession("QQMusic.exe", "Music", "Paused"), new MusicSession("cloudmusic.exe", "Music", "Playing"));
        Check("playing", new MusicSession("QQMusic.exe", "Music", "Playing"), new MusicSession("chrome.exe", "Video", "Paused"));
        Check("idle", new MusicSession("QQMusic.exe", "Music", "Stopped"));
        var tracker = new AudioMusicTracker();
        if (tracker.Evaluate(new[] { new AudioOutput("cloudmusic", true, 0.2f) }) != "playing") throw new Exception("CloudMusic audio not detected");
        if (tracker.Evaluate(new[] { new AudioOutput("cloudmusic", true, 0f) }) != "paused") throw new Exception("Silence must pause without a buffer");
        if (tracker.Evaluate(new[] { new AudioOutput("cloudmusic", true, 0f) }) != "paused") throw new Exception("Silent music session must pause");
        if (tracker.Evaluate(new[] { new AudioOutput("cloudmusic", true, 0.2f), new AudioOutput("msedge", true, 0.1f) }) != "blocked") throw new Exception("Browser video must suppress music");
        if (new AudioMusicTracker().Evaluate(new[] { new AudioOutput("vlc", true, 0.4f) }) != "blocked") throw new Exception("Video-only audio must not trigger music");
        foreach (string name in new[] { "qqmusic", "cloudmusic", "kugou", "applemusic" })
            if (new AudioMusicTracker().Evaluate(new[] { new AudioOutput(name, true, 0.1f) }) != "playing") throw new Exception("Player not recognized: " + name);
        Console.WriteLine("PASS: four music players, pause, multiple sessions, video/browser exclusion, unknown types");
        return 0;
    }
}
