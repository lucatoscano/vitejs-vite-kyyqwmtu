import "./style.css";

import * as THREE from "three";
import { OrbitControls, OBJLoader } from "three-stdlib";

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);

camera.position.set(0, 0, 4);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
});

renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);

document.body.innerHTML = "";
document.body.appendChild(renderer.domElement);

// ---------------------
// LUCI
// ---------------------

scene.add(new THREE.AmbientLight(0xffffff, 2));

const light = new THREE.DirectionalLight(0xffffff, 3);
light.position.set(5, 5, 5);

scene.add(light);

// ---------------------
// CONTROLLI
// ---------------------

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// ---------------------
// MODELLO
// ---------------------

const loader = new OBJLoader();

let model = null;

loader.load("/models/1.obj", (object) => {

  model = object;

  model.traverse((child) => {

    if (child.isMesh) {

      child.material = new THREE.MeshNormalMaterial();

    }

  });

  // Centro il modello

  const box = new THREE.Box3().setFromObject(model);

  const center = box.getCenter(new THREE.Vector3());

  model.position.sub(center);

  // Scala automaticamente

  const size = box.getSize(new THREE.Vector3());

  const maxDim = Math.max(size.x, size.y, size.z);

  model.scale.setScalar(2 / maxDim);

  scene.add(model);

});

// ---------------------
// RESIZE
// ---------------------

window.addEventListener("resize", () => {

  camera.aspect = window.innerWidth / window.innerHeight;

  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);

});

// ---------------------
// LOOP
// ---------------------

function animate() {

  requestAnimationFrame(animate);

  if (model) {

    model.rotation.y += 0.01;

  }

  controls.update();

  renderer.render(scene, camera);

}

animate();