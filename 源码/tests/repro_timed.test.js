const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const SRC = path.join(__dirname, "..", "pet.js");
const petJs = fs.readFileSync(SRC, "utf8");

// Capture callbacks registered by pet.js via window.linePuppyWindow
const captured = {};

const dom = new JSDOM(
  `<!DOCTYPE html><html><body>
    <div id="pet-shell"><img id="pet" /></div>
    <div id="pet-hit-area"></div>
    <div id="controls"></div>
    <div id="scale-handle"></div>
    <div id="close-tip"></div>
  </body></html>`,
  { runScripts: "outside-only", pretendToBeVisual: true }
);

const { window } = dom;
const { document } = window;

// Stub linePuppyWindow with IPC method captures
window.linePuppyWindow = {
  onScheduleChange: (cb) => { captured.onScheduleChange = cb; },
  onCustomGifs: (cb) => { captured.onCustomGifs = cb; },
  onMusicState: () => {},
  onTaskComplete: () => {},
  onDesktopLockChange: () => {},
  onKeyboardEffect: () => {},
  onScroll: () => {},
  moveTo: () => {},
  resize: () => {},
  close: () => {},
  startDrag: () => {},
  endDrag: () => {},
  setIgnoreMouseEvents: () => {},
};

// Minimal element stubs for methods pet.js uses
function stubEl(el) {
  el.dataset = el.dataset || {};
  el.classList = el.classList || { add() {}, remove() {}, contains() { return false; } };
  el.getBoundingClientRect = el.getBoundingClientRect || (() => ({ left: 0, top: 0, width: 180, height: 150 }));
  return el;
}
["pet", "pet-shell", "pet-hit-area", "controls", "scale-handle", "close-tip"].forEach((id) => {
  if (document.getElementById(id)) stubEl(document.getElementById(id));
});

// Run pet.js in the jsdom window context as a classic script
const scriptEl = document.createElement("script");
scriptEl.textContent = petJs;
// Execute in window scope
window.eval(petJs);

// pet.js plays startup animation at load; in jsdom the img never fires load/error,
// so startupPlaying stays true and blocks timed interactions. Simulate startup
// completion by dispatching the 'error' event (wired to `finish` -> startupPlaying=false).
const petEl = document.getElementById("pet");
petEl.dispatchEvent(new window.Event("error"));

// ---- Simulate IPC messages ----
const gifs = [
  { value: "user/贴贴脸.gif", label: "贴贴脸", file: "gif://" + encodeURIComponent("贴贴脸.gif") },
  { value: "user/飞过来抱.gif", label: "飞过来抱", file: "gif://" + encodeURIComponent("飞过来抱.gif") },
  { value: "user/一起走.gif", label: "一起走", file: "gif://" + encodeURIComponent("一起走.gif") },
  { value: "user/贴贴脸_1.gif", label: "贴贴脸_1", file: "gif://" + encodeURIComponent("贴贴脸_1.gif") },
  { value: "user/一起骑车.gif", label: "一起骑车", file: "gif://" + encodeURIComponent("一起骑车.gif") },
];
captured.onCustomGifs(gifs);

const schedule = {
  windows: [
    { id: "_meal_2", type: "timed", start: "12:00", end: "13:00", effects: ["mealtime"], interruptible: true, enabled: true },
    { id: "un0rlstu", type: "timed", start: "13:00", end: "15:00", effects: ["user/一起骑车.gif", "user/飞过来抱.gif", "user/贴贴脸.gif"], interruptible: true, enabled: true },
  ],
  system: [
    { id: "_meal_2", type: "timed", start: "12:00", end: "13:00", effects: ["mealtime"], interruptible: true, enabled: true },
  ],
};
captured.onScheduleChange(schedule);

// ---- Trigger updateTimedInteractions at 14:52 ----
const at1452 = new Date(2026, 8, 27, 14, 52, 0);
window.updateTimedInteractions(at1452);

const pet = document.getElementById("pet");
const src = pet.getAttribute("src") || pet.src || "";
console.log("=== RESULT ===");
console.log("pet.src =", JSON.stringify(src));
console.log("is gif:// ?", src.startsWith("gif://"));
console.log("is default sleep.gif ?", src.includes("sleep.gif"));

if (!src.startsWith("gif://")) {
  console.log("\n!!! BUG REPRODUCED: expected a gif:// URL, got default animation");
  process.exit(2);
} else {
  console.log("\nOK: timed interaction resolved to a custom GIF");
  process.exit(0);
}
