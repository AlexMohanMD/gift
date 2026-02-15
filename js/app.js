/**
 * app.js — Main flow controller
 * Manages screen transitions and wires up all modules.
 *
 * Query params for testing:
 *   ?screen=progress   — default, full flow from the start
 *   ?screen=error      — jump straight to the 404 screen
 *   ?screen=suitcase   — jump to the suitcase story
 *   ?screen=suitcase&step=2  — jump to a specific suitcase step (0-3)
 *   ?screen=video      — jump to the video screen
 *   ?screen=model      — jump to the 3D model screen
 *
 * Model rotation (degrees, applied before auto-spin):
 *   ?rx=-90            — default; shows the correct face
 *   ?rx=0              — override back to the model's native orientation
 *   ?ry=45             — rotate model 45° around Y axis
 *   ?rz=0              — rotate model 0° around Z axis
 *   Combine: ?screen=model&rx=-90&ry=45
 */

import { runProgress } from './progress.js';
import { initSuitcase } from './suitcase.js';
import { initVideo } from './video.js';
import { initModelViewer } from './model-viewer.js';

// --- Parse query params ---
const params = new URLSearchParams(window.location.search);
const skipTo = params.get('screen');
const suitcaseStep = params.get('step');

// --- Screen management ---
const screens = {
  progress: document.getElementById('screen-progress'),
  error: document.getElementById('screen-error'),
  suitcase: document.getElementById('screen-suitcase'),
  video: document.getElementById('screen-video'),
  model: document.getElementById('screen-model'),
};

function showScreen(name) {
  Object.entries(screens).forEach(([key, el]) => {
    if (key === name) {
      el.classList.add('active');
    } else {
      el.classList.remove('active');
    }
  });
}

// --- Flow ---
async function startFlow() {
  // SCREEN 1: Progress bars
  showScreen('progress');
  await runProgress();

  // SCREEN 2: 404 Error — with flash + shake
  showScreen('error');
  const errorScreen = screens.error;
  errorScreen.classList.add('flash');
  setTimeout(() => {
    errorScreen.classList.remove('flash');
    errorScreen.classList.add('shake');
    setTimeout(() => errorScreen.classList.remove('shake'), 500);
  }, 600);
}

/** Jump directly to a screen, initialising whatever it needs. */
function jumpTo(name) {
  showScreen(name);

  switch (name) {
    case 'error':
      // Show error screen without animation
      break;
    case 'suitcase':
      initSuitcase(suitcaseStep !== null ? parseInt(suitcaseStep, 10) : 0);
      break;
    case 'video':
      initVideo();
      break;
    case 'model':
      initModelViewer();
      break;
    default:
      // Fall through to normal flow
      startFlow();
      break;
  }
}

// --- Event wiring ---
function init() {
  // "Next Steps" button on error screen → suitcase story
  document.getElementById('btn-next-steps').addEventListener('click', () => {
    showScreen('suitcase');
    initSuitcase();
  });

  // "Show Me" button on last suitcase step → video
  document.getElementById('btn-show-video').addEventListener('click', (e) => {
    e.stopPropagation();
    showScreen('video');
    initVideo();
  });

  // "See Your Gift" button after video → 3D model
  document.getElementById('btn-video-continue').addEventListener('click', () => {
    showScreen('model');
    initModelViewer();
  });

  // Kick off — either skip to a screen or run the full flow
  if (skipTo && screens[skipTo]) {
    jumpTo(skipTo);
  } else {
    startFlow();
  }
}

// Go
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
