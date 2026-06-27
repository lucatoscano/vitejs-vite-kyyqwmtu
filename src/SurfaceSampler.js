import * as THREE from "three";
import { MeshSurfaceSampler } from "three/examples/jsm/math/MeshSurfaceSampler.js";

export default class SurfaceSampler {

    static sample(mesh, count = 100000){

        const sampler = new MeshSurfaceSampler(mesh).build();

        const positions = new Float32Array(count * 3);

        const temp = new THREE.Vector3();

        for(let i = 0; i < count; i++){

            sampler.sample(temp);

            positions[i*3]     = temp.x;
            positions[i*3 + 1] = temp.y;
            positions[i*3 + 2] = temp.z;

        }

        return positions;

    }

}