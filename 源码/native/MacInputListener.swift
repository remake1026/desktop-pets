import AppKit
import Foundation

// Read-only global input bridge for macOS. It writes the same event names as
// the Windows listener so the Electron and renderer code stay shared.
final class MacInputListener {
    private var commandPressed = false
    private var sPressed = false
    private var zPressed = false
    private var returnKeys = Set<UInt16>()
    private var deleteKeys = Set<UInt16>()
    private var activeEffects = Set<String>()
    private var monitor: Any?

    init() {
        monitor = NSEvent.addGlobalMonitorForEvents(
            matching: [.keyDown, .keyUp, .flagsChanged, .scrollWheel]
        ) { [weak self] event in
            self?.handle(event)
        }
    }

    private func handle(_ event: NSEvent) {
        switch event.type {
        case .flagsChanged:
            commandPressed = event.modifierFlags.contains(.command)
            updateCommandEffects()
        case .keyDown, .keyUp:
            let isDown = event.type == .keyDown
            commandPressed = event.modifierFlags.contains(.command)
            switch event.keyCode {
            case 1: // S
                sPressed = isDown
                updateCommandEffects()
            case 6: // Z
                zPressed = isDown
                updateCommandEffects()
            case 36, 76: // Return and keypad Enter
                if isDown {
                    returnKeys.insert(event.keyCode)
                } else {
                    returnKeys.remove(event.keyCode)
                }
                setEffect("send", active: !returnKeys.isEmpty)
            case 51, 117: // Delete (backspace) and Fn+Delete (forward delete)
                if isDown {
                    deleteKeys.insert(event.keyCode)
                } else {
                    deleteKeys.remove(event.keyCode)
                }
                setEffect("delete", active: !deleteKeys.isEmpty)
            default:
                break
            }
        case .scrollWheel:
            if event.scrollingDeltaY != 0 {
                emit("wheel")
            }
        default:
            break
        }
    }

    private func updateCommandEffects() {
        setEffect("good", active: commandPressed && sPressed)
        setEffect("undo", active: commandPressed && zPressed)
    }

    private func setEffect(_ effect: String, active: Bool) {
        if active {
            if activeEffects.insert(effect).inserted {
                emit("\(effect)-down")
            }
        } else if activeEffects.remove(effect) != nil {
            emit("\(effect)-up")
        }
    }

    private func emit(_ value: String) {
        FileHandle.standardOutput.write(Data("\(value)\n".utf8))
    }
}

_ = NSApplication.shared
let listener = MacInputListener()
RunLoop.main.run()
