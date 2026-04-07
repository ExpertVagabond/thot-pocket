import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js';
import { StylizedFace } from './face.js';
import { DumbGaze } from './dumb-gaze.js';
import { SmartGaze } from './smart-gaze.js';
import { MediaPipeInput } from './mediapipe-input.js';
import { HUD } from './hud.js';

let dumbFace, smartFace, dumbGaze, smartGaze, mediaPipe, hud;
let dumbRenderer, smartRenderer, dumbScene, smartScene, dumbCamera, smartCamera;
let lastTime = 0;
let introTimer = 0;
let introPhase = 0;

function createPanel(container) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a1a);

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 10);
  camera.position.set(0, 0.1, 3.2);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  container.appendChild(renderer.domElement);

  // Lighting
  const ambient = new THREE.AmbientLight(0xffeedd, 0.5);
  scene.add(ambient);

  const key = new THREE.DirectionalLight(0xfff5e8, 1.2);
  key.position.set(2, 3, 4);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xd4e8ff, 0.3);
  fill.position.set(-2, 1, 2);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xffe0c0, 0.4);
  rim.position.set(0, 2, -3);
  scene.add(rim);

  return { scene, camera, renderer };
}

function resize() {
  const leftContainer = document.getElementById('left-panel');
  const rightContainer = document.getElementById('right-panel');
  const w = leftContainer.clientWidth;
  const h = leftContainer.clientHeight;

  [dumbRenderer, smartRenderer].forEach(r => {
    r.setSize(w, h);
  });
  [dumbCamera, smartCamera].forEach(c => {
    c.aspect = w / h;
    c.updateProjectionMatrix();
  });
}

function applyOutput(face, output) {
  face.setGaze(output.leftX, output.leftY, output.rightX, output.rightY);
  face.setPupilSize(output.pupilDiameter);
  face.setLidOpenness(output.lidOpenness);
  face.setUpperLidOffset(output.upperLidOffset);
}

// 8-second intro sequence
function runIntro(dt) {
  if (introPhase >= 4) return;
  introTimer += dt;

  if (introPhase === 0 && introTimer > 0) {
    smartGaze.setState('listening');
    introPhase = 1;
    showToast('Both avatars are "listening" — notice the difference in eye behavior');
  }
  if (introPhase === 1 && introTimer > 3) {
    smartGaze.setState('thinking');
    document.querySelector('[data-state="thinking"]').click();
    introPhase = 2;
    showToast('Now "thinking" — watch the right avatar avert gaze cognitively');
  }
  if (introPhase === 2 && introTimer > 5.5) {
    smartGaze.setState('speaking');
    document.querySelector('[data-state="speaking"]').click();
    introPhase = 3;
    showToast('Now "speaking" — right avatar returns gaze with natural rhythm');
  }
  if (introPhase === 3 && introTimer > 8) {
    introPhase = 4;
    showToast('Try looking away from your screen — watch the right avatar respond');
  }
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('visible');
  setTimeout(() => toast.classList.remove('visible'), 4000);
}

function animate(time) {
  requestAnimationFrame(animate);
  const dt = lastTime ? (time - lastTime) / 1000 : 1 / 60;
  lastTime = time;
  const clampedDt = Math.min(dt, 0.05);

  // MediaPipe
  if (mediaPipe.simulating) {
    mediaPipe.tickSimulation(clampedDt);
  }
  smartGaze.setMediaPipeZone(mediaPipe.getZone());

  // Intro sequence
  runIntro(clampedDt);

  // Tick controllers
  const dumbOutput = dumbGaze.tick(clampedDt);
  const smartOutput = smartGaze.tick(clampedDt);

  // Apply to faces
  applyOutput(dumbFace, dumbOutput);
  applyOutput(smartFace, smartOutput);

  // HUD
  hud.update(smartOutput, mediaPipe.getZone(), mediaPipe.isActive());

  // Render
  dumbRenderer.render(dumbScene, dumbCamera);
  smartRenderer.render(smartScene, smartCamera);
}

async function init() {
  // Create panels
  const leftPanel = document.getElementById('left-panel');
  const rightPanel = document.getElementById('right-panel');

  const left = createPanel(leftPanel);
  dumbScene = left.scene; dumbCamera = left.camera; dumbRenderer = left.renderer;

  const right = createPanel(rightPanel);
  smartScene = right.scene; smartCamera = right.camera; smartRenderer = right.renderer;

  // Create faces
  dumbFace = new StylizedFace(dumbScene);
  smartFace = new StylizedFace(smartScene);

  // Controllers
  dumbGaze = new DumbGaze();

  // Load WASM
  const wasm = await import('./pkg/thot_pocket_demo.js');
  await wasm.default();
  const engine = new wasm.WasmGazeEngine('western');
  smartGaze = new SmartGaze(engine);
  smartGaze.setState('listening');

  // MediaPipe
  mediaPipe = new MediaPipeInput();
  const videoEl = document.getElementById('webcam');
  await mediaPipe.init(videoEl);

  // HUD
  hud = new HUD(
    (state) => smartGaze.setState(state),
    (culture) => smartGaze.setCulture(culture),
  );

  // Sizing
  resize();
  window.addEventListener('resize', resize);

  // Start
  document.getElementById('loading').style.display = 'none';
  requestAnimationFrame(animate);
}

init().catch(e => {
  console.error('Init failed:', e);
  document.getElementById('loading').textContent = 'Failed to load: ' + e.message;
});
