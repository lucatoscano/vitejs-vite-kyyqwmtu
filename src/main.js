import "./style.css";
import * as THREE from "three";
import { OrbitControls, OBJLoader } from "three-stdlib";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
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
const N         = 150000;
const MORPH_DUR = 2.8;
const REST_DUR  = 4.0;

// ─── STATO ───────────────────────────────────────────────────────────────────
const shapesPos = [];
let geometry    = null;
let points      = null;
let group       = null;

let currentIdx  = 0;
let fromPos     = null;
let toPos       = null;
let phase       = "rest";
let phaseTimer  = REST_DUR;
let rotY        = 0;
let rotSpeed    = 0.008;

// ─── EASING ──────────────────────────────────────────────────────────────────
function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

// ─── TURBOLENZA ──────────────────────────────────────────────────────────────
function applyTurbulence(arr, intensity) {
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
        // Raccoglie TUTTE le geometrie mesh dell'OBJ
        const geometries = [];
        obj.traverse((child) => {
          if (child.isMesh) {
            // Converti in non-indexed per poter fare merge
            const geo = child.geometry.index !== null
              ? child.geometry.toNonIndexed()
              : child.geometry.clone();
            geometries.push(geo);
          }
        });

        if (geometries.length === 0) {
          reject(new Error(`No mesh found in ${path}`));
          return;
        }

        console.log(`${path}: ${geometries.length} mesh group(s) found`);

        // Unisci tutte le geometrie in una sola
        const merged = geometries.length > 1
          ? mergeGeometries(geometries, false)
          : geometries[0];

        // Cleanup
        geometries.forEach(g => g.dispose());

        const pos = SurfaceSampler.sample(merged, N);
        merged.dispose();

        console.log(`${path}: sampled ${N} pts, first=(${pos[0].toFixed(3)}, ${pos[1].toFixed(3)}, ${pos[2].toFixed(3)})`);
        resolve(pos);
      },
      undefined,
      reject
    );
  });
}

// ─── INIT ────────────────────────────────────────────────────────────────────
async function init() {
  console.log("Loading OBJs...");

  const [p1, p2, p3] = await Promise.all([
    loadOBJ("/models/1.obj"),
    loadOBJ("/models/2.obj"),
    loadOBJ("/models/3.obj"),
  ]);

  shapesPos.push(p1, p2, p3);

  geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array(p1), 3)
  );

  const material = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.006,
    sizeAttenuation: true,
  });

  points = new THREE.Points(geometry, material);
  group  = new THREE.Group();
  group.add(points);
  scene.add(group);

  fromPos    = new Float32Array(p1);
  phase      = "rest";
  phaseTimer = REST_DUR;

  console.log("Ready — morphing will start in", REST_DUR, "seconds");
}

init();

// ─── LOOP ────────────────────────────────────────────────────────────────────
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);

  if (points && shapesPos.length === 3) {
    phaseTimer -= dt;
    const posArr = geometry.attributes.position.array;

    if (phase === "rest") {

      rotSpeed += (0.008 - rotSpeed) * 0.03;
      rotY += rotSpeed * dt;
      group.rotation.y = rotY;

      if (phaseTimer <= 0) {
        const nextIdx = (currentIdx + 1) % 3;
        console.log(`Morph: ${currentIdx} → ${nextIdx}`);
        fromPos    = new Float32Array(posArr);
        toPos      = shapesPos[nextIdx];
        currentIdx = nextIdx;
        phase      = "morph";
        phaseTimer = MORPH_DUR;
        playTransitionNoise(MORPH_DUR * 0.8);
      }

    } else {

      const rawT  = 1 - phaseTimer / MORPH_DUR;
      const t     = easeInOut(Math.min(rawT, 1));
      const turbI = Math.sin(rawT * Math.PI);

      for (let i = 0; i < posArr.length; i++) {
        posArr[i] = fromPos[i] + (toPos[i] - fromPos[i]) * t;
      }
      applyTurbulence(posArr, turbI);
      geometry.attributes.position.needsUpdate = true;

      const targetSpeed = 0.008 + turbI * 0.12;
      rotSpeed += (targetSpeed - rotSpeed) * 0.06;
      rotY += rotSpeed * dt;
      group.rotation.y = rotY;

      if (phaseTimer <= 0) {
        // snap pulito sulla forma target
        for (let i = 0; i < posArr.length; i++) posArr[i] = toPos[i];
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