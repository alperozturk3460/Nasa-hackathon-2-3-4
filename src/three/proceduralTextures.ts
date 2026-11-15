import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export interface PBRTextureSet {
  map: THREE.Texture;
  normalMap?: THREE.Texture;
  roughnessMap?: THREE.Texture;
  cloudsMap?: THREE.Texture;
  emissiveMap?: THREE.Texture;
  dispose: () => void;
}

// ============================================================================
// Deterministic 3D Noise & Fractal Brownian Motion (Seamless Spherical Mapping)
// ============================================================================

function hash3(ix: number, iy: number, iz: number, seed: number): number {
  let h = (ix * 374761393 + iy * 668265263 + iz * 2147483647 + seed * 1597334677) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

function noise3(x: number, y: number, z: number, seed = 1): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const fx = smoothstep(x - ix);
  const fy = smoothstep(y - iy);
  const fz = smoothstep(z - iz);

  const c000 = hash3(ix, iy, iz, seed);
  const c100 = hash3(ix + 1, iy, iz, seed);
  const c010 = hash3(ix, iy + 1, iz, seed);
  const c110 = hash3(ix + 1, iy + 1, iz, seed);
  const c001 = hash3(ix, iy, iz + 1, seed);
  const c101 = hash3(ix + 1, iy, iz + 1, seed);
  const c011 = hash3(ix, iy + 1, iz + 1, seed);
  const c111 = hash3(ix + 1, iy + 1, iz + 1, seed);

  const x00 = lerp(c000, c100, fx);
  const x10 = lerp(c010, c110, fx);
  const x01 = lerp(c001, c101, fx);
  const x11 = lerp(c011, c111, fx);

  return lerp(lerp(x00, x10, fy), lerp(x01, x11, fy), fz);
}

export function fbm3(
  x: number,
  y: number,
  z: number,
  octaves = 5,
  seed = 1
): number {
  let val = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    val += amp * noise3(x * freq, y * freq, z * freq, seed + i * 17);
    norm += amp;
    amp *= 0.5;
    freq *= 2.04;
  }
  return val / norm;
}

function ridged3(x: number, y: number, z: number, octaves = 4, seed = 11): number {
  let val = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    const n = 1 - Math.abs(noise3(x * freq, y * freq, z * freq, seed + i * 19) * 2 - 1);
    val += amp * n * n;
    norm += amp;
    amp *= 0.5;
    freq *= 2.1;
  }
  return val / norm;
}

function seededRand(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function makeDataTexture(
  data: Uint8Array,
  w: number,
  h: number,
  srgb: boolean,
  maxAnisotropy: number,
  wrapRepeat = true
): THREE.DataTexture {
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.wrapS = wrapRepeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.wrapT = wrapRepeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}

function heightFieldToNormalTexture(
  height: Float32Array,
  w: number,
  h: number,
  strength: number,
  maxAnisotropy: number,
  wrapT = false
): THREE.DataTexture {
  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    const yPrev = wrapT ? (y - 1 + h) % h : Math.max(0, y - 1);
    const yNext = wrapT ? (y + 1) % h : Math.min(h - 1, y + 1);
    for (let x = 0; x < w; x++) {
      const xPrev = (x - 1 + w) % w;
      const xNext = (x + 1) % w;

      const hL = height[y * w + xPrev];
      const hR = height[y * w + xNext];
      const hU = height[yPrev * w + x];
      const hD = height[yNext * w + x];

      const dx = (hL - hR) * strength;
      const dy = (hU - hD) * strength;
      const dz = 1.0;
      const invLen = 1 / Math.sqrt(dx * dx + dy * dy + dz * dz);

      const idx = (y * w + x) * 4;
      out[idx] = clamp(Math.round((dx * invLen * 0.5 + 0.5) * 255), 0, 255);
      out[idx + 1] = clamp(Math.round((dy * invLen * 0.5 + 0.5) * 255), 0, 255);
      out[idx + 2] = clamp(Math.round((dz * invLen * 0.5 + 0.5) * 255), 0, 255);
      out[idx + 3] = 255;
    }
  }
  return makeDataTexture(out, w, h, false, maxAnisotropy, true);
}

// Helper for equirectangular unit sphere vector at pixel (x, y)
function sphereDir(x: number, y: number, w: number, h: number): [number, number, number] {
  const u = (x / w) * Math.PI * 2;
  const v = ((y + 0.5) / h) * Math.PI;
  const sinV = Math.sin(v);
  return [sinV * Math.cos(u), Math.cos(v), sinV * Math.sin(u)];
}

// ============================================================================
// 1. Solar Photosphere (Seamless 3D Convection Granulation & Active Regions)
// ============================================================================

export function createSunPBR(maxAnisotropy: number): PBRTextureSet {
  const w = 1024;
  const h = 512;
  const albedo = new Uint8Array(w * h * 4);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [nx, ny, nz] = sphereDir(x, y, w, h);
      const plasma = fbm3(nx * 5.2, ny * 5.2, nz * 5.2, 5, 12);
      const granules = fbm3(nx * 18.0 + plasma * 2.1, ny * 18.0, nz * 18.0 + plasma * 2.1, 4, 44);
      const spots = fbm3(nx * 3.1, ny * 3.1, nz * 3.1, 3, 91);

      let heat = plasma * 0.55 + granules * 0.45;
      if (spots < 0.31) {
        heat -= (0.31 - spots) * 2.1; // Sunspot umbra
      } else if (spots > 0.66) {
        heat += (spots - 0.66) * 0.85; // Bright magnetic plage
      }
      heat = clamp(heat, 0, 1);

      // Blackbody photosphere gradient: deep crimson -> blazing orange -> gold -> blinding white-yellow
      let r: number;
      let g: number;
      let b: number;
      if (heat < 0.35) {
        const t = heat / 0.35;
        r = lerp(110, 232, t);
        g = lerp(22, 72, t);
        b = lerp(6, 12, t);
      } else if (heat < 0.72) {
        const t = (heat - 0.35) / 0.37;
        r = lerp(232, 255, t);
        g = lerp(72, 185, t);
        b = lerp(12, 55, t);
      } else {
        const t = (heat - 0.72) / 0.28;
        r = 255;
        g = lerp(185, 248, t);
        b = lerp(55, 195, t);
      }

      const idx = (y * w + x) * 4;
      albedo[idx] = Math.round(r);
      albedo[idx + 1] = Math.round(g);
      albedo[idx + 2] = Math.round(b);
      albedo[idx + 3] = 255;
    }
  }

  const map = makeDataTexture(albedo, w, h, true, maxAnisotropy);
  return {
    map,
    dispose: () => map.dispose(),
  };
}

// ============================================================================
// 2. Earth (Real Continents, Bathymetry, Mountain Relief, Clouds, City Lights)
// ============================================================================

interface EarthLobe {
  lon: number;
  lat: number;
  rx: number;
  ry: number;
  cosR: number;
  sinR: number;
  w: number;
}

function makeLobe(lon: number, lat: number, rx: number, ry: number, rotDeg: number, w: number): EarthLobe {
  const rad = (rotDeg * Math.PI) / 180;
  return { lon, lat, rx, ry, cosR: Math.cos(rad), sinR: Math.sin(rad), w };
}

const EARTH_LOBES: EarthLobe[] = [
  // North America & Greenland
  makeLobe(-98, 56, 26, 12, -10, 1.05),
  makeLobe(-150, 64, 15, 5.5, 8, 0.96),
  makeLobe(-105, 41, 18, 10, -15, 1.05),
  makeLobe(-82, 37, 11, 8, 25, 0.96),
  makeLobe(-81.5, 28, 2.2, 4.2, -12, 0.78),
  makeLobe(-102, 23, 7, 7, -38, 0.90),
  makeLobe(-86, 12, 6, 2.2, -38, 0.76),
  makeLobe(-79, 21.5, 4.5, 1.3, -15, 0.68),
  makeLobe(-71, 19, 3.0, 1.1, -10, 0.62),
  makeLobe(-42, 72, 13, 8.5, 15, 1.08),
  makeLobe(-18, 65, 3.2, 1.6, 10, 0.72),
  makeLobe(-85, 60, 7.5, 5.5, 0, -0.92), // Hudson Bay
  makeLobe(-90, 25, 8.5, 5.2, 0, -1.08), // Gulf of Mexico

  // South America
  makeLobe(-68, 5, 8, 6.5, -15, 0.98),
  makeLobe(-54, -8, 15, 12, -18, 1.12),
  makeLobe(-69, -17, 6.5, 12, -15, 0.98),
  makeLobe(-66, -39, 5.2, 13, 18, 0.92),

  // Europe
  makeLobe(10, 49, 14, 7.5, 10, 0.98),
  makeLobe(-4, 40, 5.2, 4.0, 0, 0.90),
  makeLobe(13, 42, 2.4, 4.5, -35, 0.78),
  makeLobe(-3, 54, 3.2, 3.8, 12, 0.78),
  makeLobe(16, 63, 7.5, 8.5, 35, 0.95),
  makeLobe(22, 41, 4.5, 4.0, -20, 0.82),
  makeLobe(14, 36, 19, 4.2, -5, -1.16), // Mediterranean Sea
  makeLobe(34, 43, 6.2, 2.6, 5, -0.96), // Black Sea
  makeLobe(19, 58, 4.2, 3.2, 30, -0.78), // Baltic Sea

  // Africa
  makeLobe(-2, 24, 16, 9.5, 5, 1.10),
  makeLobe(26, 21, 11, 9.5, 0, 1.05),
  makeLobe(44, 8, 6.5, 5.5, 30, 0.88),
  makeLobe(21, 1, 10, 9.5, 0, 1.05),
  makeLobe(23, -21, 8.5, 12.5, 5, 1.02),
  makeLobe(46.8, -19, 2.2, 5.2, 22, 0.80), // Madagascar
  makeLobe(38, 21, 2.2, 8.2, -32, -1.06), // Red Sea
  makeLobe(1, 1, 7.5, 5.2, 0, -0.84), // Gulf of Guinea

  // Eurasia & Asia
  makeLobe(45, 22, 8.5, 7.2, -30, 1.02), // Arabia
  makeLobe(44, 36, 13, 6.5, -10, 0.98),
  makeLobe(68, 60, 32, 11, 5, 1.12),
  makeLobe(122, 62, 26, 10, -8, 1.06),
  makeLobe(160, 56, 3.5, 6.5, 25, 0.80), // Kamchatka
  makeLobe(98, 37, 24, 13, 8, 1.12),
  makeLobe(78, 20, 7.5, 10.5, 0, 1.02), // India
  makeLobe(102, 15, 5.5, 8.2, -12, 0.92),
  makeLobe(101.5, 5, 1.8, 4.5, -22, 0.76),
  makeLobe(138, 36.5, 2.5, 6.5, 38, 0.78), // Japan
  makeLobe(51, 26.5, 4.2, 1.8, -35, -0.92), // Persian Gulf
  makeLobe(89, 14, 5.2, 6.5, 10, -0.78), // Bay of Bengal
  makeLobe(114, 14, 6.5, 7.2, 15, -0.82), // South China Sea

  // Maritime SE Asia & Oceania
  makeLobe(101, -1, 2.2, 5.8, -40, 0.76),
  makeLobe(110, -7.2, 4.8, 1.4, -5, 0.74),
  makeLobe(114, 1, 4.2, 4.5, 15, 0.84),
  makeLobe(122, 12, 2.2, 4.8, -10, 0.72),
  makeLobe(141, -5, 7.2, 2.8, -18, 0.82),
  makeLobe(134, -25, 18.5, 11.5, -8, 1.08), // Australia
  makeLobe(139, -14, 3.5, 3.2, 0, -0.78),
  makeLobe(172, -42, 2.2, 5.2, 35, 0.74), // New Zealand

  // Antarctica Ross & Weddell sea indentations
  makeLobe(-45, -75, 18, 6, 0, -0.62),
  makeLobe(-170, -76, 20, 6.5, 0, -0.65),
];

const CITY_CORRIDORS: [number, number, number, number][] = [
  [-77, 39, 9, 6], // US East Coast
  [-88, 40, 8, 5], // Midwest
  [-119, 35, 5, 5], // California
  [-99, 19, 4, 3], // Mexico City
  [-46, -22, 7, 5], // SE Brazil
  [4, 49, 12, 6], // Western Europe
  [37, 55, 7, 5], // Moscow
  [31, 30, 3, 4], // Nile Delta / Cairo
  [77, 23, 9, 8], // India / Ganges
  [115, 33, 9, 8], // Eastern China
  [137, 36, 4, 3], // Japan
  [107, -6, 5, 3], // Java
  [148, -35, 4, 4], // SE Australia
];

export function createEarthPBR(maxAnisotropy: number): PBRTextureSet {
  const w = 1536;
  const h = 768;
  const albedo = new Uint8Array(w * h * 4);
  const rough = new Uint8Array(w * h * 4);
  const height = new Float32Array(w * h);
  const clouds = new Uint8Array(w * h * 4);
  const emissive = new Uint8Array(w * h * 4);

  for (let y = 0; y < h; y++) {
    // Three.js DataTexture flipY=false -> y=0 maps to South Pole (-90), y=h-1 maps to North Pole (+90)
    const latDeg = ((y + 0.5) / h) * 180 - 90;
    const latAbs = Math.abs(latDeg) / 90;
    const latRad = (latDeg * Math.PI) / 180;
    const cosLat = Math.cos(latRad);
    const ny = Math.sin(latRad);

    for (let x = 0; x < w; x++) {
      const lonDeg = (x / w) * 360 - 180;
      const lonRad = (lonDeg * Math.PI) / 180;
      const nx = cosLat * Math.cos(lonRad);
      const nz = cosLat * Math.sin(lonRad);

      // Evaluate continent signed field from lobes with wrap-around longitude
      let landField = latDeg < -72 ? 0.92 : 0;
      for (let i = 0; i < EARTH_LOBES.length; i++) {
        const L = EARTH_LOBES[i];
        if (Math.abs(latDeg - L.lat) > L.ry * 2.0) continue;
        let dLon = lonDeg - L.lon;
        if (dLon > 180) dLon -= 360;
        else if (dLon < -180) dLon += 360;
        if (Math.abs(dLon) > L.rx * 2.0) continue;

        const dLat = latDeg - L.lat;
        const rx2 = L.cosR * dLon + L.sinR * dLat;
        const ry2 = -L.sinR * dLon + L.cosR * dLat;
        const q = (rx2 * rx2) / (L.rx * L.rx) + (ry2 * ry2) / (L.ry * L.ry);
        if (q < 3.4) {
          const val = L.w * Math.exp(-q * 1.15);
          if (L.w > 0) {
            if (val > landField) landField = val;
            else landField += val * 0.18;
          } else {
            landField += val;
          }
        }
      }

      // Fractal spherical coastline & mountain detail (zero Date-Line seam!)
      const coastDetail = fbm3(nx * 6.8, ny * 6.8, nz * 6.8, 4, 21) - 0.5;
      const fineCoast = fbm3(nx * 19.0, ny * 19.0, nz * 19.0, 3, 49) - 0.5;
      const ridge = ridged3(nx * 8.4, ny * 8.4, nz * 8.4, 4, 57);
      const moisture = fbm3(nx * 4.2 + 7, ny * 4.2, nz * 4.2 - 3, 3, 73);

      const contVal = landField + coastDetail * 0.28 + fineCoast * 0.11;
      const seaLevel = 0.36;
      const idx = (y * w + x) * 4;

      let r = 0;
      let g = 0;
      let b = 0;
      let rVal = 200;
      let cityGlow = 0;

      const polarIce =
        latDeg < -70 + coastDetail * 6 ||
        latDeg > 81 + coastDetail * 6 ||
        (latDeg > 64 && landField > 0.58 && lonDeg > -62 && lonDeg < -20); // Greenland ice sheet

      if (polarIce) {
        r = 234 + fineCoast * 18;
        g = 242 + fineCoast * 16;
        b = 250;
        rVal = 112;
        height[y * w + x] = 0.28;
      } else if (contVal < seaLevel) {
        // Rich PatelDev Blue Marble deep cobalt oceans + turquoise shallow continental shelves
        const depth = clamp((seaLevel - contVal) / 0.14, 0, 1);
        const shelf = Math.pow(1 - depth, 3.0);
        const wave = fineCoast * 6;
        r = lerp(8, 28, shelf) + wave * 0.5;
        g = lerp(28, 128, shelf) + wave;
        b = lerp(74, 178, shelf) + wave * 1.4;
        rVal = 40; // Crisp sunlit specular reflection on ocean water
        height[y * w + x] = 0;
      } else {
        // Land biomes: tropical emerald -> temperate green -> Sahara/Arabia/Outback desert -> alpine ridges
        const coastalElev = clamp((contVal - seaLevel) / 0.36, 0, 1);
        // Enhance Himalayas / Andes / Rockies tectonic uplift
        const himalayaBoost =
          latDeg > 26 && latDeg < 40 && lonDeg > 72 && lonDeg < 102 ? 0.36 : 0;
        const andesBoost =
          latDeg > -48 && latDeg < 8 && lonDeg > -76 && lonDeg < -65 ? 0.32 : 0;
        const elev = clamp(coastalElev * 0.55 + ridge * 0.42 + himalayaBoost + andesBoost, 0, 1);
        height[y * w + x] = elev;
        rVal = Math.round(lerp(208, 238, elev));

        // Subtropical arid belts (Sahara, Arabia, Central Asia, Australian Outback, SW USA)
        const inSaharaArabia = latDeg > 13 && latDeg < 34 && lonDeg > -17 && lonDeg < 62;
        const inOutback = latDeg < -18 && latDeg > -32 && lonDeg > 118 && lonDeg < 143;
        const inSwUsa = latDeg > 25 && latDeg < 38 && lonDeg > -116 && lonDeg < -102;
        const inCentralAsia = latDeg > 36 && latDeg < 46 && lonDeg > 55 && lonDeg < 105;
        const desertMask =
          inSaharaArabia || inOutback || inSwUsa || inCentralAsia
            ? clamp(0.65 + (0.55 - moisture) * 0.85, 0.25, 1)
            : 0;

        if (elev > 0.74) {
          const t = clamp((elev - 0.74) / 0.22, 0, 1);
          r = lerp(124, 240, t);
          g = lerp(118, 244, t);
          b = lerp(112, 250, t);
        } else if (desertMask > 0.22) {
          r = lerp(92, 206, desertMask) + fineCoast * 18;
          g = lerp(112, 168, desertMask) + fineCoast * 14;
          b = lerp(56, 118, desertMask) + fineCoast * 10;
        } else if (latAbs < 0.22) {
          // Equatorial tropical rainforest (Amazon, Congo, Indonesia)
          const lush = clamp(moisture + 0.15, 0, 1);
          r = lerp(32, 22, lush) + fineCoast * 12;
          g = lerp(84, 72, lush) + fineCoast * 14;
          b = lerp(38, 32, lush);
        } else {
          // Temperate forests & grasslands
          const northFade = clamp((latDeg - 52) / 22, 0, 1);
          r = lerp(42, 74, moisture) + northFade * 24 + fineCoast * 14;
          g = lerp(88, 104, moisture) + northFade * 14 + fineCoast * 14;
          b = lerp(36, 48, moisture) + northFade * 18;
        }

        // Golden metropolitan night-side city lights near coastal corridors
        const cityNoise = fbm3(nx * 46.0, ny * 46.0, nz * 46.0, 2, 311);
        if (cityNoise > 0.56 && elev < 0.55) {
          for (let c = 0; c < CITY_CORRIDORS.length; c++) {
            const [cLon, cLat, cRx, cRy] = CITY_CORRIDORS[c];
            let dLon = lonDeg - cLon;
            if (dLon > 180) dLon -= 360;
            else if (dLon < -180) dLon += 360;
            const dLat = latDeg - cLat;
            const d2 = (dLon * dLon) / (cRx * cRx) + (dLat * dLat) / (cRy * cRy);
            if (d2 < 1.2) {
              cityGlow = Math.max(cityGlow, (1 - d2 / 1.2) * ((cityNoise - 0.56) / 0.44));
            }
          }
        }
      }

      albedo[idx] = clamp(Math.round(r), 0, 255);
      albedo[idx + 1] = clamp(Math.round(g), 0, 255);
      albedo[idx + 2] = clamp(Math.round(b), 0, 255);
      albedo[idx + 3] = 255;

      rough[idx] = rVal;
      rough[idx + 1] = rVal;
      rough[idx + 2] = rVal;
      rough[idx + 3] = 255;

      const glowAmt = clamp(cityGlow * 1.85, 0, 1);
      emissive[idx] = Math.round(glowAmt * 255);
      emissive[idx + 1] = Math.round(glowAmt * 188);
      emissive[idx + 2] = Math.round(glowAmt * 78);
      emissive[idx + 3] = 255;

      // Multi-layered realistic global swirling cyclonic cloud formations
      const swirl = fbm3(nx * 2.8, ny * 2.8, nz * 2.8, 3, 104);
      const band = fbm3(nx * 5.8 + swirl * 1.45, ny * 8.2, nz * 5.8 - swirl * 1.45, 4, 131);
      const wisp = fbm3(nx * 14.0 - swirl * 0.9, ny * 14.0, nz * 14.0 + swirl * 0.9, 3, 197);
      const cloudVal = band * 0.68 + wisp * 0.32;
      const alpha = clamp((cloudVal - 0.505) * 4.5, 0, 1);
      clouds[idx] = 250;
      clouds[idx + 1] = 252;
      clouds[idx + 2] = 255;
      clouds[idx + 3] = Math.round(alpha * 238);
    }
  }

  const makeUpgradableCanvasTexture = (
    data: Uint8Array,
    width: number,
    height: number,
    srgb: boolean
  ): THREE.Texture => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const imgData = ctx.createImageData(width, height);
      // Flip vertically so canvas top-left matches DataTexture flipY=false
      for (let row = 0; row < height; row++) {
        const srcOff = (height - 1 - row) * width * 4;
        const dstOff = row * width * 4;
        imgData.data.set(data.subarray(srcOff, srcOff + width * 4), dstOff);
      }
      ctx.putImageData(imgData, 0, 0);
    }
    const tex = new THREE.Texture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.flipY = true;
    tex.anisotropy = maxAnisotropy;
    tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    tex.needsUpdate = true;
    return tex;
  };

  const map = makeUpgradableCanvasTexture(albedo, w, h, true);
  const normalMap = heightFieldToNormalTexture(height, w, h, 8.2, maxAnisotropy);
  const roughnessMap = makeUpgradableCanvasTexture(rough, w, h, false);
  const cloudsMap = makeUpgradableCanvasTexture(clouds, w, h, true);
  const emissiveMap = makeUpgradableCanvasTexture(emissive, w, h, true);

  // Load the Sketchfab 8K Earth GLB asset (/assets/models/earth-8k.glb) and 8K cloud/specular maps
  const gltfLoader = new GLTFLoader();
  gltfLoader
    .loadAsync('/assets/models/earth-8k.glb')
    .then((gltf) => {
      gltf.scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        const std = mesh.material as THREE.MeshStandardMaterial;
        if (!std) return;
        if (std.map?.image) {
          map.image = std.map.image;
          map.flipY = true;
          map.colorSpace = THREE.SRGBColorSpace;
          map.needsUpdate = true;
        }
        if (std.emissiveMap?.image) {
          emissiveMap.image = std.emissiveMap.image;
          emissiveMap.flipY = true;
          emissiveMap.colorSpace = THREE.SRGBColorSpace;
          emissiveMap.needsUpdate = true;
        }
      });
    })
    .catch((err) => {
      console.error('Failed to load Sketchfab 8K Earth GLB:', err);
    });

  const texLoader = new THREE.TextureLoader();
  texLoader.load('/assets/models/earth_8k_clouds.jpg', (cloudTex) => {
    if (cloudTex.image) {
      cloudsMap.image = cloudTex.image;
      cloudsMap.flipY = true;
      cloudsMap.colorSpace = THREE.SRGBColorSpace;
      cloudsMap.needsUpdate = true;
    }
  });

  return {
    map,
    normalMap,
    roughnessMap,
    cloudsMap,
    emissiveMap,
    dispose: () => {
      map.dispose();
      normalMap.dispose();
      roughnessMap.dispose();
      cloudsMap.dispose();
      emissiveMap.dispose();
    },
  };
}

// ============================================================================
// 2B. Earth Coastal Spaceport Surface (Atlantic Ocean, Barrier Beach, Green Coast, LC-39A)
// ============================================================================

export function createEarthLaunchSurfacePBR(maxAnisotropy: number): PBRTextureSet {
  const w = 1024;
  const h = 1024;
  const albedo = new Uint8Array(w * h * 4);
  const rough = new Uint8Array(w * h * 4);
  const height = new Float32Array(w * h);

  for (let y = 0; y < h; y++) {
    const ny = (y / h) * 2 - 1; // -1..1 (North-South)
    for (let x = 0; x < w; x++) {
      const nx = (x / w) * 2 - 1; // -1..1 (West-East)
      const idx = (y * w + x) * 4;

      const coastNoise = fbm3(nx * 6.5, ny * 6.5, 1.3, 4, 41) * 0.08;
      const micro = fbm3(nx * 28.0, ny * 28.0, 3.1, 4, 97);
      const canopy = fbm3(nx * 54.0, ny * 54.0, 5.7, 3, 151);

      // Eastern Atlantic Ocean coastline right alongside LC-39A
      const coastX = 0.045 + Math.sin(ny * 3.8) * 0.032 + coastNoise;
      // Western Indian River coastal lagoon
      const riverCenter = -0.095 + Math.sin(ny * 4.5 + 0.6) * 0.025 + coastNoise * 0.4;
      const inRiver = Math.abs(nx - riverCenter) < 0.028 + (micro - 0.5) * 0.012;

      // Pad & Crawlerway clearing right around center (0, 0)
      const distPad = Math.hypot(nx, ny);
      const onCrawlerway = ny > -0.01 && ny < 0.01 && nx < 0.012 && nx > -0.09;

      let r = 0;
      let g = 0;
      let b = 0;
      let rVal = 220;
      let hVal = 0.45;

      if (distPad < 0.012) {
        // Concrete LC-39A pad apron
        r = 78 + micro * 24;
        g = 86 + micro * 24;
        b = 96 + micro * 22;
        rVal = 215;
        hVal = 0.52;
      } else if (onCrawlerway) {
        // NASA gravel crawlerway leading into launch pad
        r = 128 + micro * 28;
        g = 122 + micro * 24;
        b = 110 + micro * 22;
        rVal = 225;
        hVal = 0.5;
      } else if (nx > coastX) {
        // Atlantic Ocean with turquoise coastal surf shelf -> deep marine blue
        const depthT = clamp((nx - coastX) / 0.16, 0, 1);
        const wave = Math.sin(nx * 220 + ny * 90 + micro * 6) * 0.5 + 0.5;
        if (nx < coastX + 0.008) {
          // Sandy beach & white surf foam
          const foam = clamp(1 - (nx - coastX) / 0.008, 0, 1);
          r = lerp(38, 224, foam);
          g = lerp(138, 232, foam);
          b = lerp(164, 226, foam);
          rVal = lerp(55, 175, foam);
          hVal = 0.16 + wave * 0.02;
        } else {
          r = lerp(22, 8, depthT) + wave * 6;
          g = lerp(112, 36, depthT) + wave * 8;
          b = lerp(148, 88, depthT) + wave * 12;
          rVal = 42;
          hVal = 0.1 + wave * 0.03;
        }
      } else if (nx > coastX - 0.007) {
        // Golden-tan coastal beach dunes
        r = 194 + micro * 24;
        g = 174 + micro * 22;
        b = 132 + micro * 18;
        rVal = 235;
        hVal = 0.28 + micro * 0.06;
      } else if (inRiver) {
        // Inland coastal lagoon
        r = 14 + micro * 10;
        g = 62 + micro * 18;
        b = 98 + micro * 22;
        rVal = 48;
        hVal = 0.12;
      } else {
        // Lush emerald-green coastal terrain, wetlands & forests
        const greenMix = clamp(micro * 0.55 + canopy * 0.45, 0, 1);
        const wetland = fbm3(nx * 14, ny * 14, 2.2, 3, 71);
        if (wetland < 0.39) {
          r = lerp(30, 48, greenMix);
          g = lerp(74, 96, greenMix);
          b = lerp(46, 56, greenMix);
          rVal = 175;
          hVal = 0.34;
        } else {
          r = lerp(42, 76, greenMix);
          g = lerp(88, 128, greenMix);
          b = lerp(36, 54, greenMix);
          rVal = 225;
          hVal = 0.45 + canopy * 0.25;
        }
      }

      // Soft outer vignette fade into global ocean blue near rim of cap so it blends seamlessly with Earth globe
      const radialFade = clamp((Math.hypot(nx, ny) - 0.82) / 0.18, 0, 1);
      if (radialFade > 0) {
        r = lerp(r, 12, radialFade);
        g = lerp(g, 52, radialFade);
        b = lerp(b, 102, radialFade);
        rVal = Math.round(lerp(rVal, 90, radialFade));
      }

      albedo[idx] = clamp(Math.round(r), 0, 255);
      albedo[idx + 1] = clamp(Math.round(g), 0, 255);
      albedo[idx + 2] = clamp(Math.round(b), 0, 255);
      albedo[idx + 3] = 255;

      rough[idx] = rVal;
      rough[idx + 1] = rVal;
      rough[idx + 2] = rVal;
      rough[idx + 3] = 255;

      height[y * w + x] = hVal;
    }
  }

  const map = makeDataTexture(albedo, w, h, true, maxAnisotropy);
  const normalMap = heightFieldToNormalTexture(height, w, h, 3.8, maxAnisotropy);
  const roughnessMap = makeDataTexture(rough, w, h, false, maxAnisotropy);

  return {
    map,
    normalMap,
    roughnessMap,
    dispose: () => {
      map.dispose();
      normalMap.dispose();
      roughnessMap.dispose();
    },
  };
}

// ============================================================================
// 3. The Moon / Mercury (Basalt Maria + Impact Craters + Regolith Normal)
// ============================================================================

export function createMoonPBR(maxAnisotropy: number, tintWarm = false): PBRTextureSet {
  const w = 1024;
  const h = 512;
  const albedo = new Uint8Array(w * h * 4);
  const rough = new Uint8Array(w * h * 4);
  const height = new Float32Array(w * h);

  const rand = seededRand(tintWarm ? 409 : 204);
  const craters: { cx: number; cy: number; cz: number; rad: number; maxDistSq: number; depth: number }[] = [];
  for (let i = 0; i < 48; i++) {
    const theta = rand() * Math.PI * 2;
    const phi = Math.acos(2 * rand() - 1);
    const rad = 0.04 + Math.pow(rand(), 2.4) * 0.24;
    const maxR = rad * 1.45;
    craters.push({
      cx: Math.sin(phi) * Math.cos(theta),
      cy: Math.cos(phi),
      cz: Math.sin(phi) * Math.sin(theta),
      rad,
      maxDistSq: maxR * maxR,
      depth: 0.25 + rand() * 0.45,
    });
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [nx, ny, nz] = sphereDir(x, y, w, h);
      const maria = fbm3(nx * 2.2, ny * 2.2, nz * 2.2, 5, 31);
      const detail = fbm3(nx * 16.0, ny * 16.0, nz * 16.0, 4, 67);

      let elev = maria * 0.35 + detail * 0.22;
      let ejectaBright = 0;

      for (let i = 0; i < craters.length; i++) {
        const c = craters[i];
        const dx = nx - c.cx;
        const dy = ny - c.cy;
        const dz = nz - c.cz;
        const distSq = dx * dx + dy * dy + dz * dz;
        if (distSq < c.maxDistSq) {
          const rNorm = Math.sqrt(distSq) / c.rad;
          if (rNorm < 0.82) {
            const bowl = Math.cos((rNorm / 0.82) * (Math.PI * 0.5));
            elev -= bowl * c.depth * 0.48;
          } else if (rNorm < 1.12) {
            const rimT = 1 - Math.abs(rNorm - 0.96) / 0.16;
            elev += Math.max(0, rimT) * c.depth * 0.24;
            ejectaBright += Math.max(0, rimT) * 0.18;
          } else {
            const apron = 1 - (rNorm - 1.12) / 0.33;
            ejectaBright += Math.max(0, apron) * 0.08;
          }
        }
      }

      const idx = (y * w + x) * 4;
      height[y * w + x] = elev;

      // Maria darker basalt vs bright highland regolith
      const baseTone = maria < 0.47 ? lerp(0.32, 0.48, maria / 0.47) : lerp(0.52, 0.78, (maria - 0.47) / 0.53);
      const shade = clamp(baseTone + (detail - 0.5) * 0.18 + ejectaBright, 0.18, 0.94);

      const r = shade * (tintWarm ? 220 : 210);
      const g = shade * (tintWarm ? 204 : 212);
      const b = shade * (tintWarm ? 186 : 218);

      albedo[idx] = Math.round(r);
      albedo[idx + 1] = Math.round(g);
      albedo[idx + 2] = Math.round(b);
      albedo[idx + 3] = 255;

      const rVal = clamp(Math.round(lerp(215, 245, 1 - ejectaBright)), 180, 250);
      rough[idx] = rVal;
      rough[idx + 1] = rVal;
      rough[idx + 2] = rVal;
      rough[idx + 3] = 255;
    }
  }

  const map = makeDataTexture(albedo, w, h, true, maxAnisotropy);
  const normalMap = heightFieldToNormalTexture(height, w, h, 8.5, maxAnisotropy);
  const roughnessMap = makeDataTexture(rough, w, h, false, maxAnisotropy);

  return {
    map,
    normalMap,
    roughnessMap,
    dispose: () => {
      map.dispose();
      normalMap.dispose();
      roughnessMap.dispose();
    },
  };
}

// ============================================================================
// 4. Mars & Proxima b (Iron Oxide Strata, Canyons, Dust & Polar Caps)
// ============================================================================

export function createMarsPBR(maxAnisotropy: number, exoplanet = false): PBRTextureSet {
  const w = 1024;
  const h = 512;
  const albedo = new Uint8Array(w * h * 4);
  const rough = new Uint8Array(w * h * 4);
  const height = new Float32Array(w * h);

  for (let y = 0; y < h; y++) {
    const lat = Math.abs((y / h) * 2 - 1);
    for (let x = 0; x < w; x++) {
      const [nx, ny, nz] = sphereDir(x, y, w, h);
      const terrain = fbm3(nx * 2.8, ny * 2.8, nz * 2.8, 5, exoplanet ? 311 : 117);
      const canyon = ridged3(nx * 4.5, ny * 4.5, nz * 4.5, 4, exoplanet ? 341 : 155);
      const micro = fbm3(nx * 14, ny * 14, nz * 14, 3, 189);

      const elev = terrain * 0.65 + (1 - canyon) * 0.25 + micro * 0.1;
      height[y * w + x] = elev;

      const idx = (y * w + x) * 4;
      const polarCap = !exoplanet && lat > 0.89 + (terrain - 0.5) * 0.08;

      if (polarCap) {
        albedo[idx] = 240;
        albedo[idx + 1] = 236;
        albedo[idx + 2] = 232;
        rough[idx] = 175;
      } else {
        const darkBasalt = clamp((0.52 - terrain) * 2.4, 0, 1);
        const dust = clamp((terrain - 0.45) * 2.1, 0, 1);
        let r = exoplanet ? lerp(110, 232, dust) : lerp(92, 206, dust);
        let g = exoplanet ? lerp(38, 108, dust) : lerp(42, 98, dust);
        let b = exoplanet ? lerp(18, 48, dust) : lerp(28, 54, dust);

        r = lerp(r, exoplanet ? 64 : 74, darkBasalt * 0.65) + (micro - 0.5) * 24;
        g = lerp(g, exoplanet ? 24 : 36, darkBasalt * 0.65) + (micro - 0.5) * 14;
        b = lerp(b, exoplanet ? 16 : 26, darkBasalt * 0.65) + (micro - 0.5) * 10;

        albedo[idx] = clamp(Math.round(r), 0, 255);
        albedo[idx + 1] = clamp(Math.round(g), 0, 255);
        albedo[idx + 2] = clamp(Math.round(b), 0, 255);

        const rv = clamp(Math.round(lerp(205, 242, dust)), 180, 250);
        rough[idx] = rv;
      }
      albedo[idx + 3] = 255;
      rough[idx + 1] = rough[idx];
      rough[idx + 2] = rough[idx];
      rough[idx + 3] = 255;
    }
  }

  const map = makeDataTexture(albedo, w, h, true, maxAnisotropy);
  const normalMap = heightFieldToNormalTexture(height, w, h, 8.0, maxAnisotropy);
  const roughnessMap = makeDataTexture(rough, w, h, false, maxAnisotropy);

  return {
    map,
    normalMap,
    roughnessMap,
    dispose: () => {
      map.dispose();
      normalMap.dispose();
      roughnessMap.dispose();
    },
  };
}

// ============================================================================
// 5. Jupiter (Turbulent Zonal Belts, Festoons & Great Red Spot)
// ============================================================================

export function createJupiterPBR(maxAnisotropy: number): PBRTextureSet {
  const w = 1024;
  const h = 512;
  const albedo = new Uint8Array(w * h * 4);
  const height = new Float32Array(w * h);

  const palette = [
    [138, 122, 108], // N polar haze
    [226, 209, 184], // N temperate zone
    [172, 114, 72],  // N temperate belt
    [238, 224, 198], // N tropical zone
    [164, 96, 56],   // North Equatorial Belt (dark rust)
    [242, 232, 214], // Equatorial Zone (bright cream)
    [184, 112, 68],  // South Equatorial Belt
    [232, 216, 192], // S tropical zone
    [152, 114, 88],  // S temperate belt
    [214, 198, 174], // S temperate zone
    [132, 118, 108], // S polar haze
  ];

  for (let y = 0; y < h; y++) {
    const v = y / h;
    for (let x = 0; x < w; x++) {
      const u = x / w;
      const [nx, ny, nz] = sphereDir(x, y, w, h);

      // Turbulent jet-stream domain warp
      const eddy = fbm3(nx * 4.5, ny * 11.0, nz * 4.5, 5, 221);
      const fine = fbm3(nx * 14.0 + eddy * 1.4, ny * 26.0, nz * 14.0, 4, 241);
      const bandCoord = clamp(v + (eddy - 0.5) * 0.085 + (fine - 0.5) * 0.025, 0, 0.999);

      const scaled = bandCoord * (palette.length - 1);
      const i0 = Math.floor(scaled);
      const i1 = Math.min(palette.length - 1, i0 + 1);
      const t = smoothstep(scaled - i0);

      let r = lerp(palette[i0][0], palette[i1][0], t) + (fine - 0.5) * 26;
      let g = lerp(palette[i0][1], palette[i1][1], t) + (fine - 0.5) * 20;
      let b = lerp(palette[i0][2], palette[i1][2], t) + (fine - 0.5) * 16;
      let hVal = eddy * 0.5 + fine * 0.5;

      // Great Red Spot (oval vortex at u=0.62, v=0.63)
      const dx = (u - 0.62) * 1.0;
      const dy = (v - 0.63) * 1.85;
      const spotDist = Math.sqrt(dx * dx + dy * dy);
      if (spotDist < 0.085) {
        const sNorm = 1 - spotDist / 0.085;
        const swirl = Math.sin(spotDist * 95 + Math.atan2(dy, dx) * 2.0) * 0.5 + 0.5;
        const mixFactor = smoothstep(sNorm);
        r = lerp(r, lerp(188, 218, swirl), mixFactor);
        g = lerp(g, lerp(68, 108, swirl), mixFactor);
        b = lerp(b, lerp(44, 68, swirl), mixFactor);
        hVal += mixFactor * 0.35;
      }

      const idx = (y * w + x) * 4;
      albedo[idx] = clamp(Math.round(r), 0, 255);
      albedo[idx + 1] = clamp(Math.round(g), 0, 255);
      albedo[idx + 2] = clamp(Math.round(b), 0, 255);
      albedo[idx + 3] = 255;
      height[y * w + x] = hVal;
    }
  }

  const map = makeDataTexture(albedo, w, h, true, maxAnisotropy);
  const normalMap = heightFieldToNormalTexture(height, w, h, 2.2, maxAnisotropy);

  return {
    map,
    normalMap,
    dispose: () => {
      map.dispose();
      normalMap.dispose();
    },
  };
}

// ============================================================================
// 6. Saturn & Concentric Multi-Band Ring Texture (Cassini Division)
// ============================================================================

export function createSaturnPBR(maxAnisotropy: number): PBRTextureSet {
  const w = 512;
  const h = 256;
  const albedo = new Uint8Array(w * h * 4);

  for (let y = 0; y < h; y++) {
    const v = y / h;
    for (let x = 0; x < w; x++) {
      const [nx, ny, nz] = sphereDir(x, y, w, h);
      const band = Math.sin(v * Math.PI * 13) * 0.5 + 0.5;
      const haze = fbm3(nx * 3.5, ny * 9.0, nz * 3.5, 4, 307);
      const t = clamp(band * 0.6 + haze * 0.4, 0, 1);

      const idx = (y * w + x) * 4;
      albedo[idx] = Math.round(lerp(186, 238, t));
      albedo[idx + 1] = Math.round(lerp(158, 216, t));
      albedo[idx + 2] = Math.round(lerp(114, 174, t));
      albedo[idx + 3] = 255;
    }
  }

  const map = makeDataTexture(albedo, w, h, true, maxAnisotropy);
  return { map, dispose: () => map.dispose() };
}

export function createSaturnRingTexture(maxAnisotropy: number): THREE.DataTexture {
  const w = 1024;
  const h = 16;
  const data = new Uint8Array(w * h * 4);
  const rand = seededRand(88);

  const profileR = new Float32Array(w);
  const profileG = new Float32Array(w);
  const profileB = new Float32Array(w);
  const profileA = new Float32Array(w);

  for (let x = 0; x < w; x++) {
    const t = x / (w - 1); // 0 = inner edge, 1 = outer edge
    const ripple = Math.sin(t * 190) * 0.1 + Math.sin(t * 420) * 0.06 + (rand() - 0.5) * 0.08;

    let alpha = 0;
    let r = 224;
    let g = 205;
    let b = 176;

    if (t < 0.05 || t > 0.98) {
      alpha = 0;
    } else if (t < 0.24) {
      // C Ring (faint dusky)
      alpha = 0.22 + ripple * 0.35;
      r = 168;
      g = 154;
      b = 140;
    } else if (t < 0.62) {
      // B Ring (bright dense icy bands)
      alpha = 0.86 + ripple * 0.45;
      r = 236 + ripple * 35;
      g = 218 + ripple * 30;
      b = 186 + ripple * 25;
    } else if (t < 0.69) {
      // Cassini Division (dark gap)
      alpha = 0.06;
    } else if (t < 0.94) {
      // A Ring + Encke Gap around 0.87
      if (t > 0.865 && t < 0.882) {
        alpha = 0.08;
      } else {
        alpha = 0.66 + ripple * 0.4;
        r = 214;
        g = 198;
        b = 175;
      }
    } else {
      // F Ring thin shepherd strand
      alpha = t > 0.96 && t < 0.972 ? 0.52 : 0.05;
    }

    profileR[x] = clamp(r, 0, 255);
    profileG[x] = clamp(g, 0, 255);
    profileB[x] = clamp(b, 0, 255);
    profileA[x] = clamp(alpha * 255, 0, 255);
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      data[idx] = Math.round(profileR[x]);
      data[idx + 1] = Math.round(profileG[x]);
      data[idx + 2] = Math.round(profileB[x]);
      data[idx + 3] = Math.round(profileA[x]);
    }
  }

  return makeDataTexture(data, w, h, true, maxAnisotropy, false);
}

// ============================================================================
// 7. Europa (Cryogenic Water Ice + Tectonic Red-Brown Lineae Cracks)
// ============================================================================

export function createEuropaIcePBR(maxAnisotropy: number): PBRTextureSet {
  const w = 1024;
  const h = 512;
  const albedo = new Uint8Array(w * h * 4);
  const rough = new Uint8Array(w * h * 4);
  const height = new Float32Array(w * h);

  const rand = seededRand(512);
  // Precompute great-circle tectonic fracture planes
  const planes: { ax: number; ay: number; az: number; width: number }[] = [];
  for (let i = 0; i < 34; i++) {
    const theta = rand() * Math.PI * 2;
    const phi = Math.acos(2 * rand() - 1);
    planes.push({
      ax: Math.sin(phi) * Math.cos(theta),
      ay: Math.cos(phi),
      az: Math.sin(phi) * Math.sin(theta),
      width: 0.008 + rand() * 0.018,
    });
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [nx, ny, nz] = sphereDir(x, y, w, h);
      const baseIce = fbm3(nx * 4.5, ny * 4.5, nz * 4.5, 4, 419);

      let crack = 0;
      for (let i = 0; i < planes.length; i++) {
        const p = planes[i];
        const warp = (baseIce - 0.5) * 0.06;
        const d = Math.abs(nx * p.ax + ny * p.ay + nz * p.az + warp);
        if (d < p.width) {
          crack = Math.max(crack, 1 - d / p.width);
        }
      }

      const idx = (y * w + x) * 4;
      height[y * w + x] = baseIce * 0.2 - crack * 0.65;

      // Pale icy blue-white vs ochre-rust hydrated salt fractures
      const r = lerp(212 + baseIce * 34, 152, crack * 0.85);
      const g = lerp(228 + baseIce * 24, 108, crack * 0.85);
      const b = lerp(242 + baseIce * 12, 82, crack * 0.85);

      albedo[idx] = clamp(Math.round(r), 0, 255);
      albedo[idx + 1] = clamp(Math.round(g), 0, 255);
      albedo[idx + 2] = clamp(Math.round(b), 0, 255);
      albedo[idx + 3] = 255;

      const rv = clamp(Math.round(lerp(58, 195, crack)), 40, 220);
      rough[idx] = rv;
      rough[idx + 1] = rv;
      rough[idx + 2] = rv;
      rough[idx + 3] = 255;
    }
  }

  const map = makeDataTexture(albedo, w, h, true, maxAnisotropy);
  const normalMap = heightFieldToNormalTexture(height, w, h, 9.0, maxAnisotropy);
  const roughnessMap = makeDataTexture(rough, w, h, false, maxAnisotropy);

  return {
    map,
    normalMap,
    roughnessMap,
    dispose: () => {
      map.dispose();
      normalMap.dispose();
      roughnessMap.dispose();
    },
  };
}

// ============================================================================
// 8. Asteroid (Psyche / Bennu Metallic-Carbonaceous Regolith)
// ============================================================================

export function createAsteroidPBR(maxAnisotropy: number): PBRTextureSet {
  const w = 512;
  const h = 256;
  const albedo = new Uint8Array(w * h * 4);
  const rough = new Uint8Array(w * h * 4);
  const height = new Float32Array(w * h);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [nx, ny, nz] = sphereDir(x, y, w, h);
      const rock = fbm3(nx * 5.5, ny * 5.5, nz * 5.5, 5, 601);
      const ridge = ridged3(nx * 9.0, ny * 9.0, nz * 9.0, 4, 619);
      const metallic = ridge > 0.72 ? (ridge - 0.72) * 3.2 : 0;

      const elev = rock * 0.65 + ridge * 0.35;
      height[y * w + x] = elev;

      const tone = lerp(58, 128, elev) + metallic * 45;
      const idx = (y * w + x) * 4;
      albedo[idx] = clamp(Math.round(tone * 1.04), 0, 255);
      albedo[idx + 1] = clamp(Math.round(tone * 0.99), 0, 255);
      albedo[idx + 2] = clamp(Math.round(tone * 0.96), 0, 255);
      albedo[idx + 3] = 255;

      const rv = clamp(Math.round(lerp(235, 95, metallic)), 70, 245);
      rough[idx] = rv;
      rough[idx + 1] = rv;
      rough[idx + 2] = rv;
      rough[idx + 3] = 255;
    }
  }

  const map = makeDataTexture(albedo, w, h, true, maxAnisotropy);
  const normalMap = heightFieldToNormalTexture(height, w, h, 9.5, maxAnisotropy);
  const roughnessMap = makeDataTexture(rough, w, h, false, maxAnisotropy);

  return {
    map,
    normalMap,
    roughnessMap,
    dispose: () => {
      map.dispose();
      normalMap.dispose();
      roughnessMap.dispose();
    },
  };
}

// ============================================================================
// 9. Crinkled Gold Kapton MLI Thermal Foil (IMG_6714 Photorealism)
// ============================================================================

export function createKaptonFoilPBR(maxAnisotropy: number): PBRTextureSet {
  const size = 512;
  const albedo = new Uint8Array(size * size * 4);
  const rough = new Uint8Array(size * size * 4);
  const height = new Float32Array(size * size);

  const rand = seededRand(777);
  // Voronoi-style angular crinkle facets for authentic Kapton foil folds
  const pts: { x: number; y: number; tiltX: number; tiltY: number }[] = [];
  for (let i = 0; i < 160; i++) {
    pts.push({
      x: rand() * size,
      y: rand() * size,
      tiltX: (rand() - 0.5) * 2.0,
      tiltY: (rand() - 0.5) * 2.0,
    });
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let bestD = 1e9;
      let secD = 1e9;
      let bestIdx = 0;

      for (let i = 0; i < pts.length; i++) {
        let dx = Math.abs(x - pts[i].x);
        let dy = Math.abs(y - pts[i].y);
        if (dx > size * 0.5) dx = size - dx;
        if (dy > size * 0.5) dy = size - dy;
        const d = dx * dx + dy * dy;
        if (d < bestD) {
          secD = bestD;
          bestD = d;
          bestIdx = i;
        } else if (d < secD) {
          secD = d;
        }
      }

      const d1 = Math.sqrt(bestD);
      const d2 = Math.sqrt(secD);
      const crease = clamp((d2 - d1) / 14, 0, 1);
      const p = pts[bestIdx];
      const facetSlope = ((x - p.x) * p.tiltX + (y - p.y) * p.tiltY) * 0.012;
      const micro = Math.sin(x * 0.14 + y * 0.09) * 0.06;

      const hVal = crease * 0.55 + facetSlope + micro;
      height[y * size + x] = hVal;

      // Rich aerospace amber-gold Kapton reflectance
      const tone = 0.85 + crease * 0.15;
      const idx = (y * size + x) * 4;
      albedo[idx] = clamp(Math.round(246 * tone), 0, 255);
      albedo[idx + 1] = clamp(Math.round(168 * tone), 0, 255);
      albedo[idx + 2] = clamp(Math.round(28 * tone), 0, 255);
      albedo[idx + 3] = 255;

      const rv = clamp(Math.round(lerp(82, 42, crease)), 32, 120);
      rough[idx] = rv;
      rough[idx + 1] = rv;
      rough[idx + 2] = rv;
      rough[idx + 3] = 255;
    }
  }

  const map = makeDataTexture(albedo, size, size, true, maxAnisotropy);
  map.repeat.set(2, 2);
  const normalMap = heightFieldToNormalTexture(height, size, size, 12.0, maxAnisotropy, true);
  normalMap.repeat.set(2, 2);
  const roughnessMap = makeDataTexture(rough, size, size, false, maxAnisotropy);
  roughnessMap.repeat.set(2, 2);

  return {
    map,
    normalMap,
    roughnessMap,
    dispose: () => {
      map.dispose();
      normalMap.dispose();
      roughnessMap.dispose();
    },
  };
}

// ============================================================================
// 10. Aerospace Triple-Junction Solar Cells (IMG_6714)
// ============================================================================

export function createSolarCellPBR(maxAnisotropy: number): PBRTextureSet {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rctx = roughCanvas.getContext('2d')!;

  // Carbon-composite backing substrate
  ctx.fillStyle = '#071126';
  ctx.fillRect(0, 0, size, size);
  rctx.fillStyle = '#a0a0a0';
  rctx.fillRect(0, 0, size, size);

  const cols = 4;
  const rows = 8;
  const cw = size / cols;
  const rh = size / rows;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * cw + 6;
      const y = r * rh + 5;
      const w = cw - 12;
      const h = rh - 10;

      // Wafer gradient sheen
      const grad = ctx.createLinearGradient(x, y, x + w, y + h);
      grad.addColorStop(0, '#0f2c75');
      grad.addColorStop(0.5, '#1945a8');
      grad.addColorStop(1, '#102e7a');
      ctx.fillStyle = grad;

      // Octagonal cropped wafer corners (real GaAs aerospace cells!)
      const cut = 10;
      ctx.beginPath();
      ctx.moveTo(x + cut, y);
      ctx.lineTo(x + w - cut, y);
      ctx.lineTo(x + w, y + cut);
      ctx.lineTo(x + w, y + h - cut);
      ctx.lineTo(x + w - cut, y + h);
      ctx.lineTo(x + cut, y + h);
      ctx.lineTo(x, y + h - cut);
      ctx.lineTo(x, y + cut);
      ctx.closePath();
      ctx.fill();

      // Specular glass surface in roughness map
      rctx.fillStyle = '#242424';
      rctx.fill();

      // Fine silver grid fingers
      ctx.strokeStyle = 'rgba(186, 220, 255, 0.34)';
      ctx.lineWidth = 1;
      for (let f = 1; f < 6; f++) {
        const fy = y + (h / 6) * f;
        ctx.beginPath();
        ctx.moveTo(x + 4, fy);
        ctx.lineTo(x + w - 4, fy);
        ctx.stroke();
      }

      // Main silver collector busbar
      ctx.fillStyle = 'rgba(226, 232, 240, 0.72)';
      ctx.fillRect(x + w * 0.5 - 1.5, y + 2, 3, h - 4);

      // Cell border highlight
      ctx.strokeStyle = '#60a5fa';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = maxAnisotropy;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.colorSpace = THREE.NoColorSpace;
  roughnessMap.anisotropy = maxAnisotropy;

  return {
    map,
    roughnessMap,
    dispose: () => {
      map.dispose();
      roughnessMap.dispose();
    },
  };
}

// ============================================================================
// 11. Space Shuttle Thermal Tiles & Rust-Orange ET Spray-On Foam (IMG_6712)
// ============================================================================

export function createShuttleTilesPBR(maxAnisotropy: number, dark = false): PBRTextureSet {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const height = new Float32Array(size * size);
  const tileW = 32;
  const tileH = 16;
  const rand = seededRand(dark ? 911 : 922);

  ctx.fillStyle = dark ? '#0b101b' : '#eef2f7';
  ctx.fillRect(0, 0, size, size);

  for (let row = 0; row < size / tileH; row++) {
    const offset = (row % 2) * (tileW * 0.5);
    for (let col = -1; col <= size / tileW; col++) {
      const tx = col * tileW + offset;
      const ty = row * tileH;
      const v = (rand() - 0.5) * 14;
      if (dark) {
        const c = clamp(Math.round(18 + v), 8, 34);
        ctx.fillStyle = `rgb(${c}, ${c + 3}, ${c + 9})`;
      } else {
        const c = clamp(Math.round(238 + v), 215, 252);
        ctx.fillStyle = `rgb(${c}, ${c + 2}, ${c + 5})`;
      }
      ctx.fillRect(tx + 1, ty + 1, tileW - 2, tileH - 2);
    }
  }

  for (let y = 0; y < size; y++) {
    const row = Math.floor(y / tileH);
    const offset = (row % 2) * (tileW * 0.5);
    const inSeamY = y % tileH === 0 || y % tileH === tileH - 1;
    for (let x = 0; x < size; x++) {
      const inSeamX = (x + offset) % tileW < 1.5;
      height[y * size + x] = inSeamX || inSeamY ? 0.0 : 0.75;
    }
  }

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(3, 3);
  map.anisotropy = maxAnisotropy;

  const normalMap = heightFieldToNormalTexture(height, size, size, 4.5, maxAnisotropy, true);
  normalMap.repeat.set(3, 3);

  return {
    map,
    normalMap,
    dispose: () => {
      map.dispose();
      normalMap.dispose();
    },
  };
}

export function createETFoamPBR(maxAnisotropy: number): PBRTextureSet {
  const size = 512;
  const albedo = new Uint8Array(size * size * 4);
  const height = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    // Intertank structural ribbing zone
    const inIntertank = v > 0.36 && v < 0.52;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const rib = inIntertank ? Math.sin(u * Math.PI * 56) * 0.5 + 0.5 : 0;
      const foam =
        noise3(Math.cos(u * Math.PI * 2) * 8, v * 16, Math.sin(u * Math.PI * 2) * 8, 701) * 0.65 +
        noise3(Math.cos(u * Math.PI * 2) * 24, v * 48, Math.sin(u * Math.PI * 2) * 24, 709) * 0.35;

      const scorch = v * 0.14;
      const elev = foam * 0.65 + rib * 0.45;
      height[y * size + x] = elev;

      const r = lerp(152, 206, foam) - scorch * 45 + rib * 12;
      const g = lerp(58, 92, foam) - scorch * 20 + rib * 8;
      const b = lerp(18, 32, foam) + rib * 4;

      const idx = (y * size + x) * 4;
      albedo[idx] = clamp(Math.round(r), 0, 255);
      albedo[idx + 1] = clamp(Math.round(g), 0, 255);
      albedo[idx + 2] = clamp(Math.round(b), 0, 255);
      albedo[idx + 3] = 255;
    }
  }

  const map = makeDataTexture(albedo, size, size, true, maxAnisotropy);
  const normalMap = heightFieldToNormalTexture(height, size, size, 5.5, maxAnisotropy, true);

  return {
    map,
    normalMap,
    dispose: () => {
      map.dispose();
      normalMap.dispose();
    },
  };
}

// ============================================================================
// 12. Cleanroom Hangar Epoxy Floor (Brushed Slab + Precision Cyan Calibration Grid)
// ============================================================================

export function createHangarFloorPBR(maxAnisotropy: number): PBRTextureSet {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const rCanvas = document.createElement('canvas');
  rCanvas.width = size;
  rCanvas.height = size;
  const rctx = rCanvas.getContext('2d')!;

  ctx.fillStyle = '#070e1c';
  ctx.fillRect(0, 0, size, size);

  // Polished epoxy cleanroom finish with subtle slab roughness variation
  rctx.fillStyle = '#383838';
  rctx.fillRect(0, 0, size, size);

  const rand = seededRand(1024);
  for (let i = 0; i < 180; i++) {
    const gx = rand() * size;
    const gy = rand() * size;
    const gr = 20 + rand() * 70;
    const v = Math.round(44 + rand() * 35);
    rctx.fillStyle = `rgba(${v},${v},${v},0.22)`;
    rctx.beginPath();
    rctx.arc(gx, gy, gr, 0, Math.PI * 2);
    rctx.fill();
  }

  // Fine calibration sub-grid
  ctx.strokeStyle = 'rgba(14, 165, 233, 0.08)';
  ctx.lineWidth = 1.5;
  const step = size / 8;
  for (let i = 0; i <= 8; i++) {
    const p = i * step;
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, p);
    ctx.lineTo(size, p);
    ctx.stroke();
  }

  // Primary cleanroom floor expansion seams & subtle cyan border
  ctx.strokeStyle = 'rgba(34, 211, 238, 0.24)';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(1.5, 1.5, size - 3, size - 3);

  // Corner precision fiducial crosshairs
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.34)';
  ctx.lineWidth = 2;
  [0, size].forEach((cx) => {
    [0, size].forEach((cy) => {
      ctx.beginPath();
      ctx.arc(cx, cy, 18, 0, Math.PI * 2);
      ctx.stroke();
    });
  });

  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(14, 14);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = maxAnisotropy;

  const roughnessMap = new THREE.CanvasTexture(rCanvas);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(14, 14);
  roughnessMap.colorSpace = THREE.NoColorSpace;
  roughnessMap.anisotropy = maxAnisotropy;

  return {
    map,
    roughnessMap,
    dispose: () => {
      map.dispose();
      roughnessMap.dispose();
    },
  };
}

// ============================================================================
// 13. Deep Space Milky Way Skybox (2048x1024 Galactic Dust & Nebulae)
// ============================================================================

export function createMilkyWayBackdropTexture(): THREE.CanvasTexture {
  const w = 2048;
  const h = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#02040a';
  ctx.fillRect(0, 0, w, h);

  // Diagonal Milky Way galactic core glow
  const grad = ctx.createLinearGradient(0, h * 0.72, w, h * 0.2);
  grad.addColorStop(0, 'rgba(15, 23, 42, 0)');
  grad.addColorStop(0.28, 'rgba(51, 65, 85, 0.16)');
  grad.addColorStop(0.48, 'rgba(194, 128, 82, 0.26)');
  grad.addColorStop(0.56, 'rgba(226, 178, 126, 0.22)');
  grad.addColorStop(0.75, 'rgba(56, 189, 248, 0.15)');
  grad.addColorStop(1, 'rgba(10, 15, 28, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  const rand = seededRand(2048);

  // Warm & cool star-cloud nebulae puffs
  for (let i = 0; i < 240; i++) {
    const x = rand() * w;
    const bandY = h * 0.6 - (x / w) * h * 0.32 + (rand() - 0.5) * 180;
    const r = 35 + rand() * 140;
    const g = ctx.createRadialGradient(x, bandY, 0, x, bandY, r);
    const warm = rand() > 0.38;
    g.addColorStop(
      0,
      warm ? 'rgba(226, 188, 148, 0.085)' : 'rgba(96, 165, 250, 0.075)'
    );
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, bandY, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Dark galactic dust absorption rifts along the center band
  for (let i = 0; i < 85; i++) {
    const x = rand() * w;
    const bandY = h * 0.6 - (x / w) * h * 0.32 + (rand() - 0.5) * 65;
    const rx = 30 + rand() * 110;
    const ry = 10 + rand() * 32;
    ctx.fillStyle = 'rgba(2, 4, 10, 0.42)';
    ctx.beginPath();
    ctx.ellipse(x, bandY, rx, ry, -0.25, 0, Math.PI * 2);
    ctx.fill();
  }

  // Thousands of crisp background micro-stars
  for (let i = 0; i < 3600; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const r = rand() < 0.92 ? 0.65 : 1.35;
    const a = 0.25 + rand() * 0.72;
    const tint = rand();
    ctx.fillStyle =
      tint < 0.2
        ? `rgba(147, 197, 253, ${a})`
        : tint < 0.34
        ? `rgba(253, 230, 138, ${a})`
        : `rgba(248, 250, 252, ${a})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ============================================================================
// 14. Volumetric Glow & Soft Billowing Launch Smoke Sprite Textures
// ============================================================================

export function createSoftGlowTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(
    size / 2,
    size / 2,
    2,
    size / 2,
    size / 2,
    size / 2
  );
  grad.addColorStop(0, 'rgba(255, 244, 214, 0.72)');
  grad.addColorStop(0.24, 'rgba(255, 212, 132, 0.45)');
  grad.addColorStop(0.54, 'rgba(249, 115, 22, 0.18)');
  grad.addColorStop(0.82, 'rgba(234, 88, 12, 0.04)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createSmokePuffTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const rand = seededRand(999);
  ctx.clearRect(0, 0, size, size);

  for (let i = 0; i < 24; i++) {
    const a = rand() * Math.PI * 2;
    const d = rand() * 44;
    const cx = size / 2 + Math.cos(a) * d;
    const cy = size / 2 + Math.sin(a) * d;
    const rad = 44 + rand() * 46;
    const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, rad);
    g.addColorStop(0, 'rgba(248, 250, 252, 0.32)');
    g.addColorStop(0.6, 'rgba(226, 232, 240, 0.16)');
    g.addColorStop(1, 'rgba(203, 213, 225, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ============================================================================
// 15. High-DPI Cleanroom Telemetry Wall Display (2048x840)
// ============================================================================

export interface HangarWallDisplay {
  texture: THREE.CanvasTexture;
  update: (data: {
    craftName: string;
    massKg: number;
    massLimitKg: number;
    costM: number;
    budgetLimitM: number;
    netPowerW: number;
    fuelKg: number;
    requiredFuelKg: number;
    thrustKn: number;
    requiredThrustKn: number;
    fuelLabel: string;
    powerLabel: string;
    worldName: string;
    twr: number;
  }) => void;
}

export function createHangarWallDisplay(maxAnisotropy: number): HangarWallDisplay {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 840;
  const ctx = canvas.getContext('2d')!;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;

  const drawBar = (
    x: number,
    y: number,
    w: number,
    label: string,
    valueText: string,
    pct: number,
    color: string
  ) => {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 34px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(label, x, y);

    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 36px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(valueText, x + w, y);
    ctx.textAlign = 'left';

    ctx.fillStyle = '#0c1526';
    ctx.fillRect(x, y + 22, w, 34);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.42)';
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y + 22, w, 34);

    const clamped = Math.max(0.03, Math.min(1, pct));
    ctx.fillStyle = color;
    ctx.fillRect(x + 4, y + 26, (w - 8) * clamped, 26);
  };

  const update: HangarWallDisplay['update'] = (data) => {
    ctx.fillStyle = '#050b16';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = 'rgba(34, 211, 238, 0.05)';
    ctx.lineWidth = 2;
    for (let gx = 0; gx < canvas.width; gx += 64) {
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, canvas.height);
      ctx.stroke();
    }
    for (let gy = 0; gy < canvas.height; gy += 64) {
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(canvas.width, gy);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(34, 211, 238, 0.56)';
    ctx.lineWidth = 6;
    ctx.strokeRect(14, 14, canvas.width - 28, canvas.height - 28);

    ctx.fillStyle = '#22d3ee';
    ctx.font = '700 40px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('CLEANROOM BAY 04 · NASA TELEMETRY', 68, 92);

    const twrOk = data.thrustKn >= data.requiredThrustKn;
    ctx.fillStyle = twrOk ? '#34d399' : '#f43f5e';
    ctx.textAlign = 'right';
    ctx.fillText(
      `TARGET: ${data.worldName.toUpperCase()} · LIFTOFF TWR ${data.twr.toFixed(2)}×`,
      canvas.width - 68,
      92
    );
    ctx.textAlign = 'left';

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(68, 132);
    ctx.lineTo(canvas.width - 68, 132);
    ctx.stroke();

    const remMass = data.massLimitKg - data.massKg;
    const remBudget = data.budgetLimitM - data.costM;
    const fuelOk = data.fuelKg >= data.requiredFuelKg;

    drawBar(
      68,
      244,
      880,
      'ENGINE THRUST vs REQ',
      `${data.thrustKn.toLocaleString()} / ${data.requiredThrustKn.toLocaleString()} kN`,
      data.thrustKn / Math.max(1, data.requiredThrustKn),
      twrOk ? '#10b981' : '#f43f5e'
    );
    drawBar(
      1096,
      244,
      880,
      'PROPELLANT vs TARGET',
      `${data.fuelKg.toLocaleString()} / ${data.requiredFuelKg.toLocaleString()} kg`,
      data.fuelKg / Math.max(1, data.requiredFuelKg),
      fuelOk ? '#38bdf8' : '#f43f5e'
    );
    drawBar(
      68,
      492,
      880,
      'TOTAL MASS / LIMIT',
      `${data.massKg.toLocaleString()} / ${data.massLimitKg.toLocaleString()} kg`,
      data.massKg / Math.max(1, data.massLimitKg),
      remMass < 0 ? '#ef4444' : '#22d3ee'
    );
    drawBar(
      1096,
      492,
      880,
      'COST / BUDGET',
      `$${data.costM}M / $${data.budgetLimitM}M`,
      data.costM / Math.max(1, data.budgetLimitM),
      remBudget < 0 ? '#ef4444' : '#10b981'
    );

    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 30px monospace';
    ctx.fillText(
      `${data.craftName.toUpperCase()} · ${data.fuelLabel.toUpperCase()} · ${data.powerLabel.toUpperCase()}`,
      68,
      746
    );
    ctx.fillStyle = !twrOk || !fuelOk ? '#f87171' : '#34d399';
    ctx.textAlign = 'right';
    ctx.fillText(
      !twrOk ? 'STATUS: THRUST DEFICIT' : !fuelOk ? 'STATUS: FUEL DEFICIT' : 'STATUS: FLIGHT READY',
      canvas.width - 68,
      746
    );
    ctx.textAlign = 'left';

    texture.needsUpdate = true;
  };

  return { texture, update };
}
