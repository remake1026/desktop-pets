const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage, dialog, globalShortcut } = require("electron");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { createInterface } = require("readline");

const isMac = process.platform === "darwin";
const isWindows = process.platform === "win32";
const startupEntryName = "line puppy";

if (isWindows) {
  app.setAppUserModelId("io.github.remake1026.desktop-pets");
}

let petWindow = null;
let tray = null;
let pendingTaskComplete = false;
let nativeDragOffset = null;
let ignoringMouseEvents = null;
let scrollListener = null;
let macInputListener = null;
let musicListener = null;
let musicState = "idle";

const hasTaskCompleteFlag = process.argv.includes("--task-complete");
const lock = app.requestSingleInstanceLock();

if (!lock) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    if (argv.includes("--task-complete")) {
      sendTaskComplete();
    }

    if (petWindow) {
      if (isMac) {
        petWindow.showInactive();
      } else {
        petWindow.show();
        petWindow.focus();
      }
    }
  });

  app.whenReady().then(() => {
    if (isWindows) repairWindowsLoginItem();

    if (isMac) {
      if (typeof app.setActivationPolicy === "function") {
        app.setActivationPolicy("accessory");
      } else {
        app.dock?.hide();
      }

      app.setAboutPanelOptions({
        applicationName: "line puppy",
        applicationVersion: app.getVersion(),
        copyright: "remake1026",
      });

      createMacMenu();
    }

    if (isMac || isWindows) {
      createTray();
    }

    createPetWindow();
    if (isMac && !startMacInputListener()) registerMacSaveShortcut();
    if (isWindows) startGlobalScrollListener();
    if (isWindows) startMusicListener();

    if (hasTaskCompleteFlag) {
      pendingTaskComplete = true;
    }
  });

  app.on("window-all-closed", () => {
    app.quit();
  });

  app.on("before-quit", () => {
    if (isMac) globalShortcut.unregister("Command+S");
    if (musicListener) {
      musicListener.kill();
      musicListener = null;
    }
    if (scrollListener) {
      scrollListener.kill();
      scrollListener = null;
    }
    if (macInputListener) {
      macInputListener.kill();
      macInputListener = null;
    }
    if (tray) {
      tray.destroy();
      tray = null;
    }
  });
}

function registerMacSaveShortcut() {
  globalShortcut.register("Command+S", () => {
    if (!petWindow || petWindow.isDestroyed()) return;
    petWindow.webContents.send("pet:keyboard-effect", { effect: "good", pressed: true });
    petWindow.webContents.send("pet:keyboard-effect", { effect: "good", pressed: false });
  });
}

function startNativeListener(helperPath, label, onLine, onExit, onError, onStart) {
  const child = spawn(helperPath, [String(process.pid)], {
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  onStart?.(child);
  const lines = createInterface({ input: child.stdout });
  lines.on("line", onLine);
  child.stderr.on("data", (data) => console.error(`${label}:`, data.toString()));
  child.on("error", (error) => {
    console.error(`Unable to start ${label.toLowerCase()}:`, error);
    onError?.(error);
  });
  child.on("exit", () => {
    lines.close();
    onExit(child);
  });
  return child;
}

function startGlobalScrollListener() {
  const helperPath = app.isPackaged
    ? path.join(process.resourcesPath, "native", "ScrollListener.exe")
    : path.join(__dirname, "native", "ScrollListener.exe");
  let child;
  child = startNativeListener(helperPath, "Scroll listener", (line) => {
    if (!petWindow || petWindow.isDestroyed()) return;
    if (line === "wheel") {
      petWindow.webContents.send("pet:scroll");
    } else {
      const match = /^(send|good|delete|undo)-(down|up)$/.exec(line);
      if (match) petWindow.webContents.send("pet:keyboard-effect", { effect: match[1], pressed: match[2] === "down" });
    }
  }, () => {
    if (scrollListener === child) scrollListener = null;
  }, undefined, (listener) => {
    child = listener;
    scrollListener = listener;
  });
}

function startMacInputListener() {
  const helperPath = app.isPackaged
    ? path.join(process.resourcesPath, "native", "MacInputListener")
    : path.join(__dirname, "native", "MacInputListener");

  if (!fs.existsSync(helperPath)) {
    console.warn("Mac input listener is not built; using the Command+S fallback.");
    return false;
  }

  let child;
  child = startNativeListener(helperPath, "Mac input listener", (line) => {
    if (!petWindow || petWindow.isDestroyed()) return;
    if (line === "wheel") {
      petWindow.webContents.send("pet:scroll");
      return;
    }
    const match = /^(send|good|delete|undo)-(down|up)$/.exec(line);
    if (match) {
      petWindow.webContents.send("pet:keyboard-effect", { effect: match[1], pressed: match[2] === "down" });
    }
  }, () => {
    if (macInputListener === child) macInputListener = null;
  }, undefined, (listener) => {
    child = listener;
    macInputListener = listener;
  });
  return true;
}

function createPetWindow() {
  const windowOptions = {
    width: 230,
    height: 240,
    x: getInitialX(),
    y: getInitialY(),
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  };

  if (isMac) {
    windowOptions.type = "panel";
    windowOptions.roundedCorners = false;
    windowOptions.acceptFirstMouse = true;
    windowOptions.fullscreenable = false;
    windowOptions.minimizable = false;
    windowOptions.maximizable = false;
    windowOptions.hiddenInMissionControl = true;
    windowOptions.enableLargerThanScreen = true;
  }

  petWindow = new BrowserWindow(windowOptions);

  petWindow.setBackgroundColor("#00000000");
  petWindow.setAlwaysOnTop(true, "screen-saver");

  if (isMac) {
    petWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    petWindow.setWindowButtonVisibility(false);
    petWindow.setIgnoreMouseEvents(true, { forward: true });
    ignoringMouseEvents = true;
  }

  petWindow.loadFile(path.join(__dirname, "index.html"));

  petWindow.webContents.once("did-finish-load", () => {
    petWindow.webContents.send("pet:music-state", musicState);
    if (pendingTaskComplete) {
      pendingTaskComplete = false;
      sendTaskComplete();
    }
  });
}

function getInitialX() {
  const { workArea } = screen.getPrimaryDisplay();
  return workArea.x + workArea.width - 260;
}

function getInitialY() {
  const { workArea } = screen.getPrimaryDisplay();
  return workArea.y + workArea.height - 300;
}

function sendTaskComplete() {
  if (!petWindow || petWindow.isDestroyed()) {
    pendingTaskComplete = true;
    return;
  }

  petWindow.webContents.send("pet:task-complete");
}

function loadNativeImage(filePath) {
  try {
    return nativeImage.createFromBuffer(fs.readFileSync(filePath));
  } catch (_error) {
    return nativeImage.createFromPath(filePath);
  }
}

function createTray() {
  if (isWindows) {
    tray = new Tray(path.join(__dirname, "assets", "tray-icon.ico"));
    tray.setToolTip("line puppy");
    const showMenu = () => {
      // Read the current state each time, including changes made in Task Manager.
      tray.popUpContextMenu(Menu.buildFromTemplate(buildUtilityMenu(true)));
    };
    tray.on("click", showMenu);
    tray.on("right-click", showMenu);
    return;
  }

  const iconPath = path.join(__dirname, "assets", "tray-icon.png");
  const image = loadNativeImage(iconPath);

  if (image.isEmpty()) {
    return;
  }

  const trayIcon = image.resize({ width: 18, height: 18 });
  trayIcon.setTemplateImage(false);
  tray = new Tray(trayIcon);
  tray.setToolTip("line puppy");
  rebuildTrayMenu();
  tray.on("click", () => {
    tray.popUpContextMenu();
  });
}

function rebuildTrayMenu() {
  if (!tray || isWindows) {
    return;
  }

  tray.setContextMenu(Menu.buildFromTemplate(buildUtilityMenu(true)));
}

function createMacMenu() {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: app.name,
        submenu: [
          { role: "about", label: "关于line puppy" },
          { type: "separator" },
          ...buildUtilityMenu(false),
          { type: "separator" },
          { role: "quit", label: "退出line puppy" },
        ],
      },
      {
        label: "编辑",
        submenu: [
          { role: "copy", label: "拷贝" },
          { role: "selectAll", label: "全选" },
        ],
      },
    ]),
  );
}

function getWindowsLoginOptions() {
  return {
    // Electron 42 quotes each component while writing the Windows Run command.
    // Supplying already-quoted strings escapes those quotes into the argument.
    path: process.execPath,
    args: app.isPackaged ? [] : [app.getAppPath()],
  };
}

// getLoginItemSettings re-parses `path` as a command line instead of treating
// it as a plain program path. When the install directory contains spaces
// (e.g. "D:\apps\line puppy"), an unquoted path is truncated at the first
// space and never matches the registry entry, so launchItems comes back
// empty. Quote the program path for read calls only; write calls must stay
// unquoted because FormatCommandLineString adds the quotes itself.
function getWindowsLoginQueryOptions() {
  const options = getWindowsLoginOptions();
  return { ...options, path: `"${options.path}"` };
}

function repairWindowsLoginItem() {
  const options = getWindowsLoginOptions();
  const items = app.getLoginItemSettings(getWindowsLoginQueryOptions()).launchItems;
  // Historical registry identifier only; never used for new entries or UI.
  const legacyName = String.fromCodePoint(0x7ebf, 0x6761, 0x5c0f, 0x72d7);
  const legacyItem = items.find(item => item.name === legacyName && item.scope === "user");
  const item = items.find(item => item.name === startupEntryName && item.scope === "user") || legacyItem;

  if (!item) return;
  if (item.name === startupEntryName && !legacyItem && (
    item.args.length === options.args.length &&
    item.args.every((arg, index) => arg === options.args[index])
  )) {
    return;
  }

  // Preserve the user's enabled/disabled choice while replacing the malformed
  // command written by earlier source builds.
  app.setLoginItemSettings({
    ...options,
    name: startupEntryName,
    openAtLogin: true,
    enabled: item.enabled,
  });
  if (legacyItem) {
    app.setLoginItemSettings({ ...options, name: legacyName, openAtLogin: false, enabled: false });
  }
}

function startMusicListener() {
  const helper = app.isPackaged
    ? path.join(process.resourcesPath, "native", "MusicListener.exe")
    : path.join(__dirname, "native", "MusicListener.exe");
  const publish = (state) => {
    musicState = state;
    if (petWindow && !petWindow.isDestroyed()) petWindow.webContents.send("pet:music-state", state);
  };
  let child;
  child = startNativeListener(helper, "Music listener", (line) => {
    if (["playing", "paused", "idle", "blocked", "unknown"].includes(line)) publish(line);
  }, () => {
    if (musicListener === child) { musicListener = null; publish("unknown"); }
  }, () => publish("unknown"), (listener) => {
    child = listener;
    musicListener = listener;
  });
}

function isStartupEnabled() {
  if (isWindows) {
    const settings = app.getLoginItemSettings(getWindowsLoginQueryOptions());
    return settings.launchItems.some((item) => item.name === startupEntryName && item.enabled);
  }
  return Boolean(app.getLoginItemSettings().openAtLogin);
}

async function clearAppCache() {
  try {
    await petWindow?.webContents.session.clearCache();
    await dialog.showMessageBox({
      type: "info",
      title: "清除缓存",
      message: "桌宠缓存已清除。",
    });
  } catch (error) {
    dialog.showErrorBox("清除缓存失败", error.message);
  }
}

function buildUtilityMenu(includeQuit) {
  const items = [
    { label: "line puppy", enabled: false },
    { type: "separator" },
    {
      label: isWindows ? "开机自启动" : "登录时启动",
      type: "checkbox",
      checked: isStartupEnabled(),
      click: (item) => {
        try {
          app.setLoginItemSettings(isWindows ? {
            ...getWindowsLoginOptions(),
            name: startupEntryName,
            openAtLogin: item.checked,
            enabled: item.checked,
          } : { openAtLogin: item.checked });
          if (isStartupEnabled() !== item.checked) {
            throw new Error("系统未能保存自启动设置。请重新运行新版安装包后再试。");
          }
        } catch (error) {
          dialog.showErrorBox("自启动设置未保存", error.message);
        }
        rebuildTrayMenu();
        if (isMac) createMacMenu();
      },
    },
    { type: "separator" },
    {
      label: "清除缓存",
      click: clearAppCache,
    },
  ];

  if (includeQuit) {
    items.push({ type: "separator" }, { label: "退出", click: () => app.quit() });
  }

  return items;
}

ipcMain.handle("pet-window:start-drag", () => {
  if (!petWindow || petWindow.isDestroyed()) return;

  const cursor = screen.getCursorScreenPoint();
  const [x, y] = petWindow.getPosition();
  nativeDragOffset = { x: cursor.x - x, y: cursor.y - y };
});

ipcMain.handle("pet-window:end-drag", () => {
  nativeDragOffset = null;
});

ipcMain.on("pet-window:set-ignore-mouse-events", (_event, ignore) => {
  if (!isMac || !petWindow || petWindow.isDestroyed()) return;

  const shouldIgnore = Boolean(ignore);

  if (ignoringMouseEvents === shouldIgnore) return;

  ignoringMouseEvents = shouldIgnore;
  petWindow.setIgnoreMouseEvents(shouldIgnore, { forward: true });
});

ipcMain.handle("pet-window:move-to", (_event, point) => {
  if (!petWindow || petWindow.isDestroyed()) return;

  const [width, height] = petWindow.getContentSize();
  let nextX;
  let nextY;

  if (isMac && nativeDragOffset) {
    const cursor = screen.getCursorScreenPoint();
    nextX = Math.round(cursor.x - nativeDragOffset.x);
    nextY = Math.round(cursor.y - nativeDragOffset.y);
  } else {
    nextX = Number.isFinite(point?.x) ? Math.round(point.x) : 0;
    nextY = Number.isFinite(point?.y) ? Math.round(point.y) : 0;
  }

  const petBounds = getPetBoundsInWindow(point?.petBounds, width, height);
  const display = screen.getDisplayNearestPoint({
    x: Math.round(nextX + petBounds.left + petBounds.width / 2),
    y: Math.round(nextY + petBounds.top + petBounds.height / 2),
  });
  const { bounds } = display;

  const x = clampToRange(nextX, bounds.x - petBounds.left, bounds.x + bounds.width - petBounds.right);
  const y = clampToRange(nextY, bounds.y - petBounds.top, bounds.y + bounds.height - petBounds.bottom);

  petWindow.setPosition(x, y, false);
});

ipcMain.handle("pet-window:resize", (_event, size) => {
  if (!petWindow || petWindow.isDestroyed()) return;

  const width = clamp(Math.round(size?.width ?? 230), 120, 520);
  const height = clamp(Math.round(size?.height ?? 240), 120, 560);

  petWindow.setContentSize(width, height, false);
});

ipcMain.handle("pet-window:close", () => {
  if (!petWindow || petWindow.isDestroyed()) return;

  petWindow.close();
});

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function clampToRange(value, min, max) {
  if (min > max) {
    return Math.round((min + max) / 2);
  }

  return clamp(value, min, max);
}

function getPetBoundsInWindow(bounds, windowWidth, windowHeight) {
  const left = Number.isFinite(bounds?.left) ? Math.round(bounds.left) : 0;
  const top = Number.isFinite(bounds?.top) ? Math.round(bounds.top) : 0;
  const width = Number.isFinite(bounds?.width) ? Math.round(bounds.width) : windowWidth;
  const height = Number.isFinite(bounds?.height) ? Math.round(bounds.height) : windowHeight;
  const normalizedWidth = clamp(width, 1, windowWidth);
  const normalizedHeight = clamp(height, 1, windowHeight);
  const normalizedLeft = clamp(left, 0, windowWidth - normalizedWidth);
  const normalizedTop = clamp(top, 0, windowHeight - normalizedHeight);

  return {
    left: normalizedLeft,
    top: normalizedTop,
    right: normalizedLeft + normalizedWidth,
    bottom: normalizedTop + normalizedHeight,
    width: normalizedWidth,
    height: normalizedHeight,
  };
}
