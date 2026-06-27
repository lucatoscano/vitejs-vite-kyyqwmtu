import * as THREE from "three";

export default class ParticleCloud {

    constructor(positions) {

        this.count = positions.length / 3;

        this.geometry = new THREE.BufferGeometry();

        // posizione corrente
        this.current = new Float32Array(positions);

        // posizione target
        this.target = new Float32Array(positions);

        // buffer geometry
        this.geometry.setAttribute(
            "position",
            new THREE.BufferAttribute(this.current, 3)
        );

        this.material = new THREE.PointsMaterial({

            color: 0xffffff,

            size: 0.008,

            sizeAttenuation: true,

            transparent: true,

            opacity: 1

        });

        this.points = new THREE.Points(
            this.geometry,
            this.material
        );

    }

    setTarget(targetPositions){

        this.target.set(targetPositions);

    }

    update(speed = 0.08){

        const position = this.geometry.attributes.position.array;

        for(let i = 0; i < position.length; i++){

            position[i] += (this.target[i] - position[i]) * speed;

        }

        this.geometry.attributes.position.needsUpdate = true;

    }

}