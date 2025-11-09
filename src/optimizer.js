// src/optimizer.js
// ---------------------------------------------------------------
// 1. Real-road distance matrix (OSRM – free, no API key)
// 2. Nearest-Neighbor start + 2-Opt polish → no zig-zags
// ---------------------------------------------------------------

import { getOSRMMatrix } from './utils/osrm.js';   // <-- we’ll add this next

/** Haversine fallback (in case OSRM is down) */
function haversine(p1, p2) {
  const toRad = x => (x * Math.PI) / 180;
  const R = 6371; // km
  const dLat = toRad(p2.lat - p1.lat);
  const dLon = toRad(p2.lng - p1.lng);
  const lat1 = toRad(p1.lat);
  const lat2 = toRad(p2.lat);
  return (
    2 *
    R *
    Math.asin(
      Math.sqrt(
        Math.sin(dLat / 2) ** 2 +
          Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
      )
    )
  );
}

/** Main export – returns ordered stops */
export async function optimizeRoute(points) {
  if (points.length < 2) return points;

  // ---------- 1. Get real-road matrix ----------
  const matrix = await getOSRMMatrix(points);
  if (!matrix) return points; // fallback already inside getOSRMMatrix

  const n = points.length;
  let route = [0];               // indices of the points
  const visited = new Set([0]);

  // ---------- 2. Nearest-Neighbor (greedy start) ----------
  for (let i = 1; i < n; i++) {
    let minDist = Infinity,
      next = -1;
    for (let j = 0; j < n; j++) {
      if (!visited.has(j) && matrix[route[i - 1]][j] < minDist) {
        minDist = matrix[route[i - 1]][j];
        next = j;
      }
    }
    route.push(next);
    visited.add(next);
  }

  // ---------- 3. 2-Opt – untangle crossings ----------
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 1; i < route.length - 1; i++) {
      for (let k = i + 1; k < route.length; k++) {
        const a = route[i - 1];
        const b = route[i];
        const c = route[k];
        const d = route[(k + 1) % route.length]; // wrap to first stop

        const oldDist = matrix[a][b] + matrix[c][d];
        const newDist = matrix[a][c] + matrix[b][d];

        if (newDist < oldDist - 0.1) {
          // reverse segment i … k
          const segment = route.slice(i, k + 1).reverse();
          route.splice(i, k - i + 1, ...segment);
          improved = true;
        }
      }
    }
  }

  // ---------- 4. Return points in order ----------
  return route.map(idx => ({
    ...points[idx],
    order: idx + 1, // optional, nice for UI
  }));
}