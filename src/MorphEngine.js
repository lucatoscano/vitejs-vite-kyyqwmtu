import * as THREE from "three";
import SurfaceSampler from "./SurfaceSampler.js";

export default class MorphEngine {

    constructor(meshes, particleCloud, particleCount = 300000){

        this.meshes = meshes;

        this.cloud = particleCloud;

        this.count = particleCount;

        this.targets = [];

        this.current = 0;

        this.next = 1;

        this.progress = 0;

        this.duration = 2.0;

        this.clock = new THREE.Clock();

        // -------------------
        // campiona tutti gli OBJ
        // -------------------

        for(const mesh of meshes){

            this.targets.push(

                SurfaceSampler.sample(

                    mesh,

                    particleCount

                )

            );

        }

        // posizione iniziale

        const array = this.cloud.points.geometry.attributes.position.array;

        array.set(

            this.targets[0]

        );

        this.cloud.points.geometry.attributes.position.needsUpdate = true;

    }


    update(){

        const dt = this.clock.getDelta();

        this.progress += dt / this.duration;

        if(this.progress >= 1){

            this.progress = 0;

            this.current = this.next;

            this.next++;

            if(this.next >= this.targets.length){

                this.next = 0;

            }

        }

        const a = this.targets[this.current];

        const b = this.targets[this.next];

        const pos = this.cloud.points.geometry.attributes.position.array;

        const t = this.progress;

        for(let i=0;i<pos.length;i++){

            pos[i] = a[i] + (b[i]-a[i])*t;

        }

        this.cloud.points.geometry.attributes.position.needsUpdate = true;

    }

}