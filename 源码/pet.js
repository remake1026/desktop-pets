const animations = {
  default: "assets/sleep.gif",
  hover: "assets/jump.gif",
  click: "assets/heart.gif",
  drag: "assets/special.gif",
  taskComplete: "assets/usageOver3Hours.gif",
  scroll: "assets/scroll.gif",
  mealtime: "assets/mealtime.gif",
  startup: "assets/turn on.gif",
  send: "assets/send.gif",
  good: "assets/good.gif",
  delete: "assets/delete.gif",
  undo: "assets/undo.gif",
  love520: "assets/520.gif",
  love521: "assets/521.gif",
  morningReading: "assets/morning-reading.gif",
  morningDrink: "assets/morning-drink.gif",
  afterWork: "assets/after-work.gif",
  music: "assets/music.gif",
  sleep: "assets/sleepy.gif",
  sleep2: "assets/sleepy2.gif",
};

const priority = {
  default: 0,
  music: 1,
  mealtime: 1,
  hover: 1,
  scroll: 2,
  click: 3,
  send: 3,
  good: 3,
  delete: 3,
  undo: 3,
  drag: 4,
  taskComplete: 5,
  startup: 6,
  love520: 6,
  love521: 6,
  morningReading: 1,
  morningDrink: 1,
  afterWork: 1,
  sleep: 1,
  sleep2: 1,
};

const TASK_COMPLETE_GIF_DURATION_MS = 2060;
const TASK_COMPLETE_PLAY_COUNT = 2;
const HEART_GIF_DURATION_MS = 1440;
const STARTUP_GIF_DURATION_MS = 2900;
const TIMED_INTERACTION_SWITCH_MS = 5000;
const SCROLL_GIF_DURATION_MS = 1440;
const SCROLL_IDLE_MS = 160;
const KEYBOARD_GIF_DURATION_MS = { send: 1740, good: 1000, delete: 1840, undo: 2000 };
const GOOD_PLAY_COUNT = 2;
const MUSIC_ANIMATIONS = [
  { src: "assets/music.gif",       durationMs: 1600, playCount: 6 },
  { src: "assets/music-dance.gif", durationMs: 1920, playCount: 5 },
];
const BASE_PET_WIDTH = 180;
const BASE_HIT_AREA_WIDTH = 170;
const BASE_HIT_AREA_HEIGHT = 150;
const WINDOW_PADDING_X = 36;
const WINDOW_PADDING_Y = 56;
const MIN_SCALE = 0.3;
const MAX_SCALE = 2;
const DRAG_THRESHOLD_PX = 4;

let currentState = "default";
let isPressing = false;
let isDragging = false;
let isHovering = false;
let suppressNextClick = false;
let dragOffset = { x: 0, y: 0 };
let dragStart = { x: 0, y: 0 };
let scale = 1;
let taskCompleteTimer = 0;
let clickTimer = 0;
let lastWindowSize = { width: 0, height: 0 };
let suppressHoverUntilLeave = false;
let isScaling = false;
let ignoreMouseEvents = true;
let scrollTimer = 0;
let scrollLoadListener = null;
let lastScrollTime = 0;
let scrollPlaybackId = 0;
let startupPlaying = false;
let startupPlayed = false;
let taskCompleteAfterStartup = false;
let scheduledAfterStartup = false;
const keyboardPressed = Object.fromEntries(Object.keys(KEYBOARD_GIF_DURATION_MS).map(effect => [effect, false]));
let keyboardTimer = 0;
let keyboardLoadListener = null;
let keyboardErrorListener = null;
let keyboardPlaybackId = 0;
let scheduledPlaying = false;
let scheduledEffect = "";
let scheduledInterruptible = false;
let scheduledPlaybackId = 0;
let scheduledErrorListener = null;
let failedScheduledSlot = "";
let taskCompleteAfterScheduled = false;
let timedInteractionPlaying = false;
let timedInteractionEffect = "";
let timedInteractionEntryId = "";
let timedInteractionTimer = 0;
let musicPlaybackState = "idle";
let musicCycleTimer = 0;
let musicLoadListener = null;
let musicErrorListener = null;
let musicPlaybackId = 0;
let musicAnimationIndex = 0;
let musicCyclesPlayed = 0;

// desktop-lock state
let desktopLocked = false;

// ──────────────────────────────────────────────
// Unified schedule (loaded from settings.json, updated by IPC)
// ──────────────────────────────────────────────
// Default schedule — same as main.js DEFAULT_SCHEDULE_WINDOWS
let SCHEDULE_WINDOWS = [
  { id: "_520_1", type: "scheduled", start: "05:20", effects: ["love520"] },
  { id: "_520_2", type: "scheduled", start: "17:20", effects: ["love520"] },
  { id: "_521_1", type: "scheduled", start: "05:21", effects: ["love521"] },
  { id: "_521_2", type: "scheduled", start: "17:21", effects: ["love521"] },
  { id: "_morning_reading",  type: "timed", start: "10:30", end: "10:40", effects: ["morningReading"], interruptible: true },
  { id: "_morning_drink",    type: "timed", start: "10:40", end: "10:50", effects: ["morningDrink"],   interruptible: true },
  { id: "_afterwork",        type: "timed", start: "18:00", end: "19:00", effects: ["afterWork"],      interruptible: true },
  { id: "_night_sleep",  type: "timed", start: "23:00", end: "24:00", effects: ["sleep"],  interruptible: true },
  { id: "_night_sleep2", type: "timed", start: "00:00", end: "02:00", effects: ["sleep2"], interruptible: true },
  { id: "_meal_1",      type: "timed", start: "09:30", end: "10:10", effects: ["mealtime"], interruptible: true },
  { id: "_meal_2",      type: "timed", start: "12:00", end: "13:00", effects: ["mealtime"], interruptible: true },
  { id: "_meal_3",      type: "timed", start: "20:00", end: "21:00", effects: ["mealtime"], interruptible: true },
];

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────
const pet = document.querySelector("#pet");
const petShell = document.querySelector("#pet-shell");
const hitArea = document.querySelector("#pet-hit-area");
const controls = document.querySelector("#controls");
const scaleHandle = document.querySelector("#scale-handle");
const closeTip = document.querySelector("#close-tip");

function timeToMinutes(str) {
  if (!str) return -1;
  const parts = str.split(":");
  if (parts.length < 2) return -1;
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

// Test override — set via window.__testDateOverride__ = new Date(...) from smoke tests.
function currentMinutes(date = new Date()) {
  if (typeof window !== "undefined" && window.__testDateOverride__ instanceof Date) {
    return window.__testDateOverride__.getHours() * 60 + window.__testDateOverride__.getMinutes();
  }
  if (typeof date === "number") return date; // caller passed minutes directly (e.g. real time)
  return date.getHours() * 60 + date.getMinutes();
}

// ──────────────────────────────────────────────
// Schedule update — unified (replaces old separate functions)
// ──────────────────────────────────────────────
function updateScheduledAnimations(date = new Date()) {
  const day = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  const now = currentMinutes(date);
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const currentTime = `${hh}:${mm}`;

  // Find a matching scheduled entry (exact-time, non-interruptible)
  const scheduledEntry = SCHEDULE_WINDOWS.find(
    entry => entry.type === "scheduled" && entry.enabled !== false && entry.start === currentTime
  );

  if (scheduledEntry) {
    const slot = `${day} ${currentTime}`;
    if (failedScheduledSlot === slot) return;
    if (scheduledPlaying && scheduledEntry.effects && scheduledEntry.effects.includes(scheduledEffect)) return;
    if (startupPlaying || isDragging || isPressing || isScaling || currentState === "taskComplete") return;
    if (scheduledPlaying) stopScheduledAnimation(false);
    playScheduledAnimation(scheduledEntry, slot, false);
    return;
  }

  if (scheduledPlaying) {
    stopScheduledAnimation();
  }
}

function updateTimedInteractions(date = new Date()) {
  const now = currentMinutes(date);

  // Find a matching timed entry (time-window, interruptible)
  const timedEntry = SCHEDULE_WINDOWS.find(entry => {
    if (entry.type !== "timed" || entry.enabled === false) return false;
    const startMin = timeToMinutes(entry.start);
    const endMin   = timeToMinutes(entry.end);
    if (startMin < 0 || endMin < 0) return false;
    return now >= startMin && now < endMin;
  });

  if (!timedEntry) {
    if (timedInteractionPlaying) stopTimedInteraction();
    return;
  }
  if (timedInteractionPlaying && timedInteractionEntryId === timedEntry.id) return;
  if (startupPlaying || isScheduledAnimationLocked() || isDragging || isPressing || isScaling || currentState === "taskComplete") return;
  // Music takes priority over timed interactions (e.g., mealtime).
  if (musicPlaybackState === "playing") return;
  if (timedInteractionPlaying) stopTimedInteraction(false);
  playTimedInteraction(timedEntry);
}

function isMealtime(date = new Date()) {
  const now = currentMinutes(date);
  return SCHEDULE_WINDOWS.some(entry => {
    if (entry.type !== "timed" || entry.enabled === false) return false;
    if (!Array.isArray(entry.effects) || !entry.effects.includes("mealtime")) return false;
    const startMin = timeToMinutes(entry.start);
    const endMin   = timeToMinutes(entry.end);
    return startMin >= 0 && endMin >= 0 && now >= startMin && now < endMin;
  });
}

// ──────────────────────────────────────────────
// Desktop lock
// ──────────────────────────────────────────────
function onDesktopLockChange(locked) {
  if (desktopLocked === locked) return;
  desktopLocked = locked;

  if (locked) {
    // Clear any in-progress interaction, return to default
    clearClickEffect();
    hideCloseTip();
    clearScrollEffect();
    clearKeyboardEffect();
    isHovering = false;
    isPressing = false;
    isDragging = false;
    isScaling = false;
    suppressNextClick = false;
    pet.classList.add("desktop-locked");
    setPetState("default", { force: true });
  } else {
    pet.classList.remove("desktop-locked");
  }
}

// ──────────────────────────────────────────────
// Schedule IPC
// ──────────────────────────────────────────────
window.linePuppyWindow?.onScheduleChange?.(data => {
  if (!data) return;
  const merged = [].concat(data.windows || [], data.system || []);
  if (merged.length) SCHEDULE_WINDOWS = merged;
  // If a timed interaction is currently playing, its effects list may have changed
  // (e.g. user removed a GIF via settings). Stop it so updateTimedInteractions() can
  // re-evaluate with the new schedule and avoid carrying a deleted GIF in rotation.
  if (timedInteractionPlaying) stopTimedInteraction(true);
  // Re-evaluate immediately
  updateTimedInteractions();
  updateScheduledAnimations();
});

// Register user-imported GIFs into the animation lookup table
window.linePuppyWindow?.onCustomGifs?.(gifs => {
  if (!Array.isArray(gifs)) return;
  for (const gif of gifs) {
    if (gif && gif.value && gif.file) animations[gif.value] = gif.file;
  }
  // Re-evaluate timed interactions now that the animations map is populated.
  // This also handles the startup race: if pet:custom-gifs arrived before
  // pet:schedule-changed, scheduleData is already set and the timed window
  // can now correctly resolve to its effect and call setPetState.
  if (typeof updateTimedInteractions === "function") updateTimedInteractions();
});

// ──────────────────────────────────────────────
// State machine
// ──────────────────────────────────────────────
// States that are driven purely by user interaction. When the desktop is
// locked the pet is click-through, so these must be suppressed; automatic
// states (timed-interaction cycling, scheduled events, music, mealtime, …)
// remain allowed.
const INTERACTION_STATES = new Set([
  "hover", "click", "drag", "scroll", "send", "good", "delete", "undo"
]);
function setPetState(nextState, options = {}) {
  // When the desktop is locked the pet becomes click-through and must ignore
  // user-driven states (hover/click/drag/scroll/keyboard), but it should still
  // play automatic animations — timed-interaction cycling, scheduled events,
  // music, mealtime, etc. Blocking every non-default state used to freeze
  // those as well, which also killed GIF cycling while locked.
  if (desktopLocked && INTERACTION_STATES.has(nextState)) return;
  if (startupPlaying && nextState !== "startup") return;
  if (isScheduledAnimationLocked() && nextState !== currentState) return;
  if (!animations[nextState]) nextState = "default";

  if (nextState === "default") {
    if (musicPlaybackState === "playing") nextState = "music";
    else if (hasInterruptibleScheduledAnimation()) nextState = scheduledEffect;
    else if (hasTimedInteraction()) nextState = timedInteractionEffect;
    else if (isMealtime()) nextState = "mealtime";
  }

  if (!options.force && priority[nextState] < priority[currentState]) return;

  const img = document.querySelector("#pet");
  const nextSrc = nextState === "music" ? currentMusicAnimation().src : animations[nextState];
  if (!img) return;

  if (currentState === "scroll" && nextState !== "scroll") clearScrollEffect();
  if (currentState === "music" && nextState !== "music") clearMusicCycle();
  if (isKeyboardEffect(currentState) && nextState !== currentState) clearKeyboardEffect();

  if (img.dataset.current === nextSrc) { currentState = nextState; return; }

  currentState = nextState;
  img.dataset.current = nextSrc;
  img.src = nextState === "scroll" ? `${nextSrc}?play=${++scrollPlaybackId}`
    : nextState === "music" ? `${nextSrc}?play=${++musicPlaybackId}`
    : isKeyboardEffect(nextState) ? `${nextSrc}?play=${++keyboardPlaybackId}`
    : (nextState === "love520" || nextState === "love521") ? `${nextSrc}?play=${++scheduledPlaybackId}`
    : nextSrc;
  if (nextState === "music") startMusicCycle();
}

function isScheduledAnimationLocked() { return scheduledPlaying && !scheduledInterruptible; }
function hasInterruptibleScheduledAnimation() { return scheduledPlaying && scheduledInterruptible; }
function hasScheduledAnimation() { return scheduledPlaying; }
function hasTimedInteraction() { return timedInteractionPlaying; }

function clearMusicCycle() {
  window.clearTimeout(musicCycleTimer);
  musicCycleTimer = 0;
  if (musicLoadListener) pet.removeEventListener("load", musicLoadListener);
  if (musicErrorListener) pet.removeEventListener("error", musicErrorListener);
  musicLoadListener = null;
  musicErrorListener = null;
}

function currentMusicAnimation() { return MUSIC_ANIMATIONS[musicAnimationIndex]; }
function resetMusicPlaylist() { musicAnimationIndex = 0; musicCyclesPlayed = 0; }

function startMusicCycle() {
  clearMusicCycle();
  function finishCycle() {
    if (currentState !== "music") return;
    if (musicPlaybackState === "playing") {
      musicCyclesPlayed++;
      if (musicCyclesPlayed >= currentMusicAnimation().playCount) {
        musicAnimationIndex = (musicAnimationIndex + 1) % MUSIC_ANIMATIONS.length;
        musicCyclesPlayed = 0;
        setPetState("music", { force: true });
        return;
      }
      musicCycleTimer = window.setTimeout(finishCycle, currentMusicAnimation().durationMs);
    } else {
      suppressHoverUntilLeave = isHovering;
      resetMusicPlaylist();
      setPetState("default", { force: true });
    }
  }
  musicLoadListener = () => {
    musicLoadListener = null;
    musicCycleTimer = window.setTimeout(finishCycle, currentMusicAnimation().durationMs);
  };
  musicErrorListener = () => {
    musicPlaybackState = "unknown";
    setPetState("default", { force: true });
  };
  pet.addEventListener("load", musicLoadListener, { once: true });
  pet.addEventListener("error", musicErrorListener, { once: true });
}

function handleMusicState(state) {
  if (!["playing","paused","idle","blocked","unknown"].includes(state)) return;
  musicPlaybackState = state;
  if ((state === "paused" || state === "blocked" || state === "unknown") && currentState === "music") {
    suppressHoverUntilLeave = isHovering;
    resetMusicPlaylist();
    setPetState("default", { force: true });
  }
  updateMusicAnimation();
}

function updateMusicAnimation() {
  if (startupPlaying || isScheduledAnimationLocked() || isPressing || isDragging || isScaling) return;
  if (musicPlaybackState === "playing" && ["default","mealtime","sleep","sleep2","morningReading","morningDrink","afterWork"].includes(currentState)) {
    resetMusicPlaylist();
    setPetState("music", { force: true });
  }
}

function stopTimedInteraction(restore = true) {
  if (timedInteractionTimer) { window.clearTimeout(timedInteractionTimer); timedInteractionTimer = 0; }
  const wasDisplaying = currentState === timedInteractionEffect;
  timedInteractionPlaying = false;
  timedInteractionEffect = "";
  timedInteractionEntryId = "";
  if (!restore || !wasDisplaying) return;
  suppressHoverUntilLeave = isHovering;
  setPetState("default", { force: true });
}

function pickRandomEffect(list, exclude) {
  if (list.length <= 1) return list[0];
  const choices = list.filter((e) => e !== exclude);
  const pool = choices.length ? choices : list;
  return pool[Math.floor(Math.random() * pool.length)];
}

function scheduleTimedSwitch(list, entryId) {
  if (timedInteractionTimer) { window.clearTimeout(timedInteractionTimer); timedInteractionTimer = 0; }
  if (list.length <= 1) return;
  timedInteractionTimer = window.setTimeout(() => {
    timedInteractionTimer = 0;
    if (!timedInteractionPlaying || timedInteractionEntryId !== entryId) return;
    // Don't yank the GIF away while the user is actively interacting with the pet.
    const blockedByInteraction = isHovering || isPressing || isDragging || isScaling ||
      currentState === "taskComplete" || isScheduledAnimationLocked() ||
      (musicPlaybackState === "playing");
    if (blockedByInteraction) { scheduleTimedSwitch(list, entryId); return; }
    playTimedInteraction({ id: entryId, effects: list });
  }, TIMED_INTERACTION_SWITCH_MS);
}

function playTimedInteraction(entry) {
  const list = (entry.effects && entry.effects.length) ? entry.effects : (entry.effect ? [entry.effect] : []);
  if (list.length === 0) return;
  // Pick a random effect (different from the current one when possible) so multiple
  // GIFs in one timed window cycle through instead of sticking on the first pick.
  const effect = pickRandomEffect(list, timedInteractionEffect);
  setPetState(effect, { force: true });
  timedInteractionPlaying = true;
  timedInteractionEffect = effect;
  timedInteractionEntryId = entry.id || "";
  scheduleTimedSwitch(list, entry.id || "");
}

function stopScheduledAnimation(restore = true) {
  const wasDisplaying = currentState === scheduledEffect;
  if (scheduledErrorListener) pet.removeEventListener("error", scheduledErrorListener);
  scheduledErrorListener = null;
  scheduledPlaying = false;
  scheduledEffect = "";
  scheduledInterruptible = false;
  if (!restore || !wasDisplaying) return;
  suppressHoverUntilLeave = isHovering;
  setPetState("default", { force: true });
  if (taskCompleteAfterScheduled) { taskCompleteAfterScheduled = false; playTaskComplete(); }
}

function playScheduledAnimation(entry, slot, interruptible = false) {
  const list = (entry.effects && entry.effects.length) ? entry.effects : (entry.effect ? [entry.effect] : []);
  if (list.length === 0) return;
  const effect = list[Math.floor(Math.random() * list.length)];
  clearClickEffect();
  hideCloseTip();
  scheduledErrorListener = () => {
    if (currentState !== effect) return;
    failedScheduledSlot = slot;
    stopScheduledAnimation();
  };
  pet.addEventListener("error", scheduledErrorListener);
  setPetState(effect, { force: true });
  scheduledPlaying = true;
  scheduledEffect = effect;
  scheduledInterruptible = interruptible;
}

function isKeyboardEffect(state) { return Object.prototype.hasOwnProperty.call(KEYBOARD_GIF_DURATION_MS, state); }

function clearKeyboardEffect() {
  window.clearTimeout(keyboardTimer);
  keyboardTimer = 0;
  if (keyboardLoadListener) pet.removeEventListener("load", keyboardLoadListener);
  if (keyboardErrorListener) pet.removeEventListener("error", keyboardErrorListener);
  keyboardLoadListener = null;
  keyboardErrorListener = null;
}

function handleKeyboardEffect(action) {
  if (!isKeyboardEffect(action?.effect)) return;
  const { effect, pressed } = action;
  keyboardPressed[effect] = Boolean(pressed);
  if (!pressed || currentState === effect) return;
  if (startupPlaying || isScheduledAnimationLocked() || isDragging || isPressing || isScaling || currentState === "taskComplete") return;
  clearClickEffect();
  clearKeyboardEffect();
  hideCloseTip();
  setPetState(effect, { force: true });
  const finish = () => {
    if (currentState !== effect) return;
    suppressHoverUntilLeave = isHovering;
    setPetState("default", { force: true });
  };
  let completedCycles = 0;
  function finishCycle() {
    if (currentState !== effect) return;
    completedCycles++;
    if (effect === "good" ? completedCycles < GOOD_PLAY_COUNT : effect !== "undo" && keyboardPressed[effect]) {
      keyboardTimer = window.setTimeout(finishCycle, KEYBOARD_GIF_DURATION_MS[effect]);
    } else {
      finish();
    }
  }
  keyboardLoadListener = () => {
    keyboardLoadListener = null;
    keyboardTimer = window.setTimeout(finishCycle, KEYBOARD_GIF_DURATION_MS[effect]);
  };
  keyboardErrorListener = finish;
  pet.addEventListener("load", keyboardLoadListener, { once: true });
  pet.addEventListener("error", keyboardErrorListener, { once: true });
}

function playStartupAnimation() {
  if (startupPlayed) return;
  startupPlayed = true;
  startupPlaying = true;
  let startupTimer = 0;
  const finish = () => {
    window.clearTimeout(startupTimer);
    pet.removeEventListener("load", onLoad);
    pet.removeEventListener("error", finish);
    startupPlaying = false;
    suppressHoverUntilLeave = isHovering;
    setPetState("default", { force: true });
    if (taskCompleteAfterStartup) { taskCompleteAfterStartup = false; playTaskComplete(); }
    if (scheduledAfterStartup) { scheduledAfterStartup = false; updateScheduledAnimations(); }
  };
  const onLoad = () => {
    applyScale(scale);
    startupTimer = window.setTimeout(finish, STARTUP_GIF_DURATION_MS);
  };
  pet.addEventListener("load", onLoad, { once: true });
  pet.addEventListener("error", finish, { once: true });
  setPetState("startup", { force: true });
}

function updateMealtime() {
  if (isMealtime()) {
    if (currentState === "default") { hideCloseTip(); setPetState("mealtime", { force: true }); }
  } else if (currentState === "mealtime") {
    suppressHoverUntilLeave = isHovering;
    timedInteractionPlaying = false;
    setPetState("default", { force: true });
  }
}

function clearScrollEffect() {
  window.clearTimeout(scrollTimer);
  scrollTimer = 0;
  if (scrollLoadListener) { pet.removeEventListener("load", scrollLoadListener); scrollLoadListener = null; }
}

function playScrollEffect() {
  if (startupPlaying || isScheduledAnimationLocked()) return;
  if (isDragging || isPressing || isScaling || currentState === "taskComplete") return;
  lastScrollTime = performance.now();
  if (currentState === "scroll") return;
  clearClickEffect();
  hideCloseTip();
  scrollLoadListener = () => {
    scrollLoadListener = null;
    function finishCycle() {
      if (currentState !== "scroll") return;
      if (performance.now() - lastScrollTime < SCROLL_IDLE_MS) {
        scrollTimer = window.setTimeout(finishCycle, SCROLL_GIF_DURATION_MS);
        return;
      }
      suppressHoverUntilLeave = isHovering;
      setPetState("default", { force: true });
    }
    scrollTimer = window.setTimeout(finishCycle, SCROLL_GIF_DURATION_MS);
  };
  pet.addEventListener("load", scrollLoadListener, { once: true });
  setPetState("scroll", { force: true });
}

function movePetWindow(event) {
  window.linePuppyWindow?.moveTo({ x: event.screenX - dragOffset.x, y: event.screenY - dragOffset.y, petBounds: getPetBoundsInWindow() });
}

function setIgnoreMouseEvents(ignore) {
  if (ignoreMouseEvents === ignore) return;
  ignoreMouseEvents = ignore;
  window.linePuppyWindow?.setIgnoreMouseEvents?.(ignore);
}

function updatePointerPassthrough(event) {
  if (desktopLocked) return;
  if (isDragging || isPressing || isScaling) { setIgnoreMouseEvents(false); return; }
  const x = Number.isFinite(event?.clientX) ? event.clientX : -1;
  const y = Number.isFinite(event?.clientY) ? event.clientY : -1;
  const target = x >= 0 && y >= 0 ? document.elementFromPoint(x, y) : null;
  const interactive = Boolean(target?.closest("#pet-hit-area, #close-tip, #controls"));
  setIgnoreMouseEvents(!interactive);
}

function getPetBoundsInWindow() {
  const bounds = pet.getBoundingClientRect();
  return { left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height };
}

function playTaskComplete() {
  if (isScheduledAnimationLocked()) { taskCompleteAfterScheduled = true; return; }
  if (startupPlaying) { taskCompleteAfterStartup = true; return; }
  window.clearTimeout(taskCompleteTimer);
  hideCloseTip();
  setPetState("taskComplete", { force: true });
  taskCompleteTimer = window.setTimeout(() => { taskCompleteTimer = 0; restoreAfterTransientState(); }, TASK_COMPLETE_GIF_DURATION_MS * TASK_COMPLETE_PLAY_COUNT);
}

function playHeartEffect() {
  if (startupPlaying || isScheduledAnimationLocked()) return;
  clearClickEffect();
  hideCloseTip();
  setPetState("click", { force: true });
  clickTimer = window.setTimeout(() => { clickTimer = 0; if (currentState === "click") setPetState("default", { force: true }); }, HEART_GIF_DURATION_MS);
}

function playJumpEffect() {
  if (startupPlaying || isScheduledAnimationLocked()) return;
  clearClickEffect();
  setPetState("hover", { force: true });
}

function clearClickEffect() { window.clearTimeout(clickTimer); clickTimer = 0; }

function applyScale(nextScale) {
  scale = clamp(nextScale, MIN_SCALE, MAX_SCALE);
  const petWidth = Math.round(BASE_PET_WIDTH * scale);
  const hitAreaWidth = Math.round(BASE_HIT_AREA_WIDTH * scale);
  const hitAreaHeight = Math.round(BASE_HIT_AREA_HEIGHT * scale);
  const ratio = pet.naturalWidth > 0 ? pet.naturalHeight / pet.naturalWidth : 1;
  const petHeight = Math.round(petWidth * ratio);
  pet.style.width = `${petWidth}px`;
  pet.style.height = `${petHeight}px`;
  petShell.style.setProperty("--pet-width", `${petWidth}px`);
  petShell.style.setProperty("--pet-height", `${petHeight}px`);
  hitArea.style.width = `${hitAreaWidth}px`;
  hitArea.style.height = `${hitAreaHeight}px`;
  const nextWindowSize = { width: hitAreaWidth + WINDOW_PADDING_X, height: hitAreaHeight + WINDOW_PADDING_Y };
  if (lastWindowSize.width === nextWindowSize.width && lastWindowSize.height === nextWindowSize.height) return;
  lastWindowSize = nextWindowSize;
  window.linePuppyWindow?.resize(nextWindowSize);
}

function clamp(value, min, max) { return Math.min(Math.max(value, min), max); }

function restoreAfterTransientState() {
  if (currentState === "music") return;
  if (isKeyboardEffect(currentState)) return;
  if (currentState === "scroll") return;
  if (currentState === "taskComplete" && taskCompleteTimer) return;
  if (isDragging) return;
  // Interruptible scheduled animations (e.g., nighttime sleep/mealtime) manage their own lifecycle.
  if (hasInterruptibleScheduledAnimation()) { setPetState("default", { force: true }); return; }
  // When music is still playing, it takes priority over mealtime.
  if (musicPlaybackState === "playing") { setPetState("music", { force: true }); return; }
  // Use real time (new Date()) so timer-based restores stay consistent with app logic,
  // while smoke-test overrides via window.__testDateOverride__ only affect update*() callers.
  const _override = window.__testDateOverride__;
  const _d = _override || new Date();
  const realNow = _d.getHours() * 60 + _d.getMinutes();
  // Always call setPetState — do NOT return early when hasTimedInteraction is true
  // (that flag may be stale when this fires asynchronously after updateMealtime exits the window).
  setPetState(isMealtime(realNow) ? "mealtime" : (isHovering ? "hover" : "default"), { force: true });
}

function enterHover() {
  if (desktopLocked) return;
  if (suppressHoverUntilLeave) { isHovering = true; return; }
  if (isHovering && currentState === "hover" && pet.dataset.current === animations.hover) return;
  isHovering = true;
  if (!isDragging && !isKeyboardEffect(currentState) && currentState !== "click" && currentState !== "taskComplete" && currentState !== "scroll") playJumpEffect();
}

function isPointerInsideHitArea(event) {
  const bounds = hitArea.getBoundingClientRect();
  return event.clientX >= bounds.left && event.clientX <= bounds.right && event.clientY >= bounds.top && event.clientY <= bounds.bottom;
}

function leaveHover(event) {
  if (event && isPointerInsideHitArea(event)) return;
  if (suppressHoverUntilLeave) { suppressHoverUntilLeave = false; }
  if (!isHovering && currentState !== "hover") return;
  isHovering = false;
  hideCloseTip();
  if (!isDragging && currentState !== "taskComplete" && currentState === "hover") setPetState(musicPlaybackState === "playing" ? "music" : "default", { force: true });
}

function updateHoverFromPointer(event) {
  if (desktopLocked) return;
  if (isPointerInsideHitArea(event)) { enterHover(); return; }
  leaveHover(event);
}

function showCloseTip(event) {
  if (!closeTip) return;
  const bounds = hitArea.getBoundingClientRect();
  closeTip.hidden = false;
  const maxLeft = Math.max(0, hitArea.clientWidth - closeTip.offsetWidth);
  const maxTop = Math.max(0, hitArea.clientHeight - closeTip.offsetHeight);
  const left = clamp(event.clientX - bounds.left, 0, maxLeft);
  const top = clamp(event.clientY - bounds.top, 0, maxTop);
  closeTip.style.left = `${left}px`;
  closeTip.style.top = `${top}px`;
}

function hideCloseTip() { if (closeTip) closeTip.hidden = true; }

pet.dataset.current = animations.default;

hitArea.addEventListener("mouseenter", enterHover);
hitArea.addEventListener("mouseleave", leaveHover);
hitArea.addEventListener("pointerover", enterHover);
hitArea.addEventListener("pointerout", leaveHover);
window.addEventListener("mousemove", updateHoverFromPointer);
window.addEventListener("pointermove", updateHoverFromPointer);
window.addEventListener("pointermove", updatePointerPassthrough);
window.addEventListener("pointerdown", updatePointerPassthrough);
window.addEventListener("pointerup", updatePointerPassthrough);

hitArea.addEventListener("mousedown", (event) => {
  if (event.button !== 0) return;
  if (desktopLocked) return;
  isPressing = true;
  isDragging = false;
  suppressNextClick = false;
  dragStart = { x: event.screenX, y: event.screenY };
  dragOffset = { x: event.screenX - window.screenX, y: event.screenY - window.screenY };
  setIgnoreMouseEvents(false);
  window.linePuppyWindow?.startDrag?.();
});

window.addEventListener("mousemove", (event) => {
  if (!isPressing) return;
  if (!isDragging) {
    const distanceX = Math.abs(event.screenX - dragStart.x);
    const distanceY = Math.abs(event.screenY - dragStart.y);
    if (distanceX < DRAG_THRESHOLD_PX && distanceY < DRAG_THRESHOLD_PX) return;
    isDragging = true;
    hideCloseTip();
    clearClickEffect();
    setPetState("drag", { force: true });
  }
  movePetWindow(event);
});

window.addEventListener("mouseup", () => {
  if (!isPressing) return;
  const completedDrag = isDragging;
  isPressing = false;
  isDragging = false;
  window.linePuppyWindow?.endDrag?.();
  if (!completedDrag) return;
  suppressNextClick = true;
  suppressHoverUntilLeave = true;
  isHovering = false;
  setPetState("default", { force: true });
});

hitArea.addEventListener("click", () => {
  if (isDragging || suppressNextClick) { suppressNextClick = false; return; }
  playHeartEffect();
});

hitArea.addEventListener("contextmenu", (event) => {
  event.preventDefault();
  showCloseTip(event);
});

closeTip.addEventListener("click", (event) => { event.stopPropagation(); window.linePuppyWindow?.close(); });

["mousedown","mouseup","dblclick","pointerdown","pointerup","contextmenu"].forEach(name => {
  closeTip.addEventListener(name, event => event.stopPropagation());
});

hitArea.addEventListener("dblclick", (event) => { event.preventDefault(); suppressNextClick = false; });

["mousedown","mouseup","click","dblclick","pointerdown","pointerup"].forEach(name => {
  controls.addEventListener(name, event => event.stopPropagation());
});

scaleHandle.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;
  event.preventDefault();
  const startX = event.screenX;
  const startY = event.screenY;
  const startScale = scale;
  const pointerId = event.pointerId;
  scaleHandle.setPointerCapture(pointerId);
  isScaling = true;
  setIgnoreMouseEvents(false);
  function dragScale(moveEvent) {
    const diagonalDelta = (moveEvent.screenX - startX + moveEvent.screenY - startY) / 2;
    applyScale(startScale + diagonalDelta / BASE_PET_WIDTH);
  }
  function stopDragScale(upEvent) {
    dragScale(upEvent);
    scaleHandle.removeEventListener("pointermove", dragScale);
    scaleHandle.removeEventListener("pointerup", stopDragScale);
    scaleHandle.removeEventListener("pointercancel", stopDragScale);
    if (scaleHandle.hasPointerCapture(pointerId)) scaleHandle.releasePointerCapture(pointerId);
    isScaling = false;
    setPetState("default", { force: true });
  }
  scaleHandle.addEventListener("pointermove", dragScale);
  scaleHandle.addEventListener("pointerup", stopDragScale);
  scaleHandle.addEventListener("pointercancel", stopDragScale);
});

window.linePuppyWindow?.onTaskComplete(() => playTaskComplete());
window.linePuppyWindow?.onScroll?.(playScrollEffect);
window.linePuppyWindow?.onKeyboardEffect?.(handleKeyboardEffect);
window.linePuppyWindow?.onMusicState?.(handleMusicState);
window.linePuppyWindow?.onDesktopLockChange?.(onDesktopLockChange);

// Recheck every second
playStartupAnimation();
updateMealtime();
updateTimedInteractions();
updateScheduledAnimations();
window.setInterval(() => {
  updateMealtime();
  updateTimedInteractions();
  updateScheduledAnimations();
  updateMusicAnimation();
}, 1000);

window.linePuppy = { playTaskComplete, playHeartEffect, playJumpEffect, setScale: applyScale };

applyScale(scale);
