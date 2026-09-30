const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const SRC = path.join(__dirname, "..", "pet.js");
const petJs = fs.readFileSync(SRC, "utf8");
const captured = {};

const dom = new JSDOM(
  `<!DOCTYPE html><html><body>
    <div id="pet-shell"><img id="pet" /></div>
    <div id="pet-hit-area"></div><div id="controls"></div>
    <div id="scale-handle"></div><div id="close-tip"></div>
  </body></html>`,
  { runScripts: "outside-only", pretendToBeVisual: true }
);
const { window } = dom;
const { document } = window;

let lockHandler = () => {};
window.linePuppyWindow = {
  onScheduleChange: (cb) => { captured.onScheduleChange = cb; },
  onCustomGifs: (cb) => { captured.onCustomGifs = cb; },
  onMusicState: () => {}, onTaskComplete: () => {}, onDesktopLockChange: (cb) => { lockHandler = cb; },
  onKeyboardEffect: () => {}, onScroll: () => {}, moveTo: () => {}, resize: () => {},
  close: () => {}, startDrag: () => {}, endDrag: () => {}, setIgnoreMouseEvents: () => {},
};
function stubEl(el) { el.dataset = el.dataset || {}; el.classList = el.classList || { add(){}, remove(){}, contains(){return false;} }; el.getBoundingClientRect = el.getBoundingClientRect || (() => ({left:0,top:0,width:180,height:150})); return el; }
["pet","pet-shell","pet-hit-area","controls","scale-handle","close-tip"].forEach(id => { if (document.getElementById(id)) stubEl(document.getElementById(id)); });

const RealDate = Date;
window.Date = class extends RealDate {
  constructor(...args) { if (args.length === 0) return new RealDate(2026, 8, 27, 14, 52, 0); super(...args); }
};

window.eval(petJs);
document.getElementById("pet").dispatchEvent(new window.Event("error"));

// --- Turn ON desktop lock BEFORE the timed window activates ---
lockHandler(true);
console.log("desktop lock ON");

const gifs = ["贴贴脸.gif","飞过来抱.gif","一起走.gif","贴贴脸_1.gif","一起骑车.gif"].map(f => ({
  value: "user/" + f, label: f.replace(/\.gif$/,""), file: "gif://" + encodeURIComponent(f),
}));
captured.onCustomGifs(gifs);

const schedule = {
  windows: [
    { id: "un0rlstu", type: "timed", start: "13:00", end: "15:00", effects: ["user/一起骑车.gif","user/飞过来抱.gif","user/贴贴脸.gif"], interruptible: true, enabled: true },
  ],
  system: [],
};
captured.onScheduleChange(schedule);

window.updateTimedInteractions(new Date(2026, 8, 27, 14, 52, 0));

const pet = document.getElementById("pet");
const decode = (s) => { try { const m = s.match(/^gif:\/\/(.+)$/); return m ? decodeURIComponent(m[1]) : s; } catch { return s; } };
const cur = () => { const s = pet.getAttribute("src") || pet.src || ""; return s.startsWith("gif://") ? decode(s) : s; };

console.log("=== Instant play at 14:52 (desktop LOCKED) ===");
console.log("initial src:", cur());

console.log("\n=== 12s observation (cycling should work even while locked) ===");
(async () => {
  const seen = [];
  for (let i = 0; i < 24; i++) {
    const s = cur();
    if (seen.length === 0 || seen[seen.length - 1] !== s) {
      console.log(`t=${(i*0.5).toFixed(1)}s  ${s}`);
      seen.push(s);
    }
    await new Promise(r => setTimeout(r, 500));
  }
  const distinct = new Set(seen);
  console.log("\n=== Distinct gifs seen over 12s (locked):", distinct.size, "===");
  for (const d of distinct) console.log("  -", d);
  if (distinct.size <= 1) { console.log(">>> FAIL: cycling broken while locked"); process.exit(1); }
  console.log(">>> PASS: cycling works even while desktop is locked");
  process.exit(0);
})();
