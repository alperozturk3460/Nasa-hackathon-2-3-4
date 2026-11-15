import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import {
  CRAFT_CLASSES,
  CraftStats,
  ENGINE_OPTIONS,
  FUEL_OPTIONS,
  HangarConfig,
  JourneyWarpSpeed,
  LANDING_SITES,
  MissionFailureInfo,
  POWER_SOURCES,
  SceneStage,
  SurfacePhase,
  WORLDS,
  WorldId,
} from '../data/missionData';
import { missionAudio } from '../utils/audio';
import {
  buildCarrierRocketSpaceship,
  buildDropSpaceship,
  buildRoboticArm,
  buildShuttleLaunchTower,
  CarrierRocketRig,
  createAtmosphereMesh,
  LandingVehicleRig,
  SpacecraftPBRAssets,
} from './models';
import { RoverNavTelemetry } from './surfaceNavigation';

export type { RoverNavTelemetry };
import {
  createAsteroidPBR,
  createEarthLaunchSurfacePBR,
  createEarthPBR,
  createETFoamPBR,
  createEuropaIcePBR,
  createHangarFloorPBR,
  createHangarWallDisplay,
  createJupiterPBR,
  createKaptonFoilPBR,
  createMarsPBR,
  createMilkyWayBackdropTexture,
  createMoonPBR,
  createSaturnPBR,
  createSaturnRingTexture,
  createShuttleTilesPBR,
  createSmokePuffTexture,
  createSoftGlowTexture,
  createSolarCellPBR,
  createSunPBR,
  fbm3,
  HangarWallDisplay,
  PBRTextureSet,
} from './proceduralTextures';

export interface ProjectedLabel {
  id: string;
  text: string;
  x: number;
  y: number;
  visible: boolean;
  selected: boolean;
  hovered: boolean;
}

export interface LaunchTelemetry {
  phase:
    | 'pad'
    | 'countdown'
    | 'liftoff'
    | 'srb_sep'
    | 'tank_sep'
    | 'satellite_sep'
    | 'failed_arc'
    | 'failed_crash';
  countdownValue: number;
  altitudeKm: number;
  velocityKmh: number;
  accelG: number;
  fuelPct: number;
  stageLabel: string;
  sepVelocityMs: number;
}

export interface OrbitTelemetry {
  craftAngleDeg: number;
  siteAngleDeg: number;
  alignmentPct: number;
  phase: 'orbiting' | 'armed' | 'descending';
}

export interface EngineCallbacks {
  onWorldSelect?: (worldId: WorldId) => void;
  onWorldHover?: (worldId: WorldId | null) => void;
  onLaunchTelemetry: (t: LaunchTelemetry) => void;
  onLaunchComplete: () => void;
  onMissionFailed?: (failure: MissionFailureInfo) => void;
  onJourneyProgress: (pct: number) => void;
  onJourneyFuelUpdate?: (fuelPct: number) => void;
  onJourneyComplete: () => void;
  onOrbitStateUpdate?: (state: OrbitTelemetry) => void;
  onOrbitDescentComplete?: () => void;
  onSurfacePhaseChange?: (phase: SurfacePhase) => void;
  onRoverNavUpdate?: (nav: RoverNavTelemetry) => void;
  onLabelsUpdate?: (labels: ProjectedLabel[]) => void;
}

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _v4 = new THREE.Vector3();
const _v5 = new THREE.Vector3();
const _v6 = new THREE.Vector3();
const _v7 = new THREE.Vector3();
const _v8 = new THREE.Vector3();
const _upAxis = new THREE.Vector3(0, 1, 0);
const _xAxis = new THREE.Vector3(1, 0, 0);
const _mat4 = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _euler = new THREE.Euler();
const _scale = new THREE.Vector3();
const _col = new THREE.Color();

export class MissionWorldEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private clock = new THREE.Clock();
  private isSoftwareGl = false;
  private frameId = 0;
  private disposed = false;

  private activeStage: SceneStage = 'hangar';
  private targetWorldId: WorldId = 'moon';
  private currentConfig: HangarConfig;
  private currentStats: CraftStats;
  private callbacks: EngineCallbacks;

  private maxAnisotropy = 8;

  // PBR Texture Suites
  private sunPBR: PBRTextureSet;
  private earthPBR: PBRTextureSet;
  private earthLaunchSurfacePBR: PBRTextureSet;
  private moonPBR: PBRTextureSet;
  private mercuryPBR: PBRTextureSet;
  private marsPBR: PBRTextureSet;
  private jupiterPBR: PBRTextureSet;
  private saturnPBR: PBRTextureSet;
  private saturnRingTex: THREE.Texture;
  private europaPBR: PBRTextureSet;
  private asteroidPBR: PBRTextureSet;
  private proximaPBR: PBRTextureSet;
  private hangarFloorPBR: PBRTextureSet;
  private milkyWayTexture: THREE.Texture;
  private glowTexture: THREE.Texture;
  private smokeTexture: THREE.Texture;
  private spacecraftAssets: SpacecraftPBRAssets;
  private wallDisplay: HangarWallDisplay;

  private starField!: THREE.InstancedMesh;
  private skyBackdrop!: THREE.Mesh;

  // Scene root groups for stages 2, 3, and 4
  private hangarGroup = new THREE.Group();
  private launchGroup = new THREE.Group();
  private journeyGroup = new THREE.Group();

  private cameraFocusTarget: THREE.Vector3 | null = null;
  private cameraFocusPos: THREE.Vector3 | null = null;
  private userOrbiting = false;

  // Scene 2: Hangar (Large Rocket-Style Carrier Spaceship)
  private hangarTurntable = new THREE.Group();
  private hangarCraftRig: CarrierRocketRig | null = null;
  private leftArm!: ReturnType<typeof buildRoboticArm>;
  private armReachTimer = 0;
  private hangarSnapTimer = 0;
  private turntablePaused = false;

  // Scene 3: Launch Pad (Earth Coastal LC-39A + Exact 0.0055% Scientific Rocket-to-Earth Scale)
  private shuttleRig!: CarrierRocketRig;
  private launchTower!: ReturnType<typeof buildShuttleLaunchTower>;
  private padSky!: THREE.Mesh;
  private padSkyMat!: THREE.ShaderMaterial;
  private launchEarthHorizon!: THREE.Group;
  private launchEarthRadius = 77272;
  private launchRocketHeight = 8.5;
  private launchRocketMinY = -0.9;
  private launchRocketMaxY = 8.4;
  private launchRocketSrbOffsetX = 1.65;
  private launchCloudSprites: { sprite: THREE.Sprite; baseX: number; baseY: number; baseZ: number; speed: number }[] = [];
  private launchTargetPlanet!: THREE.Mesh;
  private launchStarStreaks!: THREE.Points;
  private launchEngineLight!: THREE.PointLight;
  private launchExplosionGroup!: THREE.Group;
  private launchFireball!: THREE.Mesh;
  private launchShockwave!: THREE.Mesh;
  private launchDebris: { mesh: THREE.Mesh; vel: THREE.Vector3; rotVel: THREE.Vector3 }[] = [];
  private launchFailedTrail!: THREE.Line;
  private launchSepDashLine!: THREE.Line;
  private launchCrashTimer = 0;
  private launchFailTriggered = false;
  private launchFailStartTheta = 0;
  private launchFailEndTheta = 0.003;
  private launchFailStartAlt = 26;
  private launchFailPeakAlt = 48;
  private launchFailDuration = 2.4;
  private launchFailPrevPos = new THREE.Vector3();
  private launchFailImpactPos = new THREE.Vector3();
  private launchLagoonReflection: THREE.Mesh | null = null;
  private launchFog: THREE.FogExp2 | null = null;
  private smokePool: { sprite: THREE.Sprite; vel: THREE.Vector3; age: number; active: boolean; baseScale: number; maxAge: number }[] = [];
  private launchPhase: LaunchTelemetry['phase'] = 'pad';
  private countdownAccum = 0;
  private lastCountdownInt = 5;
  private shuttleY = 0;
  private shuttleZ = 0;
  private shuttleVelY = 0;
  private shuttleVelZ = 0;
  private launchStageTime = 0;
  private launchPitchRad = 0;
  private launchSimAltitudeKm = 0;
  private launchSimVelocityKmh = 0;
  private launchAccelG = 1.0;
  private launchFuelPct = 100;
  private srbSepDist = 0;
  private srbSepDrop = 0;
  private srbSepRot = 0;
  private bayDoorAngle = 0;
  private satSepDist = 0;
  private launchCamOffset = new THREE.Vector3(5.2, 2.75, 33.5);
  private launchLookOffset = new THREE.Vector3(1.5, 4.95, 0);
  private lastTelemetryPush = 0;

  // Scene 4: Journey (Deployed Drop-Spaceship -> Planet Orbit Capture + 1000x/2000x/10000x Warp)
  private journeyCurve!: THREE.CatmullRomCurve3;
  private journeyCraft!: THREE.Group;
  private journeySatGroup!: THREE.Group;
  private journeySatRig: LandingVehicleRig | null = null;
  private journeySatFlame!: THREE.Mesh;
  private journeyCarrierGroup = new THREE.Group();
  private journeyCarrierRig: CarrierRocketRig | null = null;
  private journeyCamLook = new THREE.Vector3();
  private journeyCamOffset = new THREE.Vector3();
  private journeyLookOffset = new THREE.Vector3();
  private journeyTargetQuat = new THREE.Quaternion();
  private journeyOriginPlanetPos = new THREE.Vector3(-9.5, -2.0, 27.5);
  private journeyTargetPlanet!: THREE.Mesh;
  private journeyProgress = 0;
  private journeySpeedMultiplier: JourneyWarpSpeed = 1000;
  private journeyFuelExhausted = false;
  private journeyLostTimer = 0;
  private journeyLostVel = new THREE.Vector3();
  private journeyFailTriggered = false;
  private lastJourneyFuelPct = 100;

  constructor(
    container: HTMLElement,
    initialConfig: HangarConfig,
    initialStats: CraftStats,
    initialWorld: WorldId,
    callbacks: EngineCallbacks
  ) {
    this.container = container;
    this.currentConfig = { ...initialConfig };
    this.currentStats = initialStats;
    this.targetWorldId = initialWorld;
    this.callbacks = callbacks;

    this.isSoftwareGl = this.detectSoftwareWebGL();
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.88;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2)
    );
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    this.renderer.setSize(width, height);
    container.appendChild(this.renderer.domElement);

    this.maxAnisotropy = Math.min(16, this.renderer.capabilities.getMaxAnisotropy());

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x02040a);

    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.42;
    pmremGenerator.dispose();

    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 750);
    this.camera.position.set(0, 26, 48);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = !this.isSoftwareGl;
    this.controls.dampingFactor = 0.06;
    this.controls.minDistance = 4;
    this.controls.maxDistance = 135;
    this.controls.addEventListener('start', () => {
      this.userOrbiting = true;
      this.cameraFocusTarget = null;
      this.cameraFocusPos = null;
    });
    this.controls.addEventListener('end', () => {
      this.userOrbiting = false;
    });

    // Generate Photorealistic Procedural PBR Texture Suites
    this.sunPBR = createSunPBR(this.maxAnisotropy);
    this.earthPBR = createEarthPBR(this.maxAnisotropy);
    this.earthLaunchSurfacePBR = createEarthLaunchSurfacePBR(this.maxAnisotropy);
    this.moonPBR = createMoonPBR(this.maxAnisotropy, false);
    this.mercuryPBR = createMoonPBR(this.maxAnisotropy, true);
    this.marsPBR = createMarsPBR(this.maxAnisotropy, false);
    this.jupiterPBR = createJupiterPBR(this.maxAnisotropy);
    this.saturnPBR = createSaturnPBR(this.maxAnisotropy);
    this.saturnRingTex = createSaturnRingTexture(this.maxAnisotropy);
    this.europaPBR = createEuropaIcePBR(this.maxAnisotropy);
    this.asteroidPBR = createAsteroidPBR(this.maxAnisotropy);
    this.proximaPBR = createMarsPBR(this.maxAnisotropy, true);
    this.hangarFloorPBR = createHangarFloorPBR(this.maxAnisotropy);
    this.milkyWayTexture = createMilkyWayBackdropTexture();
    this.glowTexture = createSoftGlowTexture();
    this.smokeTexture = createSmokePuffTexture();
    this.wallDisplay = createHangarWallDisplay(this.maxAnisotropy);

    this.spacecraftAssets = {
      kapton: createKaptonFoilPBR(this.maxAnisotropy),
      solar: createSolarCellPBR(this.maxAnisotropy),
      shuttleWhite: createShuttleTilesPBR(this.maxAnisotropy, false),
      shuttleBlack: createShuttleTilesPBR(this.maxAnisotropy, true),
      etFoam: createETFoamPBR(this.maxAnisotropy),
      glow: this.glowTexture,
    };

    if (!this.isSoftwareGl) {
      RectAreaLightUniformsLib.init();
      this.composer = new EffectComposer(this.renderer);
      this.composer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.composer.setSize(width, height);
      const renderPass = new RenderPass(this.scene, this.camera);
      this.bloomPass = new UnrealBloomPass(
        new THREE.Vector2(width, height),
        0.14, // subtle calibrated HDR bloom without blowing out white tiles/dishes
        0.28,
        0.96
      );
      const outputPass = new OutputPass();
      this.composer.addPass(renderPass);
      this.composer.addPass(this.bloomPass);
      this.composer.addPass(outputPass);
    }

    this.setupLighting();
    this.buildSkyAndStars();
    this.buildHangarScene();
    this.buildLaunchPadScene();
    this.buildJourneyScene();

    this.scene.add(
      this.hangarGroup,
      this.launchGroup,
      this.journeyGroup
    );
    this.setStage('hangar');

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.bindEvents();
    this.clock.start();
    this.tick();
  }

  private detectSoftwareWebGL(): boolean {
    try {
      const probe = document.createElement('canvas');
      const gl = probe.getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    } catch {
      return true;
    }
  }

  private setupLighting(): void {
    const hemi = new THREE.HemisphereLight(0xa5c8ff, 0x0a1020, 0.38);
    this.scene.add(hemi);

    const key = new THREE.DirectionalLight(0xfff4e0, 1.65);
    key.position.set(18, 30, 20);
    key.castShadow = !this.isSoftwareGl;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -18;
    key.shadow.camera.right = 18;
    key.shadow.camera.top = 18;
    key.shadow.camera.bottom = -18;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.02;
    this.scene.add(key);

    const rim = new THREE.DirectionalLight(0x38bdf8, 0.42);
    rim.position.set(-20, 12, -22);
    this.scene.add(rim);
  }

  private buildSkyAndStars(): void {
    this.skyBackdrop = new THREE.Mesh(
      new THREE.SphereGeometry(290, 48, 32),
      new THREE.MeshBasicMaterial({
        map: this.milkyWayTexture,
        side: THREE.BackSide,
        depthWrite: false,
      })
    );
    this.scene.add(this.skyBackdrop);

    const count = 1200;
    const geo = new THREE.OctahedronGeometry(0.16, 1);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.starField = new THREE.InstancedMesh(geo, mat, count);
    for (let i = 0; i < count; i++) {
      const r = 145 + Math.random() * 125;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      _v1.set(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi)
      );
      _euler.set(0, 0, 0);
      _quat.setFromEuler(_euler);
      const s = 0.35 + Math.random() * 1.35;
      _scale.set(s, s, s);
      _mat4.compose(_v1, _quat, _scale);
      this.starField.setMatrixAt(i, _mat4);
      const tint = Math.random();
      _col.setHex(tint < 0.22 ? 0x93c5fd : tint < 0.38 ? 0xfde68a : 0xf8fafc);
      this.starField.setColorAt(i, _col);
    }
    this.starField.instanceMatrix.needsUpdate = true;
    if (this.starField.instanceColor) this.starField.instanceColor.needsUpdate = true;
    this.starField.computeBoundingSphere();
    this.scene.add(this.starField);
  }

  private getWorldPBR(worldId: WorldId): PBRTextureSet {
    switch (worldId) {
      case 'earth':
        return this.earthPBR;
      case 'moon':
        return this.moonPBR;
      case 'mars':
        return this.marsPBR;
      case 'jupiter':
        return this.jupiterPBR;
      case 'asteroid':
        return this.asteroidPBR;
      case 'colony':
        return this.proximaPBR;
    }
  }

  private createEarthGlobeMaterial(
    sunDirRef: THREE.Vector3 = new THREE.Vector3(18, 30, 20).normalize(),
    roughness = 0.56
  ): THREE.MeshStandardMaterial {
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: this.earthPBR.map,
      normalMap: this.earthPBR.normalMap ?? null,
      normalScale: new THREE.Vector2(1.35, 1.35),
      roughnessMap: this.earthPBR.roughnessMap ?? null,
      roughness,
      metalness: 0.08,
      emissive: new THREE.Color(0xffca6a),
      emissiveMap: this.earthPBR.emissiveMap ?? null,
      emissiveIntensity: 1.55,
    });
    mat.customProgramCacheKey = () => 'pateldev-earth-nightlights-v1';
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uEarthSunDir = { value: sunDirRef };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vEarthWorldNormal;')
        .replace(
          '#include <beginnormal_vertex>',
          '#include <beginnormal_vertex>\nvEarthWorldNormal = normalize(mat3(modelMatrix) * objectNormal);'
        );
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform vec3 uEarthSunDir;\nvarying vec3 vEarthWorldNormal;')
        .replace(
          '#include <emissivemap_fragment>',
          '#include <emissivemap_fragment>\nfloat earthDayMask = smoothstep(-0.18, 0.14, dot(normalize(vEarthWorldNormal), normalize(uEarthSunDir)));\ntotalEmissiveRadiance *= (1.0 - earthDayMask);'
        );
    };
    return mat;
  }



  private buildHangarScene(): void {
    // Reflective Cleanroom Epoxy Floor (PBR roughnessMap + cyan calibration grid)
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(46, 46),
      new THREE.MeshStandardMaterial({
        map: this.hangarFloorPBR.map,
        roughnessMap: this.hangarFloorPBR.roughnessMap,
        roughness: 0.34,
        metalness: 0.42,
      })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.hangarGroup.add(floor);

    // High-Bay Cleanroom Architecture: Ribbed Acoustic Bulkhead Wall + Overhead Gantry Trusses
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x08101f,
      roughness: 0.55,
      metalness: 0.62,
    });
    const steelStrutMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.35,
      metalness: 0.86,
    });

    const backWall = new THREE.Mesh(new THREE.BoxGeometry(30, 13, 0.5), wallMat);
    backWall.position.set(0, 6.5, -10.6);
    backWall.receiveShadow = true;
    this.hangarGroup.add(backWall);

    // Beveled Titanium Screen Bezel + High-DPI Telemetry Screen
    const screenFrame = new THREE.Mesh(new THREE.BoxGeometry(14.1, 6.0, 0.25), steelStrutMat);
    screenFrame.position.set(0, 5.75, -10.3);
    this.hangarGroup.add(screenFrame);

    const screenMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(13.5, 5.5),
      new THREE.MeshBasicMaterial({ map: this.wallDisplay.texture })
    );
    screenMesh.position.set(0, 5.75, -10.15);
    this.hangarGroup.add(screenMesh);

    // Structural High-Bay Columns + Overhead Crane Truss Beams
    [-10.2, -7.8, 7.8, 10.2].forEach((x) => {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.75, 13, 0.9), steelStrutMat);
      pillar.position.set(x, 6.5, -9.9);
      pillar.castShadow = true;
      this.hangarGroup.add(pillar);
    });

    const overheadBeam = new THREE.Mesh(new THREE.BoxGeometry(24, 0.65, 1.1), steelStrutMat);
    overheadBeam.position.set(0, 10.6, -2.5);
    this.hangarGroup.add(overheadBeam);

    // Studio Cleanroom Overhead RectAreaLight Softboxes (GPU only, calibrated)
    if (!this.isSoftwareGl) {
      const softboxMain = new THREE.RectAreaLight(0xe0f2fe, 3.2, 11, 3.8);
      softboxMain.position.set(0, 9.6, 2.5);
      softboxMain.lookAt(0, 2.0, 0);
      this.hangarGroup.add(softboxMain);

      const softboxRim = new THREE.RectAreaLight(0xfef3c7, 1.9, 8, 3.0);
      softboxRim.position.set(5.5, 6.0, -4.5);
      softboxRim.lookAt(0, 2.2, 0);
      this.hangarGroup.add(softboxRim);
    }

    // Precision Rotary Assembly Turntable with Amber Illuminated Perimeter Ring
    const turntableBase = new THREE.Mesh(
      new THREE.CylinderGeometry(3.58, 3.92, 0.36, 64),
      steelStrutMat
    );
    turntableBase.position.y = 0.18;
    turntableBase.receiveShadow = true;
    this.hangarTurntable.add(turntableBase);

    const innerDeck = new THREE.Mesh(
      new THREE.CylinderGeometry(3.25, 3.25, 0.38, 48),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.32, metalness: 0.78 })
    );
    innerDeck.position.y = 0.19;
    innerDeck.receiveShadow = true;
    this.hangarTurntable.add(innerDeck);

    const glowRing = new THREE.Mesh(
      new THREE.RingGeometry(3.52, 3.82, 72),
      new THREE.MeshBasicMaterial({ color: 0xd97706, side: THREE.DoubleSide })
    );
    glowRing.rotation.x = -Math.PI / 2;
    glowRing.position.y = 0.375;
    this.hangarTurntable.add(glowRing);

    // 4-Post Open Titanium Service Cradle elevating the rocket above the turntable so engine bells are fully visible
    const cradleMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.42,
      metalness: 0.82,
    });
    const cradleAccentMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.45,
      metalness: 0.35,
    });
    const cradleRing = new THREE.Mesh(new THREE.TorusGeometry(1.52, 0.06, 12, 48), cradleMat);
    cradleRing.rotation.x = Math.PI / 2;
    cradleRing.position.y = 1.24;
    this.hangarTurntable.add(cradleRing);

    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.92, 16), cradleMat);
      post.position.set(Math.cos(a) * 1.95, 0.82, Math.sin(a) * 1.95);
      post.rotation.z = Math.cos(a) * 0.24;
      post.rotation.x = -Math.sin(a) * 0.24;
      post.castShadow = true;
      this.hangarTurntable.add(post);

      const clampPad = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.14, 0.24), cradleAccentMat);
      clampPad.position.set(Math.cos(a) * 1.54, 1.24, Math.sin(a) * 1.54);
      clampPad.rotation.y = -a;
      this.hangarTurntable.add(clampPad);
    }

    // Upward inspection spotlight underneath the engine bells
    const nozzleInspectLight = new THREE.PointLight(0x38bdf8, 4.5, 6.5, 1.5);
    nozzleInspectLight.position.set(0, 0.48, 0.9);
    this.hangarTurntable.add(nozzleInspectLight);

    this.hangarGroup.add(this.hangarTurntable);

    // Orange & White Cleanroom Robotic Arm
    this.leftArm = buildRoboticArm(0xf97316);
    this.leftArm.root.position.set(-4.2, 0, 0.45);
    this.leftArm.root.rotation.y = Math.PI / 2;
    this.hangarGroup.add(this.leftArm.root);

    this.rebuildHangarSpacecraft();
  }

  public rebuildHangarSpacecraft(animateArm = false): void {
    if (this.hangarCraftRig) {
      this.hangarTurntable.remove(this.hangarCraftRig.root);
    }
    this.hangarCraftRig = buildCarrierRocketSpaceship(this.currentConfig, this.spacecraftAssets, {
      showBoosters: true,
      openInspectBay: true,
    });
    this.hangarCraftRig.root.scale.setScalar(0.68);
    this.hangarCraftRig.root.position.y = 1.15;
    this.hangarTurntable.add(this.hangarCraftRig.root);

    if (animateArm) {
      this.armReachTimer = 0.85;
      this.hangarSnapTimer = 0.32;
    }

    const world = WORLDS[this.targetWorldId];
    const engine =
      ENGINE_OPTIONS.find((e) => e.id === this.currentConfig.engineId) || ENGINE_OPTIONS[3];
    const fuel =
      FUEL_OPTIONS.find((f) => f.id === this.currentConfig.fuelId) || FUEL_OPTIONS[2];
    const power =
      POWER_SOURCES.find((p) => p.id === this.currentConfig.powerSource) || POWER_SOURCES[0];

    this.wallDisplay.update({
      craftName: engine.name,
      massKg: this.currentStats.totalMassKg,
      massLimitKg: this.currentStats.massLimitKg,
      costM: this.currentStats.totalCostM,
      budgetLimitM: this.currentStats.budgetLimitM,
      netPowerW: this.currentStats.netPowerW,
      fuelKg: this.currentStats.fuelMassKg,
      requiredFuelKg: this.currentStats.requiredFuelKg,
      thrustKn: this.currentStats.thrustKn,
      requiredThrustKn: this.currentStats.requiredThrustKn,
      fuelLabel: fuel.name,
      powerLabel: power.name,
      worldName: world.name,
      twr: this.currentStats.launchTwr,
    });
  }

  private buildLaunchPadScene(): void {
    // Realistic Late-Afternoon Earth Coastal Sky Dome with Diagonal Cirrus Streaks fading cleanly to Deep Space
    this.padSkyMat = new THREE.ShaderMaterial({
      uniforms: {
        uSpaceMix: { value: 0.0 },
        uTime: { value: 0.0 },
      },
      vertexShader: `
        varying vec3 vLocalDir;
        void main() {
          vLocalDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uSpaceMix;
        uniform float uTime;
        varying vec3 vLocalDir;

        float hash21(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }

        float noise2(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(hash21(i + vec2(0.0, 0.0)), hash21(i + vec2(1.0, 0.0)), u.x),
            mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
            u.y
          );
        }

        void main() {
          float h = clamp(vLocalDir.y, -0.15, 1.0);
          // Warm golden-hour coastal mist near horizon transitioning to cerulean azure zenith
          vec3 horizonBase = vec3(0.66, 0.71, 0.74);
          float sunAzimuth = clamp(0.5 - vLocalDir.x * 0.45 - vLocalDir.z * 0.35, 0.0, 1.0);
          vec3 horizonWarm = mix(horizonBase, vec3(0.84, 0.71, 0.56), pow(sunAzimuth, 1.8) * 0.65);
          vec3 horizon = mix(horizonWarm, vec3(0.006, 0.01, 0.022), uSpaceMix);
          vec3 mid = mix(vec3(0.24, 0.45, 0.69), vec3(0.004, 0.008, 0.018), uSpaceMix);
          vec3 zenith = mix(vec3(0.09, 0.24, 0.48), vec3(0.003, 0.006, 0.014), uSpaceMix);

          vec3 col = h < 0.24
            ? mix(horizon, mid, smoothstep(-0.04, 0.24, h))
            : mix(mid, zenith, smoothstep(0.24, 0.92, h));

          // Procedural wispy diagonal cirrus streaks across coastal sky
          vec2 skyUv = vec2(
            vLocalDir.x * 3.8 + vLocalDir.y * 5.2 + uTime * 0.003,
            vLocalDir.z * 3.8 - vLocalDir.y * 2.4
          );
          float w1 = noise2(skyUv * 2.4);
          float w2 = noise2(skyUv * 5.8 + vec2(w1 * 1.4, -w1 * 0.8));
          float streak = smoothstep(0.52, 0.88, w1 * 0.58 + w2 * 0.42);
          float bandMask = smoothstep(0.02, 0.14, h) * (1.0 - smoothstep(0.32, 0.82, h));
          float skyVis = 1.0 - smoothstep(0.05, 0.55, uSpaceMix);
          vec3 cirrusCol = mix(vec3(0.88, 0.90, 0.94), vec3(0.96, 0.89, 0.82), pow(sunAzimuth, 1.4) * 0.45);
          col = mix(col, cirrusCol, streak * bandMask * skyVis * 0.42);

          gl_FragColor = vec4(col, 1.0);
        }
      `,
      side: THREE.BackSide,
      transparent: false,
      depthTest: true,
      depthWrite: false,
    });
    this.padSky = new THREE.Mesh(new THREE.SphereGeometry(380000, 32, 24), this.padSkyMat);
    this.launchGroup.add(this.padSky);

    this.launchFog = new THREE.FogExp2(0x9fb4c7, 0.0014);

    // True Scientific 0.0055% Scale Earth Globe (high segment density so orbital decay graze kisses visual globe!)
    this.launchEarthHorizon = new THREE.Group();
    const orbitEarth = new THREE.Mesh(
      new THREE.SphereGeometry(0.99999, 192, 128),
      this.createEarthGlobeMaterial(new THREE.Vector3(18, 30, 20).normalize(), 0.56)
    );
    // Align Florida & Eastern North America / Atlantic Ocean directly underneath coastal pad & downrange corridor
    orbitEarth.rotation.set(-1.073, -0.165, 0);
    this.launchEarthHorizon.add(orbitEarth);

    if (this.earthPBR.cloudsMap) {
      const orbitClouds = new THREE.Mesh(
        new THREE.SphereGeometry(1.0022, 128, 84),
        new THREE.MeshStandardMaterial({
          map: this.earthPBR.cloudsMap,
          alphaMap: this.earthPBR.cloudsMap,
          transparent: true,
          opacity: 0.76,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -1,
        })
      );
      orbitClouds.rotation.set(-1.073, -0.165, 0);
      this.launchEarthHorizon.add(orbitClouds);
    }
    this.launchEarthHorizon.add(createAtmosphereMesh(1.018, 0x38bdf8, 0.55, 3.0));

    // High-Precision Curved Coastal Launch Cap (blends into Earth globe cleanly)
    const CAP_THETA = 0.048;
    const capGeo = new THREE.SphereGeometry(1.0, 96, 48, 0, Math.PI * 2, 0, CAP_THETA);
    const capPos = capGeo.attributes.position as THREE.BufferAttribute;
    const capUv = capGeo.attributes.uv as THREE.BufferAttribute;
    const capSpan = Math.sin(CAP_THETA);
    for (let i = 0; i < capPos.count; i++) {
      const vx = capPos.getX(i);
      const vz = capPos.getZ(i);
      capUv.setXY(i, (vx / capSpan) * 0.5 + 0.5, (vz / capSpan) * 0.5 + 0.5);
    }
    capUv.needsUpdate = true;

    const coastalCap = new THREE.Mesh(
      capGeo,
      new THREE.MeshStandardMaterial({
        map: this.earthLaunchSurfacePBR.map,
        normalMap: this.earthLaunchSurfacePBR.normalMap,
        roughnessMap: this.earthLaunchSurfacePBR.roughnessMap,
        roughness: 0.85,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      })
    );
    coastalCap.receiveShadow = true;
    this.launchEarthHorizon.add(coastalCap);

    this.launchEarthHorizon.position.set(0, -this.launchEarthRadius, 0);
    this.launchEarthHorizon.scale.setScalar(this.launchEarthRadius);
    this.launchGroup.add(this.launchEarthHorizon);

    // Calm Foreground Coastal Lagoon / Boca Chica Tidal Flats Reflection
    const lagoonWater = new THREE.Mesh(
      new THREE.PlaneGeometry(360, 140),
      new THREE.MeshStandardMaterial({
        color: 0x16384c,
        roughness: 0.09,
        metalness: 0.68,
      })
    );
    lagoonWater.rotation.x = -Math.PI / 2;
    lagoonWater.position.set(0, -0.08, 84);
    lagoonWater.receiveShadow = true;
    this.launchGroup.add(lagoonWater);

    // Golden-Hour Sun / Rocket Flame Reflection Column Shimmering Across the Lagoon Water
    const reflGeo = new THREE.PlaneGeometry(3.4, 28);
    const reflMat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0.36,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.launchLagoonReflection = new THREE.Mesh(reflGeo, reflMat);
    this.launchLagoonReflection.rotation.x = -Math.PI / 2;
    this.launchLagoonReflection.position.set(1.2, -0.055, 25);
    this.launchGroup.add(this.launchLagoonReflection);

    // Gulf of Mexico Coastal Shelf
    const atlanticWater = new THREE.Mesh(
      new THREE.PlaneGeometry(320, 420),
      new THREE.MeshStandardMaterial({
        color: 0x0c5f8a,
        roughness: 0.16,
        metalness: 0.35,
        transparent: true,
        opacity: 0.9,
      })
    );
    atlanticWater.rotation.x = -Math.PI / 2;
    atlanticWater.position.set(215, -0.02, 0);
    atlanticWater.receiveShadow = true;
    this.launchGroup.add(atlanticWater);

    // Overhead Volumetric Cumulus Clouds Floating Through Launch Ascent Corridor
    for (let i = 0; i < 18; i++) {
      const cloudMat = new THREE.SpriteMaterial({
        map: this.smokeTexture,
        color: 0xf8fafc,
        transparent: true,
        opacity: 0.48,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(cloudMat);
      const bx = (Math.random() - 0.5) * 110;
      const by = 28 + Math.random() * 44;
      const bz = -40 + Math.random() * 65;
      const cScale = 12 + Math.random() * 16;
      sprite.position.set(bx, by, bz);
      sprite.scale.set(cScale * 1.75, cScale * 0.85, 1);
      this.launchGroup.add(sprite);
      this.launchCloudSprites.push({
        sprite,
        baseX: bx,
        baseY: by,
        baseZ: bz,
        speed: 0.45 + Math.random() * 0.6,
      });
    }

    // "South Texas Launch Site with SN15" 3D GLB Launch Complex surrounding the spacecraft at (0, 0, 0)
    this.launchTower = buildShuttleLaunchTower();
    this.launchTower.root.position.set(0, 0, 0);
    this.launchGroup.add(this.launchTower.root);

    // Visible Target Planet ahead in space for forward deployment sequence
    this.launchTargetPlanet = new THREE.Mesh(
      new THREE.SphereGeometry(7.2, 48, 36),
      new THREE.MeshStandardMaterial({
        map: this.moonPBR.map,
        normalMap: this.moonPBR.normalMap ?? null,
        roughness: 0.78,
      })
    );
    this.launchTargetPlanet.position.set(0, 74, 95);
    this.launchTargetPlanet.visible = false;
    this.launchGroup.add(this.launchTargetPlanet);

    // Subtle deep-space velocity star streaks during forward planetary cruise
    const streakCount = 260;
    const streakPositions = new Float32Array(streakCount * 3);
    for (let i = 0; i < streakCount; i++) {
      streakPositions[i * 3] = (Math.random() - 0.5) * 44;
      streakPositions[i * 3 + 1] = 28 + Math.random() * 75;
      streakPositions[i * 3 + 2] = -25 + Math.random() * 120;
    }
    const streakGeo = new THREE.BufferGeometry();
    streakGeo.setAttribute('position', new THREE.BufferAttribute(streakPositions, 3));
    this.launchStarStreaks = new THREE.Points(
      streakGeo,
      new THREE.PointsMaterial({ color: 0xe2e8f0, size: 0.22, transparent: true, opacity: 0.85 })
    );
    this.launchStarStreaks.visible = false;
    this.launchGroup.add(this.launchStarStreaks);

    this.shuttleRig = buildCarrierRocketSpaceship(this.currentConfig, this.spacecraftAssets, {
      showBoosters: true,
      openInspectBay: false,
    });
    this.shuttleRig.root.scale.setScalar(0.95);
    this.shuttleRig.root.position.set(0, 0.85, 0);
    this.launchGroup.add(this.shuttleRig.root);

    // Calibrated Engine Flame PointLight
    this.launchEngineLight = new THREE.PointLight(0xff9a3c, 0, 34, 1.5);
    this.launchEngineLight.position.set(0, 0.5, 0.4);
    this.launchGroup.add(this.launchEngineLight);

    // Failed Launch Trajectory Warning Arc
    const failArcPts: THREE.Vector3[] = [];
    for (let i = 0; i <= 60; i++) failArcPts.push(new THREE.Vector3());
    this.launchFailedTrail = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(failArcPts),
      new THREE.LineDashedMaterial({ color: 0xf43f5e, dashSize: 0.9, gapSize: 0.5 })
    );
    this.launchFailedTrail.visible = false;
    this.launchGroup.add(this.launchFailedTrail);

    // Dashed Trajectory Guide Connecting Separated Small Spaceship Ahead Toward Target Planet (Sketch 5)
    const sepDashPts: THREE.Vector3[] = [];
    for (let i = 0; i <= 24; i++) sepDashPts.push(new THREE.Vector3());
    this.launchSepDashLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(sepDashPts),
      new THREE.LineDashedMaterial({
        color: 0x38bdf8,
        dashSize: 0.95,
        gapSize: 0.65,
        transparent: true,
        opacity: 0,
      })
    );
    this.launchSepDashLine.visible = false;
    this.launchGroup.add(this.launchSepDashLine);

    // 3D Impact Explosion & Shattering Debris System (for underpowered engine planetary crash!)
    this.launchExplosionGroup = new THREE.Group();
    this.launchExplosionGroup.visible = false;

    this.launchFireball = new THREE.Mesh(
      new THREE.SphereGeometry(1.0, 28, 22),
      new THREE.MeshBasicMaterial({
        color: 0xf97316,
        transparent: true,
        opacity: 0.92,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.launchExplosionGroup.add(this.launchFireball);

    const innerFlash = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 20, 16),
      new THREE.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.95 })
    );
    this.launchFireball.add(innerFlash);

    this.launchShockwave = new THREE.Mesh(
      new THREE.TorusGeometry(1.4, 0.14, 12, 40),
      new THREE.MeshBasicMaterial({
        color: 0xfbbf24,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.launchShockwave.rotation.x = Math.PI / 2;
    this.launchExplosionGroup.add(this.launchShockwave);

    const shardMats = [
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.42, metalness: 0.25 }),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.45, metalness: 0.78 }),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.3, metalness: 0.85 }),
      new THREE.MeshBasicMaterial({ color: 0xf97316 }),
    ];
    for (let i = 0; i < 28; i++) {
      const geo =
        i % 3 === 0
          ? new THREE.BoxGeometry(0.95, 0.28, 0.65)
          : i % 3 === 1
          ? new THREE.CylinderGeometry(0.18, 0.3, 0.62, 10)
          : new THREE.TetrahedronGeometry(0.46, 0);
      const mesh = new THREE.Mesh(geo, shardMats[i % shardMats.length]);
      mesh.castShadow = true;
      this.launchExplosionGroup.add(mesh);
      this.launchDebris.push({
        mesh,
        vel: new THREE.Vector3(),
        rotVel: new THREE.Vector3(),
      });
    }
    this.launchGroup.add(this.launchExplosionGroup);

    // Volumetric Soft Billboard Flame-Trench Steam & Smoke Plume Pool (110 puffs for twin billowing cumulus clouds!)
    for (let i = 0; i < 110; i++) {
      const warmTint = i % 3 === 0 ? 0xf5e3cf : i % 3 === 1 ? 0xebdccb : 0xfaf6f0;
      const sMat = new THREE.SpriteMaterial({
        map: this.smokeTexture,
        color: warmTint,
        transparent: true,
        opacity: 0.72,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(sMat);
      sprite.visible = false;
      this.launchGroup.add(sprite);
      this.smokePool.push({
        sprite,
        vel: new THREE.Vector3(),
        age: 0,
        active: false,
        baseScale: 2.2,
        maxAge: 3.4,
      });
    }
  }

  private rebuildLaunchStack(): void {
    if (this.shuttleRig) {
      this.launchGroup.remove(this.shuttleRig.root);
    }
    this.shuttleRig = buildCarrierRocketSpaceship(this.currentConfig, this.spacecraftAssets, {
      showBoosters: true,
      openInspectBay: false,
    });
    this.shuttleRig.root.scale.setScalar(0.95);
    this.shuttleRig.root.position.set(0, 0.85, 0);
    this.launchGroup.add(this.shuttleRig.root);

    // Enforce Exact Scientific Rocket-to-Earth Scale Ratio: Rocket = 0.0055% of Earth Diameter
    this.shuttleRig.root.updateMatrixWorld(true);
    const rocketBox = new THREE.Box3().setFromObject(this.shuttleRig.root);
    this.launchRocketHeight = Math.max(7.8, rocketBox.max.y - rocketBox.min.y);
    this.launchRocketMinY = Math.min(-0.25, rocketBox.min.y - this.shuttleRig.root.position.y);
    this.launchRocketMaxY = Math.max(7.8, rocketBox.max.y - this.shuttleRig.root.position.y);
    this.launchRocketSrbOffsetX = this.shuttleRig.srbOffsetX * this.shuttleRig.root.scale.x;
    const earthDiameter = this.launchRocketHeight / 0.000055;
    this.launchEarthRadius = earthDiameter * 0.5;

    if (this.launchEarthHorizon) {
      this.launchEarthHorizon.scale.setScalar(this.launchEarthRadius);
      this.launchEarthHorizon.position.set(0, -this.launchEarthRadius, 0);
    }
  }

  private buildJourneyScene(): void {
    const earthDep = new THREE.Mesh(
      new THREE.SphereGeometry(5.6, 64, 48),
      this.createEarthGlobeMaterial(new THREE.Vector3(18, 30, 20).normalize(), 0.56)
    );
    const earthPos = this.journeyOriginPlanetPos;
    earthDep.position.copy(earthPos);
    earthDep.rotation.set(0.22, -1.15, THREE.MathUtils.degToRad(23.4));
    earthDep.add(createAtmosphereMesh(5.88, 0x38bdf8, 0.46, 3.2));
    this.journeyGroup.add(earthDep);

    if (this.earthPBR.cloudsMap) {
      const jClouds = new THREE.Mesh(
        new THREE.SphereGeometry(5.7, 56, 42),
        new THREE.MeshStandardMaterial({
          map: this.earthPBR.cloudsMap,
          alphaMap: this.earthPBR.cloudsMap,
          transparent: true,
          opacity: 0.82,
          depthWrite: false,
        })
      );
      earthDep.add(jClouds);
    }

    this.journeyTargetPlanet = new THREE.Mesh(
      new THREE.SphereGeometry(5.2, 56, 40),
      new THREE.MeshStandardMaterial({
        map: this.marsPBR.map,
        normalMap: this.marsPBR.normalMap,
        roughness: 0.8,
      })
    );
    this.journeyTargetPlanet.position.set(7.2, 0, -34);
    this.journeyGroup.add(this.journeyTargetPlanet);

    // Dashed target "yörünge" orbit ring waiting around destination planet (Sketch 3)
    const targetOrbitPts: THREE.Vector3[] = [];
    for (let i = 0; i < 96; i++) {
      const a = (i / 96) * Math.PI * 2;
      targetOrbitPts.push(new THREE.Vector3(Math.cos(a) * 8.4, 0, Math.sin(a) * 8.4));
    }
    const targetOrbitLoop = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(targetOrbitPts),
      new THREE.LineDashedMaterial({ color: 0x22d3ee, dashSize: 0.9, gapSize: 0.55 })
    );
    targetOrbitLoop.computeLineDistances();
    targetOrbitLoop.position.copy(this.journeyTargetPlanet.position);
    this.journeyGroup.add(targetOrbitLoop);

    // Flat horizontal transfer trajectory (y = 0) from departure straight up-screen (-Z) tangentially onto the 8.4 orbit ring
    const entryAngle = Math.PI;
    const entryX = 7.2 + Math.cos(entryAngle) * 8.4;
    const entryZ = -34 + Math.sin(entryAngle) * 8.4;
    this.journeyCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 13.5),
      new THREE.Vector3(0, 0, 2.0),
      new THREE.Vector3(-0.3, 0, -11.0),
      new THREE.Vector3(-0.9, 0, -23.5),
      new THREE.Vector3(entryX, 0, entryZ),
    ]);

    const curvePts = this.journeyCurve.getPoints(140);
    const dashLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(curvePts),
      new THREE.LineDashedMaterial({
        color: 0x38bdf8,
        dashSize: 1.1,
        gapSize: 0.65,
      })
    );
    dashLine.computeLineDistances();
    this.journeyGroup.add(dashLine);

    // Receding Carrier Rocket in Earth Departure Orbit (keeps Stage 3 -> Stage 4 separation continuous!)
    this.journeyGroup.add(this.journeyCarrierGroup);

    // Deployed NASA Satellite from Stage 3 separation + Ion Transfer Plume
    this.journeyCraft = new THREE.Group();
    this.journeySatGroup = new THREE.Group();

    this.journeySatFlame = new THREE.Mesh(
      new THREE.ConeGeometry(0.18, 1.05, 16),
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.78,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.journeySatFlame.rotation.x = -Math.PI / 2;
    this.journeySatFlame.position.z = -0.6;
    this.journeyCraft.add(this.journeySatFlame);
    this.journeyCraft.add(this.journeySatGroup);
    this.journeyGroup.add(this.journeyCraft);

    this.rebuildJourneySatellite();
  }

  private rebuildJourneySatellite(): void {
    if (!this.journeySatGroup) return;
    if (this.journeySatRig) {
      this.journeySatGroup.remove(this.journeySatRig.root);
    }
    this.journeySatRig = buildDropSpaceship(this.spacecraftAssets, this.currentConfig);
    this.journeySatRig.root.scale.setScalar(0.62);
    this.journeySatRig.root.rotation.order = 'ZYX';
    this.journeySatRig.root.rotation.set(Math.PI / 2, 0, Math.PI);
    this.journeySatRig.legsGroup.visible = false;
    this.journeySatRig.flameGroup.visible = false;
    this.journeySatGroup.add(this.journeySatRig.root);

    if (this.journeyCarrierRig) {
      this.journeyCarrierGroup.remove(this.journeyCarrierRig.root);
    }
    this.journeyCarrierRig = buildCarrierRocketSpaceship(this.currentConfig, this.spacecraftAssets, {
      showBoosters: false,
      openInspectBay: false,
    });
    this.journeyCarrierRig.root.scale.setScalar(0.88);
    this.journeyCarrierRig.payloadMount.visible = false;
    this.journeyCarrierRig.mainFlames.visible = false;
    this.journeyCarrierRig.srbFlames.visible = false;
    this.journeyCarrierGroup.add(this.journeyCarrierRig.root);
  }

  public setStage(stage: SceneStage): void {
    this.activeStage = stage;
    this.hangarGroup.visible = stage === 'hangar';
    this.launchGroup.visible = stage === 'launch_pad';
    this.journeyGroup.visible = stage === 'journey';

    const pbr = this.getWorldPBR(this.targetWorldId);

    // Restore standard camera fov/near/far, upright up-vector, fog, and sky dome scales
    this.camera.fov = stage === 'journey' ? 56 : 45;
    if (stage !== 'launch_pad') {
      this.camera.near = 0.1;
      this.camera.far = 750;
      this.camera.up.set(0, 1, 0);
      this.camera.updateProjectionMatrix();
      this.scene.fog = null;
      this.skyBackdrop.scale.setScalar(1);
      this.starField.scale.setScalar(1);
      this.starField.visible = true;
    }

    if (stage === 'hangar') {
      this.controls.enabled = true;
      this.controls.minDistance = 4.2;
      this.controls.maxDistance = 18;
      this.cameraFocusTarget = new THREE.Vector3(0, 2.75, 0);
      this.cameraFocusPos = new THREE.Vector3(5.2, 2.8, 7.6);
    } else if (stage === 'launch_pad') {
      this.controls.enabled = false;
      this.cameraFocusTarget = null;
      this.cameraFocusPos = null;
      this.camera.near = 0.45;
      this.camera.far = 480000;
      this.camera.up.set(0, 1, 0);
      this.camera.updateProjectionMatrix();
      this.scene.fog = this.launchFog;
      this.skyBackdrop.scale.setScalar(1200);
      this.starField.scale.setScalar(950);
      this.starField.visible = false;
      const pMat = this.launchTargetPlanet.material as THREE.MeshStandardMaterial;
      pMat.map = pbr.map;
      pMat.normalMap = pbr.normalMap ?? null;
      pMat.color.setHex(0xffffff);
      pMat.needsUpdate = true;
      this.rebuildLaunchStack();
      this.resetLaunchState();
      this.camera.position.set(5.2, 3.6, 33.5);
      this.camera.lookAt(1.5, 5.8, 0);
    } else if (stage === 'journey') {
      this.controls.enabled = false;
      this.journeyProgress = 0;
      this.journeyFuelExhausted = false;
      this.journeyLostTimer = 0;
      this.journeyFailTriggered = false;
      this.lastJourneyFuelPct = 100;
      this.callbacks.onJourneyFuelUpdate?.(100);
      this.rebuildJourneySatellite();

      const p0 = this.journeyCurve.getPointAt(0);
      const t0 = this.journeyCurve.getTangentAt(0).normalize();
      this.journeyCraft.up.set(0, 1, 0);
      this.journeyCraft.position.copy(p0);
      this.journeyCraft.lookAt(_v1.copy(p0).add(t0));
      this.journeySatGroup.scale.setScalar(0.68);
      this.journeySatFlame.visible = true;
      this.journeySatFlame.scale.set(0.25, 0.25, 0.25);

      this.journeyCarrierGroup.visible = true;
      this.journeyCarrierGroup.scale.setScalar(1);
      // Carrier rocket horizontal along -Z (screen top) with open dorsal bay facing straight UP (+Y) toward overhead camera
      this.journeyCarrierGroup.rotation.set(-Math.PI / 2, 0, 0);
      // Carrier in bottom-left of overhead frame, small ship ahead in upper-right (matching Sketch 5)
      this.journeyCarrierGroup.position.set(p0.x - 3.8, p0.y - 0.3, p0.z + 6.4);

      // Pure top-down overhead camera directly above the dorsal surface of both ships (zero lateral tilt)
      this.journeyLookOffset.set(-1.1, 0, -1.8);
      this.journeyCamOffset.set(-1.1, 22.0, -0.6);

      this.camera.up.set(0, 0, -1);
      this.camera.position.copy(p0).add(this.journeyCamOffset);
      this.journeyCamLook.copy(p0).add(this.journeyLookOffset);
      this.camera.lookAt(this.journeyCamLook);

      const mat = this.journeyTargetPlanet.material as THREE.MeshStandardMaterial;
      mat.map = pbr.map;
      mat.normalMap = pbr.normalMap ?? null;
      mat.roughnessMap = pbr.roughnessMap ?? null;
      mat.color.setHex(0xffffff);
      mat.needsUpdate = true;
    }
  }

  public setJourneySpeed(speed: JourneyWarpSpeed): void {
    this.journeySpeedMultiplier = speed;
  }

  public focusWorld(worldId: WorldId): void {
    this.targetWorldId = worldId;
    this.rebuildHangarSpacecraft(false);
  }

  public updateHangarConfig(config: HangarConfig, stats: CraftStats): void {
    this.currentConfig = { ...config };
    this.currentStats = stats;
    this.rebuildHangarSpacecraft(true);
    this.rebuildLaunchStack();
    this.rebuildJourneySatellite();
  }

  public setTurntablePaused(paused: boolean): void {
    this.turntablePaused = paused;
  }

  public startCountdown(): void {
    this.resetLaunchState();
    this.launchPhase = 'countdown';
    this.countdownAccum = 0;
    this.lastCountdownInt = 5;
    missionAudio.playCountdownBeep(false);
    this.pushLaunchTelemetry(true);
  }

  public resetLaunchState(): void {
    this.launchPhase = 'pad';
    this.countdownAccum = 0;
    this.lastCountdownInt = 5;
    this.shuttleY = 0;
    this.shuttleZ = 0;
    this.shuttleVelY = 0;
    this.shuttleVelZ = 0;
    this.launchStageTime = 0;
    this.launchPitchRad = 0;
    this.launchSimAltitudeKm = 0;
    this.launchSimVelocityKmh = 0;
    this.launchAccelG = 1.0;
    this.launchFuelPct = 100;

    this.srbSepDist = 0;
    this.srbSepDrop = 0;
    this.srbSepRot = 0;
    this.bayDoorAngle = 0;
    this.satSepDist = 0;
    this.launchCrashTimer = 0;
    this.launchFailTriggered = false;
    this.launchCamOffset.set(5.2, 2.75, 33.5);
    this.launchLookOffset.set(1.5, 4.95, 0);
    this.camera.up.set(0, 1, 0);

    this.padSkyMat.uniforms.uSpaceMix.value = 0;
    if (this.launchFog) {
      this.launchFog.density = 0.0014;
      if (this.activeStage === 'launch_pad') this.scene.fog = this.launchFog;
    }
    this.starField.visible = false;
    this.launchEarthHorizon.visible = true;
    this.launchEarthHorizon.scale.setScalar(this.launchEarthRadius);
    this.launchEarthHorizon.position.set(0, -this.launchEarthRadius, 0);
    this.launchTargetPlanet.visible = false;
    this.launchStarStreaks.visible = false;
    this.launchFailedTrail.visible = false;
    this.launchSepDashLine.visible = false;
    this.launchExplosionGroup.visible = false;
    this.launchTower.swingArm.rotation.y = 0;
    if (this.launchLagoonReflection) {
      (this.launchLagoonReflection.material as THREE.MeshBasicMaterial).opacity = 0.34;
    }

    this.shuttleRig.root.visible = true;
    this.shuttleRig.root.position.set(0, 0.85, 0);
    this.shuttleRig.root.rotation.set(0, 0, 0);
    this.shuttleRig.root.quaternion.identity();
    this.shuttleRig.srbLeft.visible = true;
    this.shuttleRig.srbLeft.position.set(-this.shuttleRig.srbOffsetX, 0.1, -0.12);
    this.shuttleRig.srbLeft.rotation.set(0, 0, 0);
    this.shuttleRig.srbRight.visible = true;
    this.shuttleRig.srbRight.position.set(this.shuttleRig.srbOffsetX, 0.1, -0.12);
    this.shuttleRig.srbRight.rotation.set(0, 0, 0);
    this.shuttleRig.bayDoorLeft.rotation.y = 0;
    this.shuttleRig.bayDoorRight.rotation.y = 0;
    this.shuttleRig.payloadMount.position.set(0, this.shuttleRig.payloadRestY, 0.84);
    this.shuttleRig.payloadMount.rotation.set(0, 0, 0);
    this.shuttleRig.srbFlames.visible = false;
    this.shuttleRig.mainFlames.visible = false;
    this.shuttleRig.craftFlame.visible = false;
    this.shuttleRig.craftFlame.scale.setScalar(1);
    this.launchEngineLight.intensity = 0;

    this.smokePool.forEach((p) => {
      p.active = false;
      p.sprite.visible = false;
    });
    this.pushLaunchTelemetry(true);
  }

  private getLaunchStageLabel(): string {
    switch (this.launchPhase) {
      case 'pad':
        return 'PRE-LAUNCH PAD HOLD · CARRIER SPACESHIP';
      case 'countdown':
        return 'TERMINAL COUNTDOWN (T-5..0)';
      case 'liftoff':
        return this.currentStats.enginePasses
          ? 'LIFTOFF & MAX-Q PITCHOVER'
          : 'LIFTOFF STRUGGLE · INSUFFICIENT THRUST';
      case 'srb_sep':
        return 'BECO · SRB BOOSTER SEPARATION (45 km)';
      case 'tank_sep':
        return 'CARRIER FORWARD CRUISE TOWARD TARGET PLANET';
      case 'satellite_sep':
        return 'IN-FLIGHT DEPLOYMENT · DROP-SPACESHIP LAUNCHING';
      case 'failed_arc':
        return 'SHALLOW SUBORBITAL DECAY · FALLING AROUND EARTH';
      case 'failed_crash':
        return 'EARTH IMPACT & VEHICLE SHATTERED — MISSION FAILED';
    }
  }

  private pushLaunchTelemetry(force = false): void {
    const now = performance.now();
    if (!force && now - this.lastTelemetryPush < 70) return;
    this.lastTelemetryPush = now;
    this.callbacks.onLaunchTelemetry({
      phase: this.launchPhase,
      countdownValue: Math.max(0, Math.ceil(5 - this.countdownAccum)),
      altitudeKm: Math.round(this.launchSimAltitudeKm),
      velocityKmh: Math.round(this.launchSimVelocityKmh),
      accelG: Number(this.launchAccelG.toFixed(1)),
      fuelPct: Math.round(this.launchFuelPct),
      stageLabel: this.getLaunchStageLabel(),
      sepVelocityMs: this.launchPhase === 'satellite_sep' && this.satSepDist > 0.05 ? 1.2 : 0,
    });
  }

  private evalFailArcPoint(arcT: number, out: THREE.Vector3): void {
    const clampedT = Math.max(0, arcT);
    const theta = THREE.MathUtils.lerp(this.launchFailStartTheta, this.launchFailEndTheta, clampedT);
    let h = 0;
    if (clampedT <= 0.28) {
      const u = clampedT / 0.28;
      h = THREE.MathUtils.lerp(
        this.launchFailStartAlt,
        this.launchFailPeakAlt,
        Math.sin(u * Math.PI * 0.5)
      );
    } else if (clampedT <= 1.0) {
      const v = (clampedT - 0.28) / 0.72;
      h = this.launchFailPeakAlt * Math.pow(Math.max(0, Math.cos(v * Math.PI * 0.5)), 1.22);
    } else {
      h = -3.5 * (clampedT - 1.0);
    }
    const r = this.launchEarthRadius + h;
    out.set(0, -this.launchEarthRadius + r * Math.cos(theta), r * Math.sin(theta));
  }

  private spawnSmoke(deluge = false): void {
    const puff = this.smokePool.find((p) => !p.active);
    if (!puff) return;
    puff.active = true;
    puff.age = 0;
    const side = Math.random() < 0.38 ? -1 : 1; // Larger rolling steam plume toward the right water tower side as in LC-39A photo
    if (deluge) {
      puff.maxAge = 3.2 + Math.random() * 1.4;
      puff.baseScale = 3.2 + Math.random() * 2.6;
      puff.sprite.visible = true;
      puff.sprite.position.set(
        side * (1.8 + Math.random() * 2.5),
        0.9 + Math.random() * 1.2,
        -1.5 - Math.random() * 4.5
      );
      puff.sprite.scale.setScalar(puff.baseScale);
      puff.sprite.material.opacity = 0.84;
      puff.vel.set(
        side * (4.8 + Math.random() * 7.8),
        1.1 + Math.random() * 2.8,
        -0.6 - Math.random() * 2.2
      );
    } else {
      puff.maxAge = 2.4;
      puff.baseScale = 2.0 + Math.random() * 1.6;
      puff.sprite.visible = true;
      puff.sprite.position.set(
        side * (1.2 + Math.random() * 1.8),
        Math.max(0.5, this.shuttleY * 0.22 + 0.5),
        -1.0 - Math.random() * 2.4
      );
      puff.sprite.scale.setScalar(puff.baseScale);
      puff.sprite.material.opacity = 0.74;
      puff.vel.set(
        side * (3.0 + Math.random() * 4.5),
        0.9 + Math.random() * 1.6,
        (Math.random() - 0.5) * 3.0
      );
    }
  }

  private bindEvents(): void {
    window.addEventListener('resize', this.handleResize);
  }

  private handleResize = (): void => {
    if (this.disposed) return;
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    if (this.composer) {
      this.composer.setSize(width, height);
      this.bloomPass?.setSize(width, height);
    }
  };

  private tick = (): void => {
    if (this.disposed) return;

    const dt = Math.min(0.05, this.clock.getDelta());
    const elapsed = this.clock.elapsedTime;
    this.starField.rotation.y += dt * 0.003;

    if (this.activeStage === 'hangar') {
      this.updateHangar(dt, elapsed);
    } else if (this.activeStage === 'launch_pad') {
      this.updateLaunchPad(dt, elapsed);
    } else if (this.activeStage === 'journey') {
      this.updateJourney(dt, elapsed);
    }

    if (this.composer && !this.isSoftwareGl) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private updateHangar(dt: number, elapsed: number): void {
    if (!this.turntablePaused) {
      this.hangarTurntable.rotation.y += dt * 0.22;
    }

    if (this.armReachTimer > 0) {
      this.armReachTimer = Math.max(0, this.armReachTimer - dt);
    }
    const reach = this.armReachTimer > 0 ? Math.sin((this.armReachTimer / 0.85) * Math.PI) : 0;
    this.leftArm.shoulder.rotation.z = -0.38 - reach * 0.28 + Math.sin(elapsed * 1.4) * 0.04;
    this.leftArm.elbow.rotation.z = 0.85 + reach * 0.3;

    if (this.hangarSnapTimer > 0) {
      this.hangarSnapTimer = Math.max(0, this.hangarSnapTimer - dt);
    }

    if (this.hangarCraftRig) {
      this.hangarCraftRig.dishGroup.rotation.y = Math.sin(elapsed * 0.85) * 0.28;
      const snapScale =
        this.hangarSnapTimer > 0
          ? 1 + Math.sin((this.hangarSnapTimer / 0.32) * Math.PI) * 0.04
          : 1;
      this.hangarCraftRig.root.scale.setScalar(0.78 * snapScale);
    }

    if (!this.userOrbiting && this.cameraFocusTarget && this.cameraFocusPos) {
      this.controls.target.lerp(this.cameraFocusTarget, 0.08);
      this.camera.position.lerp(this.cameraFocusPos, 0.08);
      if (this.camera.position.distanceTo(this.cameraFocusPos) < 0.15) {
        this.cameraFocusTarget = null;
        this.cameraFocusPos = null;
      }
    }
    this.controls.update();
  }

  private triggerLaunchEarthExplosion(impactPos: THREE.Vector3, surfaceNormal: THREE.Vector3): void {
    this.launchPhase = 'failed_crash';
    this.launchCrashTimer = 0;
    this.launchFailImpactPos.copy(impactPos);

    this.shuttleRig.root.visible = false;
    this.shuttleRig.mainFlames.visible = false;
    this.shuttleRig.srbFlames.visible = false;
    this.launchFailedTrail.visible = false;

    this.launchExplosionGroup.position.copy(impactPos);
    this.launchExplosionGroup.visible = true;
    this.launchFireball.scale.setScalar(2.0);
    (this.launchFireball.material as THREE.MeshBasicMaterial).opacity = 0.98;
    this.launchShockwave.scale.setScalar(1.05);
    this.launchShockwave.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), surfaceNormal);
    (this.launchShockwave.material as THREE.MeshBasicMaterial).opacity = 0.94;

    for (const d of this.launchDebris) {
      d.mesh.position.set(
        (Math.random() - 0.5) * 0.5,
        0.4 + Math.random() * 0.4,
        (Math.random() - 0.5) * 0.5
      );
      d.mesh.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      const speed = 5.5 + Math.random() * 11.5;
      d.vel.set(
        (Math.random() - 0.5) * speed * 1.4,
        surfaceNormal.y * (5.5 + Math.random() * 9.5) + Math.random() * 3,
        surfaceNormal.z * (5.5 + Math.random() * 9.5) + (Math.random() - 0.5) * 8.0
      );
      d.rotVel.set(
        (Math.random() - 0.5) * 12,
        (Math.random() - 0.5) * 12,
        (Math.random() - 0.5) * 12
      );
    }

    this.launchEngineLight.position.copy(impactPos).addScaledVector(surfaceNormal, 1.5);
    this.launchEngineLight.intensity = 18;
    missionAudio.playIgnition();
    this.pushLaunchTelemetry(true);
  }

  private updateLaunchPad(dt: number, elapsed: number): void {
    // Drift overhead coastal clouds & keep sky dome centered on active camera
    for (const c of this.launchCloudSprites) {
      c.sprite.position.x = c.baseX + Math.sin(elapsed * 0.08 * c.speed + c.baseZ) * 8;
    }
    this.padSky.position.copy(this.camera.position);
    this.padSkyMat.uniforms.uTime.value = elapsed;

    // Smoothly attenuate atmospheric fog as rocket climbs into orbital vacuum
    const spaceMix = this.padSkyMat.uniforms.uSpaceMix.value;
    if (this.launchFog) {
      this.launchFog.density = 0.0014 * Math.max(0, 1 - spaceMix * 1.6);
      this.scene.fog = this.launchFog.density > 0.00002 ? this.launchFog : null;
    }

    // Adjust camera near plane smoothly with altitude & reveal stars once entering upper atmosphere/space
    this.camera.near = Math.max(0.45, Math.min(8.0, 0.45 + Math.max(0, this.shuttleY) * 0.002));
    this.camera.updateProjectionMatrix();
    this.starField.visible = spaceMix > 0.35;

    const earthCenter = _v3.set(0, -this.launchEarthRadius, 0);

    for (const p of this.smokePool) {
      if (!p.active) continue;
      p.age += dt;
      p.sprite.position.addScaledVector(p.vel, dt);
      p.vel.multiplyScalar(Math.max(0.88, 1 - dt * 0.45));
      p.sprite.scale.setScalar(p.baseScale + p.age * 4.6);
      p.sprite.material.opacity = Math.max(0, 0.78 * (1 - p.age / p.maxAge));
      if (p.age > p.maxAge) {
        p.active = false;
        p.sprite.visible = false;
      }
    }

    if (this.launchPhase === 'countdown') {
      this.countdownAccum += dt;
      const rem = Math.max(0, 5 - this.countdownAccum);
      const nextInt = Math.ceil(rem);
      if (nextInt < this.lastCountdownInt && nextInt >= 0) {
        this.lastCountdownInt = nextInt;
        missionAudio.playCountdownBeep(nextInt === 0);
      }
      if (rem <= 1.2) {
        this.launchTower.swingArm.rotation.y = THREE.MathUtils.damp(
          this.launchTower.swingArm.rotation.y,
          -1.15,
          6,
          dt
        );
      }
      if (rem <= 0.95) {
        // Water deluge & flame-trench pre-ignition steam plumes rolling out across berm
        this.spawnSmoke(true);
        if (Math.random() < 0.75) this.spawnSmoke(true);
      }
      if (rem <= 0) {
        this.launchPhase = 'liftoff';
        this.launchStageTime = 0;
        this.shuttleRig.srbFlames.visible = true;
        this.shuttleRig.mainFlames.visible = true;
        missionAudio.playIgnition();
      }
      this.pushLaunchTelemetry();
    } else if (this.launchPhase === 'liftoff') {
      // Phase 1: Liftoff & Max-Q Ascent through Earth's coastal cloud deck
      this.launchStageTime += dt;
      const passesEngine = this.currentStats.enginePasses;
      const thrustRatio = Math.min(
        1.35,
        this.currentStats.thrustKn / Math.max(1, this.currentStats.requiredThrustKn)
      );
      const accelScale = passesEngine ? 7.2 * (0.9 + thrustRatio * 0.25) : 10.5 + thrustRatio * 6.5;
      this.shuttleVelY += accelScale * dt;
      this.shuttleY += this.shuttleVelY * dt;
      if (passesEngine) {
        this.shuttleVelZ += 1.6 * dt;
        this.shuttleZ += this.shuttleVelZ * dt;
      } else {
        // Underpowered launch pitches downrange over the coastal launch area into a short near-pad arc
        this.shuttleVelZ += 12.5 * dt;
        this.shuttleZ += this.shuttleVelZ * dt;
      }

      const duration = passesEngine ? 4.2 : 1.9;
      const tNorm = Math.min(1, this.launchStageTime / duration);
      this.launchSimAltitudeKm = tNorm * (passesEngine ? 45 : 12);
      this.launchSimVelocityKmh = Math.pow(tNorm, 1.35) * (passesEngine ? 4850 : 2150);
      this.launchAccelG = passesEngine ? 1.4 + tNorm * 1.4 : 0.82 + Math.sin(elapsed * 18) * 0.08;
      this.launchFuelPct = Math.max(58, 100 - tNorm * 42);
      this.launchPitchRad = THREE.MathUtils.smoothstep(tNorm, 0.25, 1.0) * (passesEngine ? 0.16 : 0.88);

      const jitterX = !passesEngine ? Math.sin(elapsed * 20) * 0.08 : 0;
      this.shuttleRig.root.position.set(jitterX, 0.85 + this.shuttleY, this.shuttleZ);
      this.shuttleRig.root.rotation.x = this.launchPitchRad;

      const flameScale = passesEngine ? 1.0 : 0.52 + Math.random() * 0.22;
      this.shuttleRig.srbFlames.scale.set(
        flameScale,
        flameScale * (0.9 + Math.sin(elapsed * 42) * 0.14),
        flameScale
      );
      this.shuttleRig.mainFlames.scale.set(
        flameScale,
        flameScale * (0.9 + Math.sin(elapsed * 48) * 0.12),
        flameScale
      );

      this.launchEngineLight.position.set(0, this.shuttleY + 0.6, this.shuttleZ);
      this.launchEngineLight.intensity = (passesEngine ? 7.8 : 4.8) + Math.sin(elapsed * 45) * 1.4;
      if (this.launchLagoonReflection) {
        const reflMat = this.launchLagoonReflection.material as THREE.MeshBasicMaterial;
        reflMat.opacity = Math.max(0.18, 0.68 - this.shuttleY * 0.012);
      }

      if (this.shuttleY < 28) {
        this.spawnSmoke(true);
        if (this.shuttleY < 14) this.spawnSmoke(true);
      }

      this.padSkyMat.uniforms.uSpaceMix.value = Math.min(
        passesEngine ? 0.42 : 0.28,
        tNorm * (passesEngine ? 0.42 : 0.28)
      );

      // Safety check: if underpowered rocket ever descends onto Earth mid-liftoff, explode instantly on contact
      if (this.launchStageTime > 0.6 && this.shuttleVelY < 0) {
        const liftoffHit = this.checkRocketEarthImpact(this.shuttleRig.root, earthCenter);
        if (liftoffHit.collided) {
          this.triggerLaunchEarthExplosion(liftoffHit.contactPoint, liftoffHit.surfaceNormal);
        }
      }

      this.pushLaunchTelemetry();

      if (tNorm >= 1) {
        if (!passesEngine) {
          // Thrust insufficient! Short curved arc near the launch site & coast at normal physical fall speed
          this.launchPhase = 'failed_arc';
          this.launchStageTime = 0;
          const rx = this.shuttleRig.root.position.y - earthCenter.y;
          const rz = this.shuttleRig.root.position.z - earthCenter.z;
          const r0 = Math.hypot(rx, rz);
          this.launchFailStartTheta = Math.atan2(rz, rx);
          this.launchFailStartAlt = Math.max(16, r0 - this.launchEarthRadius);
          this.launchFailPeakAlt = this.launchFailStartAlt + 22;
          const deltaTheta = 0.0022 + (1 - Math.min(1, thrustRatio)) * 0.0008;
          this.launchFailEndTheta = this.launchFailStartTheta + deltaTheta;
          this.launchFailDuration = 2.4;
          this.launchFailPrevPos.copy(this.shuttleRig.root.position);

          // Plot curved trajectory trail hugging Earth's curvature right to impact near launch zone
          const linePos = this.launchFailedTrail.geometry.attributes.position as THREE.BufferAttribute;
          for (let i = 0; i <= 60; i++) {
            this.evalFailArcPoint(i / 60, _v1);
            linePos.setXYZ(i, _v1.x, _v1.y, _v1.z);
          }
          linePos.needsUpdate = true;
          this.launchFailedTrail.computeLineDistances();
          this.launchFailedTrail.visible = true;
          this.pushLaunchTelemetry(true);
        } else {
          this.launchPhase = 'srb_sep';
          this.launchStageTime = 0;
          this.shuttleRig.srbFlames.visible = false;
          missionAudio.playSnap();
          this.pushLaunchTelemetry(true);
        }
      }
    } else if (this.launchPhase === 'failed_arc') {
      // Short Near-Pad Curved Fall (~2.4s) with sub-stepped exact contact detection so rocket explodes on first touch
      const subSteps = 4;
      const subDt = dt / subSteps;
      let impacted = false;

      for (let s = 0; s < subSteps; s++) {
        this.launchStageTime += subDt;
        const arcT = this.launchStageTime / this.launchFailDuration;

        this.evalFailArcPoint(arcT, _v1);
        this.evalFailArcPoint(arcT + 0.008, _v2);

        const jitterX = Math.sin((elapsed - (subSteps - 1 - s) * subDt) * 14) * 0.05;
        this.shuttleRig.root.position.set(jitterX, _v1.y, _v1.z);
        this.shuttleY = _v1.y - 0.85;
        this.shuttleZ = _v1.z;

        // Align rocket nose smoothly along instantaneous curved velocity tangent
        _v4.copy(_v2).sub(_v1).normalize();
        this.shuttleRig.root.quaternion.setFromUnitVectors(_upAxis, _v4);
        this.shuttleRig.root.rotateY((elapsed - (subSteps - 1 - s) * subDt) * 0.65);

        const hullCheck = this.checkRocketEarthImpact(this.shuttleRig.root, earthCenter);
        if (hullCheck.collided) {
          this.shuttleY = this.shuttleRig.root.position.y - 0.85;
          this.shuttleZ = this.shuttleRig.root.position.z;
          this.triggerLaunchEarthExplosion(hullCheck.contactPoint, hullCheck.surfaceNormal);
          impacted = true;
          break;
        }
      }

      if (!impacted) {
        const arcT = this.launchStageTime / this.launchFailDuration;
        const flicker = arcT < 0.35 ? 0.38 + Math.random() * 0.24 : 0.14 + Math.random() * 0.1;
        this.shuttleRig.mainFlames.scale.set(flicker, flicker, flicker);
        this.shuttleRig.srbFlames.scale.set(flicker * 0.65, flicker * 0.65, flicker * 0.65);

        const altitudeUnits = Math.max(
          0,
          this.shuttleRig.root.position.distanceTo(earthCenter) - this.launchEarthRadius
        );
        this.padSkyMat.uniforms.uSpaceMix.value = THREE.MathUtils.clamp(altitudeUnits / 360, 0.08, 0.88);
        this.launchSimAltitudeKm = Math.max(0, Math.round(altitudeUnits * 0.085));
        const speedUnitsPerSec = this.shuttleRig.root.position.distanceTo(this.launchFailPrevPos) / Math.max(0.001, dt);
        this.launchFailPrevPos.copy(this.shuttleRig.root.position);
        this.launchSimVelocityKmh = Math.round(3200 + speedUnitsPerSec * 4.2);
        this.launchAccelG = Number(Math.max(0.15, 0.55 - arcT * 0.35).toFixed(1));
        this.launchFuelPct = Math.max(12, Math.round(58 - arcT * 46));
        this.launchEngineLight.position.copy(this.shuttleRig.root.position);
        this.pushLaunchTelemetry();
      }
    } else if (this.launchPhase === 'failed_crash') {
      // Explosion & shattered wreckage bouncing strictly on TOP of solid Earth sphere
      this.launchCrashTimer += dt;
      const t = this.launchCrashTimer;
      const fireScale = 2.0 + Math.min(14.5, t * 10.5);
      this.launchFireball.scale.setScalar(fireScale);
      (this.launchFireball.material as THREE.MeshBasicMaterial).opacity = Math.max(
        0,
        0.98 - t * 0.44
      );

      const waveScale = 1.1 + t * 18.0;
      this.launchShockwave.scale.setScalar(waveScale);
      (this.launchShockwave.material as THREE.MeshBasicMaterial).opacity = Math.max(
        0,
        0.92 - t * 0.52
      );

      this.launchEngineLight.intensity = Math.max(0, 18 - t * 9.0);

      const expPos = this.launchExplosionGroup.position;
      for (const d of this.launchDebris) {
        _v1.copy(expPos).add(d.mesh.position).sub(earthCenter).normalize();
        d.vel.addScaledVector(_v1, -9.81 * dt);

        _v2.copy(expPos).add(d.mesh.position).addScaledVector(d.vel, dt);
        const bounced = this.resolveSolidSphereCollision(
          _v2,
          d.vel,
          earthCenter,
          this.launchEarthRadius,
          0.35,
          0.42
        );
        if (bounced) {
          d.vel.multiplyScalar(0.84);
        }
        d.mesh.position.copy(_v2).sub(expPos);
        d.mesh.rotation.x += d.rotVel.x * dt;
        d.mesh.rotation.y += d.rotVel.y * dt;
        d.mesh.rotation.z += d.rotVel.z * dt;
      }

      if (t >= 1.35 && !this.launchFailTriggered) {
        this.launchFailTriggered = true;
        this.callbacks.onMissionFailed?.({
          reason: 'underpowered_engine',
          title: 'MISSION FAILED',
          subtitle: 'EARTH IMPACT — ROCKET EXPLODED ON CONTACT',
          detail: `Selected engine produced ${this.currentStats.thrustKn.toLocaleString()} kN, below the NASA required ${this.currentStats.requiredThrustKn.toLocaleString()} kN (TWR ${this.currentStats.launchTwr.toFixed(
            2
          )}× < 1.25×). The rocket entered a shallow suborbital arc around Earth, lost altitude, and exploded upon touching the surface.`,
        });
      }
    } else if (this.launchPhase === 'srb_sep') {
      // Sketch 2: Climb high above Earth's curved horizon while SRBs separate
      this.launchStageTime += dt;
      const tNorm = Math.min(1, this.launchStageTime / 3.4);

      this.shuttleVelY += 175 * dt;
      this.shuttleVelZ += 48 * dt;
      this.shuttleY += this.shuttleVelY * dt;
      this.shuttleZ += this.shuttleVelZ * dt;
      this.launchSimAltitudeKm = 45 + tNorm * 70;
      this.launchSimVelocityKmh = 4850 + Math.pow(tNorm, 1.15) * (27800 - 4850);
      this.launchAccelG = 1.6 + tNorm * 1.4;
      this.launchFuelPct = Math.max(24, 58 - tNorm * 34);
      this.launchPitchRad = THREE.MathUtils.lerp(0.16, 0.34, tNorm);

      // Twin SRBs separate laterally and tumble downward
      const baseSrbX = this.shuttleRig.srbOffsetX;
      this.srbSepDist += dt * 1.45;
      this.srbSepDrop += dt * (2.6 + this.launchStageTime * 2.4);
      this.srbSepRot += dt * 0.62;
      this.shuttleRig.srbLeft.position.set(
        -baseSrbX - this.srbSepDist,
        0.1 - this.srbSepDrop,
        -0.12
      );
      this.shuttleRig.srbLeft.rotation.z = this.srbSepRot;
      this.shuttleRig.srbRight.position.set(
        baseSrbX + this.srbSepDist,
        0.1 - this.srbSepDrop,
        -0.12
      );
      this.shuttleRig.srbRight.rotation.z = -this.srbSepRot;

      this.shuttleRig.root.position.set(0, 0.85 + this.shuttleY, this.shuttleZ);
      this.shuttleRig.root.rotation.x = this.launchPitchRad;
      this.shuttleRig.mainFlames.scale.set(1, 0.92 + Math.sin(elapsed * 48) * 0.14, 1);

      this.launchEngineLight.position.set(0, this.shuttleY + 0.6, this.shuttleZ);
      this.launchEngineLight.intensity = 4.2 + Math.sin(elapsed * 45) * 0.9;

      this.padSkyMat.uniforms.uSpaceMix.value = Math.min(1, 0.42 + tNorm * 0.58);
      this.launchTargetPlanet.visible = false;
      this.launchSepDashLine.visible = false;
      this.launchStarStreaks.visible = tNorm > 0.35;
      this.launchStarStreaks.position.set(0, this.shuttleY - 30, this.shuttleZ - 20);

      this.pushLaunchTelemetry();

      if (tNorm >= 1) {
        this.launchPhase = 'tank_sep';
        this.launchStageTime = 0;
        missionAudio.playSnap();
        this.pushLaunchTelemetry(true);
      }
    } else if (this.launchPhase === 'tank_sep') {
      // Sketch 3: Above curved Earth horizon, pitch & roll so dorsal bay faces straight UP (+Y) toward overhead camera
      this.launchStageTime += dt;
      const tNorm = Math.min(1, this.launchStageTime / 2.6);

      this.shuttleY += dt * 48;
      this.shuttleZ += dt * 65;
      this.launchSimAltitudeKm = 115 + tNorm * 45;
      this.launchSimVelocityKmh = 27800 + tNorm * 3400;
      this.launchAccelG = 1.9;
      this.launchFuelPct = Math.max(10, 24 - tNorm * 14);
      this.launchPitchRad = THREE.MathUtils.lerp(
        0.34,
        Math.PI / 2,
        THREE.MathUtils.smoothstep(tNorm, 0.0, 0.92)
      );
      const rollRad = THREE.MathUtils.smoothstep(tNorm, 0.06, 0.82) * Math.PI;

      this.shuttleRig.root.position.set(0, 0.85 + this.shuttleY, this.shuttleZ);
      this.shuttleRig.root.quaternion
        .setFromAxisAngle(_xAxis, this.launchPitchRad)
        .multiply(_quat.setFromAxisAngle(_upAxis, rollRad));
      this.shuttleRig.mainFlames.visible = true;
      this.shuttleRig.mainFlames.scale.set(1, 0.95 + Math.sin(elapsed * 52) * 0.14, 1);

      this.padSkyMat.uniforms.uSpaceMix.value = 1;
      this.launchTargetPlanet.visible = true;
      this.launchTargetPlanet.scale.setScalar(0.55);
      this.launchTargetPlanet.position.set(0, 0.85 + this.shuttleY + 10.5, this.shuttleZ + 42.0);
      this.launchTargetPlanet.rotation.y += dt * 0.16;
      this.launchSepDashLine.visible = false;
      this.launchStarStreaks.visible = true;
      this.launchStarStreaks.position.set(0, this.shuttleY - 30, this.shuttleZ - 20);

      this.pushLaunchTelemetry();

      if (tNorm >= 1) {
        this.launchPhase = 'satellite_sep';
        this.launchStageTime = 0;
        missionAudio.playSnap();
        this.pushLaunchTelemetry(true);
      }
    } else if (this.launchPhase === 'satellite_sep') {
      // Sketch 4 (0..0.48: pure overhead top-down close-up of carrier dorsal bay) -> Sketch 5 (0.48..1.0: pure overhead top-down two-shot + dashed line to target planet)
      this.launchStageTime += dt;
      const tNorm = Math.min(1, this.launchStageTime / 5.4);
      const coastFactor = 1 - 0.35 * THREE.MathUtils.smoothstep(tNorm, 0.15, 0.9);
      this.shuttleY += dt * 18 * coastFactor;
      this.shuttleZ += dt * 55 * coastFactor;
      // Keep carrier horizontal (nose along +Z, open dorsal bay facing straight UP along +Y toward overhead camera)
      this.launchPitchRad = Math.PI / 2;

      // Ensure SRBs remain hidden after booster separation so Orbiter separates cleanly from its External Tank
      this.shuttleRig.srbLeft.visible = false;
      this.shuttleRig.srbRight.visible = false;

      // NASA Space Shuttle Orbiter separates from the External Tank struts forward (+Z world) & screen-right (+X local = -X world)
      const undockT = THREE.MathUtils.smoothstep(tNorm, 0.08, 0.52);
      const accelRaw = THREE.MathUtils.clamp((tNorm - 0.38) / 0.62, 0, 1);
      const boostT = accelRaw * accelRaw * (1.25 - 0.25 * accelRaw);
      const dorsalLift = THREE.MathUtils.smoothstep(tNorm, 0.08, 0.48) * 0.45;
      const curveRight = THREE.MathUtils.smoothstep(tNorm, 0.12, 0.78) * 1.95;
      this.satSepDist = undockT * 1.5 + boostT * 3.1;

      this.shuttleRig.payloadMount.position.set(
        curveRight,
        this.shuttleRig.payloadRestY + this.satSepDist,
        0.84 + dorsalLift
      );
      // Yaw smoothly in the dorsal plane (around local Z = World +Y) during separation then align toward Target Planet
      const exitCurveSin = Math.sin(THREE.MathUtils.clamp((tNorm - 0.12) / 0.64, 0, 1) * Math.PI);
      this.shuttleRig.payloadMount.rotation.set(0, 0, -exitCurveSin * 0.24);

      // Smooth ion plume ignition ramp
      const igniteT = THREE.MathUtils.smoothstep(tNorm, 0.24, 0.50);
      if (igniteT > 0.01) {
        this.shuttleRig.craftFlame.visible = true;
        const pScale = 0.06 + igniteT * 1.05;
        this.shuttleRig.craftFlame.scale.set(
          pScale,
          pScale * (0.9 + Math.sin(elapsed * 42) * 0.14),
          pScale
        );
      } else {
        this.shuttleRig.craftFlame.visible = false;
      }

      // Smooth carrier MECO throttle down
      const mecoFade = 1 - THREE.MathUtils.smoothstep(tNorm, 0.0, 0.22);
      if (mecoFade > 0.02) {
        this.shuttleRig.mainFlames.visible = true;
        const mf = 0.85 * mecoFade;
        this.shuttleRig.mainFlames.scale.set(mf, mf * (0.88 + Math.sin(elapsed * 40) * 0.1), mf);
      } else {
        this.shuttleRig.mainFlames.visible = false;
      }

      this.launchSimAltitudeKm = Math.min(185, 160 + tNorm * 25);
      this.launchSimVelocityKmh = Math.round(31200 + this.satSepDist * 650);
      this.launchAccelG = Number((0.4 + igniteT * 1.2).toFixed(1));

      this.shuttleRig.root.position.set(0, 0.85 + this.shuttleY, this.shuttleZ);
      this.shuttleRig.root.quaternion
        .setFromAxisAngle(_xAxis, this.launchPitchRad)
        .multiply(_quat.setFromAxisAngle(_upAxis, Math.PI));

      const sketch5T = THREE.MathUtils.smoothstep(tNorm, 0.44, 0.90);
      this.launchTargetPlanet.visible = tNorm > 0.42;
      this.launchTargetPlanet.scale.setScalar(THREE.MathUtils.lerp(0.22, 0.18, sketch5T));
      this.launchTargetPlanet.position.set(
        -2.45,
        0.85 + this.shuttleY + 1.5,
        this.shuttleZ + 14.2
      );
      this.launchTargetPlanet.rotation.y += dt * 0.18;

      // Dashed trajectory line from separated small ship straight ahead to Target Planet (Sketch 5)
      const dashAlpha = THREE.MathUtils.smoothstep(tNorm, 0.48, 0.78);
      if (dashAlpha > 0.01) {
        this.launchSepDashLine.visible = true;
        (this.launchSepDashLine.material as THREE.LineDashedMaterial).opacity = dashAlpha * 0.88;
        this.shuttleRig.payloadMount.getWorldPosition(_v1);
        _v2.copy(this.launchTargetPlanet.position);
        const posAttr = this.launchSepDashLine.geometry.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i <= 24; i++) {
          const u = THREE.MathUtils.lerp(0.14, 0.78, i / 24);
          posAttr.setXYZ(
            i,
            THREE.MathUtils.lerp(_v1.x, _v2.x, u),
            THREE.MathUtils.lerp(_v1.y, _v2.y, u),
            THREE.MathUtils.lerp(_v1.z, _v2.z, u)
          );
        }
        posAttr.needsUpdate = true;
        this.launchSepDashLine.computeLineDistances();
      } else {
        this.launchSepDashLine.visible = false;
      }

      this.launchStarStreaks.visible = true;
      this.launchStarStreaks.position.set(0, this.shuttleY - 30, this.shuttleZ - 20);

      this.resolveRocketHullPlanetCollision(this.shuttleRig.root, earthCenter, this.launchEarthRadius, 1.4);
      this.resolveRocketHullPlanetCollision(
        this.shuttleRig.root,
        this.launchTargetPlanet.position,
        1.5,
        1.2
      );

      this.pushLaunchTelemetry();

      if (tNorm >= 1) {
        missionAudio.playSuccess();
        this.callbacks.onLaunchComplete();
        return;
      }
    }

    // Dynamic Camera Framing (frames lagoon/shore/towers/full rocket on pad, and medium-close view of rocket + Earth curvature during fall!)
    if (this.launchPhase === 'failed_arc') {
      const arcT = Math.min(1, this.launchStageTime / this.launchFailDuration);
      this.evalFailArcPoint(arcT, _v4);
      this.evalFailArcPoint(arcT + 0.008, _v5);
      // Local spherical Earth frame around earthCenter so curving horizon stays naturally upright
      const localUp = _v6.copy(_v4).sub(earthCenter).normalize();
      const localFwd = _v5.sub(_v4).normalize();
      const localRight = _v2.crossVectors(localUp, localFwd).normalize(); // +X side matches pad/liftoff camera

      // Closer medium-range tracking offset (tightens smoothly as rocket nears Earth surface)
      const rightDist = THREE.MathUtils.lerp(11.2, 9.2, arcT);
      const upDist = THREE.MathUtils.lerp(4.0, 3.5, arcT);
      const backDist = THREE.MathUtils.lerp(-9.8, -8.2, arcT);

      this.camera.up.lerp(localUp, 1 - Math.exp(-6 * dt)).normalize();
      const camDest = _v1
        .copy(_v4)
        .addScaledVector(localRight, rightDist)
        .addScaledVector(localUp, upDist)
        .addScaledVector(localFwd, backDist);
      this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, camDest.x, 6.2, dt);
      this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, camDest.y, 6.2, dt);
      this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, camDest.z, 6.2, dt);
      const lookDest = _v4.addScaledVector(localFwd, 2.2).addScaledVector(localUp, -1.5);
      this.camera.lookAt(lookDest);
    } else if (this.launchPhase === 'failed_crash') {
      const shake = Math.max(0, 0.65 - this.launchCrashTimer * 0.35);
      const localUp = _v6.copy(this.launchFailImpactPos).sub(earthCenter).normalize();
      const localFwd = _v5.set(0, -localUp.z, localUp.y).normalize();
      const localRight = _v4.crossVectors(localUp, localFwd).normalize();
      this.camera.up.lerp(localUp, 1 - Math.exp(-8 * dt)).normalize();
      _v2.copy(this.launchFailImpactPos);
      _v1
        .copy(_v2)
        .addScaledVector(localRight, 10.2 + Math.sin(elapsed * 48) * shake)
        .addScaledVector(localUp, 5.2 + Math.cos(elapsed * 52) * shake)
        .addScaledVector(localFwd, -9.2);
      this.camera.position.lerp(_v1, 0.16);
      this.camera.lookAt(_v2);
    } else if (this.launchPhase === 'tank_sep' || this.launchPhase === 'satellite_sep') {
      if (this.launchPhase === 'tank_sep') {
        // Sketch 3 -> Transitioning smoothly into Overhead Top-Down View above the dorsal bay
        const tankT = THREE.MathUtils.smoothstep(Math.min(1, this.launchStageTime / 2.6), 0.05, 0.96);
        const toOverhead = THREE.MathUtils.smoothstep(tankT, 0.52, 1.0);
        _v5.set(0, 1 - toOverhead * 0.88, toOverhead * 0.99).normalize();
        this.camera.up.lerp(_v5, 1 - Math.exp(-6.5 * dt)).normalize();

        _v4.set(
          THREE.MathUtils.lerp(3.8, -0.3, tankT) + Math.sin(tankT * Math.PI) * 5.5,
          THREE.MathUtils.lerp(7.5, 11.4, tankT),
          THREE.MathUtils.lerp(18.0, 3.2, tankT)
        );
        _v6.set(
          THREE.MathUtils.lerp(0.4, -0.3, tankT),
          THREE.MathUtils.lerp(2.2, 0.8, tankT),
          THREE.MathUtils.lerp(6.0, 4.4, tankT)
        );
        this.launchCamOffset.x = THREE.MathUtils.damp(this.launchCamOffset.x, _v4.x, 5.2, dt);
        this.launchCamOffset.y = THREE.MathUtils.damp(this.launchCamOffset.y, _v4.y, 5.2, dt);
        this.launchCamOffset.z = THREE.MathUtils.damp(this.launchCamOffset.z, _v4.z, 5.2, dt);
        this.launchLookOffset.x = THREE.MathUtils.damp(this.launchLookOffset.x, _v6.x, 5.8, dt);
        this.launchLookOffset.y = THREE.MathUtils.damp(this.launchLookOffset.y, _v6.y, 5.8, dt);
        this.launchLookOffset.z = THREE.MathUtils.damp(this.launchLookOffset.z, _v6.z, 5.8, dt);
      } else {
        // Pure Overhead Top-Down View ("gemilerin üstünden bakış açısı, arkasından olmasın"):
        // Camera is directly ABOVE the ships (+Y = 11.4 -> 17.2) at z = +3.2 -> +6.0 (directly over the hulls, never behind the tail!)
        // with camera.up pointing along +Z so noses point toward the TOP of the screen (matching Sketch 4 & Sketch 5!)
        _v5.set(0, 0.12, 0.993).normalize();
        this.camera.up.lerp(_v5, 1 - Math.exp(-8.0 * dt)).normalize();

        const sepT = Math.min(1, this.launchStageTime / 5.4);
        const sketch5T = THREE.MathUtils.smoothstep(sepT, 0.44, 0.90);
        _v4.set(
          THREE.MathUtils.lerp(-0.3, -1.25, sketch5T),
          THREE.MathUtils.lerp(11.4, 17.2, sketch5T),
          THREE.MathUtils.lerp(3.2, 6.0, sketch5T)
        );
        _v6.set(
          THREE.MathUtils.lerp(-0.3, -1.25, sketch5T),
          THREE.MathUtils.lerp(0.8, 1.0, sketch5T),
          THREE.MathUtils.lerp(4.4, 7.4, sketch5T)
        );
        this.launchCamOffset.x = THREE.MathUtils.damp(this.launchCamOffset.x, _v4.x, 6.5, dt);
        this.launchCamOffset.y = THREE.MathUtils.damp(this.launchCamOffset.y, _v4.y, 6.5, dt);
        this.launchCamOffset.z = THREE.MathUtils.damp(this.launchCamOffset.z, _v4.z, 6.5, dt);
        this.launchLookOffset.x = THREE.MathUtils.damp(this.launchLookOffset.x, _v6.x, 6.5, dt);
        this.launchLookOffset.y = THREE.MathUtils.damp(this.launchLookOffset.y, _v6.y, 6.5, dt);
        this.launchLookOffset.z = THREE.MathUtils.damp(this.launchLookOffset.z, _v6.z, 6.5, dt);
      }
      this.camera.position.copy(this.shuttleRig.root.position).add(this.launchCamOffset);
      this.camera.lookAt(_v2.copy(this.shuttleRig.root.position).add(this.launchLookOffset));
    } else {
      this.camera.up.set(0, 1, 0);
      const isFailingLiftoff = this.launchPhase === 'liftoff' && !this.currentStats.enginePasses;
      const isSrbClimb = this.launchPhase === 'srb_sep';
      const srbNorm = isSrbClimb ? Math.min(1, this.launchStageTime / 3.4) : 0;
      const pull = isSrbClimb ? 4.5 + srbNorm * 5.0 : Math.min(5.0, this.shuttleY * 0.08);
      const offX = isFailingLiftoff
        ? 5.2 + Math.min(5.2, this.shuttleY * 0.22)
        : isSrbClimb
        ? THREE.MathUtils.lerp(5.2, 3.8, srbNorm)
        : 5.2 + Math.min(4.0, this.shuttleY * 0.05);
      const offY = isSrbClimb
        ? 4.55 + THREE.MathUtils.lerp(-1.2, 3.8, THREE.MathUtils.smoothstep(srbNorm, 0.0, 0.9))
        : 2.75;
      const offZ = isFailingLiftoff
        ? Math.max(14.5, 33.5 - this.shuttleY * 0.65)
        : 33.5 + pull;
      _v4.set(offX, offY, offZ);
      _v6.set(
        isSrbClimb ? 0.4 : 1.5,
        isSrbClimb ? 4.55 - THREE.MathUtils.lerp(0.0, 2.2, srbNorm) : 4.95,
        0
      );
      this.launchCamOffset.x = THREE.MathUtils.damp(this.launchCamOffset.x, _v4.x, 5.5, dt);
      this.launchCamOffset.y = THREE.MathUtils.damp(this.launchCamOffset.y, _v4.y, 5.5, dt);
      this.launchCamOffset.z = THREE.MathUtils.damp(this.launchCamOffset.z, _v4.z, 5.5, dt);
      this.launchLookOffset.x = THREE.MathUtils.damp(this.launchLookOffset.x, _v6.x, 5.5, dt);
      this.launchLookOffset.y = THREE.MathUtils.damp(this.launchLookOffset.y, _v6.y, 5.5, dt);
      this.launchLookOffset.z = THREE.MathUtils.damp(this.launchLookOffset.z, _v6.z, 5.5, dt);
      this.camera.position.copy(this.shuttleRig.root.position).add(this.launchCamOffset);
      this.camera.lookAt(_v2.copy(this.shuttleRig.root.position).add(this.launchLookOffset));
    }
  }

  private updateJourney(dt: number, elapsed: number): void {
    const rate =
      this.journeySpeedMultiplier === 10000
        ? 0.45
        : this.journeySpeedMultiplier === 2000
        ? 0.19
        : this.journeySpeedMultiplier === 1000
        ? 0.095
        : 0.024;

    const pCenter = this.journeyTargetPlanet.position;
    this.journeyTargetPlanet.rotation.y += dt * 0.25;

    // Insufficient Fuel Simulation: Burns out mid-transit -> Craft drifts lost into empty deep space -> MISSION FAILED!
    if (this.journeyFuelExhausted) {
      this.journeyLostTimer += dt;
      const driftScale =
        this.journeySpeedMultiplier === 10000
          ? 2.2
          : this.journeySpeedMultiplier === 2000
          ? 1.55
          : 1.0;

      this.journeyCraft.position.addScaledVector(this.journeyLostVel, dt * driftScale);
      // Solid planet boundaries: out-of-fuel spacecraft can never clip through Origin Earth or Destination Planet!
      this.resolveSolidSphereCollision(
        this.journeyCraft.position,
        this.journeyLostVel,
        this.journeyOriginPlanetPos,
        5.6,
        1.75,
        0.35
      );
      this.resolveSolidSphereCollision(
        this.journeyCraft.position,
        this.journeyLostVel,
        pCenter,
        5.2,
        1.75,
        0.35
      );

      this.journeyCraft.rotation.x += dt * 0.42;
      this.journeyCraft.rotation.y += dt * 0.65;
      this.journeyCraft.rotation.z += dt * 0.28;
      this.journeySatFlame.visible = false;

      // Pure top-down overhead view lingers directly above the unpowered spacecraft drifting in deep space
      this.camera.up.set(0, 0, -1);
      _v1.set(
        this.journeyCraft.position.x,
        this.journeyCraft.position.y + 18.5 + this.journeyLostTimer * 1.8,
        this.journeyCraft.position.z + 1.2
      );
      this.camera.position.lerp(_v1, 0.08);
      this.camera.lookAt(this.journeyCraft.position);

      if (this.journeyLostTimer >= 3.1 && !this.journeyFailTriggered) {
        this.journeyFailTriggered = true;
        const world = WORLDS[this.targetWorldId];
        this.callbacks.onMissionFailed?.({
          reason: 'out_of_fuel',
          title: 'MISSION FAILED',
          subtitle: 'PROPELLANT DEPLETED — VEHICLE LOST IN DEEP SPACE',
          detail: `Your spacecraft carried ${this.currentStats.fuelMassKg.toLocaleString()} kg of cryo propellant, short of the NASA required ${this.currentStats.requiredFuelKg.toLocaleString()} kg for ${world.name} (${world.transferDeltaVKms} km/s Δv). Fuel exhausted mid-transit and the vehicle drifted off-course into deep space.`,
        });
      }
      return;
    }

    this.journeyProgress = Math.min(1, this.journeyProgress + dt * rate);
    this.callbacks.onJourneyProgress(Math.round(this.journeyProgress * 100));

    // Track live remaining propellant (%)
    const fuelPasses = this.currentStats.fuelPasses;
    const burnoutT = this.currentStats.fuelRatio <= 0.8 ? 0.44 : 0.6;
    if (!fuelPasses) {
      const remPct = Math.max(0, Math.round((1 - this.journeyProgress / burnoutT) * 100));
      if (remPct !== this.lastJourneyFuelPct) {
        this.lastJourneyFuelPct = remPct;
        this.callbacks.onJourneyFuelUpdate?.(remPct);
      }

      if (this.journeyProgress >= burnoutT) {
        // Trigger deep-space fuel depletion right mid-transfer!
        this.journeyFuelExhausted = true;
        this.journeyLostTimer = 0;
        this.journeySatFlame.visible = false;
        this.callbacks.onJourneyFuelUpdate?.(0);
        missionAudio.playSnap();

        const curveT = Math.min(0.95, this.journeyProgress / 0.72);
        const tangent = this.journeyCurve.getTangentAt(curveT).normalize();
        // Deflect slightly in the horizontal orbital plane away from target planet
        this.journeyLostVel.copy(tangent).multiplyScalar(7.5).add(new THREE.Vector3(-2.4, 0, -1.5));
        return;
      }
    } else {
      const reserveFloor = Math.max(12, Math.round((1 - 0.88 / this.currentStats.fuelRatio) * 100));
      const remPct = Math.round(THREE.MathUtils.lerp(100, reserveFloor, this.journeyProgress));
      if (remPct !== this.lastJourneyFuelPct) {
        this.lastJourneyFuelPct = remPct;
        this.callbacks.onJourneyFuelUpdate?.(remPct);
      }
    }

    const CAPTURE_T = 0.72;
    const ENTRY_ANGLE = Math.PI;
    const ORBIT_SWEEP = 2.45;
    const ORBIT_R = 8.4;

    // 1. Seamless Overhead Carrier Rocket Separation at Departure (0% -> 28%, matching Sketch 5)
    const p0 = this.journeyCurve.getPointAt(0);
    if (this.journeyProgress < 0.28) {
      this.journeyCarrierGroup.visible = true;
      const sepEase = THREE.MathUtils.smoothstep(this.journeyProgress, 0.0, 0.26);
      const shrinkT = THREE.MathUtils.smoothstep(this.journeyProgress, 0.16, 0.28);
      this.journeyCarrierGroup.rotation.set(-Math.PI / 2, 0, 0);
      // Carrier recedes in the bottom-left of the top-down frame while the small ship accelerates straight up-screen (-Z)
      this.journeyCarrierGroup.position.set(
        p0.x - 3.8 - sepEase * 0.8,
        p0.y - 0.3 - sepEase * 0.4,
        p0.z + 6.4 + sepEase * 5.2
      );
      this.journeyCarrierGroup.scale.setScalar(THREE.MathUtils.lerp(1.0, 0.75, shrinkT));
    } else {
      this.journeyCarrierGroup.visible = false;
    }

    // Smooth scale-up from stowed carrier bay scale (0.68) to deep-space cruise scale (1.0)
    const satCruiseScale = THREE.MathUtils.lerp(
      0.68,
      1.0,
      THREE.MathUtils.smoothstep(this.journeyProgress, 0.0, 0.12)
    );
    this.journeySatGroup.scale.setScalar(satCruiseScale);

    // 2. Flat Horizontal Spacecraft Position & Slerped Orientation (Dorsal surface always facing +Y toward overhead camera)
    this.journeyCraft.up.set(0, 1, 0);
    if (this.journeyProgress <= CAPTURE_T) {
      const curveT = this.journeyProgress / CAPTURE_T;
      const pt = this.journeyCurve.getPointAt(curveT);
      this.journeyCraft.position.copy(pt);
      _v7.copy(this.journeyCurve.getTangentAt(Math.min(1, curveT))).normalize();

      if (curveT < 0.96) {
        const ahead = this.journeyCurve.getPointAt(Math.min(1, curveT + 0.02));
        _v3.copy(ahead);
      } else {
        const blendTan = (curveT - 0.96) / 0.04;
        const aheadCurve = this.journeyCurve.getPointAt(1.0);
        _v5.set(
          pCenter.x + Math.cos(ENTRY_ANGLE + 0.06) * ORBIT_R,
          pCenter.y,
          pCenter.z + Math.sin(ENTRY_ANGLE + 0.06) * ORBIT_R
        );
        _v3.copy(aheadCurve).lerp(_v5, blendTan);
      }

      const prevQ = _quat.copy(this.journeyCraft.quaternion);
      this.journeyCraft.lookAt(_v3);
      this.journeyTargetQuat.copy(this.journeyCraft.quaternion);
      this.journeyCraft.quaternion.copy(prevQ).slerp(this.journeyTargetQuat, 1 - Math.exp(-9 * dt));

      const flameRamp = THREE.MathUtils.smoothstep(this.journeyProgress, 0.0, 0.1);
      const f = (0.35 + flameRamp * 0.65) * (0.86 + Math.sin(elapsed * 30) * 0.14);
      this.journeySatFlame.visible = true;
      this.journeySatFlame.scale.set(0.45 + flameRamp * 0.55, f, 0.45 + flameRamp * 0.55);
    } else {
      const orbitT = (this.journeyProgress - CAPTURE_T) / (1 - CAPTURE_T);
      const theta = ENTRY_ANGLE + ORBIT_SWEEP * orbitT;
      const sx = pCenter.x + Math.cos(theta) * ORBIT_R;
      const sz = pCenter.z + Math.sin(theta) * ORBIT_R;
      this.journeyCraft.position.set(sx, pCenter.y, sz);
      _v7.set(-Math.sin(theta), 0, Math.cos(theta)).normalize();

      _v3.set(
        pCenter.x + Math.cos(theta + 0.08) * ORBIT_R,
        pCenter.y,
        pCenter.z + Math.sin(theta + 0.08) * ORBIT_R
      );
      const prevQ = _quat.copy(this.journeyCraft.quaternion);
      this.journeyCraft.lookAt(_v3);
      this.journeyTargetQuat.copy(this.journeyCraft.quaternion);
      this.journeyCraft.quaternion.copy(prevQ).slerp(this.journeyTargetQuat, 1 - Math.exp(-9 * dt));

      const fade = 1 - THREE.MathUtils.smoothstep(orbitT, 0.02, 0.38);
      if (fade > 0.02) {
        this.journeySatFlame.visible = true;
        this.journeySatFlame.scale.set(fade, fade * 0.85, fade);
      } else {
        this.journeySatFlame.visible = false;
      }
    }

    // 3. Overhead Separation (0% -> 14%) transitioning smoothly into Cinematic Angled Side-Profile View ("Hafif çapraz-yan sinematik bakış açısı")
    const sepToSide = THREE.MathUtils.smoothstep(this.journeyProgress, 0.12, 0.34);
    const chaseToReveal = THREE.MathUtils.smoothstep(this.journeyProgress, 0.52, 0.86);

    // Smoothly blend camera.up from top-down (0, 0, -1) during separation to standard horizon-level (0, 1, 0) in side view
    this.camera.up
      .set(0, THREE.MathUtils.lerp(0.001, 1.0, sepToSide), THREE.MathUtils.lerp(-1.0, 0.0, sepToSide))
      .normalize();

    // Unit forward tangent T = _v7 and horizontal starboard side vector R = (-T.z, 0, T.x)
    const tx = _v7.x;
    const tz = _v7.z;
    const rx = -tz;
    const rz = tx;

    // Phase A (Overhead separation look & cam offsets)
    const topLookX = -1.1;
    const topLookY = 0.0;
    const topLookZ = -1.8;
    const topCamX = -1.1;
    const topCamY = 22.0;
    const topCamZ = -0.6;

    // Phase B (Cinematic three-quarter side-profile cruise along spacecraft flank)
    const sideDist = THREE.MathUtils.lerp(11.2, 14.2, chaseToReveal);
    const backDist = THREE.MathUtils.lerp(4.6, 6.8, chaseToReveal);
    const sideHeight = THREE.MathUtils.lerp(4.0, 6.4, chaseToReveal);

    const sideCamX = rx * sideDist - tx * backDist;
    const sideCamY = sideHeight;
    const sideCamZ = rz * sideDist - tz * backDist;

    // Look slightly ahead of the Space Shuttle along its tangent, then blend toward the target planet on approach
    _v5.set(tx * 3.8, 0.45, tz * 3.8);
    _v6.copy(pCenter).sub(this.journeyCraft.position).multiplyScalar(0.45);
    _v5.lerp(_v6, chaseToReveal);

    // Blend from Phase A (top-down separation) to Phase B/C (angled side-profile transit & orbit capture)
    _v1.set(
      THREE.MathUtils.lerp(topCamX, sideCamX, sepToSide),
      THREE.MathUtils.lerp(topCamY, sideCamY, sepToSide),
      THREE.MathUtils.lerp(topCamZ, sideCamZ, sepToSide)
    );
    _v2.set(
      THREE.MathUtils.lerp(topLookX, _v5.x, sepToSide),
      THREE.MathUtils.lerp(topLookY, _v5.y, sepToSide),
      THREE.MathUtils.lerp(topLookZ, _v5.z, sepToSide)
    );

    this.journeyCamOffset.x = THREE.MathUtils.damp(this.journeyCamOffset.x, _v1.x, 6.5, dt);
    this.journeyCamOffset.y = THREE.MathUtils.damp(this.journeyCamOffset.y, _v1.y, 6.5, dt);
    this.journeyCamOffset.z = THREE.MathUtils.damp(this.journeyCamOffset.z, _v1.z, 6.5, dt);
    this.journeyLookOffset.x = THREE.MathUtils.damp(this.journeyLookOffset.x, _v2.x, 6.5, dt);
    this.journeyLookOffset.y = THREE.MathUtils.damp(this.journeyLookOffset.y, _v2.y, 6.5, dt);
    this.journeyLookOffset.z = THREE.MathUtils.damp(this.journeyLookOffset.z, _v2.z, 6.5, dt);

    this.camera.position.copy(this.journeyCraft.position).add(this.journeyCamOffset);
    this.journeyCamLook.copy(this.journeyCraft.position).add(this.journeyLookOffset);
    this.camera.lookAt(this.journeyCamLook);

    // Hard solid-planet collision barrier for Journey transit craft
    this.resolveSolidSphereCollision(
      this.journeyCraft.position,
      null,
      this.journeyOriginPlanetPos,
      5.6,
      1.75,
      0
    );
    this.resolveSolidSphereCollision(this.journeyCraft.position, null, pCenter, 5.2, 1.75, 0);

    if (this.journeyProgress >= 1) {
      this.callbacks.onJourneyComplete();
    }
  }

  private resolveSolidSphereCollision(
    pos: THREE.Vector3,
    vel: THREE.Vector3 | null,
    center: THREE.Vector3,
    solidRadius: number,
    objectRadius: number,
    restitution = 0.25
  ): boolean {
    const minDist = solidRadius + objectRadius;
    const dx = pos.x - center.x;
    const dy = pos.y - center.y;
    const dz = pos.z - center.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist < minDist) {
      const inv = dist > 0.0001 ? 1 / dist : 0;
      const nx = dist > 0.0001 ? dx * inv : 0;
      const ny = dist > 0.0001 ? dy * inv : 1;
      const nz = dist > 0.0001 ? dz * inv : 0;

      pos.set(center.x + nx * minDist, center.y + ny * minDist, center.z + nz * minDist);

      if (vel) {
        const vn = vel.x * nx + vel.y * ny + vel.z * nz;
        if (vn < 0) {
          const impulse = -(1 + restitution) * vn;
          vel.x += nx * impulse;
          vel.y += ny * impulse;
          vel.z += nz * impulse;
        }
      }
      return true;
    }
    return false;
  }

  private resolveRocketHullPlanetCollision(
    root: THREE.Object3D,
    center: THREE.Vector3,
    solidRadius: number,
    hullRadius = 1.28
  ): { collided: boolean; contactPoint: THREE.Vector3; surfaceNormal: THREE.Vector3 } {
    root.updateMatrixWorld();
    const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(root.quaternion).normalize();
    const sampleOffsets = [-0.45, 1.9, 4.3, 6.6, 8.5];
    const minR = solidRadius + hullRadius;

    let maxPen = 0;
    const bestNormal = new THREE.Vector3(0, 1, 0);
    const sampleWorld = new THREE.Vector3();

    for (const off of sampleOffsets) {
      sampleWorld.copy(root.position).addScaledVector(axis, off);
      const diffX = sampleWorld.x - center.x;
      const diffY = sampleWorld.y - center.y;
      const diffZ = sampleWorld.z - center.z;
      const d = Math.sqrt(diffX * diffX + diffY * diffY + diffZ * diffZ);
      const pen = minR - d;
      if (pen > maxPen) {
        maxPen = pen;
        if (d > 0.0001) {
          bestNormal.set(diffX / d, diffY / d, diffZ / d);
        }
      }
    }

    if (maxPen > 0) {
      root.position.addScaledVector(bestNormal, maxPen);
      const contactPoint = center.clone().addScaledVector(bestNormal, solidRadius);
      return { collided: true, contactPoint, surfaceNormal: bestNormal };
    }

    const fallbackNormal = root.position.clone().sub(center).normalize();
    return {
      collided: false,
      contactPoint: center.clone().addScaledVector(fallbackNormal, solidRadius),
      surfaceNormal: fallbackNormal,
    };
  }

  private checkRocketEarthImpact(
    root: THREE.Object3D,
    earthCenter: THREE.Vector3
  ): { collided: boolean; contactPoint: THREE.Vector3; surfaceNormal: THREE.Vector3 } {
    root.updateMatrixWorld();
    const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(root.quaternion).normalize();
    const rightAxis = new THREE.Vector3(1, 0, 0).applyQuaternion(root.quaternion).normalize();
    const top = this.launchRocketMaxY;
    const bot = this.launchRocketMinY;
    const srbX = this.launchRocketSrbOffsetX;

    // Exact hull contact spheres matching carrier rocket nose tip, fairing, tank, nozzles, and twin boosters
    const hullSamples: { lx: number; ly: number; r: number }[] = [
      { lx: 0, ly: top - 0.14, r: 0.14 },
      { lx: 0, ly: top - 0.8, r: 0.48 },
      { lx: 0, ly: top * 0.72, r: 0.82 },
      { lx: 0, ly: top * 0.44, r: 0.92 },
      { lx: 0, ly: top * 0.16, r: 0.92 },
      { lx: 0, ly: bot + 0.32, r: 0.32 },
      { lx: -srbX, ly: 0.35, r: 0.32 },
      { lx: -srbX, ly: 5.0, r: 0.28 },
      { lx: srbX, ly: 0.35, r: 0.32 },
      { lx: srbX, ly: 5.0, r: 0.28 },
    ];

    let maxPen = 0;
    const bestNormal = new THREE.Vector3(0, 1, 0);
    const bestContact = new THREE.Vector3();
    const sampleWorld = new THREE.Vector3();

    for (const s of hullSamples) {
      sampleWorld
        .copy(root.position)
        .addScaledVector(axis, s.ly)
        .addScaledVector(rightAxis, s.lx);

      // 1. Exact curved Earth sphere surface (coastalCap sits at radius = this.launchEarthRadius)
      const dx = sampleWorld.x - earthCenter.x;
      const dy = sampleWorld.y - earthCenter.y;
      const dz = sampleWorld.z - earthCenter.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const spherePen = this.launchEarthRadius + s.r - dist;
      if (spherePen > maxPen) {
        maxPen = spherePen;
        if (dist > 0.0001) {
          bestNormal.set(dx / dist, dy / dist, dz / dist);
        }
        bestContact.copy(earthCenter).addScaledVector(bestNormal, this.launchEarthRadius);
      }

      // 2. Coastal lagoon water plane (y = -0.08 across z in [14, 154], x in [-180, 180])
      if (sampleWorld.z >= 14 && sampleWorld.z <= 154 && Math.abs(sampleWorld.x) <= 180) {
        const lagoonPen = -0.08 + s.r - sampleWorld.y;
        if (lagoonPen > maxPen) {
          maxPen = lagoonPen;
          bestNormal.set(0, 1, 0);
          bestContact.set(sampleWorld.x, -0.08, sampleWorld.z);
        }
      }
    }

    if (maxPen > 0) {
      root.position.addScaledVector(bestNormal, maxPen);
      return { collided: true, contactPoint: bestContact, surfaceNormal: bestNormal };
    }

    const fallbackNormal = root.position.clone().sub(earthCenter).normalize();
    return {
      collided: false,
      contactPoint: earthCenter.clone().addScaledVector(fallbackNormal, this.launchEarthRadius),
      surfaceNormal: fallbackNormal,
    };
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    window.removeEventListener('resize', this.handleResize);

    this.controls.dispose();
    this.composer?.dispose();

    this.sunPBR.dispose();
    this.earthPBR.dispose();
    this.earthLaunchSurfacePBR.dispose();
    this.moonPBR.dispose();
    this.mercuryPBR.dispose();
    this.marsPBR.dispose();
    this.jupiterPBR.dispose();
    this.saturnPBR.dispose();
    this.saturnRingTex.dispose();
    this.europaPBR.dispose();
    this.asteroidPBR.dispose();
    this.proximaPBR.dispose();
    this.hangarFloorPBR.dispose();
    this.milkyWayTexture.dispose();
    this.glowTexture.dispose();
    this.smokeTexture.dispose();
    this.wallDisplay.texture.dispose();
    this.spacecraftAssets.kapton.dispose();
    this.spacecraftAssets.solar.dispose();
    this.spacecraftAssets.shuttleWhite.dispose();
    this.spacecraftAssets.shuttleBlack.dispose();
    this.spacecraftAssets.etFoam.dispose();

    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Line || obj instanceof THREE.Sprite) {
        if ('geometry' in obj && obj.geometry) obj.geometry.dispose();
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
        else obj.material.dispose();
      }
    });

    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
