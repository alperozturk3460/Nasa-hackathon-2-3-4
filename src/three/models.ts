import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  CRAFT_CLASSES,
  ENGINE_OPTIONS,
  FUEL_OPTIONS,
  HangarConfig,
} from '../data/missionData';
import { PBRTextureSet } from './proceduralTextures';

interface NasaShuttleGlbCache {
  orbiterTemplate: THREE.Group;
  externalTankTemplate: THREE.Group;
  srbTemplate: THREE.Group;
}

let nasaGlbCache: NasaShuttleGlbCache | null = null;
let nasaGlbLoading = false;
const nasaGlbCallbacks: Array<(cache: NasaShuttleGlbCache) => void> = [];

function normalizeGlbMaterials(root: THREE.Object3D, isOrbiter = false): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mats.forEach((m) => {
      const std = m as THREE.MeshStandardMaterial;
      if (!std) return;
      if (std.map) {
        std.map.colorSpace = THREE.SRGBColorSpace;
      }
      if (isOrbiter) {
        if (std.name === 'belly') {
          std.color.setHex(0x1e293b);
          std.roughness = 0.52;
          std.metalness = 0.22;
        } else if (std.name === 'shut-glass') {
          std.color.setHex(0x0f172a);
          std.roughness = 0.12;
          std.metalness = 0.58;
        }
      }
      std.needsUpdate = true;
    });
  });
}

function reset3DSRootRotation(scene: THREE.Object3D): void {
  scene.traverse((child) => {
    if (child.name === '<3DSRoot>') {
      child.rotation.set(0, 0, 0);
      child.quaternion.identity();
      child.updateMatrix();
    }
  });
}

function onNasaShuttleGlbsReady(cb: (cache: NasaShuttleGlbCache) => void): void {
  if (nasaGlbCache) {
    cb(nasaGlbCache);
    return;
  }
  nasaGlbCallbacks.push(cb);
  if (nasaGlbLoading) return;
  nasaGlbLoading = true;

  const loader = new GLTFLoader();
  Promise.all([
    loader.loadAsync('/assets/models/space-shuttle-d.glb'),
    loader.loadAsync('/assets/models/space-shuttle-d-door-prt.glb'),
    loader.loadAsync('/assets/models/space-shuttle-d-door-stb.glb'),
    loader.loadAsync('/assets/models/space-shuttle-d-eng.glb'),
    loader.loadAsync('/assets/models/external-tank.glb'),
    loader.loadAsync('/assets/models/solid-rocket-booster.glb'),
  ])
    .then(([shuttleGltf, doorPrtGltf, doorStbGltf, engGltf, etGltf, srbGltf]) => {
      normalizeGlbMaterials(shuttleGltf.scene, true);
      normalizeGlbMaterials(doorPrtGltf.scene, true);
      normalizeGlbMaterials(doorStbGltf.scene, true);

      reset3DSRootRotation(engGltf.scene);
      normalizeGlbMaterials(engGltf.scene, true);

      reset3DSRootRotation(etGltf.scene);
      normalizeGlbMaterials(etGltf.scene, false);

      reset3DSRootRotation(srbGltf.scene);
      normalizeGlbMaterials(srbGltf.scene, false);

      // Assemble complete NASA Space Shuttle Orbiter template in native coordinates (+X nose, +-Y wings, +Z dorsal tail)
      const orbiterNative = new THREE.Group();
      orbiterNative.add(shuttleGltf.scene);
      orbiterNative.add(doorPrtGltf.scene);
      orbiterNative.add(doorStbGltf.scene);

      // Mount the 3 RS-25 SSME main engine bells at the aft fuselage bulkhead
      const ssmeOffsets: Array<[number, number, number]> = [
        [-535, 0, 35],
        [-535, -62, -52],
        [-535, 62, -52],
      ];
      ssmeOffsets.forEach(([ex, ey, ez]) => {
        const engClone = engGltf.scene.clone(true);
        engClone.position.set(ex, ey, ez);
        orbiterNative.add(engClone);
      });

      // Rotate +90 deg around Z so +X (Nose) -> +Y (App Up/Forward), +-Y (Wings) -> +-X, +Z (Dorsal Tail/Cockpit) -> +Z
      orbiterNative.rotation.z = Math.PI / 2;
      orbiterNative.scale.setScalar(0.0041);
      orbiterNative.position.set(0, 3.05, 0);

      const orbiterTemplate = new THREE.Group();
      orbiterTemplate.add(orbiterNative);

      // External Tank template (+X nose -> +Y Up, +Z shuttle attachment struts -> +Z Front)
      const etNative = new THREE.Group();
      etNative.add(etGltf.scene);
      etNative.rotation.z = Math.PI / 2;
      const externalTankTemplate = new THREE.Group();
      externalTankTemplate.add(etNative);

      // Solid Rocket Booster template (+X nose -> +Y Up)
      const srbNative = new THREE.Group();
      srbNative.add(srbGltf.scene);
      srbNative.rotation.z = Math.PI / 2;
      const srbTemplate = new THREE.Group();
      srbTemplate.add(srbNative);

      nasaGlbCache = {
        orbiterTemplate,
        externalTankTemplate,
        srbTemplate,
      };

      while (nasaGlbCallbacks.length > 0) {
        const next = nasaGlbCallbacks.shift();
        next?.(nasaGlbCache);
      }
    })
    .catch((err) => {
      console.error('Failed to load NASA Space Shuttle GLB models:', err);
    });
}

export interface SpacecraftPBRAssets {
  kapton: PBRTextureSet;
  solar: PBRTextureSet;
  shuttleWhite: PBRTextureSet;
  shuttleBlack: PBRTextureSet;
  etFoam: PBRTextureSet;
  glow: THREE.Texture;
}

export interface HangarSpacecraftRig {
  root: THREE.Group;
  dishGroup: THREE.Group;
}

export interface CarrierRocketRig {
  root: THREE.Group;
  coreGroup: THREE.Group;
  srbLeft: THREE.Group;
  srbRight: THREE.Group;
  bayDoorLeft: THREE.Group;
  bayDoorRight: THREE.Group;
  payloadMount: THREE.Group;
  payloadRestY: number;
  srbOffsetX: number;
  srbFlames: THREE.Group;
  mainFlames: THREE.Group;
  craftFlame: THREE.Group;
  dishGroup: THREE.Group;
}

/**
 * Photorealistic Fresnel Atmospheric Rim Shader for Planets & Radiation Shields
 */
export function createAtmosphereMesh(
  radius: number,
  colorHex: number,
  intensity = 0.72,
  power = 3.2
): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(colorHex) },
      uIntensity: { value: intensity },
      uPower: { value: power },
    },
    vertexShader: `
      varying vec3 vNormalWorld;
      varying vec3 vViewDir;
      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vNormalWorld = normalize(mat3(modelMatrix) * normal);
        vViewDir = normalize(cameraPosition - worldPos.xyz);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uIntensity;
      uniform float uPower;
      varying vec3 vNormalWorld;
      varying vec3 vViewDir;
      void main() {
        float ndotv = max(0.0, dot(normalize(vNormalWorld), normalize(vViewDir)));
        float fresnel = pow(1.0 - ndotv, uPower);
        gl_FragColor = vec4(uColor * uIntensity * 0.78, fresnel * uIntensity * 0.78);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.FrontSide,
  });

  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 36), mat);
  mesh.renderOrder = 4;
  return mesh;
}

/**
 * IMG_6714 Photorealistic Spacecraft Bus:
 * - Crinkled gold Kapton MLI thermal blanket (normal + roughness mapped)
 * - White thermal radiator panels with recessed louvers, bolt studs & telemetry beacons
 * - Precision carbon-composite parabolic dish with tripod sub-reflector & gold feed horn
 * - Clearcoated triple-junction GaAs solar wings with articulated yokes (or Nuclear RTG)
 * - Sleek Fresnel physical radiation shield envelope (Thin / Medium / Thick)
 */
export function buildHangarSpacecraft(
  config: HangarConfig,
  assets: SpacecraftPBRAssets
): HangarSpacecraftRig {
  const root = new THREE.Group();
  const craftSpec = CRAFT_CLASSES.find((c) => c.id === config.craftClass) || CRAFT_CLASSES[1];

  const goldFoilMat = new THREE.MeshPhysicalMaterial({
    map: assets.kapton.map,
    normalMap: assets.kapton.normalMap,
    normalScale: new THREE.Vector2(1.45, 1.45),
    roughnessMap: assets.kapton.roughnessMap,
    color: 0xf6c453,
    roughness: 0.28,
    metalness: 0.9,
    clearcoat: 0.2,
    clearcoatRoughness: 0.24,
  });

  const whitePanelMat = new THREE.MeshPhysicalMaterial({
    color: 0xe6ecf4,
    roughness: 0.36,
    metalness: 0.1,
    clearcoat: 0.2,
    clearcoatRoughness: 0.28,
  });

  const brushedTitaniumMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.32,
    metalness: 0.88,
  });

  const darkCarbonMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    roughness: 0.45,
    metalness: 0.65,
  });

  const solarMat = new THREE.MeshPhysicalMaterial({
    map: assets.solar.map,
    roughnessMap: assets.solar.roughnessMap,
    color: 0xdbeafe,
    roughness: 0.18,
    metalness: 0.55,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
  });

  const nozzleMat = new THREE.MeshStandardMaterial({
    color: 0x7c2d12,
    roughness: 0.34,
    metalness: 0.86,
  });

  const scaleFactor =
    config.craftClass === 'heavy' ? 1.18 : config.craftClass === 'light' ? 0.86 : 1.0;

  // 1. Machined Launch Adapter Skirt & Gimbaled Main Engine Bells
  const adapterBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.76 * scaleFactor, 0.94 * scaleFactor, 0.52, 36),
    brushedTitaniumMat
  );
  adapterBase.position.y = 0.26;
  adapterBase.castShadow = true;
  adapterBase.receiveShadow = true;
  root.add(adapterBase);

  const adapterFlange = new THREE.Mesh(
    new THREE.TorusGeometry(0.92 * scaleFactor, 0.045, 14, 48),
    darkCarbonMat
  );
  adapterFlange.rotation.x = Math.PI / 2;
  adapterFlange.position.y = 0.04;
  root.add(adapterFlange);

  // Bell nozzle lathe profile
  const bellProfile = [
    new THREE.Vector2(0.08, 0.22),
    new THREE.Vector2(0.06, 0.12),
    new THREE.Vector2(0.14, -0.02),
    new THREE.Vector2(0.22, -0.22),
    new THREE.Vector2(0.24, -0.32),
  ];
  const bellGeo = new THREE.LatheGeometry(bellProfile, 28);
  const nozzleCount = config.craftClass === 'heavy' ? 3 : config.craftClass === 'light' ? 1 : 2;
  for (let i = 0; i < nozzleCount; i++) {
    const a = (i / nozzleCount) * Math.PI * 2;
    const offset = nozzleCount === 1 ? 0 : 0.3 * scaleFactor;
    const bell = new THREE.Mesh(bellGeo, nozzleMat);
    bell.position.set(Math.cos(a) * offset, 0.12, Math.sin(a) * offset);
    bell.castShadow = true;
    root.add(bell);
  }

  // 2. Octagonal Crinkled Gold Kapton MLI Spacecraft Bus
  const radius = 0.96 * scaleFactor;
  const bodyHeight =
    2.08 * (config.craftClass === 'heavy' ? 1.12 : config.craftClass === 'light' ? 0.9 : 1.0);
  const coreMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius * 1.03, bodyHeight, 8, 4),
    goldFoilMat
  );
  coreMesh.position.y = 0.52 + bodyHeight / 2;
  coreMesh.castShadow = true;
  coreMesh.receiveShadow = true;
  root.add(coreMesh);

  // Machined Aluminum Structural Bulkhead Collars + Corner Gussets
  const topCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 1.05, radius * 1.05, 0.13, 32),
    brushedTitaniumMat
  );
  topCollar.position.y = 0.52 + bodyHeight;
  topCollar.castShadow = true;
  root.add(topCollar);

  const botCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 1.06, radius * 1.06, 0.14, 32),
    brushedTitaniumMat
  );
  botCollar.position.y = 0.52;
  botCollar.castShadow = true;
  root.add(botCollar);

  // Upper avionics bay instrumentation deck
  const upperDeck = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.88, radius * 0.96, 0.24, 32),
    darkCarbonMat
  );
  upperDeck.position.y = 0.52 + bodyHeight + 0.15;
  root.add(upperDeck);

  // 4-axis RCS Attitude Thruster Quads
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + Math.PI / 4;
    const rcsPod = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.18), brushedTitaniumMat);
    rcsPod.position.set(
      Math.cos(a) * (radius + 0.08),
      0.52 + bodyHeight - 0.18,
      Math.sin(a) * (radius + 0.08)
    );
    rcsPod.rotation.y = -a;
    root.add(rcsPod);
  }

  // 3. White Thermal Radiator / Avionics Louver Panels (IMG_6714)
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2;
    const panelGroup = new THREE.Group();
    const dist = radius * 0.95;
    panelGroup.position.set(
      Math.sin(angle) * dist,
      0.52 + bodyHeight / 2,
      Math.cos(angle) * dist
    );
    panelGroup.rotation.y = angle;

    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(0.82 * scaleFactor, bodyHeight * 0.68, 0.07),
      whitePanelMat
    );
    panel.castShadow = true;
    panel.receiveShadow = true;
    panelGroup.add(panel);

    // Recessed radiator louvers
    for (let l = -2; l <= 2; l++) {
      const louver = new THREE.Mesh(
        new THREE.BoxGeometry(0.62 * scaleFactor, 0.04, 0.085),
        brushedTitaniumMat
      );
      louver.position.y = l * 0.2;
      panelGroup.add(louver);
    }

    // Precision gold Kapton foil patch / star-tracker port
    const port = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.09, 0.1, 16),
      darkCarbonMat
    );
    port.rotation.x = Math.PI / 2;
    port.position.set(0.22 * scaleFactor, bodyHeight * 0.24, 0.04);
    panelGroup.add(port);

    root.add(panelGroup);
  }

  // 4. Wide White Carbon-Composite Parabolic High-Gain Dish + Gimbal Tripod + Copper Feed Horn
  const dishGroup = new THREE.Group();
  dishGroup.position.y = 0.52 + bodyHeight + 0.24;

  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const strut = new THREE.Mesh(
      new THREE.CylinderGeometry(0.032, 0.042, 0.52, 12),
      brushedTitaniumMat
    );
    strut.position.set(
      Math.cos(a) * 0.4 * scaleFactor,
      0.22,
      Math.sin(a) * 0.4 * scaleFactor
    );
    strut.rotation.z = Math.cos(a) * 0.38;
    strut.rotation.x = -Math.sin(a) * 0.38;
    dishGroup.add(strut);
  }

  const dishPoints = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.32, 0.03),
    new THREE.Vector2(0.72, 0.13),
    new THREE.Vector2(1.12, 0.34),
    new THREE.Vector2(1.36, 0.54),
    new THREE.Vector2(1.32, 0.57),
    new THREE.Vector2(0.72, 0.18),
    new THREE.Vector2(0, 0.06),
  ];
  const dishMesh = new THREE.Mesh(new THREE.LatheGeometry(dishPoints, 48), whitePanelMat);
  dishMesh.scale.setScalar(scaleFactor);
  dishMesh.position.y = 0.36;
  dishMesh.castShadow = true;
  dishMesh.receiveShadow = true;
  dishGroup.add(dishMesh);

  // Sub-reflector tripod & gold coaxial waveguide feed horn
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const feedStrut = new THREE.Mesh(
      new THREE.CylinderGeometry(0.016, 0.018, 0.72 * scaleFactor, 8),
      darkCarbonMat
    );
    feedStrut.position.set(
      Math.cos(a) * 0.32 * scaleFactor,
      0.36 + 0.42 * scaleFactor,
      Math.sin(a) * 0.32 * scaleFactor
    );
    feedStrut.rotation.z = Math.cos(a) * 0.46;
    feedStrut.rotation.x = -Math.sin(a) * 0.46;
    dishGroup.add(feedStrut);
  }

  const feedHorn = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.09, 0.42, 20),
    goldFoilMat
  );
  feedHorn.position.y = 0.36 + 0.32 * scaleFactor;
  dishGroup.add(feedHorn);

  const subReflector = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16 * scaleFactor, 0.04, 0.08, 24),
    whitePanelMat
  );
  subReflector.position.y = 0.36 + 0.68 * scaleFactor;
  dishGroup.add(subReflector);

  root.add(dishGroup);

  // 5. Power Array: Clearcoated GaAs Photovoltaic Wings OR Nuclear Stirling MMRTG
  const wingY = 0.52 + bodyHeight * 0.54;
  if (config.powerSource === 'nuclear_rtg') {
    [-1, 1].forEach((dir) => {
      const rtgDrum = new THREE.Mesh(
        new THREE.CylinderGeometry(0.24, 0.27, 1.4, 24),
        darkCarbonMat
      );
      rtgDrum.rotation.z = dir * (Math.PI / 2.35);
      rtgDrum.position.set(dir * (radius + 0.68), wingY, 0);
      rtgDrum.castShadow = true;
      root.add(rtgDrum);

      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.24, 20, 14), goldFoilMat);
      cap.position.set(dir * (radius + 1.28), wingY - 0.16, 0);
      root.add(cap);

      for (let f = 0; f < 6; f++) {
        const fin = new THREE.Mesh(
          new THREE.BoxGeometry(1.12, 0.035, 0.52),
          new THREE.MeshStandardMaterial({
            color: 0x0ea5e9,
            emissive: 0x0369a1,
            emissiveIntensity: 0.22,
            roughness: 0.32,
            metalness: 0.78,
          })
        );
        fin.position.set(dir * (radius + 0.72), wingY, 0);
        fin.rotation.x = (f * Math.PI) / 6;
        root.add(fin);
      }
    });
  } else {
    const buildSolarWing = (angleY: number, segments: number) => {
      const wingHolder = new THREE.Group();
      wingHolder.position.y = wingY;
      wingHolder.rotation.y = angleY;

      // Deployment mast boom & gimbal yoke
      const yoke = new THREE.Mesh(
        new THREE.CylinderGeometry(0.045, 0.055, 0.5, 16),
        brushedTitaniumMat
      );
      yoke.rotation.z = Math.PI / 2;
      yoke.position.x = radius + 0.24;
      wingHolder.add(yoke);

      const spine = new THREE.Mesh(
        new THREE.CylinderGeometry(0.024, 0.024, segments * 0.94, 12),
        brushedTitaniumMat
      );
      spine.rotation.z = Math.PI / 2;
      spine.position.set(radius + 0.48 + (segments * 0.94) / 2, -0.025, 0);
      wingHolder.add(spine);

      for (let s = 0; s < segments; s++) {
        const segX = radius + 0.48 + s * 0.94 + 0.45;
        const panel = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.036, 0.96), solarMat);
        panel.position.x = segX;
        panel.castShadow = true;
        panel.receiveShadow = true;
        wingHolder.add(panel);

        const frame = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.022, 1.0), brushedTitaniumMat);
        frame.position.set(segX, -0.016, 0);
        wingHolder.add(frame);

        if (s > 0) {
          const hinge = new THREE.Mesh(
            new THREE.CylinderGeometry(0.025, 0.025, 0.88, 10),
            goldFoilMat
          );
          hinge.rotation.x = Math.PI / 2;
          hinge.position.set(segX - 0.47, 0, 0);
          wingHolder.add(hinge);
        }
      }
      root.add(wingHolder);
    };

    const segs = craftSpec.solarPanels >= 6 ? 3 : 2;
    buildSolarWing(0, segs);
    buildSolarWing(Math.PI, segs);
    if (craftSpec.solarPanels >= 4) {
      buildSolarWing(Math.PI * 0.46, 2);
    }
    if (craftSpec.solarPanels >= 6) {
      buildSolarWing(-Math.PI * 0.54, 2);
    }
  }

  return { root, dishGroup };
}

/**
 * Precision Cleanroom Articulated Robotic Arm with Hydraulic Conduits
 */
export function buildRoboticArm(accentColor: number): {
  root: THREE.Group;
  shoulder: THREE.Group;
  elbow: THREE.Group;
  wrist: THREE.Group;
} {
  const root = new THREE.Group();

  const whiteMat = new THREE.MeshPhysicalMaterial({
    color: 0xeef2f7,
    roughness: 0.26,
    metalness: 0.2,
    clearcoat: 0.45,
  });
  const accentMat = new THREE.MeshPhysicalMaterial({
    color: accentColor,
    roughness: 0.24,
    metalness: 0.45,
    clearcoat: 0.55,
  });
  const jointMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.34,
    metalness: 0.88,
  });
  const hoseMat = new THREE.MeshStandardMaterial({
    color: 0x090d16,
    roughness: 0.62,
    metalness: 0.2,
  });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.76, 0.42, 32), jointMat);
  base.position.y = 0.21;
  base.castShadow = true;
  base.receiveShadow = true;
  root.add(base);

  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.55, 0.24, 32), accentMat);
  collar.position.y = 0.52;
  collar.castShadow = true;
  root.add(collar);

  const shoulder = new THREE.Group();
  shoulder.position.y = 0.74;
  root.add(shoulder);

  const shoulderDrum = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.52, 24), jointMat);
  shoulderDrum.rotation.x = Math.PI / 2;
  shoulder.add(shoulderDrum);

  const lowerBoom = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 1.65, 10, 20), accentMat);
  lowerBoom.position.y = 0.92;
  lowerBoom.castShadow = true;
  shoulder.add(lowerBoom);

  // Flexible hydraulic conduit along lower boom
  const conduitCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.18, 0.1, 0.14),
    new THREE.Vector3(-0.28, 0.9, 0.18),
    new THREE.Vector3(-0.18, 1.75, 0.12),
  ]);
  const conduit = new THREE.Mesh(new THREE.TubeGeometry(conduitCurve, 16, 0.032, 8, false), hoseMat);
  shoulder.add(conduit);

  const elbow = new THREE.Group();
  elbow.position.y = 1.85;
  shoulder.add(elbow);

  const elbowDrum = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.44, 24), jointMat);
  elbowDrum.rotation.x = Math.PI / 2;
  elbow.add(elbowDrum);

  const upperBoom = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 1.35, 10, 20), whiteMat);
  upperBoom.position.y = 0.78;
  upperBoom.castShadow = true;
  elbow.add(upperBoom);

  const wrist = new THREE.Group();
  wrist.position.y = 1.56;
  elbow.add(wrist);

  const wristHousing = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.2, 20), jointMat);
  wrist.add(wristHousing);

  [-0.12, 0.12].forEach((fz) => {
    const finger = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.07, 0.06), jointMat);
    finger.position.set(0.14, 0.12, fz);
    wrist.add(finger);
  });

  return { root, shoulder, elbow, wrist };
}

/**
 * IMG_6712 Photorealistic Space Shuttle Launch Stack:
 * - Lathe-sculpted rust-orange External Tank with SOFI foam texture, intertank ribs & steel LOX feedline
 * - Twin segmented Solid Rocket Boosters with field joints, hold-down skirts & nozzles
 * - Sculpted white & black ceramic-tiled Orbiter with tinted cockpit windshield, double-delta wings,
 *   RCC leading edges, OMS pods & 3 ribbed SSME bell nozzles
 * - Multi-layer shock-diamond exhaust plumes
 */
export interface ShuttleLaunchRig {
  root: THREE.Group;
  etGroup: THREE.Group;
  srbLeft: THREE.Group;
  srbRight: THREE.Group;
  orbiter: THREE.Group;
  bayDoorLeft: THREE.Group;
  bayDoorRight: THREE.Group;
  payloadMount: THREE.Group;
  srbFlames: THREE.Group;
  mainFlames: THREE.Group;
  satFlame: THREE.Mesh;
}

/**
 * NASA LC-39A Multi-Stage Shuttle / Heavy Launch Stack:
 * - Separable rust-orange External Tank (MECO separation at ~115 km)
 * - Twin separable Solid Rocket Boosters (BECO separation at ~45 km)
 * - Detailed Orbiter with hinged Payload Bay Doors & stowed player NASA Satellite
 * - Calibrated Mach-diamond exhaust plumes (zero white-out glare)
 */
export function buildShuttleLaunchStack(
  assets: SpacecraftPBRAssets,
  config: HangarConfig
): ShuttleLaunchRig {
  const root = new THREE.Group();

  const etMat = new THREE.MeshStandardMaterial({
    map: assets.etFoam.map,
    normalMap: assets.etFoam.normalMap,
    normalScale: new THREE.Vector2(1.1, 1.1),
    roughness: 0.78,
    metalness: 0.08,
  });

  const whiteTileMat = new THREE.MeshPhysicalMaterial({
    map: assets.shuttleWhite.map,
    normalMap: assets.shuttleWhite.normalMap,
    normalScale: new THREE.Vector2(0.75, 0.75),
    color: 0xe8edf4,
    roughness: 0.44,
    metalness: 0.08,
    clearcoat: 0.16,
  });

  const blackTileMat = new THREE.MeshStandardMaterial({
    map: assets.shuttleBlack.map,
    normalMap: assets.shuttleBlack.normalMap,
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughness: 0.62,
    metalness: 0.22,
  });

  const srbWhiteMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.48,
    metalness: 0.16,
  });

  const nozzleMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.34,
    metalness: 0.88,
  });

  const goldBayMat = new THREE.MeshStandardMaterial({
    map: assets.kapton.map,
    normalMap: assets.kapton.normalMap,
    color: 0xd9a03b,
    roughness: 0.32,
    metalness: 0.86,
  });

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x020617,
    roughness: 0.1,
    metalness: 0.3,
    clearcoat: 0.8,
    clearcoatRoughness: 0.06,
  });

  // 1. Separable Sculpted Ogive External Tank (ET)
  const etGroup = new THREE.Group();
  const etProfile = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.45, 0.15),
    new THREE.Vector2(0.66, 0.55),
    new THREE.Vector2(0.66, 5.2),
    new THREE.Vector2(0.54, 6.0),
    new THREE.Vector2(0.28, 6.65),
    new THREE.Vector2(0.03, 7.05),
    new THREE.Vector2(0.0, 7.1),
  ];
  const etMesh = new THREE.Mesh(new THREE.LatheGeometry(etProfile, 40), etMat);
  etMesh.position.set(0, 0.65, -0.38);
  etMesh.castShadow = true;
  etMesh.receiveShadow = true;
  etGroup.add(etMesh);

  const loxCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.42, 6.1, 0.1),
    new THREE.Vector3(0.45, 3.8, 0.26),
    new THREE.Vector3(0.32, 1.3, 0.28),
  ]);
  const loxPipe = new THREE.Mesh(
    new THREE.TubeGeometry(loxCurve, 20, 0.045, 10, false),
    srbWhiteMat
  );
  etGroup.add(loxPipe);
  root.add(etGroup);

  const createPlume = (
    target: THREE.Group,
    x: number,
    y: number,
    z: number,
    radius: number,
    length: number,
    cyanTint = false
  ) => {
    const outer = new THREE.Mesh(
      new THREE.ConeGeometry(radius, length, 24),
      new THREE.MeshBasicMaterial({
        color: cyanTint ? 0x38bdf8 : 0xf97316,
        transparent: true,
        opacity: cyanTint ? 0.38 : 0.52,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    outer.rotation.x = Math.PI;
    outer.position.set(x, y - length / 2, z);
    target.add(outer);

    const mid = new THREE.Mesh(
      new THREE.ConeGeometry(radius * 0.6, length * 0.78, 20),
      new THREE.MeshBasicMaterial({
        color: cyanTint ? 0x93c5fd : 0xfbbf24,
        transparent: true,
        opacity: 0.62,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    mid.rotation.x = Math.PI;
    mid.position.set(x, y - (length * 0.78) / 2, z);
    target.add(mid);

    const core = new THREE.Mesh(
      new THREE.ConeGeometry(radius * 0.32, length * 0.48, 16),
      new THREE.MeshBasicMaterial({
        color: cyanTint ? 0xe0f2fe : 0xfef3c7,
        transparent: true,
        opacity: 0.76,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    core.rotation.x = Math.PI;
    core.position.set(x, y - (length * 0.48) / 2, z);
    target.add(core);
  };

  // 2. Twin Separable Solid Rocket Boosters (SRBs)
  const buildSrb = (dir: -1 | 1) => {
    const srbGroup = new THREE.Group();
    srbGroup.position.set(dir * 1.04, 0, -0.38);

    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.33, 4.75, 28), srbWhiteMat);
    cyl.position.y = 2.82;
    cyl.castShadow = true;
    cyl.receiveShadow = true;
    srbGroup.add(cyl);

    const frustum = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.32, 0.72, 28), srbWhiteMat);
    frustum.position.y = 5.55;
    srbGroup.add(frustum);

    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.14, 20, 14), blackTileMat);
    tip.position.y = 5.9;
    srbGroup.add(tip);

    [1.1, 2.2, 3.3, 4.4, 4.9].forEach((jy, idx) => {
      const band = new THREE.Mesh(
        new THREE.CylinderGeometry(0.336, 0.336, idx === 4 ? 0.14 : 0.06, 28),
        blackTileMat
      );
      band.position.y = jy;
      srbGroup.add(band);
    });

    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.44, 0.48, 28), srbWhiteMat);
    skirt.position.y = 0.24;
    srbGroup.add(skirt);

    const srbBell = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 0.32, 24), nozzleMat);
    srbBell.position.y = -0.04;
    srbGroup.add(srbBell);

    root.add(srbGroup);
    return srbGroup;
  };

  const srbLeft = buildSrb(-1);
  const srbRight = buildSrb(1);

  const srbFlames = new THREE.Group();
  srbFlames.visible = false;
  createPlume(srbFlames, -1.04, -0.15, -0.38, 0.46, 3.2, false);
  createPlume(srbFlames, 1.04, -0.15, -0.38, 0.46, 3.2, false);
  root.add(srbFlames);

  // 3. Detailed Space Shuttle Orbiter with Openable Payload Bay & Stowed NASA Satellite
  const orbiter = new THREE.Group();
  orbiter.position.set(0, 2.32, 0.58);

  // Aft engine compartment (y: -1.52 .. -0.68)
  const aftBody = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.47, 0.86, 28), whiteTileMat);
  aftBody.position.y = -1.1;
  aftBody.castShadow = true;
  orbiter.add(aftBody);

  // Forward crew compartment (y: 0.82 .. 1.52)
  const fwdBody = new THREE.Mesh(new THREE.CylinderGeometry(0.43, 0.45, 0.72, 28), whiteTileMat);
  fwdBody.position.y = 1.18;
  fwdBody.castShadow = true;
  orbiter.add(fwdBody);

  // Payload bay open lower cradle (back 220° arc, leaves +Z dorsal face openable!)
  const baySaddle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.45, 0.45, 1.5, 28, 1, false, Math.PI * 0.38, Math.PI * 1.24),
    whiteTileMat
  );
  baySaddle.position.y = 0.06;
  baySaddle.castShadow = true;
  orbiter.add(baySaddle);

  const bayLiner = new THREE.Mesh(
    new THREE.CylinderGeometry(0.41, 0.41, 1.46, 24, 1, true, Math.PI * 0.42, Math.PI * 1.16),
    goldBayMat
  );
  bayLiner.material.side = THREE.BackSide;
  bayLiner.position.y = 0.06;
  orbiter.add(bayLiner);

  // Hinged Left & Right Payload Bay Doors (swing open in LEO before Satellite Separation!)
  const bayDoorLeft = new THREE.Group();
  bayDoorLeft.position.set(-0.42, 0.06, 0.14);
  const doorLeftMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.455, 0.455, 1.48, 18, 1, false, -Math.PI * 0.38, Math.PI * 0.38),
    whiteTileMat
  );
  doorLeftMesh.position.set(0.42, 0, -0.14);
  bayDoorLeft.add(doorLeftMesh);
  orbiter.add(bayDoorLeft);

  const bayDoorRight = new THREE.Group();
  bayDoorRight.position.set(0.42, 0.06, 0.14);
  const doorRightMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.455, 0.455, 1.48, 18, 1, false, 0, Math.PI * 0.38),
    whiteTileMat
  );
  doorRightMesh.position.set(-0.42, 0, -0.14);
  bayDoorRight.add(doorRightMesh);
  orbiter.add(bayDoorRight);

  // Player's Custom NASA Satellite Stowed Inside Payload Bay (Separates at ~185 km LEO!)
  const payloadMount = new THREE.Group();
  payloadMount.position.set(0, 0.02, 0.06);
  const satRig = buildHangarSpacecraft(config, assets);
  satRig.root.scale.setScalar(0.19);
  payloadMount.add(satRig.root);

  const satFlame = new THREE.Mesh(
    new THREE.ConeGeometry(0.1, 0.65, 14),
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  satFlame.rotation.x = Math.PI;
  satFlame.position.y = -0.35;
  satFlame.visible = false;
  payloadMount.add(satFlame);
  orbiter.add(payloadMount);

  // Dark HRSI belly thermal tile heatshield
  const bellyShield = new THREE.Mesh(
    new THREE.CylinderGeometry(0.455, 0.48, 3.0, 24, 1, false, Math.PI * 0.72, Math.PI * 0.56),
    blackTileMat
  );
  orbiter.add(bellyShield);

  // Ogive cockpit nose
  const noseProfile = [
    new THREE.Vector2(0.43, 0.0),
    new THREE.Vector2(0.38, 0.4),
    new THREE.Vector2(0.24, 0.85),
    new THREE.Vector2(0.11, 1.15),
    new THREE.Vector2(0.0, 1.24),
  ];
  const noseMesh = new THREE.Mesh(new THREE.LatheGeometry(noseProfile, 28), whiteTileMat);
  noseMesh.position.y = 1.52;
  noseMesh.castShadow = true;
  orbiter.add(noseMesh);

  const rccNose = new THREE.Mesh(new THREE.SphereGeometry(0.14, 20, 14), blackTileMat);
  rccNose.position.y = 2.66;
  rccNose.scale.set(1, 1.4, 1);
  orbiter.add(rccNose);

  // Multi-pane tinted cockpit windows
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.24), glassMat);
  windshield.position.set(0, 1.88, 0.24);
  windshield.rotation.x = -0.46;
  orbiter.add(windshield);

  // Double-Delta Wings
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, -1.42);
  wingShape.lineTo(1.56, -1.42);
  wingShape.lineTo(1.56, -1.28);
  wingShape.lineTo(0.45, -0.05);
  wingShape.lineTo(0.26, 0.72);
  wingShape.lineTo(0, 0.72);
  wingShape.closePath();

  const wingGeo = new THREE.ExtrudeGeometry(wingShape, {
    depth: 0.08,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.025,
    bevelSegments: 2,
  });

  const rightWing = new THREE.Mesh(wingGeo, whiteTileMat);
  rightWing.position.set(0.22, 0, -0.14);
  rightWing.castShadow = true;
  orbiter.add(rightWing);

  const leftWing = new THREE.Mesh(wingGeo, whiteTileMat);
  leftWing.scale.x = -1;
  leftWing.position.set(-0.22, 0, -0.14);
  leftWing.castShadow = true;
  orbiter.add(leftWing);

  [-1, 1].forEach((dir) => {
    const trim = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.75, 0.14), blackTileMat);
    trim.position.set(dir * 1.06, -0.66, -0.08);
    trim.rotation.z = dir * 0.74;
    orbiter.add(trim);

    const oms = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.55, 8, 16), whiteTileMat);
    oms.position.set(dir * 0.34, -1.12, 0.22);
    orbiter.add(oms);
  });

  const tailShape = new THREE.Shape();
  tailShape.moveTo(0, 0);
  tailShape.lineTo(0.92, 0);
  tailShape.lineTo(0.36, 1.02);
  tailShape.lineTo(0, 1.02);
  tailShape.closePath();
  const tailMesh = new THREE.Mesh(
    new THREE.ExtrudeGeometry(tailShape, {
      depth: 0.07,
      bevelEnabled: true,
      bevelThickness: 0.015,
      bevelSize: 0.015,
      bevelSegments: 2,
    }),
    whiteTileMat
  );
  tailMesh.rotation.y = Math.PI / 2;
  tailMesh.rotation.z = Math.PI / 2;
  tailMesh.position.set(-0.035, -1.5, 0.28);
  tailMesh.castShadow = true;
  orbiter.add(tailMesh);

  [
    [0, 0.17],
    [-0.19, -0.09],
    [0.19, -0.09],
  ].forEach(([nx, nz]) => {
    const ssme = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.18, 0.38, 20), nozzleMat);
    ssme.position.set(nx, -1.66, nz);
    orbiter.add(ssme);
  });

  // Main SSME plumes attached to orbiter aft
  const mainFlames = new THREE.Group();
  mainFlames.visible = false;
  createPlume(mainFlames, 0, -1.85, 0, 0.42, 2.7, true);
  orbiter.add(mainFlames);

  root.add(orbiter);

  return {
    root,
    etGroup,
    srbLeft,
    srbRight,
    orbiter,
    bayDoorLeft,
    bayDoorRight,
    payloadMount,
    srbFlames,
    mainFlames,
    satFlame,
  };
}

/**
 * Large Heavy-Lift Rocket-Style Carrier Spaceship for Stage 2 (Hangar) & Stage 3 (Launch Pad -> In-Flight Deployment)
 * - Houses the Smaller Space-Capable Drop-Spaceship inside its upper clamshell payload bay!
 * - Visibly reflects Craft Class (Light / Standard / Heavy), Power Source (Solar / Nuclear RTG), and Radiation Shield Shell.
 */
export function buildCarrierRocketSpaceship(
  config: HangarConfig,
  assets: SpacecraftPBRAssets,
  options: { showBoosters?: boolean; openInspectBay?: boolean } = {}
): CarrierRocketRig {
  const { showBoosters = true } = options;
  const root = new THREE.Group();
  const coreGroup = new THREE.Group();
  root.add(coreGroup);

  const engineSpec = ENGINE_OPTIONS.find((e) => e.id === config.engineId) || ENGINE_OPTIONS[3];
  const fuelSpec = FUEL_OPTIONS.find((f) => f.id === config.fuelId) || FUEL_OPTIONS[2];

  const scaleW = fuelSpec.tankScaleR;
  const scaleH = fuelSpec.tankScaleY;
  const etScaleY = THREE.MathUtils.lerp(0.86, 1.08, (scaleH - 0.58) / (1.36 - 0.58));
  const etCenterZ = -0.32;

  const blackTileMat = new THREE.MeshStandardMaterial({
    map: assets.shuttleBlack.map,
    normalMap: assets.shuttleBlack.normalMap,
    normalScale: new THREE.Vector2(0.85, 0.85),
    color: 0x1e293b,
    roughness: 0.56,
    metalness: 0.34,
  });

  const titaniumMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    roughness: 0.34,
    metalness: 0.86,
  });

  const goldBayMat = new THREE.MeshPhysicalMaterial({
    map: assets.kapton.map,
    normalMap: assets.kapton.normalMap,
    color: 0xe6b44d,
    roughness: 0.28,
    metalness: 0.9,
    clearcoat: 0.2,
  });

  const nozzleMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.32,
    metalness: 0.88,
  });

  const copperBellMat = new THREE.MeshStandardMaterial({
    color: 0x9a3412,
    roughness: 0.3,
    metalness: 0.86,
  });

  const silverBellMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.25,
    metalness: 0.92,
  });

  const warningCrimsonMat = new THREE.MeshStandardMaterial({
    color: 0xe11d48,
    roughness: 0.42,
    metalness: 0.25,
  });

  const createPlume = (
    target: THREE.Group,
    x: number,
    y: number,
    z: number,
    radius: number,
    length: number,
    cyanTint = false
  ) => {
    const outer = new THREE.Mesh(
      new THREE.ConeGeometry(radius, length, 24),
      new THREE.MeshBasicMaterial({
        color: cyanTint ? 0x38bdf8 : 0xf97316,
        transparent: true,
        opacity: cyanTint ? 0.38 : 0.52,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    outer.rotation.x = Math.PI;
    outer.position.set(x, y - length / 2, z);
    target.add(outer);

    const mid = new THREE.Mesh(
      new THREE.ConeGeometry(radius * 0.58, length * 0.78, 20),
      new THREE.MeshBasicMaterial({
        color: cyanTint ? 0x93c5fd : 0xfbbf24,
        transparent: true,
        opacity: 0.62,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    mid.rotation.x = Math.PI;
    mid.position.set(x, y - (length * 0.78) / 2, z);
    target.add(mid);

    const core = new THREE.Mesh(
      new THREE.ConeGeometry(radius * 0.3, length * 0.48, 16),
      new THREE.MeshBasicMaterial({
        color: cyanTint ? 0xe0f2fe : 0xfef3c7,
        transparent: true,
        opacity: 0.76,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    core.rotation.x = Math.PI;
    core.position.set(x, y - (length * 0.48) / 2, z);
    target.add(core);
  };

  // 1. Engine-Specific Aft Propulsion Mount under NASA External Tank (5 distinct selectable engine configurations)
  const tankRadius = 0.57 * scaleW;
  const engineMountGroup = new THREE.Group();
  engineMountGroup.position.set(0, 0.48, etCenterZ);
  coreGroup.add(engineMountGroup);

  const skirtRadiusBottom =
    engineSpec.id === 'f1b_penta'
      ? tankRadius * 1.42
      : engineSpec.id === 'rs25_quad'
      ? tankRadius * 1.2
      : engineSpec.id === 'j2x_twin'
      ? tankRadius * 1.12
      : engineSpec.id === 'merlin_trio'
      ? tankRadius * 1.02
      : tankRadius * 0.72;
  const skirtHeight =
    engineSpec.id === 'f1b_penta' ? 0.58 : engineSpec.id === 'rl10_single' ? 0.34 : 0.44;
  const skirtMat =
    engineSpec.id === 'rs25_quad'
      ? goldBayMat
      : engineSpec.id === 'f1b_penta'
      ? titaniumMat
      : engineSpec.id === 'j2x_twin'
      ? silverBellMat
      : blackTileMat;

  const skirt = new THREE.Mesh(
    new THREE.CylinderGeometry(tankRadius * 0.92, skirtRadiusBottom, skirtHeight, 32),
    skirtMat
  );
  skirt.position.y = skirtHeight * 0.35;
  skirt.castShadow = true;
  skirt.receiveShadow = true;
  engineMountGroup.add(skirt);

  const buildDetailedBell = (
    bx: number,
    bz: number,
    topR: number,
    botR: number,
    len: number,
    ribbed: boolean,
    mat: THREE.Material = nozzleMat,
    tiltX = 0,
    tiltZ = 0
  ) => {
    const bell = new THREE.Mesh(new THREE.CylinderGeometry(topR, botR, len, 24), mat);
    bell.position.set(bx, -len * 0.42, bz);
    bell.rotation.set(tiltX, 0, tiltZ);
    bell.castShadow = true;
    engineMountGroup.add(bell);

    if (ribbed) {
      const band = new THREE.Mesh(
        new THREE.TorusGeometry((topR + botR) * 0.53, 0.022, 10, 24),
        engineSpec.id === 'f1b_penta' ? goldBayMat : silverBellMat
      );
      band.rotation.x = Math.PI / 2 + tiltX;
      band.position.set(bx, -len * 0.48, bz);
      engineMountGroup.add(band);
    }
  };

  if (engineSpec.id === 'rl10_single') {
    buildDetailedBell(0, 0, 0.13, 0.25, 0.68, true, silverBellMat);
  } else if (engineSpec.id === 'merlin_trio') {
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + Math.PI / 6;
      buildDetailedBell(
        Math.cos(a) * 0.26 * scaleW,
        Math.sin(a) * 0.26 * scaleW,
        0.11,
        0.2,
        0.54,
        false,
        copperBellMat
      );
    }
  } else if (engineSpec.id === 'j2x_twin') {
    [-1, 1].forEach((dir) => {
      buildDetailedBell(dir * 0.32 * scaleW, 0, 0.16, 0.3, 0.64, true, nozzleMat, 0, -dir * 0.08);
    });
  } else if (engineSpec.id === 'rs25_quad') {
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      buildDetailedBell(
        Math.cos(a) * 0.36 * scaleW,
        Math.sin(a) * 0.36 * scaleW,
        0.14,
        0.26,
        0.6,
        true,
        nozzleMat
      );
    }
  } else {
    buildDetailedBell(0, 0, 0.2, 0.36, 0.74, true, copperBellMat);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      buildDetailedBell(
        Math.cos(a) * 0.5 * scaleW,
        Math.sin(a) * 0.5 * scaleW,
        0.16,
        0.29,
        0.68,
        true,
        copperBellMat
      );
    }
    const thrustCollar = new THREE.Mesh(
      new THREE.TorusGeometry(skirtRadiusBottom * 0.96, 0.048, 12, 36),
      new THREE.MeshBasicMaterial({ color: 0xf59e0b })
    );
    thrustCollar.rotation.x = Math.PI / 2;
    thrustCollar.position.y = 0.04;
    engineMountGroup.add(thrustCollar);
  }

  // 2. Official NASA External Tank GLB (external-tank.glb) with Fuel Tank Option scaling & accents
  const etContainer = new THREE.Group();
  etContainer.position.set(0, 0.52 + 3.85 * etScaleY, etCenterZ);
  etContainer.scale.set(0.0041 * scaleW, 0.0041 * etScaleY, 0.0041 * scaleW);
  coreGroup.add(etContainer);

  // Fuel-specific structural ring accents on External Tank
  if (fuelSpec.id === 'fuel_critical') {
    const redBand = new THREE.Mesh(
      new THREE.CylinderGeometry(tankRadius * 1.02, tankRadius * 1.02, 0.18, 32),
      warningCrimsonMat
    );
    redBand.position.set(0, 2.4 * etScaleY, etCenterZ);
    coreGroup.add(redBand);
  } else if (fuelSpec.id === 'fuel_excess') {
    [2.2, 4.8].forEach((by) => {
      const goldBand = new THREE.Mesh(
        new THREE.CylinderGeometry(tankRadius * 1.015, tankRadius * 1.015, 0.16, 36),
        goldBayMat
      );
      goldBand.position.set(0, by * etScaleY, etCenterZ);
      coreGroup.add(goldBand);
    });
  }

  // 3. Bay Door Placeholders & Dish Group (kept for rig compatibility; NASA Orbiter separates directly from External Tank)
  const bayDoorLeft = new THREE.Group();
  const bayDoorRight = new THREE.Group();
  coreGroup.add(bayDoorLeft);
  coreGroup.add(bayDoorRight);
  const dishGroup = new THREE.Group();
  coreGroup.add(dishGroup);

  // 4. Mounted NASA Space Shuttle Orbiter (space-shuttle-d.glb) on External Tank Dorsal (+Z) Struts
  const payloadRestY = 0.42;
  const payloadMount = new THREE.Group();
  payloadMount.position.set(0, payloadRestY, 0.84);

  const innerDropShip = buildDropSpaceship(assets, config);
  innerDropShip.root.scale.setScalar(0.78);
  innerDropShip.legsGroup.visible = false;
  innerDropShip.flameGroup.visible = false;
  payloadMount.add(innerDropShip.root);

  // Orbital Maneuvering / SSME Plume on the Space Shuttle Orbiter during separation
  const craftFlame = new THREE.Group();
  craftFlame.visible = false;
  createPlume(craftFlame, 0, 0.36, 0.11, 0.24, 1.85, true);
  createPlume(craftFlame, -0.2, 0.36, -0.16, 0.2, 1.55, true);
  createPlume(craftFlame, 0.2, 0.36, -0.16, 0.2, 1.55, true);
  payloadMount.add(craftFlame);

  root.add(payloadMount);

  // 5. Main Core Exhaust Plumes (scales visually with engine thrust)
  const mainFlames = new THREE.Group();
  mainFlames.visible = false;
  const plumeRadius = 0.28 + (engineSpec.thrustKn / 3550) * 0.36;
  const plumeLen = 1.65 + (engineSpec.thrustKn / 3550) * 1.85;
  createPlume(mainFlames, 0, -0.25, etCenterZ, plumeRadius * scaleW, plumeLen, true);
  coreGroup.add(mainFlames);

  // 6. Twin Separable NASA Solid Rocket Boosters (solid-rocket-booster.glb)
  const srbOffsetX = tankRadius + 0.52;
  const buildSrb = (dir: -1 | 1) => {
    const srbGroup = new THREE.Group();
    srbGroup.position.set(dir * srbOffsetX, 0.1, -0.12);
    srbGroup.visible = showBoosters;
    root.add(srbGroup);
    return srbGroup;
  };

  const srbLeft = buildSrb(-1);
  const srbRight = buildSrb(1);

  const srbFlames = new THREE.Group();
  srbFlames.visible = false;
  createPlume(srbFlames, -srbOffsetX, -0.05, etCenterZ, 0.38, 2.8, false);
  createPlume(srbFlames, srbOffsetX, -0.05, etCenterZ, 0.38, 2.8, false);
  root.add(srbFlames);

  // Populate NASA External Tank and Twin SRBs from GLB cache
  onNasaShuttleGlbsReady((cache) => {
    const etClone = cache.externalTankTemplate.clone(true);
    if (fuelSpec.id !== 'fuel_nominal') {
      etClone.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (mesh.isMesh && mesh.material) {
          const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
          if (fuelSpec.id === 'fuel_critical') {
            mat.color.setHex(0x64748b);
            mat.roughness = 0.55;
            mat.metalness = 0.35;
          } else if (fuelSpec.id === 'fuel_short') {
            mat.color.setHex(0xfbbf24);
            mat.roughness = 0.42;
            mat.metalness = 0.28;
          } else if (fuelSpec.id === 'fuel_excess') {
            mat.color.setHex(0xea580c);
            mat.roughness = 0.62;
          }
          mesh.material = mat;
        }
      });
    }
    etContainer.add(etClone);

    [-1, 1].forEach((dir) => {
      const targetSrb = dir === -1 ? srbLeft : srbRight;
      const srbClone = cache.srbTemplate.clone(true);
      srbClone.scale.setScalar(0.0041);
      srbClone.position.set(0, 3.55, etCenterZ + 0.12);
      targetSrb.add(srbClone);
    });
  });

  return {
    root,
    coreGroup,
    srbLeft,
    srbRight,
    bayDoorLeft,
    bayDoorRight,
    payloadMount,
    payloadRestY,
    srbOffsetX,
    srbFlames,
    mainFlames,
    craftFlame,
    dishGroup,
  };
}

let southTexasGlbScene: THREE.Group | null = null;
let mobileLauncherGlbScene: THREE.Group | null = null;
let launchSiteGlbLoading = false;
const launchSiteCallbacks: Array<(site: THREE.Group, mlp: THREE.Group | null) => void> = [];

function onSouthTexasLaunchSiteReady(
  cb: (site: THREE.Group, mlp: THREE.Group | null) => void
): void {
  if (southTexasGlbScene) {
    cb(southTexasGlbScene, mobileLauncherGlbScene);
    return;
  }
  launchSiteCallbacks.push(cb);
  if (launchSiteGlbLoading) return;
  launchSiteGlbLoading = true;

  const loader = new GLTFLoader();
  Promise.all([
    loader.loadAsync('/assets/models/south-texas-launch-site-sn15.glb'),
    loader.loadAsync('/assets/models/mobile-launcher-assembled.glb').catch(() => null),
  ])
    .then(([siteGltf, mlpGltf]) => {
      siteGltf.scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach((m) => {
          const std = m as THREE.MeshStandardMaterial;
          if (!std) return;
          if (mesh.geometry.attributes.color) {
            std.vertexColors = true;
          }
          std.needsUpdate = true;
        });
      });
      southTexasGlbScene = siteGltf.scene;

      if (mlpGltf) {
        normalizeGlbMaterials(mlpGltf.scene, false);
        mobileLauncherGlbScene = mlpGltf.scene;
      }

      while (launchSiteCallbacks.length > 0) {
        const next = launchSiteCallbacks.shift();
        next?.(southTexasGlbScene, mobileLauncherGlbScene);
      }
    })
    .catch((err) => {
      console.error('Failed to load South Texas Launch Site with SN15 GLB:', err);
    });
}

/**
 * South Texas Launch Site with SN15 (SpaceX Starbase / Boca Chica) 3D GLB Environment & Integration Tower
 */
export function buildShuttleLaunchTower(): {
  root: THREE.Group;
  swingArm: THREE.Group;
} {
  const root = new THREE.Group();

  const steelMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    roughness: 0.44,
    metalness: 0.68,
  });
  const whiteSpireMat = new THREE.MeshPhysicalMaterial({
    color: 0xf8fafc,
    roughness: 0.28,
    metalness: 0.2,
    clearcoat: 0.3,
  });

  // Load and mount the full "South Texas Launch Site with SN15" 3D GLB surrounding the spacecraft at (0, 0, 0)
  const siteHolder = new THREE.Group();
  root.add(siteHolder);

  onSouthTexasLaunchSiteReady((siteTemplate, mlpTemplate) => {
    const siteClone = siteTemplate.clone(true);
    siteHolder.add(siteClone);

    if (mlpTemplate) {
      const mlpClone = mlpTemplate.clone(true);
      mlpClone.scale.setScalar(3.8);
      mlpClone.position.set(-1.35, 0.02, -0.35);
      siteHolder.add(mlpClone);
    }
  });

  // Articulated Crew/Umbilical Swing-Arm positioned at the tower (-2.3, 4.55, -0.35)
  const swingArm = new THREE.Group();
  swingArm.position.set(-2.32, 4.55, -0.35);
  const armBeam = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.24, 0.34), whiteSpireMat);
  armBeam.position.set(1.0, 0, 0);
  armBeam.castShadow = true;
  swingArm.add(armBeam);

  const whiteRoom = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.44, 0.48), steelMat);
  whiteRoom.position.set(1.92, 0, 0);
  swingArm.add(whiteRoom);
  root.add(swingArm);

  return { root, swingArm };
}

export function buildSatellite(type: 'iss' | 'hubble' | 'jwst'): THREE.Group {
  const group = new THREE.Group();
  const silverMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.28,
    metalness: 0.82,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xfbbf24,
    roughness: 0.18,
    metalness: 0.94,
  });
  const solarMat = new THREE.MeshPhysicalMaterial({
    color: 0x1d4ed8,
    roughness: 0.18,
    metalness: 0.6,
    clearcoat: 1.0,
  });

  if (type === 'iss') {
    group.add(new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.08, 0.08), silverMat));
    group.add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.45, 12), silverMat));
    [-0.42, -0.24, 0.24, 0.42].forEach((x) => {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.02, 0.62), solarMat);
      wing.position.set(x, 0, 0);
      group.add(wing);
    });
  } else if (type === 'hubble') {
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.55, 20), silverMat);
    tube.rotation.z = Math.PI / 2;
    group.add(tube);
    [-0.25, 0.25].forEach((z) => {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.02, 0.35), solarMat);
      wing.position.set(0, 0, z);
      group.add(wing);
    });
  } else {
    const shield = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.03, 0.4), silverMat);
    shield.rotation.y = Math.PI / 4;
    group.add(shield);
    const mirror = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.04, 6), goldMat);
    mirror.rotation.x = Math.PI / 2;
    mirror.position.set(0, 0.2, 0);
    group.add(mirror);
  }
  return group;
}

/**
 * Proxima b Photorealistic Exoplanet Outpost (Geodesic Glass Biodome + Solar Farm + Radar)
 */
export function buildColonyStructures(solarPBR: PBRTextureSet): {
  root: THREE.Group;
  radarDish: THREE.Group;
} {
  const root = new THREE.Group();

  const titaniumMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.36,
    metalness: 0.85,
  });

  const domeBase = new THREE.Mesh(
    new THREE.CylinderGeometry(2.5, 2.75, 0.4, 48),
    titaniumMat
  );
  domeBase.position.set(-4.2, 0.2, -1.4);
  domeBase.castShadow = true;
  domeBase.receiveShadow = true;
  root.add(domeBase);

  const domeGlass = new THREE.Mesh(
    new THREE.SphereGeometry(2.38, 40, 28, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.14,
      roughness: 0.12,
      metalness: 0.08,
      clearcoat: 0.6,
      clearcoatRoughness: 0.1,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    })
  );
  domeGlass.renderOrder = 3;
  domeGlass.position.set(-4.2, 0.36, -1.4);
  root.add(domeGlass);

  const domeWire = new THREE.LineSegments(
    new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(2.4, 2)),
    new THREE.LineBasicMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.42 })
  );
  domeWire.position.copy(domeGlass.position);
  root.add(domeWire);

  // Warm illuminated interior hydroponic core
  const habGlow = new THREE.Mesh(
    new THREE.CylinderGeometry(1.18, 1.32, 0.52, 24),
    new THREE.MeshStandardMaterial({
      color: 0xfef3c7,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.35,
      roughness: 0.38,
    })
  );
  habGlow.position.set(-4.2, 0.54, -1.4);
  root.add(habGlow);

  // Airlock pressurized corridor
  const airlock = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.35, 16), titaniumMat);
  airlock.rotation.z = Math.PI / 2;
  airlock.position.set(-1.6, 0.52, -1.4);
  root.add(airlock);

  // Solar tracker array
  const panelMat = new THREE.MeshPhysicalMaterial({
    map: solarPBR.map,
    roughnessMap: solarPBR.roughnessMap,
    color: 0xdbeafe,
    roughness: 0.18,
    metalness: 0.55,
    clearcoat: 1.0,
  });
  for (let i = 0; i < 4; i++) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 0.78, 16), titaniumMat);
    post.position.set(3.2 + i * 1.22, 0.39, -1.6);
    post.castShadow = true;
    root.add(post);

    const panel = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.06, 1.42), panelMat);
    panel.position.set(3.2 + i * 1.22, 0.78, -1.6);
    panel.rotation.x = 0.44;
    panel.castShadow = true;
    root.add(panel);
  }

  // Deep Space Ka-Band Radar Tower
  const radarTower = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.34, 2.3, 20), titaniumMat);
  radarTower.position.set(-3.2, 1.15, 2.8);
  radarTower.castShadow = true;
  root.add(radarTower);

  const radarDish = new THREE.Group();
  radarDish.position.set(-3.2, 2.35, 2.8);
  const dishPoints = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.45, 0.08),
    new THREE.Vector2(0.92, 0.32),
    new THREE.Vector2(1.14, 0.5),
  ];
  const dish = new THREE.Mesh(
    new THREE.LatheGeometry(dishPoints, 32),
    new THREE.MeshPhysicalMaterial({
      color: 0xf8fafc,
      roughness: 0.28,
      metalness: 0.2,
      clearcoat: 0.35,
      side: THREE.DoubleSide,
    })
  );
  dish.rotation.x = -Math.PI / 3;
  radarDish.add(dish);
  root.add(radarDish);

  return { root, radarDish };
}

export interface LandingVehicleRig {
  root: THREE.Group;
  flameGroup: THREE.Group;
  rampPivot: THREE.Group;
  legsGroup: THREE.Group;
  bayLight: THREE.PointLight;
}

/**
 * Sketches 1, 5, 6, 7: Vertical-Landing Planetary Lander / Cargo Rocket
 * - White ceramic tiled central fuselage with ogive nose cone
 * - Twin side propellant booster pods
 * - 4 articulated landing legs
 * - Forward cargo bay opening with interior warm LED illumination & hinged ribbed deployment ramp
 * - Retro-thruster descent flame plumes
 */
export function buildDropSpaceship(
  assets: SpacecraftPBRAssets,
  config?: HangarConfig
): LandingVehicleRig {
  const root = new THREE.Group();
  const craftScale =
    config?.craftClass === 'heavy' ? 1.06 : config?.craftClass === 'light' ? 0.94 : 1.0;

  const whiteMat = new THREE.MeshPhysicalMaterial({
    map: assets.shuttleWhite.map,
    normalMap: assets.shuttleWhite.normalMap,
    normalScale: new THREE.Vector2(0.7, 0.7),
    color: 0xe8edf4,
    roughness: 0.4,
    metalness: 0.14,
    clearcoat: 0.22,
  });

  const darkMat = new THREE.MeshStandardMaterial({
    map: assets.shuttleBlack.map,
    normalMap: assets.shuttleBlack.normalMap,
    color: 0x1e293b,
    roughness: 0.45,
    metalness: 0.72,
  });

  const titaniumMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    roughness: 0.36,
    metalness: 0.85,
  });

  // Official NASA Space Shuttle Orbiter GLB Container (space-shuttle-d.glb + doors + 3 SSME engines)
  const orbiterHolder = new THREE.Group();
  orbiterHolder.scale.setScalar(craftScale);
  root.add(orbiterHolder);

  onNasaShuttleGlbsReady((cache) => {
    const orbiterClone = cache.orbiterTemplate.clone(true);
    orbiterHolder.add(orbiterClone);
  });

  // Warm interior payload bay light
  const bayLight = new THREE.PointLight(0xfef3c7, 1.2, 6.0, 1.5);
  bayLight.position.set(0, 2.15, 0.25);
  root.add(bayLight);

  // 4 Deployable Articulated Landing Gear Struts (hidden during orbital flight, deployed on Stage 6 touchdown)
  const legsGroup = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + Math.PI / 4;
    const legHolder = new THREE.Group();
    legHolder.rotation.y = a;

    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.35, 12), titaniumMat);
    strut.position.set(1.12, 0.58, 0);
    strut.rotation.z = 0.46;
    strut.castShadow = true;
    legHolder.add(strut);

    const footPad = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 0.08, 16), darkMat);
    footPad.position.set(1.42, 0.04, 0);
    legHolder.add(footPad);

    legsGroup.add(legHolder);
  }
  root.add(legsGroup);

  // Hinged Ribbed Rover Deployment Ramp for Stage 6 Surface Rollout
  const rampPivot = new THREE.Group();
  rampPivot.position.set(0, 0.68, 0.42);

  const rampLength = 2.05;
  const rampPlate = new THREE.Mesh(
    new THREE.BoxGeometry(1.12, rampLength, 0.08),
    titaniumMat
  );
  rampPlate.position.set(0, rampLength / 2, 0);
  rampPlate.castShadow = true;
  rampPlate.receiveShadow = true;
  rampPivot.add(rampPlate);

  for (let r = 0; r < 9; r++) {
    const rib = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.05, 0.11), darkMat);
    rib.position.set(0, 0.18 + r * 0.21, 0.02);
    rampPivot.add(rib);
  }

  [-0.56, 0.56].forEach((rx) => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.05, rampLength, 0.14), whiteMat);
    rail.position.set(rx, rampLength / 2, 0.04);
    rampPivot.add(rail);
  });

  root.add(rampPivot);

  // 3 SSME Main Engine Plumes aligned with the NASA Space Shuttle Orbiter aft nozzles
  const flameGroup = new THREE.Group();
  const makePlume = (px: number, pz: number, radius: number, len: number) => {
    const outer = new THREE.Mesh(
      new THREE.ConeGeometry(radius, len, 20),
      new THREE.MeshBasicMaterial({
        color: 0xf97316,
        transparent: true,
        opacity: 0.52,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    outer.rotation.x = Math.PI;
    outer.position.set(px, 0.45 - len / 2, pz);
    flameGroup.add(outer);

    const core = new THREE.Mesh(
      new THREE.ConeGeometry(radius * 0.45, len * 0.62, 16),
      new THREE.MeshBasicMaterial({
        color: 0xfef3c7,
        transparent: true,
        opacity: 0.72,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    core.rotation.x = Math.PI;
    core.position.set(px, 0.45 - (len * 0.62) / 2, pz);
    flameGroup.add(core);
  };
  makePlume(0, 0.14, 0.32, 2.4);
  makePlume(-0.25, -0.21, 0.26, 2.0);
  makePlume(0.25, -0.21, 0.26, 2.0);
  root.add(flameGroup);

  return { root, flameGroup, rampPivot, legsGroup, bayLight };
}

export const buildLandingVehicle = buildDropSpaceship;

export interface RoverVehicleRig {
  root: THREE.Group;
  wheels: THREE.Mesh[];
  mastHead: THREE.Group;
}

/**
 * Sketch 7: Ultra-Realistic 6-Wheeled NASA Planetary Rover ("rover araç")
 * - Crinkled gold Kapton warm electronics box & white composite top deck
 * - 6 machined titanium treaded wheels with rocker-bogie suspension linkages
 * - Stereo optical mast head with glowing cyan camera lenses & LED headlights
 * - High-gain dish antenna & rear MMRTG finned power pack
 */
export function buildRoverVehicle(assets: SpacecraftPBRAssets): RoverVehicleRig {
  const root = new THREE.Group();
  const wheels: THREE.Mesh[] = [];

  const goldFoilMat = new THREE.MeshPhysicalMaterial({
    map: assets.kapton.map,
    normalMap: assets.kapton.normalMap,
    normalScale: new THREE.Vector2(1.2, 1.2),
    color: 0xffd175,
    roughness: 0.24,
    metalness: 0.92,
    clearcoat: 0.25,
  });

  const whiteDeckMat = new THREE.MeshPhysicalMaterial({
    color: 0xf1f5f9,
    roughness: 0.28,
    metalness: 0.16,
    clearcoat: 0.35,
  });

  const titaniumMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.34,
    metalness: 0.85,
  });

  const wheelMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.55,
    metalness: 0.78,
  });

  // 1. Main Warm Electronics Box (WEB) & White Avionics Deck
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.26, 0.78), goldFoilMat);
  chassis.position.set(0, 0.34, 0);
  chassis.castShadow = true;
  chassis.receiveShadow = true;
  root.add(chassis);

  const topDeck = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.05, 0.84), whiteDeckMat);
  topDeck.position.set(0, 0.49, 0);
  topDeck.castShadow = true;
  root.add(topDeck);

  // Rear MMRTG Radioisotope Finned Power Pack
  const rtg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.34, 16), titaniumMat);
  rtg.rotation.x = Math.PI / 3;
  rtg.position.set(0, 0.42, -0.48);
  root.add(rtg);

  // High-Gain Antenna Dish on rear deck
  const dishPoints = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.11, 0.03),
    new THREE.Vector2(0.18, 0.08),
  ];
  const hga = new THREE.Mesh(new THREE.LatheGeometry(dishPoints, 24), whiteDeckMat);
  hga.position.set(-0.16, 0.58, -0.22);
  hga.rotation.x = 0.45;
  root.add(hga);

  // 2. Rocker-Bogie Suspension + 6 Machined Wheels (3 per side)
  const wheelGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.11, 20);
  wheelGeo.rotateZ(Math.PI / 2);

  const hubGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.125, 12);
  hubGeo.rotateZ(Math.PI / 2);

  [-1, 1].forEach((side) => {
    const xPos = side * 0.39;
    // Main rocker bar
    const rockerBar = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.66), titaniumMat);
    rockerBar.position.set(side * 0.33, 0.28, 0);
    root.add(rockerBar);

    [-0.36, 0, 0.36].forEach((zPos) => {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.position.set(xPos, 0.14, zPos);
      wheel.castShadow = true;
      wheel.receiveShadow = true;

      const hub = new THREE.Mesh(hubGeo, goldFoilMat);
      wheel.add(hub);

      // Strut connecting rocker bar down to axle
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.17, 8), titaniumMat);
      strut.position.set(side * 0.34, 0.21, zPos);
      root.add(strut);

      root.add(wheel);
      wheels.push(wheel);
    });
  });

  // 3. Remote-Sensing Mast & Stereo NavCam Head (front-right deck)
  const mastPole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.42, 12), whiteDeckMat);
  mastPole.position.set(0.14, 0.72, 0.26);
  mastPole.castShadow = true;
  root.add(mastPole);

  const mastHead = new THREE.Group();
  mastHead.position.set(0.14, 0.94, 0.26);

  const camBox = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.11, 0.13), whiteDeckMat);
  camBox.castShadow = true;
  mastHead.add(camBox);

  // Glowing cyan stereo optics & laser spectrometer lens
  [-0.06, 0.06].forEach((lx) => {
    const lens = new THREE.Mesh(
      new THREE.CylinderGeometry(0.024, 0.024, 0.04, 12),
      new THREE.MeshBasicMaterial({ color: 0x22d3ee })
    );
    lens.rotation.x = Math.PI / 2;
    lens.position.set(lx, 0, 0.065);
    mastHead.add(lens);
  });
  root.add(mastHead);

  // Front LED Headlights on Chassis
  [-0.18, 0.18].forEach((hx) => {
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.03, 10, 10),
      new THREE.MeshBasicMaterial({ color: 0xfef08a })
    );
    lamp.position.set(hx, 0.38, 0.4);
    root.add(lamp);
  });

  // Articulated Front Robotic Sample Arm
  const armSeg = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.28), titaniumMat);
  armSeg.position.set(-0.14, 0.3, 0.48);
  armSeg.rotation.x = 0.25;
  root.add(armSeg);

  return { root, wheels, mastHead };
}

