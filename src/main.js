import "./style.css";
import * as THREE from "three";
import { OrbitControls, OBJLoader } from "three-stdlib";
import SurfaceSampler from "./SurfaceSampler.js";
import ParticleCloud from "./ParticleCloud.js";

// ─── SCENA ───────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

// ─── CAMERA ──────────────────────────────────────────
const camera = new THREE.PerspectiveCamera(
  60, window.innerWidth / window.innerHeight, 0.1, 100
);
camera.position.set(0, 0, 4);

// ─── RENDERER ────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.innerHTML = "";
document.body.appendChild(renderer.domElement);

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ─── LUCI ────────────────────────────────────────────
scene.add(new THREE.AmbientLight(0xffffff, 2));
const dirLight = new THREE.DirectionalLight(0xffffff, 3);
dirLight.position.set(5, 5, 5);
scene.add(dirLight);

// ─── CONTROLS ────────────────────────────────────────
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// ─── AUDIO ───────────────────────────────────────────
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playTransitionNoise(duration = 1.5) {
  if (audioCtx.state === "suspended") audioCtx.resume();
  const bufferSize = Math.floor(audioCtx.sampleRate * duration);
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 1.5);
  }
  const source = audioCtx.createBufferSource();
  source.buffer = buffer;

  const filter = audioCtx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 600;
  filter.Q.value = 0.8;

  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
  gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + duration);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);
  source.start();
}

// ─── COSTANTI ────────────────────────────────────────
const N            = 300000;
const MORPH_DUR    = 2.8;   // durata fase morph (secondi)
const REST_DUR     = 3.5;   // durata pausa sulla forma

// ─── STATO ───────────────────────────────────────────
const shapesPos = [];       // Float32Array[3]
let cloud       = null;     // ParticleCloud
let group       = null;     // THREE.Group wrapper per la rotazione

let currentIdx  = 0;
let fromPos     = null;
let toPos       = null;

let phase       = "rest";   // "rest" | "morph"
let phaseT      = 0;        // tempo rimanente nella fase corrente

// rotazione continua sull'asse Y del gruppo
let rotY        = 0;
let rotSpeed    = 0.003;    // rad/frame base

// ─── EASING ──────────────────────────────────────────
function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

// ─── TURBOLENZA VISIVA ────────────────────────────────
function applyTurbulence(arr, intensity) {
  // agita solo 1 particella su 4 per performance
  for (let i = 0; i < arr.length; i += 4 * 3) {
    arr[i]     += (Math.random() - 0.5) * intensity * 0.12;
    arr[i + 1] += (Math.random() - 0.5) * intensity * 0.12;
    arr[i + 2] += (Math.random() - 0.5) * intensity * 0.12;
  }
}

// ─── LOAD OBJ ────────────────────────────────────────
function loadOBJ(path) {
  return new Promise((resolve) => {
    new OBJLoader().load(path, (obj) => {
      obj.traverse((child) => {
        if (child.isMesh) {
          // centra
          child.geometry.computeBoundingBox();
          const box = child.geometry.boundingBox;
          const center = new THREE.Vector3();
          box.getCenter(center);
          child.geometry.translate(-center.x, -center.y, -center.z);
          // campiona (la scala avviene dentro SurfaceSampler)
          resolve(SurfaceSampler.sample(child, N));
        }
      });
    });
  });
}

// ─── INIT ────────────────────────────────────────────
async function init() {
  const [p1, p2, p3] = await Promise.all([
    loadOBJ("/models/1.obj"),
    loadOBJ("/models/2.obj"),
    loadOBJ("/models/3.obj"),
  ]);
  shapesPos.push(p1, p2, p3);

  // crea cloud con prima forma
  cloud = new ParticleCloud(new Float32Array(p1));

  // gruppo wrapper: la rotazione va qui, non sul cloud
  group = new THREE.Group();
  group.add(cloud.points);
  scene.add(group);

  phase  = "rest";
  phaseT = REST_DUR;
}

init();

// ─── ANIMATE ─────────────────────────────────────────
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();

  if (cloud && shapesPos.length === 3) {
    phaseT -= dt;

    if (phase === "rest") {

      // rotazione lenta costante
      rotSpeed += (0.003 - rotSpeed) * 0.04;
      rotY += rotSpeed;
      group.rotation.y = rotY;

      if (phaseT <= 0) {
        // prepara morph
        const nextIdx = (currentIdx + 1) % 3;
        fromPos = new Float32Array(shapesPos[currentIdx]);
        toPos   = shapesPos[nextIdx];
        currentIdx = nextIdx;
        phase  = "morph";
        phaseT = MORPH_DUR;
        playTransitionNoise(MORPH_DUR * 0.9);
      }

    } else {
      // ── MORPH ──
      const rawT = 1 - phaseT / MORPH_DUR;           // 0 → 1
      const t    = easeInOut(Math.min(rawT, 1));

      // turbolenza: picco a metà
      const turbI = Math.sin(rawT * Math.PI);

      const arr = cloud.points.geometry.attributes.position.array;

      for (let i = 0; i < arr.length; i++) {
        arr[i] = fromPos[i] + (toPos[i] - fromPos[i]) * t;
      }
      applyTurbulence(arr, turbI);
      cloud.points.geometry.attributes.position.needsUpdate = true;

      // rotazione accelera durante morph, poi torna lenta
      rotSpeed += (0.003 + turbI * 0.04 - rotSpeed) * 0.06;
      rotY += rotSpeed;
      group.rotation.y = rotY;

      if (phaseT <= 0) {
        phase  = "rest";
        phaseT = REST_DUR;
      }
    }
  }

  controls.update();
  renderer.render(scene, camera);
}

animate();