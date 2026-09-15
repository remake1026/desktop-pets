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
  love520: "assets/520.gif",
  love521: "assets/521.gif",
  music: "assets/music.gif",
  sleep: "assets/sleepy.gif",
  sleep2: "assets/sleepy2.png",
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
  drag: 4,
  taskComplete: 5,
  startup: 6,
  love520: 6,
  love521: 6,
  sleep: 6,
  sleep2: 6,
};

const TASK_COMPLETE_GIF_DURATION_MS = 2060;
const TASK_COMPLETE_PLAY_COUNT = 2;
const HEART_GIF_DURATION_MS = 1440;
// turn on.gif: 18 frames, including the first and last frame pauses.
const STARTUP_GIF_DURATION_MS = 2900;
// scroll.gif: 18 frames, 80 ms per frame.
const SCROLL_GIF_DURATION_MS = 1440;
const SCROLL_IDLE_MS = 160;
const KEYBOARD_GIF_DURATION_MS = { send: 1740, good: 1000, delete: 1840 };
const GOOD_PLAY_COUNT = 2;
const MUSIC_GIF_DURATION_MS = 1600;
const SCHEDULED_ANIMATIONS = [
  { time: "05:20", effect: "love520" }, // 05:20:00–05:20:59
  { time: "17:20", effect: "love520" }, // 17:20:00–17:20:59
  { time: "05:21", effect: "love521" }, // 05:21:00–05:21:59
  { time: "17:21", effect: "love521" }, // 17:21:00–17:21:59
];
const MEALTIME_WINDOWS = [[9 * 60 + 30, 10 * 60 + 10], [12 * 60, 13 * 60], [20 * 60, 21 * 60]];
const NIGHTTIME_WINDOWS = [
  { start: 23 * 60, end: 24 * 60, effect: "sleep" },
  { start: 0, end: 2 * 60, effect: "sleep2" },
];
const BASE_PET_WIDTH = 180;
const BASE_HIT_AREA_WIDTH = 170;
const BASE_HIT_AREA_HEIGHT = 150;
const WINDOW_PADDING_X = 36;
const WINDOW_PADDING_Y = 56;
const MIN_SCALE = 0.6;
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
const keyboardPressed = { send: false, good: false, delete: false };
let keyboardTimer = 0;
let keyboardLoadListener = null;
let keyboardErrorListener = null;
let keyboardPlaybackId = 0;
let scheduledPlaying = false;
let scheduledPlaybackId = 0;
let scheduledErrorListener = null;
let failedScheduledSlot = "";
let taskCompleteAfterScheduled = false;
let musicPlaybackState = "idle";
let musicCycleTimer = 0;
let musicLoadListener = null;
let musicErrorListener = null;
let musicPlaybackId = 0;

const pet = document.querySelector("#pet");
const petShell = document.querySelector("#pet-shell");
const hitArea = document.querySelector("#pet-hit-area");
const controls = document.querySelector("#controls");
const scaleHandle = document.querySelector("#scale-handle");
const closeTip = document.querySelector("#close-tip");

function setPetState(nextState, options = {}) {
  if (startupPlaying && nextState !== "startup") return;
  if (scheduledPlaying && nextState !== currentState) return;
  if (!animations[nextState]) {
    nextState = "default";
  }

  if (nextState === "default") {
    if (isMealtime()) nextState = "mealtime";
    else if (musicPlaybackState === "playing") nextState = "music";
  }

  if (!options.force && priority[nextState] < priority[currentState]) {
    return;
  }

  const img = document.querySelector("#pet");
  const nextSrc = animations[nextState];

  if (!img) return;

  if (currentState === "scroll" && nextState !== "scroll") clearScrollEffect();
  if (currentState === "music" && nextState !== "music") clearMusicCycle();
  if (isKeyboardEffect(currentState) && nextState !== currentState) clearKeyboardEffect();

  if (img.dataset.current === nextSrc) {
    currentState = nextState;

    return;
  }

  currentState = nextState;
  img.dataset.current = nextSrc;
  if (nextState === "music") startMusicCycle();
  img.src = nextState === "scroll" ? `${nextSrc}?play=${++scrollPlaybackId}`
    : nextState === "music" ? `${nextSrc}?play=${++musicPlaybackId}`
    : isKeyboardEffect(nextState) ? `${nextSrc}?play=${++keyboardPlaybackId}`
    : (nextState === "love520" || nextState === "love521") ? `${nextSrc}?play=${++scheduledPlaybackId}` : nextSrc;
}

function clearMusicCycle() {
  window.clearTimeout(musicCycleTimer);
  musicCycleTimer = 0;
  if (musicLoadListener) pet.removeEventListener("load", musicLoadListener);
  if (musicErrorListener) pet.removeEventListener("error", musicErrorListener);
  musicLoadListener = null;
  musicErrorListener = null;
}

function startMusicCycle() {
  clearMusicCycle();
  function finishCycle() {
    if (currentState !== "music") return;
    if (musicPlaybackState === "playing") {
      musicCycleTimer = window.setTimeout(finishCycle, MUSIC_GIF_DURATION_MS);
    } else {
      suppressHoverUntilLeave = isHovering;
      setPetState("default", { force: true });
    }
  }
  musicLoadListener = () => {
    musicLoadListener = null;
    musicCycleTimer = window.setTimeout(finishCycle, MUSIC_GIF_DURATION_MS);
  };
  musicErrorListener = () => {
    musicPlaybackState = "unknown";
    setPetState("default", { force: true });
  };
  pet.addEventListener("load", musicLoadListener, { once: true });
  pet.addEventListener("error", musicErrorListener, { once: true });
}

function handleMusicState(state) {
  if (!["playing", "paused", "idle", "blocked", "unknown"].includes(state)) return;
  musicPlaybackState = state;

  // Pause, stop, or unsupported output immediately restores the default pet.
  if ((state === "paused" || state === "blocked" || state === "unknown") && currentState === "music") {
    suppressHoverUntilLeave = isHovering;
    setPetState("default", { force: true });
  }
  updateMusicAnimation();
}

function updateMusicAnimation() {
  if (startupPlaying || scheduledPlaying || isPressing || isDragging || isScaling) return;
  if (musicPlaybackState === "playing" && ["default", "hover"].includes(currentState)) {
    setPetState("default", { force: true });
  }
}

function updateScheduledAnimations(date = new Date()) {
  const day = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  const time = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  const minute = date.getHours() * 60 + date.getMinutes();
  const nightAnimation = NIGHTTIME_WINDOWS.find(item => minute >= item.start && minute < item.end);
  const animation = nightAnimation || SCHEDULED_ANIMATIONS.find(item => item.time === time);
  if (!animation) {
    if (scheduledPlaying) stopScheduledAnimation();
    return;
  }
  const slot = `${day} ${nightAnimation ? nightAnimation.effect : time}`;
  if (failedScheduledSlot === slot || (scheduledPlaying && currentState === animation.effect)) return;
  if (startupPlaying || isDragging || isPressing || isScaling || currentState === "taskComplete") return;
  if (scheduledPlaying) stopScheduledAnimation(false);
  playScheduledAnimation(animation, slot);
}

function stopScheduledAnimation(restore = true) {
  if (scheduledErrorListener) pet.removeEventListener("error", scheduledErrorListener);
  scheduledErrorListener = null;
  scheduledPlaying = false;
  if (!restore) return;
  suppressHoverUntilLeave = isHovering;
  setPetState("default", { force: true });
  if (taskCompleteAfterScheduled) {
    taskCompleteAfterScheduled = false;
    playTaskComplete();
  }
}

function playScheduledAnimation({ effect }, slot) {
  clearClickEffect();
  hideCloseTip();
  scheduledErrorListener = () => {
    failedScheduledSlot = slot;
    stopScheduledAnimation();
  };
  pet.addEventListener("error", scheduledErrorListener, { once: true });
  // Keep the asset displayed until its wall-clock window ends; GIFs loop natively.
  setPetState(effect, { force: true });
  scheduledPlaying = true;
}

function isKeyboardEffect(state) {
  return state === "send" || state === "good" || state === "delete";
}

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
  // Key release and auto-repeat never reset the animation or cut a cycle short.
  if (!pressed || currentState === effect) return;
  if (startupPlaying || scheduledPlaying || isDragging || isPressing || isScaling || currentState === "taskComplete") return;
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
    if (effect === "good" ? completedCycles < GOOD_PLAY_COUNT : keyboardPressed[effect]) {
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
    if (taskCompleteAfterStartup) {
      taskCompleteAfterStartup = false;
      playTaskComplete();
    }
  };
  const onLoad = () => {
    applyScale(scale);
    startupTimer = window.setTimeout(finish, STARTUP_GIF_DURATION_MS);
  };
  pet.addEventListener("load", onLoad, { once: true });
  pet.addEventListener("error", finish, { once: true });
  setPetState("startup", { force: true });
}

function isMealtime(date = new Date()) {
  const minute = date.getHours() * 60 + date.getMinutes();
  return MEALTIME_WINDOWS.some(([start, end]) => minute >= start && minute < end);
}

function updateMealtime() {
  if (isMealtime()) {
    if (currentState === "default" || currentState === "hover" || currentState === "music") {
      hideCloseTip();
      setPetState("mealtime", { force: true });
    }
  } else if (currentState === "mealtime") {
    suppressHoverUntilLeave = isHovering;
    setPetState("default", { force: true });
  }
}

function clearScrollEffect() {
  window.clearTimeout(scrollTimer);
  scrollTimer = 0;
  if (scrollLoadListener) {
    pet.removeEventListener("load", scrollLoadListener);
    scrollLoadListener = null;
  }
}

function playScrollEffect() {
  if (startupPlaying || scheduledPlaying) return;
  if (isDragging || isPressing || isScaling || currentState === "taskComplete") return;
  lastScrollTime = performance.now();
  // More wheel events extend playback without restarting the GIF mid-cycle.
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
  window.linePuppyWindow?.moveTo({
    x: event.screenX - dragOffset.x,
    y: event.screenY - dragOffset.y,
    petBounds: getPetBoundsInWindow(),
  });
}

function setIgnoreMouseEvents(ignore) {
  if (ignoreMouseEvents === ignore) {
    return;
  }

  ignoreMouseEvents = ignore;
  window.linePuppyWindow?.setIgnoreMouseEvents?.(ignore);
}

function updatePointerPassthrough(event) {
  if (isDragging || isPressing || isScaling) {
    setIgnoreMouseEvents(false);
    return;
  }

  const x = Number.isFinite(event?.clientX) ? event.clientX : -1;
  const y = Number.isFinite(event?.clientY) ? event.clientY : -1;
  const target = x >= 0 && y >= 0 ? document.elementFromPoint(x, y) : null;
  const interactive = Boolean(target?.closest("#pet-hit-area, #close-tip, #controls"));
  setIgnoreMouseEvents(!interactive);
}

function getPetBoundsInWindow() {
  const bounds = pet.getBoundingClientRect();

  return {
    left: bounds.left,
    top: bounds.top,
    width: bounds.width,
    height: bounds.height,
  };
}

function playTaskComplete() {
  if (scheduledPlaying) {
    taskCompleteAfterScheduled = true;
    return;
  }
  if (startupPlaying) {
    taskCompleteAfterStartup = true;
    return;
  }
  window.clearTimeout(taskCompleteTimer);
  hideCloseTip();
  setPetState("taskComplete", { force: true });

  taskCompleteTimer = window.setTimeout(() => {
    taskCompleteTimer = 0;
    restoreAfterTransientState();
  }, TASK_COMPLETE_GIF_DURATION_MS * TASK_COMPLETE_PLAY_COUNT);
}

function playHeartEffect() {
  if (startupPlaying || scheduledPlaying) return;
  clearClickEffect();
  hideCloseTip();
  setPetState("click", { force: true });

  clickTimer = window.setTimeout(() => {
    clickTimer = 0;
    if (currentState === "click") {
      setPetState("default", { force: true });
    }
  }, HEART_GIF_DURATION_MS);
}

function playJumpEffect() {
  if (startupPlaying || scheduledPlaying) return;
  clearClickEffect();
  setPetState("hover", { force: true });
}

function clearClickEffect() {
  window.clearTimeout(clickTimer);
  clickTimer = 0;
}

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

  const nextWindowSize = {
    width: hitAreaWidth + WINDOW_PADDING_X,
    height: hitAreaHeight + WINDOW_PADDING_Y,
  };

  if (lastWindowSize.width === nextWindowSize.width && lastWindowSize.height === nextWindowSize.height) {
    return;
  }

  lastWindowSize = nextWindowSize;
  window.linePuppyWindow?.resize(nextWindowSize);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function restoreAfterTransientState() {
  if (currentState === "music") return;
  if (isKeyboardEffect(currentState)) return;
  if (currentState === "scroll") return;
  if (currentState === "taskComplete" && taskCompleteTimer) {
    return;
  }

  if (isDragging) {
    return;
  }

  setPetState(isMealtime() ? "mealtime" : (musicPlaybackState === "playing" ? "music" : (isHovering ? "hover" : "default")), { force: true });
}

function enterHover() {
  if (suppressHoverUntilLeave) {
    isHovering = true;
    return;
  }

  if (isHovering && currentState === "hover" && pet.dataset.current === animations.hover) {
    return;
  }

  isHovering = true;

  if (!isDragging && !isMealtime() && !isKeyboardEffect(currentState) && currentState !== "music" && currentState !== "click" && currentState !== "taskComplete" && currentState !== "scroll") {
    playJumpEffect();
  }
}

function isPointerInsideHitArea(event) {
  const bounds = hitArea.getBoundingClientRect();

  return (
    event.clientX >= bounds.left &&
    event.clientX <= bounds.right &&
    event.clientY >= bounds.top &&
    event.clientY <= bounds.bottom
  );
}

function leaveHover(event) {
  if (event && isPointerInsideHitArea(event)) {
    return;
  }

  if (suppressHoverUntilLeave) {
    suppressHoverUntilLeave = false;
  }

  if (!isHovering && currentState !== "hover") {
    return;
  }

  isHovering = false;
  hideCloseTip();

  if (!isDragging && currentState !== "taskComplete" && currentState === "hover") {
    setPetState("default", { force: true });
  }
}

function updateHoverFromPointer(event) {
  if (isPointerInsideHitArea(event)) {
    enterHover();
    return;
  }

  leaveHover(event);
}

function showCloseTip(event) {
  if (!closeTip) {
    return;
  }

  const bounds = hitArea.getBoundingClientRect();
  closeTip.hidden = false;

  const maxLeft = Math.max(0, hitArea.clientWidth - closeTip.offsetWidth);
  const maxTop = Math.max(0, hitArea.clientHeight - closeTip.offsetHeight);
  const left = clamp(event.clientX - bounds.left, 0, maxLeft);
  const top = clamp(event.clientY - bounds.top, 0, maxTop);

  closeTip.style.left = `${left}px`;
  closeTip.style.top = `${top}px`;
}

function hideCloseTip() {
  if (closeTip) {
    closeTip.hidden = true;
  }
}

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

  isPressing = true;
  isDragging = false;
  suppressNextClick = false;
  dragStart = {
    x: event.screenX,
    y: event.screenY,
  };
  dragOffset = {
    x: event.screenX - window.screenX,
    y: event.screenY - window.screenY,
  };
  setIgnoreMouseEvents(false);
  window.linePuppyWindow?.startDrag?.();
});

window.addEventListener("mousemove", (event) => {
  if (!isPressing) return;

  if (!isDragging) {
    const distanceX = Math.abs(event.screenX - dragStart.x);
    const distanceY = Math.abs(event.screenY - dragStart.y);

    if (distanceX < DRAG_THRESHOLD_PX && distanceY < DRAG_THRESHOLD_PX) {
      return;
    }

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
  if (isDragging || suppressNextClick) {
    suppressNextClick = false;
    return;
  }

  playHeartEffect();
});

hitArea.addEventListener("contextmenu", (event) => {
  event.preventDefault();
  showCloseTip(event);
});

closeTip.addEventListener("click", (event) => {
  event.stopPropagation();
  window.linePuppyWindow?.close();
});

["mousedown", "mouseup", "click", "dblclick", "pointerdown", "pointerup", "contextmenu"].forEach((eventName) => {
  closeTip.addEventListener(eventName, (event) => {
    event.stopPropagation();
  });
});

hitArea.addEventListener("dblclick", (event) => {
  event.preventDefault();
  suppressNextClick = false;
});

["mousedown", "mouseup", "click", "dblclick", "pointerdown", "pointerup"].forEach((eventName) => {
  controls.addEventListener(eventName, (event) => {
    event.stopPropagation();
  });
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

    if (scaleHandle.hasPointerCapture(pointerId)) {
      scaleHandle.releasePointerCapture(pointerId);
    }

    isScaling = false;
    setPetState("default", { force: true });
  }

  scaleHandle.addEventListener("pointermove", dragScale);
  scaleHandle.addEventListener("pointerup", stopDragScale);
  scaleHandle.addEventListener("pointercancel", stopDragScale);
});

window.linePuppyWindow?.onTaskComplete(() => {
  playTaskComplete();
});

window.linePuppyWindow?.onScroll?.(playScrollEffect);
window.linePuppyWindow?.onKeyboardEffect?.(handleKeyboardEffect);
window.linePuppyWindow?.onMusicState?.(handleMusicState);

// Recheck wall-clock time so startup, sleep/resume, and clock changes are handled.
playStartupAnimation();
updateMealtime();
updateScheduledAnimations();
window.setInterval(() => {
  updateMealtime();
  updateScheduledAnimations();
  updateMusicAnimation();
}, 1000);

window.linePuppy = {
  playTaskComplete,
  playHeartEffect,
  playJumpEffect,
  setScale: applyScale,
};

applyScale(scale);
