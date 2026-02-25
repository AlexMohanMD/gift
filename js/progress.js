/**
 * progress.js — Fake loading/authentication progress bars
 */

const STEPS = [
  { label: 'Authenticating',                colour: 'lavender', duration: 2200 },
  { label: 'Locating gift',                 colour: 'pink',     duration: 2800 },
  { label: 'Cross-referencing list of gift ideas', colour: 'mint',   duration: 2000 },
  { label: 'Verifying recipient',           colour: 'coral',    duration: 1800 },
  { label: 'Finalising',                    colour: 'gold',     duration: 3000, failAt: 87 },
];

function createProgressItem(step) {
  const item = document.createElement('div');
  item.className = 'progress-item';
  item.innerHTML = `
    <div class="progress-label">
      <span class="label-text">${step.label}&hellip;</span>
      <span class="status"></span>
    </div>
    <div class="progress-track">
      <div class="progress-fill ${step.colour}"></div>
    </div>
  `;
  return item;
}

function animateFill(fill, target, duration) {
  return new Promise((resolve) => {
    const start = performance.now();
    const startWidth = parseFloat(fill.style.width) || 0;
    const delta = target - startWidth;

    function frame(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-in-out quad
      const eased = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      fill.style.width = (startWidth + delta * eased) + '%';
      if (progress < 1) {
        requestAnimationFrame(frame);
      } else {
        resolve();
      }
    }
    requestAnimationFrame(frame);
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Run the full progress sequence.
 * Returns a promise that resolves when the sequence completes (including the failure).
 */
export async function runProgress() {
  const list = document.getElementById('progress-list');
  list.innerHTML = '';

  for (let i = 0; i < STEPS.length; i++) {
    const step = STEPS[i];
    const item = createProgressItem(step);
    list.appendChild(item);

    // Small delay before showing the item
    await sleep(300);
    item.classList.add('visible');
    await sleep(200);

    const fill = item.querySelector('.progress-fill');
    const status = item.querySelector('.status');

    if (step.failAt) {
      // Animate to the fail point, then pause and fail
      await animateFill(fill, step.failAt, step.duration * (step.failAt / 100));
      status.textContent = `${step.failAt}%`;
      await sleep(800);

      // Stutter a little
      await animateFill(fill, step.failAt + 1, 400);
      status.textContent = `${step.failAt + 1}%`;
      await sleep(600);

      // Drop back and fail
      await animateFill(fill, step.failAt - 2, 200);
      status.textContent = 'FAILED';
      status.classList.add('fail');
      fill.style.background = 'linear-gradient(90deg, var(--error-red), #E57373)';
      await sleep(1200);
    } else {
      // Normal completion
      await animateFill(fill, 100, step.duration);
      status.textContent = '';
      status.classList.add('done');
      status.innerHTML = '<svg class="tick-icon show" viewBox="0 0 24 24" fill="none" stroke="#A8E6CF" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
      await sleep(400);
    }
  }

  // Brief pause before transitioning
  await sleep(600);
}
