const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage, dialog, globalShortcut, protocol } = require("electron");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

// Register the gif:// scheme so user-imported GIFs can be loaded as image sources
protocol.registerSchemesAsPrivileged([
  { scheme: "gif", privileges: { secure: true, supportFetchAPI: false, bypassCSP: true, stream: false } },
]);
const { spawn } = require("child_process");
const { createInterface } = require("readline");

const isMac = process.platform === "darwin";
const isWindows = process.platform === "win32";
const startupEntryName = "line puppy";

if (isWindows) {
  app.setAppUserModelId("io.github.remake1026.desktop-pets");
}

let petWindow = null;
let settingsWindow = null;
let tray = null;
let pendingTaskComplete = false;
let nativeDragOffset = null;
let ignoringMouseEvents = null;
let scrollListener = null;
let macInputListener = null;
let musicListener = null;
let musicState = "idle";

// desktop-lock state
let desktopLocked = false;

// --- Settings JSON helpers ---
function getSettingsPath() {
  return path.join(app.getPath("userData"), "settings.json");
}

function loadSettings() {
  try {
    const raw = fs.readFileSync(getSettingsPath(), "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveSettings(data) {
  try {
    const current = loadSettings();
    fs.writeFileSync(getSettingsPath(), JSON.stringify({ ...current, ...data }, null, 2), "utf8");
  } catch (err) {
    console.error("Failed to save settings:", err);
  }
}

// Restore desktop-lock state on startup
function loadDesktopLock() {
  return loadSettings().desktopLocked === true;
}

function applyDesktopLock(lock) {
  desktopLocked = lock;
  saveSettings({ desktopLocked: lock });
  if (petWindow && !petWindow.isDestroyed()) {
    if (isMac) {
      // macOS: toggle setIgnoreMouseEvents
      const shouldIgnore = lock;
      if (ignoringMouseEvents !== shouldIgnore) {
        ignoringMouseEvents = shouldIgnore;
        petWindow.setIgnoreMouseEvents(shouldIgnore, { forward: true });
      }
    } else {
      // Windows: use forward:true so mouse moves still pass through
      petWindow.setIgnoreMouseEvents(lock, { forward: true });
    }
    petWindow.webContents.send("pet:desktop-lock", lock);
  }
}

if (!app.requestSingleInstanceLock()) {
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
    // Custom protocol to serve user-imported GIFs from userData (writable, survives reinstall)
    protocol.registerFileProtocol("gif", (request, callback) => {
      let name = request.url.replace(/^gif:\/\/?/, "");
      try { name = decodeURIComponent(name); } catch { /* keep raw if malformed */ }
      callback(path.join(app.getPath("userData"), "user-gifs", name));
    });

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

    // Restore desktop-lock state
    if (loadDesktopLock()) {
      // Defer so pet window is ready
      setTimeout(() => applyDesktopLock(true), 500);
    }

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
    if (musicListener) { musicListener.kill(); musicListener = null; }
    if (scrollListener) { scrollListener.kill(); scrollListener = null; }
    if (macInputListener) { macInputListener.kill(); macInputListener = null; }
    if (tray) { tray.destroy(); tray = null; }
  });
}

// --- Default schedule config (used when settings.json has no schedule) ---
const DEFAULT_SCHEDULE_WINDOWS = [
  // scheduled (exact-time, non-interruptible)
  { id: "_520_1",   type: "scheduled", start: "05:20", effects: ["love520"] },
  { id: "_520_2",   type: "scheduled", start: "17:20", effects: ["love520"] },
  { id: "_521_1",   type: "scheduled", start: "05:21", effects: ["love521"] },
  { id: "_521_2",   type: "scheduled", start: "17:21", effects: ["love521"] },
  // timed (time-window, interruptible)
  { id: "_morning_reading",  type: "timed", start: "10:30", end: "10:40", effects: ["morningReading"], interruptible: true },
  { id: "_morning_drink",    type: "timed", start: "10:40", end: "10:50", effects: ["morningDrink"],   interruptible: true },
  { id: "_afterwork",        type: "timed", start: "18:00", end: "19:00", effects: ["afterWork"],      interruptible: true },
  // night / mealtime (always present, controlled by `enabled` flag)
  { id: "_night_sleep",  type: "timed", start: "23:00", end: "24:00", effects: ["sleep"],    interruptible: true },
  { id: "_night_sleep2", type: "timed", start: "00:00", end: "02:00", effects: ["sleep2"],   interruptible: true },
  { id: "_meal_1",      type: "timed", start: "09:30", end: "10:10", effects: ["mealtime"], interruptible: true },
  { id: "_meal_2",      type: "timed", start: "12:00", end: "13:00", effects: ["mealtime"], interruptible: true },
  { id: "_meal_3",      type: "timed", start: "20:00", end: "21:00", effects: ["mealtime"], interruptible: true },
];

const SYSTEM_ENTRIES = DEFAULT_SCHEDULE_WINDOWS.filter(e =>
  ["_night_sleep", "_night_sleep2", "_meal_1", "_meal_2", "_meal_3"].includes(e.id)
);

// Normalize a schedule entry so it always uses `effects: []` (backward-compat with old `effect` field)
function normalizeEffects(entry) {
  if (!Array.isArray(entry.effects)) {
    entry.effects = entry.effect ? [entry.effect] : [];
  }
  delete entry.effect;
  return entry;
}

function loadSchedule() {
  const settings = loadSettings();
  const saved = settings.animationSchedule;
  if (!saved) return {
    windows: DEFAULT_SCHEDULE_WINDOWS.map(normalizeEffects),
    system: SYSTEM_ENTRIES.map(normalizeEffects),
  };

  const windows = (saved.windows || DEFAULT_SCHEDULE_WINDOWS).map(normalizeEffects);
  // Merge system entries, preserving enabled flags from saved
  const systemMap = {};
  for (const s of SYSTEM_ENTRIES) {
    const savedSys = (saved.system || []).find(e => e.id === s.id);
    systemMap[s.id] = normalizeEffects({
      ...s,
      ...(savedSys
        ? {
            enabled: savedSys.enabled !== false,
            ...(savedSys.start ? { start: savedSys.start } : {}),
            ...(savedSys.end ? { end: savedSys.end } : {}),
            ...(savedSys.type ? { type: savedSys.type } : {}),
            ...(Array.isArray(savedSys.effects) ? { effects: savedSys.effects } : {}),
          }
        : { enabled: true }),
    });
  }
  const system = Object.values(systemMap);
  return { windows, system };
}

// Custom (user-imported) GIF helpers
const USER_GIFS_DIR = () => path.join(app.getPath("userData"), "user-gifs");

// Returns stored descriptors { value, label, file } where file is the bare filename
function getCustomGifs() {
  return loadSettings().customAssets || [];
}

// Returns descriptors with a resolvable gif:// URL for the renderer
function loadCustomGifsForRenderer() {
  return getCustomGifs().map(a => ({
    value: a.value,
    label: a.label,
    // Percent-encode so non-ASCII filenames (e.g. Chinese) survive URL parsing.
    // A raw `gif://中文.gif` is not percent-encoded by Chromium and never reaches the handler.
    file: `gif://${encodeURIComponent(a.file)}`,
  }));
}

function saveSchedule(data) {
  const settings = loadSettings();
  settings.animationSchedule = {
    windows: data.windows || [],
    system: data.system || SYSTEM_ENTRIES,
  };
  fs.writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2), "utf8");
}

// --- Schedule window ---
function createSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return;
  }
  settingsWindow = new BrowserWindow({
    width: 820,
    height: 880,
    resizable: true,
    minimizable: true,
    maximizable: false,
    title: "动画日程",
    backgroundColor: "#1e1e2e",
    webPreferences: {
      preload: path.join(__dirname, "preload-settings.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  settingsWindow.setMenu(null);
  settingsWindow.loadFile(path.join(__dirname, "settings-window.html"));
  settingsWindow.on("closed", () => { settingsWindow = null; });
}

// --- IPC: settings window ↔ main process ---
ipcMain.handle("settings:load-schedule", () => loadSchedule());
ipcMain.handle("settings:save-schedule", (_event, data) => {
  try {
    saveSchedule(data);
    // Notify pet window of schedule change AND updated custom GIFs list
    if (petWindow && !petWindow.isDestroyed()) {
      petWindow.webContents.send("pet:schedule-changed", loadSchedule());
      petWindow.webContents.send("pet:custom-gifs", loadCustomGifsForRenderer());
    }
    return { ok: true };
  } catch (err) {
    console.error("Failed to save schedule:", err);
    return { ok: false, error: err.message };
  }
});
ipcMain.handle("settings:get-custom-gifs", () => getCustomGifs());
ipcMain.handle("settings:import-gif", async () => {
  const result = await dialog.showOpenDialog(settingsWindow || petWindow, {
    title: "选择 GIF 动画",
    properties: ["openFile"],
    filters: [{ name: "GIF 动画", extensions: ["gif"] }],
  });
  if (result.canceled || !result.filePaths || result.filePaths.length === 0) return { ok: false };
  const src = result.filePaths[0];
  const dir = USER_GIFS_DIR();
  try { fs.mkdirSync(dir, { recursive: true }); } catch { /* ignore */ }
  const safe = path.basename(src).replace(/[^\w.\u4e00-\u9fff-]/g, "_");
  let destName = safe,
    counter = 1;
  while (fs.existsSync(path.join(dir, destName))) {
    const ext = path.extname(safe);
    const stem = safe.slice(0, safe.length - ext.length);
    destName = `${stem}_${counter}${ext}`;
    counter++;
  }
  fs.copyFileSync(src, path.join(dir, destName));
  const value = `user/${destName}`;
  const settings = loadSettings();
  const customAssets = settings.customAssets || [];
  let asset = customAssets.find(a => a.value === value);
  if (!asset) {
    asset = { value, label: path.parse(destName).name, file: destName };
    customAssets.push(asset);
    saveSettings({ customAssets });
  }
  // Notify pet window so it registers the new GIF into the animations map
  if (petWindow && !petWindow.isDestroyed()) {
    petWindow.webContents.send("pet:custom-gifs", loadCustomGifsForRenderer());
  }
  return { ok: true, asset: { value: asset.value, label: asset.label, file: asset.file } };
});
ipcMain.handle("settings:delete-gif", (_event, value) => {
  const settings = loadSettings();
  const customAssets = (settings.customAssets || []).filter(a => a.value !== value);
  saveSettings({ customAssets });
  const name = value.startsWith("user/") ? value.slice(5) : value;
  const filePath = path.join(USER_GIFS_DIR(), name);
  if (fs.existsSync(filePath)) { try { fs.unlinkSync(filePath); } catch { /* ignore */ } }
  // Notify pet window of updated custom GIFs list after deletion
  if (petWindow && !petWindow.isDestroyed()) {
    petWindow.webContents.send("pet:custom-gifs", loadCustomGifsForRenderer());
  }
  return { ok: true };
});

// --- Config export / import (backup & restore across reinstalls) ---
const CONFIG_BACKUP_PREFIX = "line-puppy-config-";

async function exportConfigImpl() {
  const parent = settingsWindow && !settingsWindow.isDestroyed() ? settingsWindow : petWindow;
  const result = await dialog.showOpenDialog(parent, {
    title: "选择配置导出位置",
    properties: ["openDirectory"],
  });
  if (result.canceled || !result.filePaths || !result.filePaths.length) return { ok: false, canceled: true };
  const destDir = result.filePaths[0];
  const stamp = new Date().toISOString().slice(0, 10);
  const backupDir = path.join(destDir, CONFIG_BACKUP_PREFIX + stamp);
  try {
    fs.mkdirSync(backupDir, { recursive: true });
    const settingsPath = getSettingsPath();
    if (fs.existsSync(settingsPath)) {
      fs.copyFileSync(settingsPath, path.join(backupDir, "settings.json"));
    }
    const gifsDir = USER_GIFS_DIR();
    if (fs.existsSync(gifsDir)) {
      const target = path.join(backupDir, "user-gifs");
      fs.mkdirSync(target, { recursive: true });
      for (const f of fs.readdirSync(gifsDir)) {
        const full = path.join(gifsDir, f);
        if (fs.statSync(full).isFile()) fs.copyFileSync(full, path.join(target, f));
      }
    }
    return { ok: true, path: backupDir };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function importConfigImpl() {
  const parent = settingsWindow && !settingsWindow.isDestroyed() ? settingsWindow : petWindow;
  const result = await dialog.showOpenDialog(parent, {
    title: "选择配置文件夹（需含 settings.json）",
    properties: ["openDirectory"],
  });
  if (result.canceled || !result.filePaths || !result.filePaths.length) return { ok: false, canceled: true };
  const srcDir = result.filePaths[0];
  const settingsFile = path.join(srcDir, "settings.json");
  if (!fs.existsSync(settingsFile)) {
    return { ok: false, error: "该文件夹不含 settings.json，不是有效的配置备份。" };
  }
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(settingsFile, "utf8"));
  } catch {
    return { ok: false, error: "settings.json 无法解析，文件可能已损坏。" };
  }
  if (!parsed || typeof parsed !== "object") {
    return { ok: false, error: "settings.json 内容无效。" };
  }
  try {
    fs.copyFileSync(settingsFile, getSettingsPath());
    const srcGifs = path.join(srcDir, "user-gifs");
    if (fs.existsSync(srcGifs)) {
      const dest = USER_GIFS_DIR();
      fs.mkdirSync(dest, { recursive: true });
      for (const f of fs.readdirSync(srcGifs)) {
        const full = path.join(srcGifs, f);
        if (fs.statSync(full).isFile()) fs.copyFileSync(full, path.join(dest, f));
      }
    }
    if (petWindow && !petWindow.isDestroyed()) {
      petWindow.webContents.send("pet:schedule-changed", loadSchedule());
      petWindow.webContents.send("pet:custom-gifs", loadCustomGifsForRenderer());
    }
    return { ok: true, path: srcDir };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

ipcMain.handle("settings:export-config", () => exportConfigImpl());
ipcMain.handle("settings:import-config", () => importConfigImpl());

// --- IPC: desktop-lock ---
ipcMain.handle("desktop-lock:get", () => desktopLocked);
ipcMain.on("desktop-lock:set", (_event, lock) => applyDesktopLock(lock));

// --- Existing IPC: music, scroll, keyboard, drag, resize, close (unchanged) ---
ipcMain.handle("pet-window:start-drag", () => {
  if (!petWindow || petWindow.isDestroyed()) return;
  const cursor = screen.getCursorScreenPoint();
  const [x, y] = petWindow.getPosition();
  nativeDragOffset = { x: cursor.x - x, y: cursor.y - y };
});

ipcMain.handle("pet-window:end-drag", () => { nativeDragOffset = null; });

ipcMain.on("pet-window:set-ignore-mouse-events", (_event, ignore) => {
  // When desktop is locked, ignore renderer requests to change mouse passthrough
  if (desktopLocked) return;
  if (!isMac || !petWindow || petWindow.isDestroyed()) return;
  const shouldIgnore = Boolean(ignore);
  if (ignoringMouseEvents === shouldIgnore) return;
  ignoringMouseEvents = shouldIgnore;
  petWindow.setIgnoreMouseEvents(shouldIgnore, { forward: true });
});

ipcMain.handle("pet-window:move-to", (_event, point) => {
  if (!petWindow || petWindow.isDestroyed()) return;
  const [width, height] = petWindow.getContentSize();
  let nextX, nextY;
  if (isMac && nativeDragOffset) {
    const cursor = screen.getCursorScreenPoint();
    nextX = Math.round(cursor.x - nativeDragOffset.x);
    nextY = Math.round(cursor.y - nativeDragOffset.y);
  } else {
    nextX = Number.isFinite(point?.x) ? Math.round(point.x) : 0;
    nextY = Number.isFinite(point?.y) ? Math.round(point.y) : 0;
  }
  const petBounds = getPetBoundsInWindow(point?.petBounds, width, height);
  const display = screen.getDisplayNearestPoint({ x: Math.round(nextX + petBounds.left + petBounds.width / 2), y: Math.round(nextY + petBounds.top + petBounds.height / 2) });
  const { bounds } = display;
  const x = clampToRange(nextX, bounds.x - petBounds.left, bounds.x + bounds.width - petBounds.right);
  const y = clampToRange(nextY, bounds.y - petBounds.top, bounds.y + bounds.height - petBounds.bottom);
  petWindow.setPosition(x, y, false);
});

ipcMain.handle("pet-window:resize", (_event, size) => {
  if (!petWindow || petWindow.isDestroyed()) return;
  petWindow.setContentSize(clamp(Math.round(size?.width ?? 230), 120, 520), clamp(Math.round(size?.height ?? 240), 120, 560), false);
});

ipcMain.handle("pet-window:close", () => {
  if (!petWindow || petWindow.isDestroyed()) return;
  petWindow.close();
});

function registerMacSaveShortcut() {
  globalShortcut.register("Command+S", () => {
    if (!petWindow || petWindow.isDestroyed()) return;
    petWindow.webContents.send("pet:keyboard-effect", { effect: "good", pressed: true });
    petWindow.webContents.send("pet:keyboard-effect", { effect: "good", pressed: false });
  });
}

function startNativeListener(helperPath, label, onLine, onExit, onError, onStart) {
  const child = spawn(helperPath, [String(process.pid)], { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  onStart?.(child);
  const lines = createInterface({ input: child.stdout });
  lines.on("line", onLine);
  child.stderr.on("data", data => console.error(`${label}:`, data.toString()));
  child.on("error", error => { console.error(`Unable to start ${label.toLowerCase()}:`, error); onError?.(error); });
  child.on("exit", () => { lines.close(); onExit(child); });
  return child;
}

function startGlobalScrollListener() {
  const helperPath = app.isPackaged
    ? path.join(process.resourcesPath, "native", "ScrollListener.exe")
    : path.join(__dirname, "native", "ScrollListener.exe");
  let child;
  child = startNativeListener(helperPath, "Scroll listener", line => {
    if (!petWindow || petWindow.isDestroyed()) return;
    if (line === "wheel") { petWindow.webContents.send("pet:scroll"); }
    else {
      const match = /^(send|good|delete|undo)-(down|up)$/.exec(line);
      if (match) petWindow.webContents.send("pet:keyboard-effect", { effect: match[1], pressed: match[2] === "down" });
    }
  }, () => { if (scrollListener === child) scrollListener = null; }, undefined, listener => { child = listener; scrollListener = listener; });
}

function startMacInputListener() {
  const helperPath = app.isPackaged
    ? path.join(process.resourcesPath, "native", "MacInputListener")
    : path.join(__dirname, "native", "MacInputListener");
  if (!fs.existsSync(helperPath)) { console.warn("Mac input listener not built; using Command+S fallback."); return false; }
  let child;
  child = startNativeListener(helperPath, "Mac input listener", line => {
    if (!petWindow || petWindow.isDestroyed()) return;
    if (line === "wheel") { petWindow.webContents.send("pet:scroll"); return; }
    const match = /^(send|good|delete|undo)-(down|up)$/.exec(line);
    if (match) petWindow.webContents.send("pet:keyboard-effect", { effect: match[1], pressed: match[2] === "down" });
  }, () => { if (macInputListener === child) macInputListener = null; }, undefined, listener => { child = listener; macInputListener = listener; });
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
    // Send current schedule config
    petWindow.webContents.send("pet:schedule-changed", loadSchedule());
    // Send user-imported GIFs (gif:// URLs)
    petWindow.webContents.send("pet:custom-gifs", loadCustomGifsForRenderer());
    if (pendingTaskComplete) { pendingTaskComplete = false; sendTaskComplete(); }
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
  if (!petWindow || petWindow.isDestroyed()) { pendingTaskComplete = true; return; }
  petWindow.webContents.send("pet:task-complete");
}

function loadNativeImage(filePath) {
  try { return nativeImage.createFromBuffer(fs.readFileSync(filePath)); }
  catch { return nativeImage.createFromPath(filePath); }
}

function createTray() {
  if (isWindows) {
    tray = new Tray(path.join(__dirname, "assets", "tray-icon.ico"));
    tray.setToolTip("line puppy");
    const showMenu = () => { tray.popUpContextMenu(Menu.buildFromTemplate(buildUtilityMenu(true))); };
    tray.on("click", showMenu);
    tray.on("right-click", showMenu);
    return;
  }

  const iconPath = path.join(__dirname, "assets", "tray-icon.png");
  const image = loadNativeImage(iconPath);
  if (image.isEmpty()) return;
  const trayIcon = image.resize({ width: 18, height: 18 });
  trayIcon.setTemplateImage(false);
  tray = new Tray(trayIcon);
  tray.setToolTip("line puppy");
  rebuildTrayMenu();
  tray.on("click", () => tray.popUpContextMenu());
}

function rebuildTrayMenu() {
  if (!tray || isWindows) return;
  tray.setContextMenu(Menu.buildFromTemplate(buildUtilityMenu(true)));
}

function createMacMenu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: app.name, submenu: [
      { role: "about", label: "关于line puppy" },
      { type: "separator" },
      ...buildUtilityMenu(false),
      { type: "separator" },
      { role: "quit", label: "退出line puppy" },
    ]},
    { label: "编辑", submenu: [
      { role: "copy", label: "拷贝" },
      { role: "selectAll", label: "全选" },
    ]},
  ]));
}

function getWindowsLoginOptions() {
  return {
    path: process.execPath,
    args: app.isPackaged ? [] : [app.getAppPath()],
  };
}

function getWindowsLoginQueryOptions() {
  const options = getWindowsLoginOptions();
  return { ...options, path: `"${options.path}"` };
}

function repairWindowsLoginItem() {
  const options = getWindowsLoginOptions();
  const items = app.getLoginItemSettings(getWindowsLoginQueryOptions()).launchItems;
  const legacyName = String.fromCodePoint(0x7ebf, 0x6761, 0x5c0f, 0x72d7);
  const legacyItem = items.find(item => item.name === legacyName && item.scope === "user");
  const item = items.find(item => item.name === startupEntryName && item.scope === "user") || legacyItem;
  if (!item) return;
  if (item.name === startupEntryName && !legacyItem && (
    item.args.length === options.args.length &&
    item.args.every((arg, index) => arg === options.args[index])
  )) return;
  app.setLoginItemSettings({ ...options, name: startupEntryName, openAtLogin: true, enabled: item.enabled });
  if (legacyItem) app.setLoginItemSettings({ ...options, name: legacyName, openAtLogin: false, enabled: false });
}

function startMusicListener() {
  const helper = app.isPackaged
    ? path.join(process.resourcesPath, "native", "MusicListener.exe")
    : path.join(__dirname, "native", "MusicListener.exe");
  const publish = state => {
    musicState = state;
    if (petWindow && !petWindow.isDestroyed()) petWindow.webContents.send("pet:music-state", state);
  };
  let child;
  child = startNativeListener(helper, "Music listener", line => {
    if (["playing", "paused", "idle", "blocked", "unknown"].includes(line)) publish(line);
  }, () => { if (musicListener === child) { musicListener = null; publish("unknown"); } }, () => publish("unknown"), listener => { child = listener; musicListener = listener; });
}

function isStartupEnabled() {
  if (isWindows) {
    const settings = app.getLoginItemSettings(getWindowsLoginQueryOptions());
    return settings.launchItems.some(item => item.name === startupEntryName && item.enabled);
  }
  return Boolean(app.getLoginItemSettings().openAtLogin);
}

async function clearAppCache() {
  try {
    await petWindow?.webContents.session.clearCache();
    await dialog.showMessageBox({ type: "info", title: "清除缓存", message: "桌宠缓存已清除。" });
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
      click: item => {
        try {
          app.setLoginItemSettings(isWindows ? {
            ...getWindowsLoginOptions(), name: startupEntryName, openAtLogin: item.checked, enabled: item.checked,
          } : { openAtLogin: item.checked });
          if (isStartupEnabled() !== item.checked) throw new Error("系统未能保存自启动设置。请重新运行新版安装包后再试。");
        } catch (error) { dialog.showErrorBox("自启动设置未保存", error.message); }
        rebuildTrayMenu();
        if (isMac) createMacMenu();
      },
    },
    { type: "separator" },
    {
      label: "锁定桌面（鼠标穿透）",
      type: "checkbox",
      checked: desktopLocked,
      click: item => applyDesktopLock(item.checked),
    },
    { type: "separator" },
    {
      label: "动画日程…",
      click: createSettingsWindow,
    },
    { type: "separator" },
    { label: "清除缓存", click: clearAppCache },
  ];

  if (includeQuit) {
    items.push({ type: "separator" }, { label: "退出", click: () => app.quit() });
  }

  return items;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function clampToRange(value, min, max) {
  if (min > max) return Math.round((min + max) / 2);
  return clamp(value, min, max);
}

function getPetBoundsInWindow(bounds, windowWidth, windowHeight) {
  const left    = Number.isFinite(bounds?.left)   ? Math.round(bounds.left)   : 0;
  const top     = Number.isFinite(bounds?.top)    ? Math.round(bounds.top)    : 0;
  const width   = Number.isFinite(bounds?.width) ? Math.round(bounds.width) : windowWidth;
  const height  = Number.isFinite(bounds?.height) ? Math.round(bounds.height): windowHeight;
  const nw = clamp(width,  1, windowWidth);
  const nh = clamp(height, 1, windowHeight);
  const nl = clamp(left,   0, windowWidth  - nw);
  const nt = clamp(top,    0, windowHeight - nh);
  return { left: nl, top: nt, right: nl + nw, bottom: nt + nh, width: nw, height: nh };
}

