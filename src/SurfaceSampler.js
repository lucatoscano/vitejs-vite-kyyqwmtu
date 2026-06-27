/**
 * SurfaceSampler.js
 * Campionamento superficiale via barycentric sampling, area-weighted.
 * NON usa MeshSurfaceSampler di Three.js (instabile con OBJ complessi).
 */

export default class SurfaceSampler {

    static sample(geometry, count = 300000) {
  
      // 1. Estrai posizioni e indici
      let positions, indices;
  
      if (geometry.index !== null) {
        positions = geometry.attributes.position;
        indices   = geometry.index.array;
      } else {
        // non-indexed: ogni 3 vertici = 1 triangolo
        positions = geometry.attributes.position;
        indices   = null;
      }
  
      // 2. Raccoglie triangoli e calcola area
      const triangles = [];
      const triCount  = indices
        ? indices.length / 3
        : positions.count / 3;
  
      let totalArea = 0;
  
      for (let i = 0; i < triCount; i++) {
        let ai, bi, ci;
        if (indices) {
          ai = indices[i * 3];
          bi = indices[i * 3 + 1];
          ci = indices[i * 3 + 2];
        } else {
          ai = i * 3;
          bi = i * 3 + 1;
          ci = i * 3 + 2;
        }
  
        const ax = positions.getX(ai), ay = positions.getY(ai), az = positions.getZ(ai);
        const bx = positions.getX(bi), by = positions.getY(bi), bz = positions.getZ(bi);
        const cx = positions.getX(ci), cy = positions.getY(ci), cz = positions.getZ(ci);
  
        // vettori ab, ac
        const abx = bx - ax, aby = by - ay, abz = bz - az;
        const acx = cx - ax, acy = cy - ay, acz = cz - az;
  
        // cross product
        const crx = aby * acz - abz * acy;
        const cry = abz * acx - abx * acz;
        const crz = abx * acy - aby * acx;
  
        const area = 0.5 * Math.sqrt(crx * crx + cry * cry + crz * crz);
        totalArea += area;
  
        triangles.push({ ax, ay, az, bx, by, bz, cx, cy, cz, area });
      }
  
      // 3. Cumulative distribution per weighted random sampling
      const cdf = new Float64Array(triangles.length);
      let cumSum = 0;
      for (let i = 0; i < triangles.length; i++) {
        cumSum += triangles[i].area / totalArea;
        cdf[i] = cumSum;
      }
  
      // 4. Calcola bbox per normalizzazione
      let xMin = Infinity, xMax = -Infinity;
      let yMin = Infinity, yMax = -Infinity;
      let zMin = Infinity, zMax = -Infinity;
  
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const y = positions.getY(i);
        const z = positions.getZ(i);
        if (x < xMin) xMin = x; if (x > xMax) xMax = x;
        if (y < yMin) yMin = y; if (y > yMax) yMax = y;
        if (z < zMin) zMin = z; if (z > zMax) zMax = z;
      }
  
      const cx0 = (xMin + xMax) / 2;
      const cy0 = (yMin + yMax) / 2;
      const cz0 = (zMin + zMax) / 2;
      const maxDim = Math.max(xMax - xMin, yMax - yMin, zMax - zMin);
      const scale  = 2.0 / maxDim;
  
      // 5. Campiona
      const out = new Float32Array(count * 3);
  
      for (let i = 0; i < count; i++) {
        // binary search nella CDF
        const r = Math.random();
        let lo = 0, hi = cdf.length - 1;
        while (lo < hi) {
          const mid = (lo + hi) >> 1;
          if (cdf[mid] < r) lo = mid + 1;
          else hi = mid;
        }
  
        const t = triangles[lo];
  
        // barycentric random point
        let r1 = Math.random();
        let r2 = Math.random();
        if (r1 + r2 > 1) { r1 = 1 - r1; r2 = 1 - r2; }
        const r3 = 1 - r1 - r2;
  
        const px = (t.ax * r3 + t.bx * r1 + t.cx * r2 - cx0) * scale;
        const py = (t.ay * r3 + t.by * r1 + t.cy * r2 - cy0) * scale;
        const pz = (t.az * r3 + t.bz * r1 + t.cz * r2 - cz0) * scale;
  
        out[i * 3]     = px;
        out[i * 3 + 1] = py;
        out[i * 3 + 2] = pz;
      }
  
      return out;
    }
  }