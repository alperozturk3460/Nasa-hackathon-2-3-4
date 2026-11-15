import * as THREE from 'three';
import { WorldId } from '../data/missionData';

export interface SurfaceCrater {
  x: number;
  z: number;
  radius: number;
  depth: number;
  rimHeight: number;
  isDeepPit: boolean;
}

export interface SurfaceObstacle {
  id: number;
  x: number;
  z: number;
  radius: number;
  height: number;
  kind:
    | 'boulder'
    | 'loose_rock'
    | 'ice_spire'
    | 'iron_shard'
    | 'pit'
    | 'lander'
    | 'colony'
    | 'deck_prop';
  label: string;
  movable: boolean;
  mesh?: THREE.Object3D;
}

export interface RoverNavTelemetry {
  active: boolean;
  targetX: number | null;
  targetZ: number | null;
  distanceM: number;
  obstacleNotice: string | null;
}

export const ROVER_COLLISION_RADIUS = 0.82;

function seededRand(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function worldSeed(worldId: WorldId): number {
  switch (worldId) {
    case 'moon':
      return 101;
    case 'mars':
      return 202;
    case 'jupiter':
      return 303;
    case 'asteroid':
      return 404;
    case 'colony':
      return 505;
    case 'earth':
      return 606;
  }
}

const CRATER_CACHE: Partial<Record<WorldId, SurfaceCrater[]>> = {};

export function getWorldCraters(worldId: WorldId): SurfaceCrater[] {
  if (worldId === 'earth') return [];
  if (CRATER_CACHE[worldId]) return CRATER_CACHE[worldId]!;

  const rng = seededRand(worldSeed(worldId) + 77);
  const craters: SurfaceCrater[] = [];

  // 4 Walkable broad impact craters (gentle slopes + raised ejecta rim)
  const craterAngles = [0.65, 2.15, 3.75, 5.25];
  for (let i = 0; i < craterAngles.length; i++) {
    const a = craterAngles[i] + (rng() - 0.5) * 0.25;
    const dist = 14.5 + rng() * 14.5;
    const x = Math.cos(a) * dist;
    const z = Math.sin(a) * dist;
    if (worldId === 'colony' && Math.hypot(x + 6.5, z + 3.5) < 7.5) continue;
    craters.push({
      x,
      z,
      radius: 4.8 + rng() * 2.4,
      depth: 0.9 + rng() * 0.45,
      rimHeight: 0.36 + rng() * 0.2,
      isDeepPit: false,
    });
  }

  // 4 Deep steep sinkhole pits ("çukurlar") that act as physical hazards the rover routes around
  const pitAngles = [1.35, 2.85, 4.45, 5.85];
  for (let i = 0; i < pitAngles.length; i++) {
    const a = pitAngles[i] + (rng() - 0.5) * 0.22;
    const dist = 11.5 + rng() * 15.0;
    const x = Math.cos(a) * dist;
    const z = Math.sin(a) * dist;
    // Keep clear of rover ramp exit lane (x ~ 0, z ~ 0..7) and colony structures
    if (Math.abs(x) < 4.5 && z > -2 && z < 8.5) continue;
    if (worldId === 'colony' && Math.hypot(x + 6.5, z + 3.5) < 6.8) continue;
    if (craters.some((c) => Math.hypot(c.x - x, c.z - z) < c.radius + 3.2)) continue;
    craters.push({
      x,
      z,
      radius: 2.3 + rng() * 0.75,
      depth: 2.45 + rng() * 0.65,
      rimHeight: 0.34,
      isDeepPit: true,
    });
  }

  CRATER_CACHE[worldId] = craters;
  return craters;
}

export function getCraterDisplacement(worldId: WorldId, x: number, z: number): number {
  const craters = getWorldCraters(worldId);
  let delta = 0;

  for (let i = 0; i < craters.length; i++) {
    const c = craters[i];
    const d = Math.hypot(x - c.x, z - c.z);
    if (d >= c.radius * 1.38) continue;

    const u = d / c.radius;
    if (u <= 1.0) {
      // Smooth bowl depression (steeper wall for deep pits)
      const t = 1 - u * u;
      const bowlShape = c.isDeepPit ? Math.pow(t, 0.72) : t * t;
      delta -= bowlShape * c.depth;
    }
    // Raised ejecta rim peaking around u = 1.02
    const rimDist = (u - 1.02) / 0.22;
    delta += Math.exp(-rimDist * rimDist) * c.rimHeight;
  }
  return delta;
}

export function generateWorldObstacles(worldId: WorldId): SurfaceObstacle[] {
  const obstacles: SurfaceObstacle[] = [];
  let nextId = 1;

  // 1. Landed Smaller Spaceship Collider at (0, 0)
  obstacles.push({
    id: nextId++,
    x: 0,
    z: 0,
    radius: 2.25,
    height: 6.4,
    kind: 'lander',
    label: 'Drop-Spaceship Hull',
    movable: false,
  });

  if (worldId === 'earth') {
    const deckProps: { x: number; z: number; r: number; h: number; label: string }[] = [
      { x: 5.8, z: 3.4, r: 1.05, h: 1.3, label: 'Recovery Telemetry Container' },
      { x: -6.2, z: 3.8, r: 1.05, h: 1.3, label: 'Cryo Umbilical Module' },
      { x: 6.5, z: -4.6, r: 1.15, h: 1.8, label: 'Deck Radar Beacon' },
      { x: -5.4, z: -5.2, r: 1.15, h: 1.8, label: 'Tracking Antenna Pod' },
      { x: 0.4, z: -7.6, r: 1.2, h: 1.4, label: 'Propellant Manifold Crate' },
      { x: 9.2, z: 0.2, r: 0.95, h: 1.1, label: 'Hydraulic Winch Pylon' },
      { x: -9.4, z: -0.6, r: 0.95, h: 1.1, label: 'Safety Perimeter Barrier' },
    ];
    for (const p of deckProps) {
      obstacles.push({
        id: nextId++,
        x: p.x,
        z: p.z,
        radius: p.r,
        height: p.h,
        kind: 'deck_prop',
        label: p.label,
        movable: false,
      });
    }
    // 3 Movable deck canisters for tactile interaction
    for (const mp of [
      { x: 3.6, z: 6.4 },
      { x: -3.5, z: 6.8 },
      { x: 4.5, z: -1.8 },
    ]) {
      obstacles.push({
        id: nextId++,
        x: mp.x,
        z: mp.z,
        radius: 0.52,
        height: 0.65,
        kind: 'loose_rock',
        label: 'Test Sample Canister',
        movable: true,
      });
    }
    return obstacles;
  }

  // 2. Colony structures on Proxima b
  if (worldId === 'colony') {
    obstacles.push(
      {
        id: nextId++,
        x: -8.0,
        z: -4.9,
        radius: 2.85,
        height: 3.2,
        kind: 'colony',
        label: 'New Eden Biodome',
        movable: false,
      },
      {
        id: nextId++,
        x: -8.7,
        z: -0.7,
        radius: 1.05,
        height: 2.8,
        kind: 'colony',
        label: 'Ka-Band Radar Tower',
        movable: false,
      },
      {
        id: nextId++,
        x: -0.4,
        z: -5.1,
        radius: 2.2,
        height: 1.4,
        kind: 'colony',
        label: 'Colony Solar Field',
        movable: false,
      }
    );
  }

  // 3. Deep Pits ("çukurlar") as impassable hazard colliders
  const craters = getWorldCraters(worldId);
  for (const c of craters) {
    if (c.isDeepPit) {
      obstacles.push({
        id: nextId++,
        x: c.x,
        z: c.z,
        radius: c.radius * 0.92,
        height: 0.5,
        kind: 'pit',
        label: 'Deep Impact Pit Hazard',
        movable: false,
      });
    }
  }

  // 4. Solid Boulders / Ice Spires / Metallic Shards + Movable Loose Rocks
  const rng = seededRand(worldSeed(worldId) + 333);
  const solidKind: SurfaceObstacle['kind'] =
    worldId === 'jupiter' ? 'ice_spire' : worldId === 'asteroid' ? 'iron_shard' : 'boulder';
  const solidLabel =
    worldId === 'jupiter'
      ? 'Cryo-Ice Spire'
      : worldId === 'asteroid'
      ? 'Nickel-Iron Outcrop'
      : worldId === 'mars'
      ? 'Martian Basalt Boulder'
      : 'Planetary Boulder';

  let attempts = 0;
  let solidCount = 0;
  while (solidCount < 18 && attempts < 220) {
    attempts++;
    const a = rng() * Math.PI * 2;
    const d = 7.8 + rng() * 24.5;
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    const r = 0.95 + rng() * 0.65;

    // Keep rover exit ramp corridor (0, 0..7.5) unobstructed
    if (Math.abs(x) < 3.4 && z >= -1 && z <= 7.8) continue;
    // Keep clear of existing obstacles & pits so corridors remain open
    if (obstacles.some((o) => Math.hypot(o.x - x, o.z - z) < o.radius + r + 2.4)) continue;

    obstacles.push({
      id: nextId++,
      x,
      z,
      radius: r,
      height: r * (worldId === 'jupiter' ? 2.1 : 1.15),
      kind: solidKind,
      label: solidLabel,
      movable: false,
    });
    solidCount++;
  }

  // 5. 6 Pushable / Interactive Loose Regolith Rocks
  let movableCount = 0;
  attempts = 0;
  while (movableCount < 6 && attempts < 140) {
    attempts++;
    const a = rng() * Math.PI * 2;
    const d = 6.8 + rng() * 14.5;
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    const r = 0.54;

    if (Math.abs(x) < 2.2 && z >= -1 && z <= 7.0) continue;
    if (obstacles.some((o) => Math.hypot(o.x - x, o.z - z) < o.radius + r + 1.8)) continue;

    obstacles.push({
      id: nextId++,
      x,
      z,
      radius: r,
      height: 0.62,
      kind: 'loose_rock',
      label: 'Movable Regolith Specimen',
      movable: true,
    });
    movableCount++;
  }

  return obstacles;
}

function isPointBlocked(
  x: number,
  z: number,
  obstacles: SurfaceObstacle[],
  maxPlayableR: number,
  clearance: number
): boolean {
  if (Math.hypot(x, z) > maxPlayableR) return true;
  for (let i = 0; i < obstacles.length; i++) {
    const o = obstacles[i];
    const minDist = o.radius + clearance;
    const dx = x - o.x;
    const dz = z - o.z;
    if (dx * dx + dz * dz < minDist * minDist) {
      return true;
    }
  }
  return false;
}

function isSegmentClear(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  obstacles: SurfaceObstacle[],
  maxPlayableR: number,
  clearance: number
): boolean {
  const dist = Math.hypot(bx - ax, bz - az);
  if (dist < 0.001) return true;
  const steps = Math.max(2, Math.ceil(dist / 0.35));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const sx = ax + (bx - ax) * t;
    const sz = az + (bz - az) * t;
    if (isPointBlocked(sx, sz, obstacles, maxPlayableR, clearance)) {
      return false;
    }
  }
  return true;
}

export function clampToFreeSurfacePoint(
  x: number,
  z: number,
  obstacles: SurfaceObstacle[],
  maxPlayableR: number,
  clearance = ROVER_COLLISION_RADIUS + 0.3
): { x: number; z: number } {
  let px = x;
  let pz = z;
  const radial = Math.hypot(px, pz);
  if (radial > maxPlayableR - 0.4) {
    const s = (maxPlayableR - 0.4) / radial;
    px *= s;
    pz *= s;
  }

  for (let iter = 0; iter < 4; iter++) {
    for (let i = 0; i < obstacles.length; i++) {
      const o = obstacles[i];
      const dx = px - o.x;
      const dz = pz - o.z;
      const dist = Math.hypot(dx, dz);
      const minD = o.radius + clearance + 0.12;
      if (dist < minD) {
        const nx = dist > 0.001 ? dx / dist : 1;
        const nz = dist > 0.001 ? dz / dist : 0;
        px = o.x + nx * minD;
        pz = o.z + nz * minD;
      }
    }
  }

  const rAfter = Math.hypot(px, pz);
  if (rAfter > maxPlayableR - 0.4) {
    const s = (maxPlayableR - 0.4) / rAfter;
    px *= s;
    pz *= s;
  }

  return { x: px, z: pz };
}

/**
 * Shortest Obstacle-Free Pathfinding:
 * 8-connected A* grid search followed by greedy Line-of-Sight String-Pulling smoothing
 * so the rover takes the shortest taut path around every crater pit, boulder, and spaceship.
 */
export function findShortestObstacleFreePath(
  startX: number,
  startZ: number,
  rawGoalX: number,
  rawGoalZ: number,
  obstacles: SurfaceObstacle[],
  maxPlayableR: number
): THREE.Vector2[] {
  const clearance = ROVER_COLLISION_RADIUS + 0.28;
  const safeStart = clampToFreeSurfacePoint(startX, startZ, obstacles, maxPlayableR, clearance - 0.1);
  const safeGoal = clampToFreeSurfacePoint(rawGoalX, rawGoalZ, obstacles, maxPlayableR, clearance);

  // Fast path: if straight line from start to goal is completely clear, return direct segment immediately!
  if (
    isSegmentClear(safeStart.x, safeStart.z, safeGoal.x, safeGoal.z, obstacles, maxPlayableR, clearance)
  ) {
    return [new THREE.Vector2(safeStart.x, safeStart.z), new THREE.Vector2(safeGoal.x, safeGoal.z)];
  }

  const cellSize = maxPlayableR < 20 ? 0.65 : 0.9;
  const halfExtent = maxPlayableR + 1.5;
  const gridN = Math.ceil((halfExtent * 2) / cellSize) + 1;

  const toGrid = (v: number) =>
    Math.max(0, Math.min(gridN - 1, Math.round((v + halfExtent) / cellSize)));
  const toWorld = (idx: number) => -halfExtent + idx * cellSize;

  const sx = toGrid(safeStart.x);
  const sz = toGrid(safeStart.z);
  const gx = toGrid(safeGoal.x);
  const gz = toGrid(safeGoal.z);

  const totalCells = gridN * gridN;
  const blocked = new Uint8Array(totalCells);

  for (let iz = 0; iz < gridN; iz++) {
    const wz = toWorld(iz);
    for (let ix = 0; ix < gridN; ix++) {
      const wx = toWorld(ix);
      if (isPointBlocked(wx, wz, obstacles, maxPlayableR, clearance)) {
        blocked[iz * gridN + ix] = 1;
      }
    }
  }

  const startIdx = sz * gridN + sx;
  const goalIdx = gz * gridN + gx;
  blocked[startIdx] = 0;
  blocked[goalIdx] = 0;

  const gScore = new Float32Array(totalCells).fill(Infinity);
  const fScore = new Float32Array(totalCells).fill(Infinity);
  const cameFrom = new Int32Array(totalCells).fill(-1);
  const closed = new Uint8Array(totalCells);
  const inOpen = new Uint8Array(totalCells);

  const heap: number[] = [];
  const pushHeap = (idx: number) => {
    heap.push(idx);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (fScore[heap[p]] <= fScore[heap[i]]) break;
      const tmp = heap[p];
      heap[p] = heap[i];
      heap[i] = tmp;
      i = p;
    }
  };
  const popHeap = (): number => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length > 0) {
      heap[0] = last;
      let i = 0;
      const len = heap.length;
      while (true) {
        let best = i;
        const l = i * 2 + 1;
        const r = l + 1;
        if (l < len && fScore[heap[l]] < fScore[heap[best]]) best = l;
        if (r < len && fScore[heap[r]] < fScore[heap[best]]) best = r;
        if (best === i) break;
        const tmp = heap[i];
        heap[i] = heap[best];
        heap[best] = tmp;
        i = best;
      }
    }
    return top;
  };

  const heuristic = (ix: number, iz: number) => {
    const dx = Math.abs(ix - gx);
    const dz = Math.abs(iz - gz);
    return (dx + dz + (Math.SQRT2 - 2) * Math.min(dx, dz)) * cellSize;
  };

  gScore[startIdx] = 0;
  fScore[startIdx] = heuristic(sx, sz);
  inOpen[startIdx] = 1;
  pushHeap(startIdx);

  const dirs = [
    [1, 0, 1],
    [-1, 0, 1],
    [0, 1, 1],
    [0, -1, 1],
    [1, 1, Math.SQRT2],
    [1, -1, Math.SQRT2],
    [-1, 1, Math.SQRT2],
    [-1, -1, Math.SQRT2],
  ];

  let found = false;
  while (heap.length > 0) {
    const cur = popHeap();
    inOpen[cur] = 0;
    if (cur === goalIdx) {
      found = true;
      break;
    }
    closed[cur] = 1;

    const cx = cur % gridN;
    const cz = (cur / gridN) | 0;

    for (let d = 0; d < 8; d++) {
      const nx = cx + dirs[d][0];
      const nz = cz + dirs[d][1];
      if (nx < 0 || nx >= gridN || nz < 0 || nz >= gridN) continue;
      const nIdx = nz * gridN + nx;
      if (closed[nIdx] || blocked[nIdx]) continue;

      // Disallow diagonal corner-cutting across adjacent blocked obstacles
      if (dirs[d][0] !== 0 && dirs[d][1] !== 0) {
        if (blocked[cz * gridN + nx] || blocked[nz * gridN + cx]) continue;
      }

      const tentativeG = gScore[cur] + dirs[d][2] * cellSize;
      if (tentativeG < gScore[nIdx]) {
        cameFrom[nIdx] = cur;
        gScore[nIdx] = tentativeG;
        fScore[nIdx] = tentativeG + heuristic(nx, nz);
        if (!inOpen[nIdx]) {
          inOpen[nIdx] = 1;
          pushHeap(nIdx);
        }
      }
    }
  }

  if (!found) {
    return [new THREE.Vector2(safeStart.x, safeStart.z), new THREE.Vector2(safeGoal.x, safeGoal.z)];
  }

  const rawPts: THREE.Vector2[] = [new THREE.Vector2(safeGoal.x, safeGoal.z)];
  let trace = cameFrom[goalIdx];
  while (trace !== -1 && trace !== startIdx) {
    const tx = trace % gridN;
    const tz = (trace / gridN) | 0;
    rawPts.push(new THREE.Vector2(toWorld(tx), toWorld(tz)));
    trace = cameFrom[trace];
  }
  rawPts.push(new THREE.Vector2(safeStart.x, safeStart.z));
  rawPts.reverse();

  // Line-of-Sight String-Pulling for true Euclidean shortest taut route
  const smoothed: THREE.Vector2[] = [rawPts[0]];
  let i = 0;
  while (i < rawPts.length - 1) {
    let furthest = i + 1;
    for (let j = rawPts.length - 1; j > i + 1; j--) {
      if (
        isSegmentClear(
          rawPts[i].x,
          rawPts[i].y,
          rawPts[j].x,
          rawPts[j].y,
          obstacles,
          maxPlayableR,
          clearance
        )
      ) {
        furthest = j;
        break;
      }
    }
    smoothed.push(rawPts[furthest]);
    i = furthest;
  }

  return smoothed;
}
