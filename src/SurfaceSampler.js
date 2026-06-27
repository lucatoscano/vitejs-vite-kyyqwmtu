import * as THREE from "three";
import { MeshSurfaceSampler } from "three/examples/jsm/math/MeshSurfaceSampler.js";

export default class SurfaceSampler {

  static sample(mesh, count = 300000) {

    // Normalizza scala: porta il bounding box in [-1, 1]
    mesh.geometry.computeBoundingBox();
    const box = mesh.geometry.boundingBox;
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 2.0 / maxDim; // tutte le forme entrano in un cubo 2x2x2

    const sampler = new MeshSurfaceSampler(mesh).build();

    const positions = new Float32Array(count * 3);
    const temp = new THREE.Vector3();

    for (let i = 0; i < count; i++) {
      sampler.sample(temp);
      positions[i * 3 + 0] = temp.x * scale;
      positions[i * 3 + 1] = temp.y * scale;
      positions[i * 3 + 2] = temp.z * scale;
    }

    return positions;
  }
}