const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("linePuppySettings", {
  loadSchedule() { return ipcRenderer.invoke("settings:load-schedule"); },
  saveSchedule(data) { return ipcRenderer.invoke("settings:save-schedule", data); },
  getCustomGifs() { return ipcRenderer.invoke("settings:get-custom-gifs"); },
  importGif() { return ipcRenderer.invoke("settings:import-gif"); },
  deleteGif(value) { return ipcRenderer.invoke("settings:delete-gif", value); },
  exportConfig() { return ipcRenderer.invoke("settings:export-config"); },
  importConfig() { return ipcRenderer.invoke("settings:import-config"); },
});
