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

    return () => {
      ipcRenderer.removeListener("pet:task-complete", listener);
    };
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
});
