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
let totalTime = 0;
let micActive = false;
let micAnalyser = null;
let micDataArray = null;

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
  const w = leftContainer.clientWidth;
  const h = leftContainer.clientHeight;

  [dumbRenderer, smartRenderer].forEach(r => r.setSize(w, h));
  [dumbCamera, smartCamera].forEach(c => {
    c.aspect = w / h;
    c.updateProjectionMatrix();
  });
}

function applyOutput(face, output, headYaw, headPitch) {
  face.setGaze(output.leftX, output.leftY, output.rightX, output.rightY);
  face.setPupilSize(output.pupilDiameter);
  face.setLidOpenness(output.lidOpenness);
  face.setUpperLidOffset(output.upperLidOffset);
  if (face.group) {
    face.group.rotation.y = headYaw;
    face.group.rotation.x = headPitch;
  }
}

// Idle head sway — subtle breathing motion that showcases VOR
function getHeadSway(t) {
  const yaw = Math.sin(t * 0.4) * 0.03 + Math.sin(t * 0.17) * 0.015;
  const pitch = Math.sin(t * 0.3 + 1.0) * 0.012 + Math.sin(t * 0.7) * 0.006;
  return { yaw, pitch };
}

// Annotation callouts during intro
function showAnnotation(panel, text, duration) {
  const container = document.getElementById(panel);
  let ann = container.querySelector('.annotation');
  if (!ann) {
    ann = document.createElement('div');
    ann.className = 'annotation';
    container.appendChild(ann);
  }
  ann.textContent = text;
  ann.classList.add('visible');
  setTimeout(() => ann.classList.remove('visible'), duration || 3000);
}

function runIntro(dt) {
  if (introPhase >= 5) return;
  introTimer += dt;

  if (introPhase === 0 && introTimer > 0.1) {
    smartGaze.setState('listening');
    introPhase = 1;
    showToast('Both avatars are "listening" — notice the difference');
    showAnnotation('left-panel', 'Locked stare. No micro-saccades.', 2800);
    showAnnotation('right-panel', 'Triangle scan active. Micro-saccades.', 2800);
  }
  if (introPhase === 1 && introTimer > 3) {
    smartGaze.setState('thinking');
    document.querySelector('[data-state="thinking"]')?.click();
    introPhase = 2;
    showToast('"Thinking" — watch the right avatar avert gaze cognitively');
    showAnnotation('left-panel', 'Still staring. No cognitive signal.', 2200);
    showAnnotation('right-panel', 'Looks up-right: constructing a response.', 2200);
  }
  if (introPhase === 2 && introTimer > 5.5) {
    smartGaze.setState('speaking');
    document.querySelector('[data-state="speaking"]')?.click();
    introPhase = 3;
    showToast('"Speaking" — right avatar returns gaze with natural rhythm');
    showAnnotation('left-panel', 'Fixed pupils. Metronome blinks.', 2500);
    showAnnotation('right-panel', 'Pupils dilate. Blinks at phrase boundaries.', 2500);
  }
  if (introPhase === 3 && introTimer > 8) {
    introPhase = 4;
    showToast('Try looking away from your screen — the right avatar responds');
  }
  if (introPhase === 4 && introTimer > 12) {
    introPhase = 5;
    showToast('Use the mic button for auto state switching from your voice');
  }
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('visible');
  setTimeout(() => toast.classList.remove('visible'), 3500);
}

// Audio-reactive: mic drives state transitions
function getMicLevel() {
  if (!micAnalyser || !micDataArray) return 0;
  micAnalyser.getByteFrequencyData(micDataArray);
  let sum = 0;
  for (let i = 0; i < micDataArray.length; i++) sum += micDataArray[i];
  return sum / micDataArray.length / 255;
}

let micSilenceTimer = 0;
let micLastState = 'idle';

function updateMicState(dt) {
  if (!micActive) return;
  const level = getMicLevel();

  if (level > 0.08) {
    // User is speaking → avatar listens
    micSilenceTimer = 0;
    if (micLastState !== 'listening') {
      smartGaze.setState('listening');
      document.querySelector('[data-state="listening"]')?.click();
      micLastState = 'listening';
    }
  } else {
    micSilenceTimer += dt;
    if (micSilenceTimer > 0.5 && micSilenceTimer < 1.5 && micLastState !== 'thinking') {
      // Brief pause → thinking
      smartGaze.setState('thinking');
      document.querySelector('[data-state="thinking"]')?.click();
      micLastState = 'thinking';
    } else if (micSilenceTimer >= 1.5 && micSilenceTimer < 5 && micLastState !== 'speaking') {
      // Longer pause → avatar speaks
      smartGaze.setState('speaking');
      document.querySelector('[data-state="speaking"]')?.click();
      micLastState = 'speaking';
    } else if (micSilenceTimer >= 5 && micLastState !== 'idle') {
      smartGaze.setState('idle');
      document.querySelector('[data-state="idle"]')?.click();
      micLastState = 'idle';
    }
  }
}

async function toggleMic() {
  const btn = document.getElementById('mic-btn');
  if (micActive) {
    micActive = false;
    btn.classList.remove('active');
    btn.textContent = 'Mic: Off';
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const audioCtx = new AudioContext();
    const source = audioCtx.createMediaStreamSource(stream);
    micAnalyser = audioCtx.createAnalyser();
    micAnalyser.fftSize = 256;
    micDataArray = new Uint8Array(micAnalyser.frequencyBinCount);
    source.connect(micAnalyser);
    micActive = true;
    btn.classList.add('active');
    btn.textContent = 'Mic: On';
    showToast('Mic active — speak to drive avatar state transitions');
  } catch (e) {
    showToast('Mic access denied');
  }
}

function animate(time) {
  requestAnimationFrame(animate);
  const dt = lastTime ? (time - lastTime) / 1000 : 1 / 60;
  lastTime = time;
  const clampedDt = Math.min(dt, 0.05);
  totalTime += clampedDt;

  // MediaPipe
  if (mediaPipe.simulating) mediaPipe.tickSimulation(clampedDt);
  smartGaze.setMediaPipeZone(mediaPipe.getZone());

  // Audio-reactive state
  updateMicState(clampedDt);

  // Intro
  runIntro(clampedDt);

  // Head sway — both faces breathe/sway identically
  const sway = getHeadSway(totalTime);

  // Feed head velocity to smart gaze for VOR
  const headVelX = Math.cos(totalTime * 0.4) * 0.4 * 1.7;
  const headVelY = Math.cos(totalTime * 0.3 + 1.0) * 0.3 * 0.7;
  smartGaze.engine.set_head_velocity(headVelX * 60, headVelY * 60);

  // Tick controllers
  const dumbOutput = dumbGaze.tick(clampedDt);
  const smartOutput = smartGaze.tick(clampedDt);

  // Apply to faces
  applyOutput(dumbFace, dumbOutput, sway.yaw, sway.pitch);
  applyOutput(smartFace, smartOutput, sway.yaw, sway.pitch);

  // HUD
  hud.update(smartOutput, mediaPipe.getZone(), mediaPipe.isActive());

  // Render
  dumbRenderer.render(dumbScene, dumbCamera);
  smartRenderer.render(smartScene, smartCamera);
}

async function init() {
  const leftPanel = document.getElementById('left-panel');
  const rightPanel = document.getElementById('right-panel');

  const left = createPanel(leftPanel);
  dumbScene = left.scene; dumbCamera = left.camera; dumbRenderer = left.renderer;

  const right = createPanel(rightPanel);
  smartScene = right.scene; smartCamera = right.camera; smartRenderer = right.renderer;

  dumbFace = new StylizedFace(dumbScene);
  smartFace = new StylizedFace(smartScene);

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
    (state) => { smartGaze.setState(state); micLastState = state; },
    (culture) => smartGaze.setCulture(culture),
  );

  // Mic button
  document.getElementById('mic-btn').addEventListener('click', toggleMic);

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    const map = { '1': 'idle', '2': 'listening', '3': 'thinking', '4': 'speaking' };
    if (map[e.key]) {
      document.querySelector(`[data-state="${map[e.key]}"]`)?.click();
    }
    if (e.key === 'm') toggleMic();
  });

  resize();
  window.addEventListener('resize', resize);

  document.getElementById('loading').style.display = 'none';
  requestAnimationFrame(animate);
}

init().catch(e => {
  console.error('Init failed:', e);
  document.getElementById('loading').textContent = 'Failed to load: ' + e.message;
});
