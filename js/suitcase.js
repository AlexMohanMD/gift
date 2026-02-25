/**
 * suitcase.js — Multi-step suitcase story with slide transitions + Leaflet map
 */

// Edinburgh & Venice coordinates
const EDINBURGH = [55.9533, -3.1883];
const VENICE = [45.4408, 12.3155];

// Route waypoints (rough path via London, Paris, Alps)
const ROUTE = [
  [55.9533, -3.1883],  // Edinburgh
  [54.9783, -1.6178],  // Newcastle
  [53.4808, -2.2426],  // Manchester
  [52.4862, -1.8904],  // Birmingham
  [51.5074, -0.1278],  // London
  [50.8225, -0.1372],  // Brighton coast
  [49.4431,  2.0833],  // Amiens
  [48.8566,  2.3522],  // Paris
  [47.3220,  5.0415],  // Dijon
  [46.2044,  6.1432],  // Geneva
  [45.8656,  6.9889],  // Chamonix
  [45.4642,  9.1900],  // Milan
  [45.4408, 12.3155],  // Venice
];

let map = null;
let routeLine = null;
let mapInitialised = false;

/**
 * Create the Leaflet map and animate the route.
 * Called the first time step 2 becomes active.
 */
function initMap() {
  if (mapInitialised) return;
  mapInitialised = true;

  // Tiny delay so the container has dimensions
  requestAnimationFrame(() => {
    const container = document.getElementById('journey-map');
    if (!container) return;

    map = L.map(container, {
      zoomControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      touchZoom: false,
      boxZoom: false,
      keyboard: false,
      attributionControl: true,
    });

    // Pastel-friendly light tile style (Carto Voyager)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map);

    // Fit bounds to show both cities with padding
    const bounds = L.latLngBounds([EDINBURGH, VENICE]);
    map.fitBounds(bounds, { padding: [40, 40] });

    // Edinburgh marker — lavender
    const ediIcon = L.divIcon({
      className: '',
      html: '<div style="width:18px;height:18px;border-radius:50%;background:#C8A2C8;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>',
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });

    // Venice marker — pink
    const vceIcon = L.divIcon({
      className: '',
      html: '<div style="width:18px;height:18px;border-radius:50%;background:#F4B9C2;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>',
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });

    L.marker(EDINBURGH, { icon: ediIcon })
      .addTo(map)
      .bindTooltip('Edinburgh', {
        permanent: true,
        direction: 'top',
        offset: [0, -10],
        className: 'city-tooltip',
      });

    L.marker(VENICE, { icon: vceIcon })
      .addTo(map)
      .bindTooltip('Venice', {
        permanent: true,
        direction: 'bottom',
        offset: [0, 10],
        className: 'city-tooltip',
      });

    // Draw the route line — solid stroke, animated via CSS
    routeLine = L.polyline(ROUTE, {
      color: '#C8A2C8',
      weight: 4,
      opacity: 0.9,
      lineCap: 'round',
      lineJoin: 'round',
      className: 'route-line',
    }).addTo(map);

    // Trigger the draw animation after a brief pause
    setTimeout(() => {
      const pathEl = container.querySelector('.route-line');
      if (pathEl) {
        const length = pathEl.getTotalLength();
        // Set the CSS custom property so the keyframes know the real length
        pathEl.style.setProperty('--route-len', length);
        pathEl.style.strokeDasharray = length;
        pathEl.style.strokeDashoffset = length;
        // Force reflow then trigger the animation class
        pathEl.getBoundingClientRect();
        pathEl.classList.add('animate');
      }
    }, 400);

    // Add a crossed-out suitcase icon midway after the line finishes
    setTimeout(() => {
      const midIdx = Math.floor(ROUTE.length / 2);
      const midPoint = ROUTE[midIdx];
      const crossIcon = L.divIcon({
        className: '',
        html: `<div style="position:relative;font-size:22px;line-height:1;">
          &#x1F9F3;
          <span style="position:absolute;top:-2px;left:-2px;font-size:28px;color:#E74C3C;font-weight:bold;pointer-events:none;">&#x2715;</span>
        </div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });
      L.marker(midPoint, { icon: crossIcon, interactive: false }).addTo(map);
    }, 3000);
  });
}

/**
 * Initialise the suitcase story section.
 * @param {number} [startAt=0] — step index to start at (for testing via ?screen=suitcase&step=2)
 */
export function initSuitcase(startAt = 0) {
  const viewport = document.getElementById('suitcase-viewport');
  const steps = viewport.querySelectorAll('.suitcase-step');
  const dots = document.querySelectorAll('#step-dots .step-dot');
  const tapHint = document.getElementById('tap-hint');
  const totalSteps = steps.length;
  let currentStep = Math.min(Math.max(startAt, 0), totalSteps - 1);
  let transitioning = false;

  function showStep(index, animate = true) {
    if (animate && transitioning) return;
    if (animate) transitioning = true;

    steps.forEach((step, i) => {
      if (i === index) {
        step.classList.remove('exited');
        if (animate) {
          // Force reflow so the browser picks up the starting translateX(60px)
          step.getBoundingClientRect();
        }
        step.classList.add('active');
      } else if (i < index) {
        // Already-passed steps sit in the exited (left) position
        step.classList.remove('active');
        step.classList.add('exited');
      } else {
        // Future steps: default position (right)
        step.classList.remove('active', 'exited');
      }
    });

    // Update dots
    dots.forEach((dot, i) => {
      dot.classList.toggle('active', i === index);
    });

    // Hide tap hint on last step
    tapHint.style.display = index >= totalSteps - 1 ? 'none' : '';

    // If this is the map step, initialise Leaflet
    if (index === 2) {
      initMap();
    }

    if (animate) {
      setTimeout(() => { transitioning = false; }, 580);
    }
  }

  // Jump to the starting step without animation
  showStep(currentStep, false);

  // Tap/click on the suitcase screen to advance
  const screen = document.getElementById('screen-suitcase');
  screen.addEventListener('click', (e) => {
    if (e.target.closest('#btn-show-gift')) return;
    if (currentStep >= totalSteps - 1) return;
    currentStep++;
    showStep(currentStep, true);
  });
}
