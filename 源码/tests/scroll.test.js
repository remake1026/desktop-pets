const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const { test } = require("node:test");

function fixture({ includeStartup = false } = {}) {
  let now = 0, timerId = 0;
  let minuteOfDay = 8 * 60;
  let dayOfMonth = 14;
  const timers = new Map();
  const elements = new Map();
  function element(id) {
    if (elements.has(id)) return elements.get(id);
    const events = new Map();
    const node = {
      dataset: {}, style: { setProperty() {} }, naturalWidth: 240, naturalHeight: 240,
      addEventListener(name, fn, options) {
        const entries = events.get(name) || [];
        entries.push({ fn, once: options?.once });
        events.set(name, entries);
      },
      removeEventListener(name, fn) {
        events.set(name, (events.get(name) || []).filter(entry => entry.fn !== fn));
      },
      emit(name, event = {}) {
        for (const entry of [...(events.get(name) || [])]) {
          if (entry.once) this.removeEventListener(name, entry.fn);
          entry.fn(event);
        }
      },
      getBoundingClientRect() { return { left: 0, top: 0, right: 170, bottom: 150 }; },
    };
    elements.set(id, node);
    return node;
  }
  let onScroll, onKeyboardEffect, onMusicState;
  const window = {
    setTimeout(fn, delay) { const id = ++timerId; timers.set(id, { fn, at: now + delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
    setInterval() {},
    screenX: 0, screenY: 0,
    addEventListener() {},
    linePuppyWindow: { resize() {}, onTaskComplete() {}, onScroll(fn) { onScroll = fn; }, onKeyboardEffect(fn) { onKeyboardEffect = fn; }, onMusicState(fn) { onMusicState = fn; } },
  };
  const context = vm.createContext({
    window, performance: { now: () => now },
    Date: class {
      getHours() { return Math.floor(minuteOfDay / 60); }
      getMinutes() { return minuteOfDay % 60; }
      getFullYear() { return 2026; }
      getMonth() { return 8; }
      getDate() { return dayOfMonth; }
    },
    document: { querySelector: element, querySelectorAll: () => [] },
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../pet.js"), "utf8"), context);
  const f = {
    run: code => vm.runInContext(code, context),
    state: () => vm.runInContext("currentState", context),
    pet: element("#pet"), hit: element("#pet-hit-area"),
    time(hour, minute) { minuteOfDay = hour * 60 + minute; vm.runInContext("updateMealtime(); updateTimedInteractions(); updateScheduledAnimations()", context); },
    day(day) { dayOfMonth = day; },
    wheel() { onScroll(); },
    key(effect, pressed) { onKeyboardEffect({ effect, pressed }); },
    music(state) { onMusicState(state); },
    load() { element("#pet").emit("load"); },
    advance(ms) {
      const end = now + ms;
      while (true) {
        const entry = [...timers].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!entry) break;
        timers.delete(entry[0]); now = entry[1].at; entry[1].fn();
      }
      now = end;
    },
  };
  if (!includeStartup) { f.load(); f.advance(2900); }
  return f;
}

test("startup waits for loading, plays once in full, and resists pointer effects", () => {
  const f = fixture({ includeStartup: true });
  assert.equal(f.state(), "startup");
  f.advance(1000); assert.equal(f.state(), "startup");
  f.load();
  f.wheel(); f.hit.emit("click"); f.hit.emit("mouseenter");
  f.advance(2899); assert.equal(f.state(), "startup");
  f.advance(1); assert.equal(f.state(), "default");
  f.run("playStartupAnimation()"); assert.equal(f.state(), "default");
  f.hit.emit("click"); assert.equal(f.state(), "click");
});

test("startup defers meal playback and recovers if the image cannot load", () => {
  const f = fixture({ includeStartup: true });
  f.time(12, 0); assert.equal(f.state(), "startup");
  f.load(); f.advance(2900); assert.equal(f.state(), "mealtime");
  const broken = fixture({ includeStartup: true });
  broken.pet.emit("error"); assert.equal(broken.state(), "default");
});

test("one wheel event plays all 18 frames before returning to default", () => {
  const f = fixture();
  f.wheel(); f.advance(100); // Decode time must not eat into playback.
  assert.equal(f.state(), "scroll");
  f.load(); f.advance(1439);
  assert.equal(f.state(), "scroll");
  f.advance(1); assert.equal(f.state(), "default");
});

test("continuous scrolling extends full cycles without restarting; replay starts fresh", () => {
  const f = fixture(); f.wheel(); f.load(); const src = f.pet.src;
  f.advance(1400); f.wheel(); assert.equal(f.pet.src, src);
  f.advance(40); assert.equal(f.state(), "scroll");
  f.advance(1439); assert.equal(f.state(), "scroll");
  f.advance(1); assert.equal(f.state(), "default");
  f.wheel(); assert.notEqual(f.pet.src, src);
});

test("hover and old task timers cannot cut scroll short", () => {
  const f = fixture();
  f.run("playTaskComplete(); playHeartEffect()");
  f.advance(4000); f.wheel(); f.load();
  f.hit.emit("mouseenter"); assert.equal(f.state(), "scroll");
  f.advance(200); assert.equal(f.state(), "scroll");
  f.advance(1240); assert.equal(f.state(), "default");
  f.hit.emit("mouseenter"); assert.equal(f.state(), "default");
  f.hit.emit("mouseleave", { clientX: 300, clientY: 300 });
  f.hit.emit("mouseenter"); assert.equal(f.state(), "hover");
});

test("click cancels scroll callbacks, and drag/task effects retain their interaction", () => {
  const f = fixture(); f.wheel();
  f.run("playHeartEffect()"); f.load(); f.advance(1440);
  assert.equal(f.state(), "default");
  f.run("isDragging = true; setPetState('drag', { force: true })");
  f.wheel(); assert.equal(f.state(), "drag");
  f.run("isDragging = false; playTaskComplete()");
  f.wheel(); assert.equal(f.state(), "taskComplete");
});

test("all three meal windows include their start and exclude their end", () => {
  const f = fixture();
  for (const [h, m, expected] of [
    [9, 29, "default"], [9, 30, "mealtime"], [10, 9, "mealtime"], [10, 10, "default"],
    [11, 59, "default"], [12, 0, "mealtime"], [12, 59, "mealtime"], [13, 0, "default"],
    [19, 59, "default"], [20, 0, "mealtime"], [20, 59, "mealtime"], [21, 0, "default"],
    [0, 0, "sleep2"], [9, 30, "mealtime"],
  ]) {
    f.time(h, m); assert.equal(f.state(), expected, `${h}:${m}`);
  }
});

test("meal animation yields to hover, music, click, and scroll before resuming", () => {
  const f = fixture(); f.time(12, 0);
  f.hit.emit("mouseenter"); assert.equal(f.state(), "hover");
  f.hit.emit("mouseleave", { clientX: 300, clientY: 300 }); assert.equal(f.state(), "mealtime");
  f.music("playing"); assert.equal(f.state(), "music");
  f.music("paused"); assert.equal(f.state(), "mealtime");
  f.hit.emit("click"); assert.equal(f.state(), "click");
  f.advance(1440); assert.equal(f.state(), "mealtime");
  f.wheel(); f.load(); f.advance(1440); assert.equal(f.state(), "mealtime");
  f.wheel(); f.load(); f.time(13, 0); assert.equal(f.state(), "scroll");
  f.advance(1440); assert.equal(f.state(), "default");
});

test("local pet clicks retain drag suppression", () => {
  const f = fixture();
  f.run("suppressNextClick = true");
  f.hit.emit("click"); assert.equal(f.state(), "default");
  f.hit.emit("click"); assert.equal(f.state(), "click");
  f.advance(1440); assert.equal(f.state(), "default");
});

test("Enter, Ctrl+S, Delete, and Ctrl+Z finish their full GIF, including load time", () => {
  for (const [effect, duration] of [["send", 1740], ["good", 2000], ["delete", 1840], ["undo", 2000]]) {
    const f = fixture(); f.key(effect, true); f.advance(100); f.key(effect, false);
    assert.equal(f.state(), effect);
    f.load(); f.hit.emit("mouseenter"); f.advance(duration - 1);
    assert.equal(f.state(), effect);
    f.advance(1); assert.equal(f.state(), "default");
  }
});

test("Ctrl+S plays exactly two cycles even when held or repeated", () => {
  const f = fixture(); f.key("good", true); f.load(); const src = f.pet.src;
  f.advance(800); f.key("good", true); assert.equal(f.pet.src, src);
  f.advance(300); assert.equal(f.state(), "good");
  f.advance(899); assert.equal(f.state(), "good");
  f.advance(1); assert.equal(f.state(), "default");
  f.key("good", false);
});

test("switching keyboard effects cleans old timers and respects startup and meals", () => {
  const f = fixture(); f.key("send", true); f.load(); f.advance(300);
  f.key("good", true); f.load(); f.key("good", false); f.advance(2000);
  assert.equal(f.state(), "default");
  f.time(12, 0); f.key("send", true); f.load(); f.key("send", false); f.advance(1740);
  assert.equal(f.state(), "mealtime");
  const starting = fixture({ includeStartup: true });
  starting.key("send", true); starting.key("send", false); assert.equal(starting.state(), "startup");
  starting.load(); starting.advance(2900); assert.equal(starting.state(), "default");
});

test("520 and 521 loop throughout their minute, switch at the boundary, and repeat daily", () => {
  const f = fixture();
  for (const day of [14, 15]) {
    f.day(day);
    for (const [hour, minute, effect, duration] of [
      [5, 20, "love520", 2000], [5, 21, "love521", 2300],
      [17, 20, "love520", 2000], [17, 21, "love521", 2300],
    ]) {
      f.time(hour, minute); assert.equal(f.state(), effect);
      const src = f.pet.src;
      f.time(hour, minute); assert.equal(f.pet.src, src);
      f.load(); f.advance(duration * 4); assert.equal(f.state(), effect);
      f.time(hour, minute); assert.equal(f.pet.src, src);
      if (minute === 21) { f.time(hour, 22); assert.equal(f.state(), "default"); }
    }
  }
});

test("nighttime windows use sleepy and sleepy2 assets", () => {
  const f = fixture();
  f.time(23, 0); assert.equal(f.state(), "sleep");
  assert.match(f.pet.src, /assets\/sleepy\.gif/);
  f.time(0, 0); assert.equal(f.state(), "sleep2");
  assert.match(f.pet.src, /assets\/sleepy2\.gif/);
  f.time(2, 0); assert.equal(f.state(), "default");
});

test("Ctrl+Z always plays exactly one cycle, even when held", () => {
  const f = fixture(); f.key("undo", true); f.load();
  f.advance(1999); assert.equal(f.state(), "undo");
  f.advance(1); assert.equal(f.state(), "default");
  f.key("undo", false);
});

test("nighttime assets yield to interactions and resume for the remaining window", () => {
  const f = fixture(); f.time(23, 0);
  f.hit.emit("click"); assert.equal(f.state(), "click");
  f.time(23, 0); assert.equal(f.state(), "click");
  f.advance(1440); assert.equal(f.state(), "sleep");

  f.wheel(); f.load(); assert.equal(f.state(), "scroll");
  f.time(23, 0); assert.equal(f.state(), "scroll");
  f.advance(1440); assert.equal(f.state(), "sleep");

  f.key("send", true); f.load(); f.key("send", false); assert.equal(f.state(), "send");
  f.advance(1740); assert.equal(f.state(), "sleep");
  f.hit.emit("mouseenter"); assert.equal(f.state(), "hover");
  f.hit.emit("mouseleave", { clientX: 300, clientY: 300 }); assert.equal(f.state(), "sleep");

  f.music("playing"); assert.equal(f.state(), "music");
  f.music("paused"); assert.equal(f.state(), "sleep");

  f.time(0, 0); assert.equal(f.state(), "sleep2");
  f.run("playTaskComplete()"); assert.equal(f.state(), "taskComplete");
  f.advance(4120); assert.equal(f.state(), "sleep2");

  f.wheel(); f.load(); f.time(2, 0); assert.equal(f.state(), "scroll");
  f.advance(1440); assert.equal(f.state(), "default");
});

test("morning timed interactions loop through their windows, yield to input, and then resume", () => {
  const f = fixture();
  f.time(10, 30); assert.equal(f.state(), "morningReading");
  f.load(); f.advance(2520 * 3); assert.equal(f.state(), "morningReading");

  f.hit.emit("click"); assert.equal(f.state(), "click");
  f.time(10, 30); assert.equal(f.state(), "click");
  f.advance(1440); assert.equal(f.state(), "morningReading");

  f.time(10, 40); assert.equal(f.state(), "morningDrink");
  f.load(); f.advance(800 * 3); assert.equal(f.state(), "morningDrink");
  f.wheel(); assert.equal(f.state(), "scroll");
  f.time(10, 40); assert.equal(f.state(), "scroll");
  f.load(); f.advance(1440); assert.equal(f.state(), "morningDrink");
  f.run("playTaskComplete()"); assert.equal(f.state(), "taskComplete");
  f.advance(4120); assert.equal(f.state(), "morningDrink");
  f.time(10, 50); assert.equal(f.state(), "default");
});

test("after-work animation loops through its window and resumes after interactions", () => {
  const f = fixture();
  f.time(18, 0); assert.equal(f.state(), "afterWork");
  f.load(); f.advance(800 * 3); assert.equal(f.state(), "afterWork");
  f.hit.emit("mouseenter"); assert.equal(f.state(), "hover");
  f.hit.emit("mouseleave"); assert.equal(f.state(), "afterWork");

  const music = fixture();
  music.time(18, 0); music.music("playing"); assert.equal(music.state(), "music");
  music.music("paused"); assert.equal(music.state(), "afterWork");

  const scroll = fixture();
  scroll.time(18, 0); scroll.wheel(); assert.equal(scroll.state(), "scroll");
  scroll.load(); scroll.advance(1440); assert.equal(scroll.state(), "afterWork");
  scroll.time(19, 0); assert.equal(scroll.state(), "default");
});

test("scheduled clips wait for startup and resist input until their time window ends", () => {
  const f = fixture({ includeStartup: true });
  f.time(5, 20); assert.equal(f.state(), "startup");
  f.load(); f.advance(2900); f.time(5, 20); assert.equal(f.state(), "love520");
  f.load(); f.wheel(); f.hit.emit("click"); f.key("send", true); f.key("send", false);
  f.hit.emit("mouseenter"); f.advance(1999); assert.equal(f.state(), "love520");
  f.advance(10000); assert.equal(f.state(), "love520");
  f.time(5, 22); assert.equal(f.state(), "default");
  f.time(5, 21); f.pet.emit("error"); assert.equal(f.state(), "default");
  f.time(5, 21); assert.equal(f.state(), "default");
});

test("music alternates equal-length asset groups and resets on pause", () => {
  const f = fixture();
  f.music("paused"); assert.equal(f.state(), "default");
  f.music("playing"); assert.equal(f.state(), "music");
  f.load();
  const originalSrc = f.pet.src;
  f.advance(9600); assert.match(f.pet.src, /music-dance\.gif/);
  f.load(); f.advance(9600); assert.match(f.pet.src, /music\.gif/);
  f.load(); assert.notEqual(f.pet.src, originalSrc);
  f.hit.emit("mouseenter"); assert.equal(f.state(), "hover");
  f.hit.emit("mouseleave", { clientX: 300, clientY: 300 }); assert.equal(f.state(), "music");
  f.music("paused"); assert.equal(f.state(), "default");
  f.advance(1200); assert.equal(f.state(), "default");
  f.music("playing"); assert.match(f.pet.src, /music\.gif/);
});

test("video and unknown output exit immediately; music restarts after pause", () => {
  const f = fixture();
  for (const state of ["blocked", "unknown"]) {
    f.music("playing"); f.music(state); assert.equal(f.state(), "default");
    f.advance(2000); assert.equal(f.state(), "default");
  }
  f.music("playing"); f.load(); assert.equal(f.state(), "music");
  f.music("paused"); assert.equal(f.state(), "default");
  f.music("playing"); assert.equal(f.state(), "music");
  f.music("blocked"); assert.equal(f.state(), "default");
});

test("music restores after input, can cover meals, and preserves startup", () => {
  const f = fixture(); f.music("playing");
  f.key("good", true); f.load(); f.key("good", false); f.advance(2000);
  assert.equal(f.state(), "music");
  f.time(12, 0); assert.equal(f.state(), "music");
  f.time(13, 0); assert.equal(f.state(), "music");
  const starting = fixture({ includeStartup: true }); starting.music("playing");
  assert.equal(starting.state(), "startup"); starting.load(); starting.advance(2900);
  assert.equal(starting.state(), "music");
});
