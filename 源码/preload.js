const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("linePuppyWindow", {
  moveTo(point) {
    return ipcRenderer.invoke("pet-window:move-to", point);
  },
  startDrag() {
    return ipcRenderer.invoke("pet-window:start-drag");
  },
  endDrag() {
    return ipcRenderer.invoke("pet-window:end-drag");
  },
  setIgnoreMouseEvents(ignore) {
    ipcRenderer.send("pet-window:set-ignore-mouse-events", ignore);
  },
  resize(size) {
    return ipcRenderer.invoke("pet-window:resize", size);
  },
  close() {
    return ipcRenderer.invoke("pet-window:close");
  },
  onTaskComplete(callback) {
    if (typeof callback !== "function") return () => {};
    const listener = () => callback();
    ipcRenderer.on("pet:task-complete", listener);
    return () => ipcRenderer.removeListener("pet:task-complete", listener);
  },
  onScroll(callback) {
    if (typeof callback !== "function") return () => {};
    const listener = () => callback();
    ipcRenderer.on("pet:scroll", listener);
    return () => ipcRenderer.removeListener("pet:scroll", listener);
  },
  onMusicState(callback) {
    if (typeof callback !== "function") return () => {};
    const listener = (_event, state) => callback(state);
    ipcRenderer.on("pet:music-state", listener);
    return () => ipcRenderer.removeListener("pet:music-state", listener);
  },
  onKeyboardEffect(callback) {
    if (typeof callback !== "function") return () => {};
    const listener = (_event, action) => callback(action);
    ipcRenderer.on("pet:keyboard-effect", listener);
    return () => ipcRenderer.removeListener("pet:keyboard-effect", listener);
  },
  // desktop-lock: listen for lock state changes (from tray or settings window)
  onDesktopLockChange(callback) {
    if (typeof callback !== "function") return () => {};
    const listener = (_event, locked) => callback(Boolean(locked));
    ipcRenderer.on("pet:desktop-lock", listener);
    return () => ipcRenderer.removeListener("pet:desktop-lock", listener);
  },
  // schedule: listen for schedule config updates (from settings window)
  onScheduleChange(callback) {
    if (typeof callback !== "function") return () => {};
    const listener = (_event, data) => callback(data);
    ipcRenderer.on("pet:schedule-changed", listener);
    return () => ipcRenderer.removeListener("pet:schedule-changed", listener);
  },
  // custom gifs: receive user-imported GIF descriptors with resolvable URLs
  onCustomGifs(callback) {
    if (typeof callback !== "function") return () => {};
    const listener = (_event, gifs) => callback(gifs);
    ipcRenderer.on("pet:custom-gifs", listener);
    return () => ipcRenderer.removeListener("pet:custom-gifs", listener);
  },
});
