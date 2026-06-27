import "./style.css";
import * as THREE from "three";
import { OrbitControls, OBJLoader } from "three-stdlib";
import SurfaceSampler from "./SurfaceSampler.js";

// ─── SCENA ───────────────────────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

// ─── CAMERA ──────────────────────────────────────────────────────────────────
const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
camera.position.set(0, 0, 4);

// ─── RENDERER ────────────────────────────────────────────────────────────────
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

// ─── LUCI ────────────────────────────────────────────────────────────────────
scene.add(new THREE.AmbientLight(0xffffff, 2));
const dirLight = new THREE.DirectionalLight(0xffffff, 3);
dirLight.position.set(5, 5, 5);
scene.add(dirLight);

// ─── ORBIT CONTROLS ──────────────────────────────────────────────────────────
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// ─── AUDIO ───────────────────────────────────────────────────────────────────
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playTransitionNoise(duration = 1.5) {
  if (audioCtx.state === "suspended") audioCtx.resume();
  const sr         = audioCtx.sampleRate;
  const bufferSize = Math.floor(sr * duration);
  const buffer     = audioCtx.createBuffer(1, bufferSize, sr);
  const data       = buffer.getChannelData(0);
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

// ─── COSTANTI ────────────────────────────────────────────────────────────────
const N         = 150000;   // particelle (ridotto per performance)
const MORPH_DUR = 2.8;      // secondi fase morph
const REST_DUR  = 4.0;      // secondi pausa sulla forma

// ─── STATO GLOBALE ───────────────────────────────────────────────────────────
const shapesPos = [];        // [Float32Array, Float32Array, Float32Array]
let geometry    = null;      // THREE.BufferGeometry condivisa
let points      = null;      // THREE.Points
let group       = null;      // wrapper per rotazione

let currentIdx  = 0;
let fromPos     = null;
let toPos       = null;

let phase       = "rest";
let phaseTimer  = REST_DUR;

let rotY        = 0;
let rotSpeed    = 0.008;     // rad/s base (velocità lenta a riposo)

// ─── EASING ──────────────────────────────────────────────────────────────────
function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

// ─── TURBOLENZA ──────────────────────────────────────────────────────────────
function applyTurbulence(arr, intensity) {
  // ogni 8 particelle per performance
  for (let i = 0; i < arr.length; i += 8 * 3) {
    arr[i]     += (Math.random() - 0.5) * intensity * 0.15;
    arr[i + 1] += (Math.random() - 0.5) * intensity * 0.15;
    arr[i + 2] += (Math.random() - 0.5) * intensity * 0.15;
  }
}

// ─── CARICAMENTO OBJ ─────────────────────────────────────────────────────────
function loadOBJ(path) {
  return new Promise((resolve, reject) => {
    new OBJLoader().load(
      path,
      (obj) => {
        let found = false;
        obj.traverse((child) => {
          if (child.isMesh && !found) {
            found = true;
            console.log(`Loaded ${path}: geometry index=${child.geometry.index !== null}`);
            const pos = SurfaceSampler.sample(child.geometry, N);
            console.log(`Sampled ${path}: first point = ${pos[0].toFixed(3)}, ${pos[1].toFixed(3)}, ${pos[2].toFixed(3)}`);
            resolve(pos);
          }
        });
        if (!found) reject(new Error(`No mesh in ${path}`));
      },
      undefined,
      reject
    );
  });
}

// ─── INIZIALIZZAZIONE ─────────────────────────────────────────────────────────
async function init() {
  console.log("Loading 3 OBJ files...");

  const [p1, p2, p3] = await Promise.all([
    loadOBJ("/models/1.obj"),
    loadOBJ("/models/2.obj"),
    loadOBJ("/models/3.obj"),
  ]);

  shapesPos.push(p1, p2, p3);
  console.log("All shapes loaded. Creating particle cloud...");

  // Geometria condivisa — STESSO buffer, aggiornato ogni frame durante morph
  geometry = new THREE.BufferGeometry();
  const initialPos = new Float32Array(p1); // copia della prima forma
  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(initialPos, 3)
  );

  const material = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.006,
    sizeAttenuation: true,
  });

  points = new THREE.Points(geometry, material);

  group = new THREE.Group();
  group.add(points);
  scene.add(group);

  phase      = "rest";
  phaseTimer = REST_DUR;
  fromPos    = new Float32Array(p1);

  console.log("Ready.");
}

init();

// ─── LOOP ────────────────────────────────────────────────────────────────────
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05); // cap a 50ms per sicurezza

  if (points && shapesPos.length === 3) {
    phaseTimer -= dt;

    const posArr = geometry.attributes.position.array;

    if (phase === "rest") {

      // rotazione lenta costante
      rotSpeed += (0.008 - rotSpeed) * 0.03;
      rotY += rotSpeed * dt;
      group.rotation.y = rotY;

      if (phaseTimer <= 0) {
        const nextIdx = (currentIdx + 1) % 3;
        console.log(`Morphing: shape ${currentIdx} → shape ${nextIdx}`);

        fromPos    = new Float32Array(posArr); // stato visivo corrente (con turbolenza)
        toPos      = shapesPos[nextIdx];
        currentIdx = nextIdx;
        phase      = "morph";
        phaseTimer = MORPH_DUR;

        playTransitionNoise(MORPH_DUR * 0.8);
      }

    } else {
      // ── MORPH ──────────────────────────────────────────────────────────────
      const rawT = 1 - phaseTimer / MORPH_DUR;  // 0 → 1
      const t    = easeInOut(Math.min(rawT, 1));
      const turbI = Math.sin(rawT * Math.PI);     // picco a metà

      // lerp posizioni
      for (let i = 0; i < posArr.length; i++) {
        posArr[i] = fromPos[i] + (toPos[i] - fromPos[i]) * t;
      }

      // turbolenza visiva
      applyTurbulence(posArr, turbI);

      geometry.attributes.position.needsUpdate = true;

      // rotazione accelera durante morph
      const targetSpeed = 0.008 + turbI * 0.12;
      rotSpeed += (targetSpeed - rotSpeed) * 0.06;
      rotY += rotSpeed * dt;
      group.rotation.y = rotY;

      if (phaseTimer <= 0) {
        // snap finale: copia pulita della forma target (senza turbolenza residua)
        for (let i = 0; i < posArr.length; i++) {
          posArr[i] = toPos[i];
        }
        geometry.attributes.position.needsUpdate = true;

        phase      = "rest";
        phaseTimer = REST_DUR;
        fromPos    = new Float32Array(toPos);
      }
    }
  }

  controls.update();
  renderer.render(scene, camera);
}

animate();