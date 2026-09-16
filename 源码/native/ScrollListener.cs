using System;
using System.ComponentModel;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Windows.Forms;

// A message-only window receives input even while other apps are focused.
// No hooks, input suppression, or visible helper window. Only named actions are emitted.
internal sealed class ScrollListener : NativeWindow, IDisposable
{
    [StructLayout(LayoutKind.Sequential)]
    private struct RawInputDevice
    {
        public ushort UsagePage, Usage;
        public uint Flags;
        public IntPtr Target;
    }

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool RegisterRawInputDevices(RawInputDevice[] devices, uint count, uint size);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern uint GetRawInputData(IntPtr input, uint command, IntPtr data, ref uint size, uint headerSize);

    private readonly IntPtr buffer = Marshal.AllocHGlobal(256);
    private readonly Process parent;
    private readonly Timer timer;
    private bool wheelPending;
    private readonly KeyboardShortcuts shortcuts;
    private int parentCheckTicks;

    private ScrollListener(int parentId)
    {
        parent = Process.GetProcessById(parentId);
        CreateHandle(new CreateParams { Caption = "LineDogScrollListener", Parent = new IntPtr(-3) });
        shortcuts = new KeyboardShortcuts(action => {
            try { Console.WriteLine(action); }
            catch (System.IO.IOException) { Application.ExitThread(); }
        });
        var devices = new[] {
            new RawInputDevice { UsagePage = 1, Usage = 2, Flags = 0x100, Target = Handle },
            new RawInputDevice { UsagePage = 1, Usage = 6, Flags = 0x100, Target = Handle }
        };
        if (!RegisterRawInputDevices(devices, (uint)devices.Length, (uint)Marshal.SizeOf(typeof(RawInputDevice))))
            throw new Win32Exception(Marshal.GetLastWin32Error());

        timer = new Timer { Interval = 30 };
        timer.Tick += delegate
        {
            if (++parentCheckTicks >= 33)
            {
                parentCheckTicks = 0;
                if (parent.HasExited) { Application.ExitThread(); return; }
            }
            if (wheelPending)
            {
                wheelPending = false;
                try { Console.WriteLine("wheel"); }
                catch (System.IO.IOException) { Application.ExitThread(); }
            }
        };
        timer.Start();
        Console.WriteLine("ready");
    }

    protected override void WndProc(ref Message message)
    {
        if (message.Msg == 0xFF) // WM_INPUT
        {
            uint size = 256;
            uint headerSize = (uint)(8 + 2 * IntPtr.Size);
            uint read = GetRawInputData(message.LParam, 0x10000003, buffer, ref size, headerSize);
            if (read != uint.MaxValue && read >= headerSize + 24 && Marshal.ReadInt32(buffer) == 0)
            {
                // RAWMOUSE's button union starts at offset 4; both wheel directions use 0x400.
                ushort flags = (ushort)Marshal.ReadInt16(buffer, (int)headerSize + 4);
                short delta = Marshal.ReadInt16(buffer, (int)headerSize + 6);
                if ((flags & 0x400) != 0 && delta != 0) wheelPending = true;
            }
            else if (read != uint.MaxValue && read >= headerSize + 16 && Marshal.ReadInt32(buffer) == 1)
            {
                ushort flags = (ushort)Marshal.ReadInt16(buffer, (int)headerSize + 2);
                ushort key = (ushort)Marshal.ReadInt16(buffer, (int)headerSize + 6);
                shortcuts.Handle(key, flags);
            }
        }
        base.WndProc(ref message);
    }

    public void Dispose()
    {
        timer.Dispose();
        DestroyHandle();
        Marshal.FreeHGlobal(buffer);
        parent.Dispose();
    }

    [STAThread]
    private static int Main(string[] args)
    {
        try
        {
            using (var listener = new ScrollListener(int.Parse(args[0]))) Application.Run();
            return 0;
        }
        catch (Exception error)
        {
            Console.Error.WriteLine(error.Message);
            return 1;
        }
    }
}

internal sealed class KeyboardShortcuts
{
    private readonly Action<string> emit;
    private bool leftControl, rightControl, letterS, letterZ, enter, numpadEnter, deleteKey, numpadDelete, backspace;
    private bool sending, saving, deleting, undoing;

    internal KeyboardShortcuts(Action<string> emitAction) { emit = emitAction; }

    internal void Handle(ushort key, ushort flags)
    {
        bool down = (flags & 1) == 0; // RI_KEY_BREAK
        bool extended = (flags & 2) != 0; // RI_KEY_E0
        switch (key)
        {
            case 0x11: if (extended) rightControl = down; else leftControl = down; break;
            case 0xA2: leftControl = down; break;
            case 0xA3: rightControl = down; break;
            case 0x53: letterS = down; break;
            case 0x5A: letterZ = down; break;
            case 0x0D: if (extended) numpadEnter = down; else enter = down; break;
            case 0x2E: if (extended) deleteKey = down; else numpadDelete = down; break;
            case 0x08: backspace = down; break;
            default: return;
        }
        bool nextSending = enter || numpadEnter;
        bool nextSaving = letterS && (leftControl || rightControl);
        bool nextDeleting = deleteKey || numpadDelete || backspace;
        bool nextUndoing = letterZ && (leftControl || rightControl);
        if (nextSending != sending) { sending = nextSending; emit(sending ? "send-down" : "send-up"); }
        if (nextSaving != saving) { saving = nextSaving; emit(saving ? "good-down" : "good-up"); }
        if (nextDeleting != deleting) { deleting = nextDeleting; emit(deleting ? "delete-down" : "delete-up"); }
        if (nextUndoing != undoing) { undoing = nextUndoing; emit(undoing ? "undo-down" : "undo-up"); }
    }
}
