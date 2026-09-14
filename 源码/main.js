const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage } = require("electron");
const fs = require("fs");
const path = require("path");

const isMac = process.platform === "darwin";
const isWindows = process.platform === "win32";

if (isWindows) {
  app.disableHardwareAcceleration();
}

let petWindow = null;
let tray = null;
let pendingTaskComplete = false;
let nativeDragOffset = null;
let ignoringMouseEvents = null;

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
    if (isMac) {
      if (typeof app.setActivationPolicy === "function") {
        app.setActivationPolicy("accessory");
      } else {
        app.dock?.hide();
      }

      app.setAboutPanelOptions({
        applicationName: "线条小狗",
        applicationVersion: app.getVersion(),
        copyright: "remake1026",
      });

      createMacMenu();
      createTray();
    }

    createPetWindow();

    if (hasTaskCompleteFlag) {
      pendingTaskComplete = true;
    }
  });

  app.on("window-all-closed", () => {
    app.quit();
  });

  app.on("before-quit", () => {
    if (tray) {
      tray.destroy();
      tray = null;
    }
  });
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
  const iconPath = path.join(__dirname, "assets", "tray-icon.png");
  const image = loadNativeImage(iconPath);

  if (image.isEmpty()) {
    return;
  }

  const trayIcon = image.resize({ width: 18, height: 18 });
  trayIcon.setTemplateImage(false);
  tray = new Tray(trayIcon);
  tray.setToolTip("线条小狗");
  rebuildTrayMenu();
  tray.on("click", () => {
    tray.popUpContextMenu();
  });
}

function rebuildTrayMenu() {
  if (!tray) {
    return;
  }

  tray.setContextMenu(Menu.buildFromTemplate(buildMacUtilityMenu(true)));
}

function createMacMenu() {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: app.name,
        submenu: [
          { role: "about", label: "关于线条小狗" },
          { type: "separator" },
          ...buildMacUtilityMenu(false),
          { type: "separator" },
          { role: "quit", label: "退出线条小狗" },
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

function buildMacUtilityMenu(includeQuit) {
  const loginSettings = app.getLoginItemSettings();
  const items = [
    { label: "线条小狗", enabled: false },
    { type: "separator" },
    {
      label: "登录时启动",
      type: "checkbox",
      checked: Boolean(loginSettings.openAtLogin),
      click: (item) => {
        app.setLoginItemSettings({ openAtLogin: item.checked });
        rebuildTrayMenu();
      },
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
