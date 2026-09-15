using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;

// Read per-process output meters only. Audio samples are neither captured nor stored.
internal static class AudioSessions
{
    internal static List<AudioOutput> Read()
    {
        var outputs = new List<AudioOutput>();
        IMMDeviceEnumerator enumerator = (IMMDeviceEnumerator)new MMDeviceEnumerator();
        IMMDeviceCollection devices = null;
        try
        {
            Marshal.ThrowExceptionForHR(enumerator.EnumAudioEndpoints(0, 1, out devices));
            uint count; Marshal.ThrowExceptionForHR(devices.GetCount(out count));
            for (uint i = 0; i < count; i++)
            {
                IMMDevice device = null; object managerObject = null; IAudioSessionEnumerator sessions = null;
                try
                {
                    Marshal.ThrowExceptionForHR(devices.Item(i, out device));
                    Guid iid = typeof(IAudioSessionManager2).GUID;
                    Marshal.ThrowExceptionForHR(device.Activate(ref iid, 23, IntPtr.Zero, out managerObject));
                    Marshal.ThrowExceptionForHR(((IAudioSessionManager2)managerObject).GetSessionEnumerator(out sessions));
                    int sessionCount; Marshal.ThrowExceptionForHR(sessions.GetCount(out sessionCount));
                    for (int j = 0; j < sessionCount; j++)
                    {
                        object sessionObject = null;
                        try
                        {
                            Marshal.ThrowExceptionForHR(sessions.GetSession(j, out sessionObject));
                            var control = (IAudioSessionControl2)sessionObject;
                            uint pid; int state; float peak;
                            Marshal.ThrowExceptionForHR(control.GetProcessId(out pid));
                            if (pid == 0) continue;
                            Marshal.ThrowExceptionForHR(control.GetState(out state));
                            Marshal.ThrowExceptionForHR(((IAudioMeterInformation)sessionObject).GetPeakValue(out peak));
                            using (var process = Process.GetProcessById((int)pid))
                                outputs.Add(new AudioOutput(process.ProcessName, state == 1, peak));
                        }
                        catch (ArgumentException) { } // Process ended during enumeration.
                        catch (COMException) { } // Session/device disappeared.
                        finally { Release(sessionObject); }
                    }
                }
                catch (COMException) { } // Device was unplugged during enumeration.
                finally { Release(sessions); Release(managerObject); Release(device); }
            }
        }
        finally { Release(devices); Release(enumerator); }
        return outputs;
    }

    private static void Release(object obj)
    {
        if (obj != null && Marshal.IsComObject(obj)) Marshal.ReleaseComObject(obj);
    }
}

internal sealed class AudioOutput
{
    internal readonly string ProcessName;
    internal readonly bool Active;
    internal readonly float Peak;
    internal AudioOutput(string name, bool active, float peak) { ProcessName = name; Active = active; Peak = peak; }
}

internal sealed class AudioMusicTracker
{
    private bool heardMusic;
    internal string Evaluate(IEnumerable<AudioOutput> outputs)
    {
        bool hasMusicSession = false, audibleMusic = false;
        foreach (var output in outputs)
        {
            bool audible = output.Active && output.Peak > 0.00001f;
            string name = output.ProcessName.ToLowerInvariant();
            bool music = MusicClassifier.IsSupportedSource(name) || name == "applemusic";
            if (music) { hasMusicSession = true; audibleMusic |= audible; }
            else if (audible && (name == "chrome" || name == "msedge" || name == "firefox" ||
                     name == "vlc" || name == "potplayer" || name == "potplayermini" || name == "potplayermini64" ||
                     name == "wmplayer" || name == "mpv" || name == "mpc-hc" || name == "mpc-hc64"))
                return "blocked";
        }
        if (audibleMusic) { heardMusic = true; return "playing"; }
        return heardMusic && hasMusicSession ? "paused" : "idle";
    }
}

[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] internal class MMDeviceEnumerator { }
[ComImport, Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
internal interface IMMDeviceEnumerator {
    [PreserveSig] int EnumAudioEndpoints(int flow, uint mask, out IMMDeviceCollection devices);
}
[ComImport, Guid("0BD7A1BE-7A1A-44DB-8397-CC5392387B5E"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
internal interface IMMDeviceCollection {
    [PreserveSig] int GetCount(out uint count);
    [PreserveSig] int Item(uint index, out IMMDevice device);
}
[ComImport, Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
internal interface IMMDevice {
    [PreserveSig] int Activate(ref Guid iid, uint context, IntPtr parameters, [MarshalAs(UnmanagedType.IUnknown)] out object result);
}
[ComImport, Guid("77AA99A0-1BD6-484F-8BC7-2C654C9A9B6F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
internal interface IAudioSessionManager2 {
    [PreserveSig] int GetAudioSessionControl(IntPtr guid, uint flags, out IntPtr control);
    [PreserveSig] int GetSimpleAudioVolume(IntPtr guid, uint flags, out IntPtr volume);
    [PreserveSig] int GetSessionEnumerator(out IAudioSessionEnumerator sessions);
}
[ComImport, Guid("E2F5BB11-0570-40CA-ACDD-3AA01277DEE8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
internal interface IAudioSessionEnumerator {
    [PreserveSig] int GetCount(out int count);
    [PreserveSig] int GetSession(int index, [MarshalAs(UnmanagedType.IUnknown)] out object session);
}
[ComImport, Guid("BFB7FF88-7239-4FC9-8FA2-07C950BE9C6D"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
internal interface IAudioSessionControl2 {
    [PreserveSig] int GetState(out int state);
    [PreserveSig] int GetDisplayName([MarshalAs(UnmanagedType.LPWStr)] out string name);
    [PreserveSig] int SetDisplayName([MarshalAs(UnmanagedType.LPWStr)] string name, ref Guid context);
    [PreserveSig] int GetIconPath([MarshalAs(UnmanagedType.LPWStr)] out string path);
    [PreserveSig] int SetIconPath([MarshalAs(UnmanagedType.LPWStr)] string path, ref Guid context);
    [PreserveSig] int GetGroupingParam(out Guid grouping);
    [PreserveSig] int SetGroupingParam(ref Guid grouping, ref Guid context);
    [PreserveSig] int RegisterAudioSessionNotification(IntPtr notification);
    [PreserveSig] int UnregisterAudioSessionNotification(IntPtr notification);
    [PreserveSig] int GetSessionIdentifier([MarshalAs(UnmanagedType.LPWStr)] out string id);
    [PreserveSig] int GetSessionInstanceIdentifier([MarshalAs(UnmanagedType.LPWStr)] out string id);
    [PreserveSig] int GetProcessId(out uint pid);
}
[ComImport, Guid("C02216F6-8C67-4B5B-9D00-D008E73E0064"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
internal interface IAudioMeterInformation {
    [PreserveSig] int GetPeakValue(out float peak);
}
