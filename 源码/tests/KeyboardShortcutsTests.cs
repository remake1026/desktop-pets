using System;
using System.Collections.Generic;

internal static class KeyboardShortcutsTests
{
    private static int Main()
    {
        var events = new List<string>();
        var keys = new KeyboardShortcuts(events.Add);
        keys.Handle(0x0D, 0); keys.Handle(0x0D, 0); keys.Handle(0x0D, 1);
        keys.Handle(0x0D, 2); keys.Handle(0x0D, 3); // Numpad Enter
        keys.Handle(0x53, 0); keys.Handle(0x53, 1); // Plain S does nothing.
        keys.Handle(0x11, 0); keys.Handle(0x53, 0); keys.Handle(0x53, 0);
        keys.Handle(0x11, 1); keys.Handle(0x53, 1); // Releasing Ctrl finishes chord.
        keys.Handle(0x11, 2); keys.Handle(0x53, 0); keys.Handle(0x53, 1); keys.Handle(0x11, 3);
        keys.Handle(0x41, 0); keys.Handle(0x41, 1); // Other keys are not emitted.
        keys.Handle(0x2E, 2); keys.Handle(0x2E, 2); keys.Handle(0x2E, 3); // Delete and auto-repeat.
        keys.Handle(0x2E, 0); keys.Handle(0x2E, 1); // Numpad Delete (Num Lock off).
        keys.Handle(0x08, 0); keys.Handle(0x08, 0); keys.Handle(0x08, 1); // Backspace and auto-repeat.
        keys.Handle(0x2E, 2); keys.Handle(0x08, 0); keys.Handle(0x2E, 3); keys.Handle(0x08, 1); // Release only after both keys are up.
        var expected = "send-down,send-up,send-down,send-up,good-down,good-up,good-down,good-up,delete-down,delete-up,delete-down,delete-up,delete-down,delete-up,delete-down,delete-up";
        if (String.Join(",", events) != expected) throw new Exception("Shortcut transition mismatch: " + String.Join(",", events));
        Console.WriteLine("PASS: Enter, Ctrl+S, Delete/Backspace, simultaneous holds, repeat suppression, key release");
        return 0;
    }
}
