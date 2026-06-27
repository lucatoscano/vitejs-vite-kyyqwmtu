import * as THREE from "three";

export default class ParticleCloud {

  constructor(positions) {

    const geometry = new THREE.BufferGeometry();

    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3)
    );

    const material = new THREE.PointsMaterial({

      color: 0xffffff,

      size: 0.006,

      sizeAttenuation: true

    });

    this.points = new THREE.Points(
      geometry,
      material
    );

  }

}