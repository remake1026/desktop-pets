const animations = {
  default: "assets/sleep.gif",
  hover: "assets/jump.gif",
  click: "assets/heart.gif",
  drag: "assets/special.gif",
  taskComplete: "assets/usageOver3Hours.gif",
};

const priority = {
  default: 0,
  hover: 1,
  click: 2,
  drag: 3,
  taskComplete: 4,
};

const TASK_COMPLETE_GIF_DURATION_MS = 2060;
const TASK_COMPLETE_PLAY_COUNT = 2;
const HEART_GIF_DURATION_MS = 1440;
const BASE_PET_WIDTH = 180;
const BASE_HIT_AREA_WIDTH = 170;
const BASE_HIT_AREA_HEIGHT = 150;
const WINDOW_PADDING_X = 36;
const WINDOW_PADDING_Y = 56;
const MIN_SCALE = 0.6;
const MAX_SCALE = 2;
const DRAG_THRESHOLD_PX = 4;
const SCALE_HANDLE_HIDE_DELAY_MS = 2500;
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

const pet = document.querySelector("#pet");
const petShell = document.querySelector("#pet-shell");
const hitArea = document.querySelector("#pet-hit-area");
const controls = document.querySelector("#controls");
const scaleHandle = document.querySelector("#scale-handle");
const closeTip = document.querySelector("#close-tip");

function setPetState(nextState, options = {}) {
  if (!animations[nextState]) {
    nextState = "default";
  }

  if (!options.force && priority[nextState] < priority[currentState]) {
    return;
  }

  const img = document.querySelector("#pet");
  const nextSrc = animations[nextState];

  if (!img) return;

  if (img.dataset.current === nextSrc) {
    currentState = nextState;

    return;
  }

  currentState = nextState;
  img.dataset.current = nextSrc;
  img.src = nextSrc;
}

function movePetWindow(event) {
  window.nuphyPetWindow?.moveTo({
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
  window.nuphyPetWindow?.setIgnoreMouseEvents?.(ignore);
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
  window.clearTimeout(taskCompleteTimer);
  hideCloseTip();
  setPetState("taskComplete", { force: true });

  taskCompleteTimer = window.setTimeout(() => {
    taskCompleteTimer = 0;
    restoreAfterTransientState();
  }, TASK_COMPLETE_GIF_DURATION_MS * TASK_COMPLETE_PLAY_COUNT);
}

function playHeartEffect() {
  clearClickEffect();
  clearLegacyClickEffects();
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
  clearClickEffect();
  clearLegacyClickEffects();
  setPetState("hover", { force: true });
}

function clearClickEffect() {
  window.clearTimeout(clickTimer);
  clickTimer = 0;
}

function clearLegacyClickEffects() {
  document
    .querySelectorAll("#heart-layer, .heart, .heart-effect, .particle, .click-effect, .love-effect, [data-click-effect]")
    .forEach((node) => node.remove());
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
  window.nuphyPetWindow?.resize(nextWindowSize);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function restoreAfterTransientState() {
  if (currentState === "taskComplete" && taskCompleteTimer) {
    return;
  }

  if (isDragging) {
    return;
  }

  setPetState(isHovering ? "hover" : "default", { force: true });
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

  if (!isDragging && currentState !== "click" && currentState !== "taskComplete") {
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
  window.nuphyPetWindow?.startDrag?.();
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
    clearLegacyClickEffects();
    setPetState("drag", { force: true });
  }

  movePetWindow(event);
});

window.addEventListener("mouseup", () => {
  if (!isPressing) return;

  const completedDrag = isDragging;
  isPressing = false;
  isDragging = false;
  window.nuphyPetWindow?.endDrag?.();

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
  window.nuphyPetWindow?.close();
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

window.nuphyPetWindow?.onTaskComplete(() => {
  playTaskComplete();
});

window.NUPHYPet = {
  playTaskComplete,
  playHeartEffect,
  playJumpEffect,
  setScale: applyScale,
};

applyScale(scale);
