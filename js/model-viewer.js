/**
 * model-viewer.js — Three.js 3D model viewer with auto-rotate
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let scene, camera, renderer, controls, mixer;
let animationId;

// --- Rotation query params (degrees → radians, default rx=-90) ---
const _params = new URLSearchParams(window.location.search);
const _rx = THREE.MathUtils.degToRad(parseFloat(_params.get('rx') ?? '-90'));
const _ry = THREE.MathUtils.degToRad(parseFloat(_params.get('ry') ?? '0'));
const _rz = THREE.MathUtils.degToRad(parseFloat(_params.get('rz') ?? '0'));

export function initModelViewer() {
  const canvas = document.getElementById('model-canvas');
  const container = document.getElementById('model-container');
  const placeholder = document.getElementById('model-placeholder');

  // Scene
  scene = new THREE.Scene();

  // Soft gradient background
  const bgColor = new THREE.Color(0xFFF5F9);
  scene.background = bgColor;
  scene.fog = new THREE.Fog(bgColor, 8, 20);

  // Camera — initial position, will be refined after model loads
  camera = new THREE.PerspectiveCamera(
    45,
    container.clientWidth / container.clientHeight,
    0.1,
    100
  );
  camera.position.set(0, 1.5, 4);

  // Renderer
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;

  // Lighting — positions are defined in the model's native space aimed
  // at the -Y (bottom) face, which is the visible "front" after rx=-90.
  // They are then rotated by the same Euler so they track any override.
  //
  // Base rig (model-local, illuminating the -Y face):
  //   Key:  below-front-right    (3, -8, 3)   — strong, direct on face
  //   Fill: below-left           (-4, -6, 1)   — lift shadows
  //   Front: directly below      (0, -9, 0)   — even wash on the face
  //   Rim:  above-behind         (0, 6, -4)   — edge separation
  //   Back: above (native +Y)    (0, 8, 2)    — fills the back when orbiting
  //   Top:  native -Z at angle   (3, -2, -8)  — angled wash on the new top edge

  const lightRotation = new THREE.Euler(_rx, _ry, _rz, 'XYZ');
  const rotateVec = (v) => v.applyEuler(lightRotation);

  const ambient = new THREE.AmbientLight(0xffffff, 0.65);
  scene.add(ambient);

  const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
  keyLight.position.copy(rotateVec(new THREE.Vector3(3, -8, 3)));
  keyLight.castShadow = false;
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0xC8A2C8, 0.5);
  fillLight.position.copy(rotateVec(new THREE.Vector3(-4, -6, 1)));
  scene.add(fillLight);

  const frontLight = new THREE.DirectionalLight(0xffffff, 0.45);
  frontLight.position.copy(rotateVec(new THREE.Vector3(0, -9, 0)));
  scene.add(frontLight);

  const rimLight = new THREE.DirectionalLight(0xF4B9C2, 0.3);
  rimLight.position.copy(rotateVec(new THREE.Vector3(0, 6, -4)));
  scene.add(rimLight);

  const backLight = new THREE.DirectionalLight(0xffffff, 0.45);
  backLight.position.copy(rotateVec(new THREE.Vector3(0, 8, 2)));
  scene.add(backLight);

  const topLight = new THREE.DirectionalLight(0xffffff, 0.4);
  topLight.position.copy(rotateVec(new THREE.Vector3(3, -2, -8)));
  scene.add(topLight);

  // Orbit controls — target will be updated after model loads
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 2.0;
  controls.enablePan = false;
  controls.minDistance = 1.5;
  controls.maxDistance = 10;
  controls.target.set(0, 0.8, 0);
  controls.update();

  // Try loading the model
  tryLoadModel(placeholder);

  // Animation loop
  const clock = new THREE.Clock();
  function animate() {
    animationId = requestAnimationFrame(animate);
    const delta = clock.getDelta();
    if (mixer) mixer.update(delta);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  // Resize handler
  function onResize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  window.addEventListener('resize', onResize);
}

/**
 * After a model (or placeholder) has been added to the scene with rotation
 * applied, recompute the world-space bounding box and reposition the camera
 * and orbit target so the object is nicely centred and framed.
 */
function frameCentreObject(obj) {
  // Force world matrix update so Box3 sees the rotation
  obj.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(obj);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());

  // Orbit target → centre of the rotated bounding box
  controls.target.copy(center);

  // Camera distance: back far enough to see the whole thing
  const maxDim = Math.max(size.x, size.y, size.z);
  const fov = camera.fov * (Math.PI / 180);
  let cameraZ = (maxDim / 2) / Math.tan(fov / 2);
  cameraZ *= 1.6; // breathing room

  camera.position.set(center.x, center.y, center.z + cameraZ);
  camera.lookAt(center);
  controls.update();
}

function tryLoadModel(placeholder) {
  // Try common model paths
  const possiblePaths = [
    'assets/model/gift.glb',
    'assets/model/model.glb',
    'assets/model/gift.gltf',
    'assets/model/model.gltf',
  ];

  const loader = new GLTFLoader();

  // Try to find any model file
  let found = false;

  // First do a quick check with fetch, then load the first one found
  async function findAndLoad() {
    for (const path of possiblePaths) {
      try {
        const resp = await fetch(path, { method: 'HEAD' });
        if (resp.ok) {
          loadModel(path);
          found = true;
          return;
        }
      } catch (e) {
        // Continue
      }
    }

    // Also try to list files in assets/model/ by loading a known path pattern
    // If nothing found, show placeholder cube
    if (!found) {
      showPlaceholderCube();
    }
  }

  findAndLoad();
}

function loadModel(path) {
  const loader = new GLTFLoader();
  loader.load(
    path,
    (gltf) => {
      const model = gltf.scene;

      // Scale to fit a 2.5-unit envelope
      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 2.5 / maxDim;
      model.scale.setScalar(scale);

      // Shift model so its centre sits at the local origin
      model.position.sub(center.multiplyScalar(scale));

      // Wrap in a pivot so rotation happens around the centre
      const pivot = new THREE.Group();
      pivot.add(model);
      pivot.rotation.set(_rx, _ry, _rz);

      scene.add(pivot);

      // Reposition camera & orbit target to frame the rotated result
      frameCentreObject(pivot);

      // Play animations if present
      if (gltf.animations && gltf.animations.length > 0) {
        mixer = new THREE.AnimationMixer(model);
        gltf.animations.forEach((clip) => {
          mixer.clipAction(clip).play();
        });
      }
    },
    undefined,
    (error) => {
      console.warn('Error loading model:', error);
      showPlaceholderCube();
    }
  );
}

function showPlaceholderCube() {
  // Show a cute spinning gift box as placeholder
  const group = new THREE.Group();

  // Box body
  const boxGeo = new THREE.BoxGeometry(1.2, 1, 1.2);
  const boxMat = new THREE.MeshStandardMaterial({
    color: 0xF4B9C2,
    roughness: 0.4,
    metalness: 0.1,
  });
  const box = new THREE.Mesh(boxGeo, boxMat);
  box.position.y = 0.5;
  group.add(box);

  // Lid
  const lidGeo = new THREE.BoxGeometry(1.3, 0.2, 1.3);
  const lidMat = new THREE.MeshStandardMaterial({
    color: 0xC8A2C8,
    roughness: 0.4,
    metalness: 0.1,
  });
  const lid = new THREE.Mesh(lidGeo, lidMat);
  lid.position.y = 1.1;
  group.add(lid);

  // Ribbon horizontal
  const ribbonH = new THREE.Mesh(
    new THREE.BoxGeometry(1.22, 1.02, 0.12),
    new THREE.MeshStandardMaterial({ color: 0xF5D6A8, roughness: 0.5 })
  );
  ribbonH.position.y = 0.5;
  group.add(ribbonH);

  // Ribbon vertical
  const ribbonV = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 1.02, 1.22),
    new THREE.MeshStandardMaterial({ color: 0xF5D6A8, roughness: 0.5 })
  );
  ribbonV.position.y = 0.5;
  group.add(ribbonV);

  // Ribbon on lid
  const ribbonLidH = new THREE.Mesh(
    new THREE.BoxGeometry(1.32, 0.22, 0.12),
    new THREE.MeshStandardMaterial({ color: 0xF5D6A8, roughness: 0.5 })
  );
  ribbonLidH.position.y = 1.1;
  group.add(ribbonLidH);

  const ribbonLidV = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.22, 1.32),
    new THREE.MeshStandardMaterial({ color: 0xF5D6A8, roughness: 0.5 })
  );
  ribbonLidV.position.y = 1.1;
  group.add(ribbonLidV);

  // Bow (two spheres)
  const bowMat = new THREE.MeshStandardMaterial({ color: 0xF5D6A8, roughness: 0.3 });
  const bow1 = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), bowMat);
  bow1.position.set(-0.12, 1.35, 0);
  bow1.scale.set(1.3, 0.9, 0.7);
  group.add(bow1);

  const bow2 = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), bowMat);
  bow2.position.set(0.12, 1.35, 0);
  bow2.scale.set(1.3, 0.9, 0.7);
  group.add(bow2);

  const bowCenter = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 12), bowMat);
  bowCenter.position.set(0, 1.32, 0);
  group.add(bowCenter);

  // Centre the group at the origin before rotating
  const groupBox = new THREE.Box3().setFromObject(group);
  const groupCenter = groupBox.getCenter(new THREE.Vector3());
  group.position.sub(groupCenter);

  // Wrap in a pivot for rotation around centre
  const pivot = new THREE.Group();
  pivot.add(group);
  pivot.rotation.set(_rx, _ry, _rz);

  scene.add(pivot);

  // Reposition camera & orbit target
  frameCentreObject(pivot);
}

export function disposeModelViewer() {
  if (animationId) cancelAnimationFrame(animationId);
  if (renderer) renderer.dispose();
}
