export type SceneStage =
  | 'planet_select'
  | 'hangar'
  | 'launch_pad'
  | 'journey'
  | 'orbit_insertion'
  | 'final_visual';

export type WorldId = 'moon' | 'earth' | 'mars' | 'asteroid' | 'jupiter' | 'colony';

export type CraftClassId = 'light' | 'standard' | 'heavy';
export type EngineId = 'rl10_single' | 'merlin_trio' | 'j2x_twin' | 'rs25_quad' | 'f1b_penta';
export type FuelOptionId = 'fuel_critical' | 'fuel_short' | 'fuel_nominal' | 'fuel_excess';

export type ManeuverType = 'retro_burn' | 'aerobraking' | 'gravity_assist';

export interface WorldSpec {
  id: WorldId;
  name: string;
  subtitle: string;
  category: string;
  difficulty: 'STANDARD' | 'MODERATE' | 'HIGH' | 'EXTREME';
  gravity: number; // m/s^2
  earthG: number;
  distanceLabel: string;
  tripDuration: string;
  radioDelay: string;
  radiationHazard: 'LOW' | 'MODERATE' | 'HIGH' | 'EXTREME';
  solarFluxRatio: number;
  hasAtmosphere: boolean;
  recommendedManeuver: ManeuverType;
  approachVelocityKms: number;
  transferDeltaVKms: number; // Official NASA mission Delta-V budget (km/s)
  requiredFuelKg: number; // Exact NASA cryogenic propellant mass required (kg)
  idealAngleDeg: number;
  angleToleranceDeg: number;
  accentColor: string;
  orbitRadius: number;
  orbitSpeed: number;
  planetRadius: number;
  description: string;
  novaGuidance: string;
  finalSummary: string;
}

export interface EngineSpec {
  id: EngineId;
  name: string;
  nasaProgram: string;
  thrustKn: number;
  ispSec: number;
  massKg: number;
  costM: number;
  nozzleCount: number;
  skirtStyle: 'minimal' | 'carbon' | 'ducts' | 'sls_quad' | 'f1b_heavy';
  description: string;
}

export interface FuelOptionSpec {
  id: FuelOptionId;
  name: string;
  ratio: number; // Multiplier on world.requiredFuelKg
  extraTankMassKg: number;
  costM: number;
  tankScaleY: number;
  tankScaleR: number;
  description: string;
}

export interface CraftClassSpec {
  id: CraftClassId;
  name: string;
  subtitle: string;
  dryMassKg: number;
  fuelCapacityKg: number;
  costM: number;
  thrustN: number;
  ispSec: number;
  powerGenW: number;
  powerDrawW: number;
  solarPanels: number;
  description: string;
}

export type PowerSourceId = 'solar_array' | 'nuclear_rtg';

export interface PowerSourceSpec {
  id: PowerSourceId;
  name: string;
  massKg: number;
  costM: number;
  baseWatts: number;
  solarDependent: boolean;
  description: string;
}

export interface HangarConfig {
  craftClass: CraftClassId;
  engineId: EngineId;
  fuelId: FuelOptionId;
  powerSource: PowerSourceId;
}

export interface CraftStats {
  totalMassKg: number;
  dryMassKg: number;
  fuelMassKg: number;
  requiredFuelKg: number;
  fuelRatio: number;
  fuelPasses: boolean;
  massLimitKg: number;
  remainingMassKg: number;
  totalCostM: number;
  budgetLimitM: number;
  remainingBudgetM: number;
  netPowerW: number;
  thrustN: number;
  thrustKn: number;
  requiredThrustKn: number;
  enginePasses: boolean;
  launchTwr: number;
  twrOnTarget: number;
  deltaV: number;
  readinessScore: number;
  advisories: { level: 'nominal' | 'caution' | 'critical'; text: string }[];
}

export interface MissionFailureInfo {
  reason: 'underpowered_engine' | 'out_of_fuel';
  title: 'MISSION FAILED';
  subtitle: string;
  detail: string;
}

export interface OrbitOutcome {
  success: boolean;
  reason: 'stable' | 'crash' | 'escape' | 'no_fuel' | 'burnup';
  title: string;
  explanation: string;
  remainingDeltaV: number;
}

export const NASA_BUDGET_LIMIT_M = 1000;
export const NASA_MASS_LIMIT_KG = 275000;
export const EARTH_LAUNCH_GRAVITY = 9.81; // m/s^2
export const NASA_LIFTOFF_TWR_MIN = 1.25; // NASA minimum orbital launch TWR to clear Max-Q & gravity losses

export const WORLDS: Record<WorldId, WorldSpec> = {
  moon: {
    id: 'moon',
    name: 'The Moon',
    subtitle: 'Shackleton Crater · Lunar South Pole',
    category: 'LUNAR SURFACE',
    difficulty: 'STANDARD',
    gravity: 1.62,
    earthG: 0.165,
    distanceLabel: '384,400 km',
    tripDuration: '3 Days',
    radioDelay: '1.3 s',
    radiationHazard: 'LOW',
    solarFluxRatio: 1.0,
    hasAtmosphere: false,
    recommendedManeuver: 'retro_burn',
    approachVelocityKms: 2.38,
    transferDeltaVKms: 12.6,
    requiredFuelKg: 118000,
    idealAngleDeg: 0,
    angleToleranceDeg: 8,
    accentColor: '#cbd5e1',
    orbitRadius: 15.2,
    orbitSpeed: 0.3,
    planetRadius: 0.56,
    description:
      'Low lunar gravity (1.62 m/s²) and full solar illumination. Requires 12.6 km/s total NASA Trans-Lunar Injection Δv from Earth pad.',
    novaGuidance:
      'Earth liftoff needs ≥ 2,500 kN thrust and ≥ 118,000 kg propellant for Trans-Lunar Injection.',
    finalSummary:
      'Landed on the cratered lunar regolith with pit hazards, solid ejecta boulders, and a crisp curved horizon.',
  },
  earth: {
    id: 'earth',
    name: 'Earth Orbit',
    subtitle: 'Sun-Synchronous Orbital Corridor',
    category: 'LOW EARTH ORBIT',
    difficulty: 'STANDARD',
    gravity: 9.81,
    earthG: 1.0,
    distanceLabel: '540 km',
    tripDuration: '9 Minutes',
    radioDelay: '< 0.1 s',
    radiationHazard: 'LOW',
    solarFluxRatio: 1.0,
    hasAtmosphere: true,
    recommendedManeuver: 'retro_burn',
    approachVelocityKms: 7.65,
    transferDeltaVKms: 9.4,
    requiredFuelKg: 102000,
    idealAngleDeg: 0,
    angleToleranceDeg: 9,
    accentColor: '#38bdf8',
    orbitRadius: 13.8,
    orbitSpeed: 0.22,
    planetRadius: 1.48,
    description:
      'Full 9.81 m/s² gravity requires 9.4 km/s orbital insertion Δv through Max-Q aerodynamic drag and precision apogee burn.',
    novaGuidance:
      'Ensure liftoff TWR ≥ 1.25× (2,500 kN at nominal 102,000 kg propellant) to clear Earth’s dense lower atmosphere.',
    finalSummary:
      'Autonomous offshore recovery deck reached after precision retro-propulsive descent.',
  },
  mars: {
    id: 'mars',
    name: 'Mars',
    subtitle: 'Jezero Crater Delta',
    category: 'TERRESTRIAL PLANET',
    difficulty: 'MODERATE',
    gravity: 3.71,
    earthG: 0.378,
    distanceLabel: '225,000,000 km',
    tripDuration: '7 Months',
    radioDelay: '14 min',
    radiationHazard: 'MODERATE',
    solarFluxRatio: 0.43,
    hasAtmosphere: true,
    recommendedManeuver: 'aerobraking',
    approachVelocityKms: 5.03,
    transferDeltaVKms: 13.1,
    requiredFuelKg: 126000,
    idealAngleDeg: -2,
    angleToleranceDeg: 6.5,
    accentColor: '#f97316',
    orbitRadius: 18.8,
    orbitSpeed: 0.16,
    planetRadius: 1.05,
    description:
      '38% Earth gravity (3.71 m/s²) with a thin CO₂ atmosphere. Requires 13.1 km/s Trans-Mars Injection Δv and 126,000 kg propellant.',
    novaGuidance:
      'Interplanetary transit requires ≥ 126,000 kg cryo propellant so the craft never runs dry mid-cruise.',
    finalSummary:
      'Jezero cratered terrain with sunken pits, basalt boulders, and loose Martian specimens ready for rover survey.',
  },
  asteroid: {
    id: 'asteroid',
    name: 'Asteroid (Psyche / Bennu)',
    subtitle: 'Main Belt Metallic World',
    category: 'ASTEROID BELT',
    difficulty: 'MODERATE',
    gravity: 0.14,
    earthG: 0.014,
    distanceLabel: '370,000,000 km',
    tripDuration: '2.5 Years',
    radioDelay: '22 min',
    radiationHazard: 'MODERATE',
    solarFluxRatio: 0.2,
    hasAtmosphere: false,
    recommendedManeuver: 'retro_burn',
    approachVelocityKms: 1.15,
    transferDeltaVKms: 13.7,
    requiredFuelKg: 130000,
    idealAngleDeg: 0,
    angleToleranceDeg: 7.5,
    accentColor: '#fb7185',
    orbitRadius: 24.5,
    orbitSpeed: 0.11,
    planetRadius: 0.68,
    description:
      'Microgravity (0.14 m/s²) Main Belt destination demanding 13.7 km/s deep-space rendezvous Δv (130,000 kg propellant).',
    novaGuidance:
      'Load at least 130,000 kg propellant for the 370M km cruise.',
    finalSummary:
      'Touchdown confirmed on fractured carbonaceous-metallic regolith surrounded by impact pits and iron shards.',
  },
  jupiter: {
    id: 'jupiter',
    name: 'Jupiter / Europa',
    subtitle: 'Jovian Radiation Belt & Ice Moon',
    category: 'OUTER GAS GIANT',
    difficulty: 'EXTREME',
    gravity: 24.79,
    earthG: 2.53,
    distanceLabel: '778,000,000 km',
    tripDuration: '5 Years',
    radioDelay: '45 min',
    radiationHazard: 'EXTREME',
    solarFluxRatio: 0.04,
    hasAtmosphere: false,
    recommendedManeuver: 'gravity_assist',
    approachVelocityKms: 13.7,
    transferDeltaVKms: 15.8,
    requiredFuelKg: 138000,
    idealAngleDeg: 3,
    angleToleranceDeg: 5.5,
    accentColor: '#f59e0b',
    orbitRadius: 31.8,
    orbitSpeed: 0.075,
    planetRadius: 2.35,
    description:
      '778M km outer-planet transfer requiring 15.8 km/s Δv (138,000 kg propellant) and 4% sunlight.',
    novaGuidance:
      'Equip ≥ 138,000 kg fuel and Nuclear Stirling RTG power to survive Jovian outer space.',
    finalSummary:
      'Cracked cryogenic ice spires, deep fracture pits, and banded Jupiter filling the Europa horizon.',
  },
  colony: {
    id: 'colony',
    name: 'Proxima b (New Eden)',
    subtitle: 'Exoplanet Outpost · Biodome Sector',
    category: 'EXOPLANET COLONY',
    difficulty: 'HIGH',
    gravity: 10.8,
    earthG: 1.1,
    distanceLabel: '4.24 Light Years',
    tripDuration: '18 Months (Cruise)',
    radioDelay: '4.24 Years',
    radiationHazard: 'HIGH',
    solarFluxRatio: 0.65,
    hasAtmosphere: true,
    recommendedManeuver: 'aerobraking',
    approachVelocityKms: 9.4,
    transferDeltaVKms: 17.5,
    requiredFuelKg: 144000,
    idealAngleDeg: -1,
    angleToleranceDeg: 6.0,
    accentColor: '#14b8a6',
    orbitRadius: 48.0,
    orbitSpeed: 0.04,
    planetRadius: 1.55,
    description:
      'Deep-cruise exoplanet outpost needing 17.5 km/s transfer Δv (144,000 kg propellant).',
    novaGuidance:
      'Requires 144,000 kg propellant. If selecting Extended Heavy Tank (138%), upgrade to SLS F-1B Penta engine!',
    finalSummary:
      'Landed beside the blue geodesic biodome amidst craters, deep vents, and navigable rocky fields.',
  },
};

export const WORLD_LIST: WorldSpec[] = [
  WORLDS.moon,
  WORLDS.earth,
  WORLDS.mars,
  WORLDS.asteroid,
  WORLDS.jupiter,
  WORLDS.colony,
];

/**
 * 5 Official NASA-Inspired Engine Propulsion Options by Liftoff Thrust (kN):
 * - 3 Options strictly < Baseline Required Thrust (2,500 kN)
 * - 1 Option strictly == Baseline Required Thrust (2,500 kN)
 * - 1 Option strictly > Required Thrust even with Excess Fuel loaded (3,550 kN)
 */
export const ENGINE_OPTIONS: EngineSpec[] = [
  {
    id: 'rl10_single',
    name: 'RL10-C Cryo Single',
    nasaProgram: 'NASA Centaur / SLS ICPS',
    thrustKn: 980,
    ispSec: 453,
    massKg: 2100,
    costM: 95,
    nozzleCount: 1,
    skirtStyle: 'minimal',
    description:
      'Single compact expander bell (980 kN). Upper-stage vacuum thruster — far below Earth orbital liftoff requirement.',
  },
  {
    id: 'merlin_trio',
    name: 'Merlin-1D Trio Array',
    nasaProgram: 'Commercial Cargo Cluster',
    thrustKn: 1520,
    ispSec: 311,
    massKg: 3400,
    costM: 155,
    nozzleCount: 3,
    skirtStyle: 'carbon',
    description:
      '3 compact kerolox bells with twin stubby fins (1,520 kN). Insufficient thrust to escape thick lower atmosphere.',
  },
  {
    id: 'j2x_twin',
    name: 'J-2X Twin Gas-Gen',
    nasaProgram: 'NASA Constellation / Ares',
    thrustKn: 2020,
    ispSec: 448,
    massKg: 4900,
    costM: 235,
    nozzleCount: 2,
    skirtStyle: 'ducts',
    description:
      '2 wide high-expansion nozzles with vertical turbopump exhaust ducts (2,020 kN). Still underpowered for full atmospheric escape.',
  },
  {
    id: 'rs25_quad',
    name: 'RS-25D Quad SLS Core',
    nasaProgram: 'NASA Space Shuttle / Artemis SLS',
    thrustKn: 2500,
    ispSec: 452,
    massKg: 6600,
    costM: 340,
    nozzleCount: 4,
    skirtStyle: 'sls_quad',
    description:
      '4 contoured cryogenic bells, gold thermal boat-tail & 4 delta fins (2,500 kN). Matches NASA Nominal Liftoff Thrust exactly (fail only if overloaded).',
  },
  {
    id: 'f1b_penta',
    name: 'SLS F-1B Heavy Penta',
    nasaProgram: 'NASA Saturn V / SLS Block-2',
    thrustKn: 3550,
    ispSec: 380,
    massKg: 9400,
    costM: 490,
    nozzleCount: 5,
    skirtStyle: 'f1b_heavy',
    description:
      '5 massive wide-throat boosters, armored flare skirt & twin side manifolds (3,550 kN). Easily lifts even Extended Heavy Fuel tanks!',
  },
];

/**
 * 4 Official NASA Propellant Tank Options (relative to target world's requiredFuelKg):
 * - 2 Options < Required Fuel (runs dry in deep space -> MISSION FAILED)
 * - 1 Option == Required Fuel (exact NASA transfer budget)
 * - 1 Option > Required Fuel (increases rocket mass & increases required engine thrust!)
 */
export const FUEL_OPTIONS: FuelOptionSpec[] = [
  {
    id: 'fuel_critical',
    name: 'Sub-Orbital Short Tank',
    ratio: 0.76,
    extraTankMassKg: 0,
    costM: 65,
    tankScaleY: 0.68,
    tankScaleR: 0.82,
    description:
      '76% propellant in slim gunmetal core with open truss adapter. Runs dry mid-transit.',
  },
  {
    id: 'fuel_short',
    name: 'Compact Silver Reserve',
    ratio: 0.89,
    extraTankMassKg: 0,
    costM: 105,
    tankScaleY: 0.86,
    tankScaleR: 0.93,
    description:
      '89% propellant in ribbed aluminum tank. Exhausts fuel before orbit capture.',
  },
  {
    id: 'fuel_nominal',
    name: 'NASA Nominal Cryo Tank',
    ratio: 1.0,
    extraTankMassKg: 0,
    costM: 150,
    tankScaleY: 1.04,
    tankScaleR: 1.02,
    description:
      '100% exact NASA mission propellant in flush ceramic-white cryo fuselage.',
  },
  {
    id: 'fuel_excess',
    name: 'Heavy Orange + Twin Side Tanks',
    ratio: 1.38,
    extraTankMassKg: 6500,
    costM: 245,
    tankScaleY: 1.38,
    tankScaleR: 1.15,
    description:
      '138% propellant with orange SOFI core + twin side drop-tanks (+weight & +thrust req!).',
  },
];

export const CRAFT_CLASSES: CraftClassSpec[] = [
  {
    id: 'light',
    name: 'Light Scout (Mk-I)',
    subtitle: 'Compact carbon-composite bus',
    dryMassKg: 1450,
    fuelCapacityKg: 1650,
    costM: 320,
    thrustN: 34000,
    ispSec: 330,
    powerGenW: 1500,
    powerDrawW: 620,
    solarPanels: 2,
    description: 'Compact bus architecture.',
  },
  {
    id: 'standard',
    name: 'Standard Explorer (Titan-II)',
    subtitle: 'Balanced NASA deep-space bus',
    dryMassKg: 2350,
    fuelCapacityKg: 2650,
    costM: 540,
    thrustN: 72000,
    ispSec: 365,
    powerGenW: 2200,
    powerDrawW: 880,
    solarPanels: 4,
    description: 'Balanced NASA deep-space carrier architecture.',
  },
  {
    id: 'heavy',
    name: 'Heavy Deep-Space (DeepForge)',
    subtitle: 'High-thrust cryogenic flagship',
    dryMassKg: 3150,
    fuelCapacityKg: 2950,
    costM: 780,
    thrustN: 175000,
    ispSec: 405,
    powerGenW: 3100,
    powerDrawW: 1180,
    solarPanels: 6,
    description: 'Heavy-lift deep-space carrier architecture.',
  },
];

export const POWER_SOURCES: PowerSourceSpec[] = [
  {
    id: 'solar_array',
    name: 'Blue Photovoltaic Wings',
    massKg: 180,
    costM: 45,
    baseWatts: 2400,
    solarDependent: true,
    description: 'Deployable blue solar wings; output drops to 4% at Jupiter.',
  },
  {
    id: 'nuclear_rtg',
    name: 'Nuclear Stirling RTG',
    massKg: 360,
    costM: 140,
    baseWatts: 2100,
    solarDependent: false,
    description: 'Twin finned plutonium-238 RTG pods; steady power anywhere.',
  },
];

export const DEFAULT_HANGAR_CONFIG: HangarConfig = {
  craftClass: 'standard',
  engineId: 'rs25_quad',
  fuelId: 'fuel_nominal',
  powerSource: 'solar_array',
};

export function computeCraftStats(config: HangarConfig, worldId: WorldId): CraftStats {
  const world = WORLDS[worldId];
  const engine = ENGINE_OPTIONS.find((e) => e.id === config.engineId) || ENGINE_OPTIONS[3];
  const fuel = FUEL_OPTIONS.find((f) => f.id === config.fuelId) || FUEL_OPTIONS[2];
  const power = POWER_SOURCES.find((p) => p.id === config.powerSource) || POWER_SOURCES[0];

  const requiredFuelKg = world.requiredFuelKg;
  const fuelMassKg = Math.round(requiredFuelKg * fuel.ratio);

  // Calibrate carrier stack baseline to 203,900 kg at Nominal Fuel (1.00x) -> Required Thrust = 2,500 kN exact!
  const refStackNominalKg = 203900;
  const baselineCarrierDryKg = refStackNominalKg - requiredFuelKg - 6600 - 180;
  const dryMassKg =
    baselineCarrierDryKg + engine.massKg + fuel.extraTankMassKg + power.massKg;
  const totalMassKg = dryMassKg + fuelMassKg;
  const remainingMassKg = NASA_MASS_LIMIT_KG - totalMassKg;

  // Base spacecraft avionics & launch infrastructure cost = $215M
  const totalCostM = 215 + engine.costM + fuel.costM + power.costM;
  const remainingBudgetM = NASA_BUDGET_LIMIT_M - totalCostM;

  const effectiveGenW = power.solarDependent
    ? Math.round((880 + power.baseWatts) * world.solarFluxRatio)
    : Math.round(550 + power.baseWatts);
  const netPowerW = effectiveGenW - 880;

  // Required Liftoff Thrust (NASA F_req = StackMass_fuel_adjusted * 9.81 * 1.25 TWR)
  const thrustRefMassKg =
    refStackNominalKg + (fuelMassKg - requiredFuelKg) + fuel.extraTankMassKg;
  const rawReqKn = (thrustRefMassKg * EARTH_LAUNCH_GRAVITY * NASA_LIFTOFF_TWR_MIN) / 1000;
  const requiredThrustKn = Math.round(rawReqKn / 10) * 10;

  const thrustKn = engine.thrustKn;
  const thrustN = thrustKn * 1000;
  const launchTwr = Number(
    (thrustN / Math.max(1, thrustRefMassKg * EARTH_LAUNCH_GRAVITY)).toFixed(2)
  );
  const targetWeightN = totalMassKg * world.gravity;
  const twrOnTarget = targetWeightN > 0 ? thrustN / targetWeightN : 0;

  const enginePasses = thrustKn >= requiredThrustKn;
  const fuelPasses = fuelMassKg >= requiredFuelKg;

  const deltaV = Math.round(
    engine.ispSec * EARTH_LAUNCH_GRAVITY * Math.log(totalMassKg / Math.max(1, dryMassKg)) * 2.95
  );

  const advisories: CraftStats['advisories'] = [];

  if (!enginePasses) {
    advisories.push({
      level: 'critical',
      text: `THRUST DEFICIT: ${thrustKn.toLocaleString()} kN < ${requiredThrustKn.toLocaleString()} kN required! Rocket will crash on liftoff.`,
    });
  }
  if (!fuelPasses) {
    advisories.push({
      level: 'critical',
      text: `FUEL DEFICIT: ${fuelMassKg.toLocaleString()} kg < ${requiredFuelKg.toLocaleString()} kg needed for ${world.name}. Craft will run dry in space!`,
    });
  }
  if (remainingMassKg < 0) {
    advisories.push({
      level: 'critical',
      text: `Over pad gantry mass limit by ${Math.abs(remainingMassKg).toLocaleString()} kg!`,
    });
  }
  if (remainingBudgetM < 0) {
    advisories.push({
      level: 'critical',
      text: `Over NASA mission budget by $${Math.abs(remainingBudgetM)}M!`,
    });
  }
  if (netPowerW < 0) {
    advisories.push({
      level: 'critical',
      text: `Power deficit (${netPowerW} W) at ${Math.round(world.solarFluxRatio * 100)}% sunlight. Switch to Nuclear Stirling RTG!`,
    });
  }

  if (advisories.length === 0) {
    advisories.push({
      level: 'nominal',
      text: `Certified for ${world.name}: ${thrustKn.toLocaleString()} kN thrust · ${fuelMassKg.toLocaleString()} kg fuel · TWR ${launchTwr.toFixed(
        2
      )}×`,
    });
  }

  let score = 100;
  if (!enginePasses) score -= 45;
  if (!fuelPasses) score -= 40;
  if (remainingMassKg < 0) score -= 20;
  if (remainingBudgetM < 0) score -= 15;
  if (netPowerW < 0) score -= 20;

  return {
    totalMassKg,
    dryMassKg,
    fuelMassKg,
    requiredFuelKg,
    fuelRatio: fuel.ratio,
    fuelPasses,
    massLimitKg: NASA_MASS_LIMIT_KG,
    remainingMassKg,
    totalCostM,
    budgetLimitM: NASA_BUDGET_LIMIT_M,
    remainingBudgetM,
    netPowerW,
    thrustN,
    thrustKn,
    requiredThrustKn,
    enginePasses,
    launchTwr,
    twrOnTarget,
    deltaV,
    readinessScore: Math.max(5, Math.min(100, score)),
    advisories,
  };
}

export function evaluateOrbitInsertion(params: {
  world: WorldSpec;
  stats: CraftStats;
  maneuver: ManeuverType;
  approachAngleDeg: number;
  burnTimingAccuracy: number;
}): OrbitOutcome {
  const { world, stats, maneuver, approachAngleDeg, burnTimingAccuracy } = params;
  const angleDelta = Math.abs(approachAngleDeg - world.idealAngleDeg);

  if (maneuver === 'aerobraking' && !world.hasAtmosphere) {
    return {
      success: false,
      reason: 'escape',
      title: 'Aerobraking Failed — No Atmosphere',
      explanation: `${world.name} has virtually no atmosphere to slow your spacecraft.`,
      remainingDeltaV: stats.deltaV,
    };
  }

  if (approachAngleDeg < world.idealAngleDeg - world.angleToleranceDeg) {
    return {
      success: false,
      reason: maneuver === 'aerobraking' ? 'burnup' : 'crash',
      title: maneuver === 'aerobraking' ? 'Atmospheric Entry Burn-Up' : 'Impact Trajectory — Too Steep',
      explanation: `Approach angle (${approachAngleDeg.toFixed(1)}°) dipped too steeply into ${world.name}’s gravity well.`,
      remainingDeltaV: Math.max(0, stats.deltaV - 950),
    };
  }

  if (approachAngleDeg > world.idealAngleDeg + world.angleToleranceDeg) {
    return {
      success: false,
      reason: 'escape',
      title: 'Orbit Missed — Approach Too Shallow',
      explanation: `Approach angle (+${approachAngleDeg.toFixed(1)}°) was too shallow for capture.`,
      remainingDeltaV: Math.max(0, stats.deltaV - 700),
    };
  }

  if (burnTimingAccuracy < 0.52) {
    return {
      success: false,
      reason: 'escape',
      title: 'Missed Periapsis Burn Window',
      explanation: 'Missed optimal Oberth periapsis capture window.',
      remainingDeltaV: Math.max(0, stats.deltaV - 1100),
    };
  }

  const baseRequiredDv = Math.round(world.approachVelocityKms * 265);
  const maneuverMultiplier =
    maneuver === 'aerobraking' ? 0.45 : maneuver === 'gravity_assist' ? 0.65 : 1.0;
  const timingPenalty = 1 + (1 - burnTimingAccuracy) * 0.45;
  const requiredDv = Math.round(baseRequiredDv * maneuverMultiplier * timingPenalty);

  if (stats.deltaV < requiredDv) {
    return {
      success: false,
      reason: 'no_fuel',
      title: 'Propellant Exhausted Before Capture',
      explanation: `Required ${requiredDv.toLocaleString()} m/s Δv, carried ${stats.deltaV.toLocaleString()} m/s.`,
      remainingDeltaV: 0,
    };
  }

  const remainingDeltaV = stats.deltaV - requiredDv;
  const maneuverLabel =
    maneuver === 'aerobraking'
      ? 'Aerobraking Pass'
      : maneuver === 'gravity_assist'
      ? 'Gravity Assist Capture'
      : 'Periapsis Retro-Burn';

  return {
    success: true,
    reason: 'stable',
    title: `Stable ${world.name} Orbit Achieved`,
    explanation: `${maneuverLabel} executed cleanly at ${angleDelta.toFixed(1)}° using ${requiredDv.toLocaleString()} m/s Δv.`,
    remainingDeltaV,
  };
}

export type JourneyWarpSpeed = 1 | 1000 | 2000 | 10000;

export type SurfacePhase =
  | 'descending'
  | 'landed'
  | 'ramp_deploy'
  | 'rover_exit'
  | 'rover_active';

export interface LandingSiteSpec {
  id: string;
  name: string;
  angleDeg: number;
  terrainType: string;
  risk: 'LOW' | 'MODERATE' | 'HIGH';
  scienceValue: string;
  description: string;
}

export const LANDING_SITES: Record<WorldId, LandingSiteSpec[]> = {
  moon: [
    {
      id: 'shackleton_rim',
      name: 'Shackleton Crater Rim',
      angleDeg: 35,
      terrainType: 'Sunlit Ridge · Water Ice Edge',
      risk: 'LOW',
      scienceValue: 'Polar Ice & Eternal Sunlight',
      description: 'Flat high-illumination ridge ideal for vertical landing and rover traverse.',
    },
    {
      id: 'mare_tranquillitatis',
      name: 'Mare Tranquillitatis',
      angleDeg: 150,
      terrainType: 'Smooth Basalt Plain',
      risk: 'LOW',
      scienceValue: 'Ancient Volcanic Regolith',
      description: 'Wide low-slope basalt floor with minimal boulder hazards.',
    },
    {
      id: 'tycho_central',
      name: 'Tycho Central Peak',
      angleDeg: 265,
      terrainType: 'Crater Uplift · Steep Terrace',
      risk: 'MODERATE',
      scienceValue: 'Deep Lunar Crustal Ejecta',
      description: 'Rugged highland ejecta requiring precise overhead de-orbit alignment.',
    },
  ],
  earth: [
    {
      id: 'atlantic_drone_pad',
      name: 'Atlantic Recovery Platform',
      angleDeg: 40,
      terrainType: 'Autonomous Ocean Landing Pad',
      risk: 'LOW',
      scienceValue: 'Orbital Re-Entry & Recovery',
      description: 'Stabilized offshore recovery deck for vertical retro-propulsive touchdown.',
    },
    {
      id: 'kennedy_coastal',
      name: 'Cape Canaveral Landing Zone 1',
      angleDeg: 165,
      terrainType: 'Concrete Coastal Pad',
      risk: 'LOW',
      scienceValue: 'Precision RTLS Touchdown',
      description: 'Primary coastal recovery apron with full telemetry tracking.',
    },
    {
      id: 'pacific_atoll',
      name: 'Equatorial Atoll Test Range',
      angleDeg: 280,
      terrainType: 'Coral Island Pad',
      risk: 'MODERATE',
      scienceValue: 'Cross-Range Aerocapture',
      description: 'Remote equatorial recovery strip testing high-energy de-orbit accuracy.',
    },
  ],
  mars: [
    {
      id: 'jezero_delta',
      name: 'Jezero Crater Delta',
      angleDeg: 45,
      terrainType: 'Ancient River Delta Basin',
      risk: 'LOW',
      scienceValue: 'Biosignature Clay Minerals',
      description: 'NASA Perseverance landing zone with flat sediment plains for rover science.',
    },
    {
      id: 'elysium_planitia',
      name: 'Elysium Planitia',
      angleDeg: 170,
      terrainType: 'Broad Volcanic Plain',
      risk: 'LOW',
      scienceValue: 'Seismic & Subsurface Ice',
      description: 'Extremely smooth equatorial plain offering maximum landing safety.',
    },
    {
      id: 'valles_rim',
      name: 'Valles Marineris Rim',
      angleDeg: 285,
      terrainType: 'Canyon Plateau Edge',
      risk: 'HIGH',
      scienceValue: 'Exposed Crustal Strata',
      description: 'High-value geological canyon terrace with steeper descent winds.',
    },
  ],
  asteroid: [
    {
      id: 'nightingale_crater',
      name: 'Nightingale Crater Floor',
      angleDeg: 30,
      terrainType: 'Fine Carbonaceous Regolith',
      risk: 'LOW',
      scienceValue: 'Pristine Solar Nebula Organics',
      description: 'Sheltered microgravity basin suited for soft thruster touchdown.',
    },
    {
      id: 'psyche_ridge',
      name: 'Psyche Nickel-Iron Ridge',
      angleDeg: 155,
      terrainType: 'Metallic Core Exposure',
      risk: 'MODERATE',
      scienceValue: 'Planetesimal Metallic Core',
      description: 'Dense iron-nickel outcrop ideal for magnetic rover anchoring.',
    },
    {
      id: 'equatorial_boulder',
      name: 'Equatorial Boulder Field',
      angleDeg: 270,
      terrainType: 'Fractured Rubble Pile',
      risk: 'HIGH',
      scienceValue: 'Impact Breccia Diversity',
      description: 'Uneven rubble surface demanding careful microgravity descent.',
    },
  ],
  jupiter: [
    {
      id: 'conamara_chaos',
      name: 'Conamara Chaos Ice Shelf',
      angleDeg: 50,
      terrainType: 'Refrozen Ocean Ice Raft',
      risk: 'LOW',
      scienceValue: 'Subsurface Brine Plumes',
      description: 'Relatively level cryogenic ice floe directly beneath giant Jupiter.',
    },
    {
      id: 'pwyll_ejecta',
      name: 'Pwyll Crater Ice Plain',
      angleDeg: 180,
      terrainType: 'Fresh Water-Ice Blanket',
      risk: 'MODERATE',
      scienceValue: 'Pure Subsurface Ice Sample',
      description: 'Bright fresh ice sheet exposed by recent impact excavation.',
    },
    {
      id: 'thrace_lineae',
      name: 'Thrace Macula Fracture',
      angleDeg: 295,
      terrainType: 'Tectonic Double-Ridge',
      risk: 'HIGH',
      scienceValue: 'Active Hydrated Salt Vent',
      description: 'Dark reddish tectonic fissure with extreme radiation & ridge relief.',
    },
  ],
  colony: [
    {
      id: 'new_eden_pad',
      name: 'New Eden Biodome Pad',
      angleDeg: 40,
      terrainType: 'Leveled Outpost Apron',
      risk: 'LOW',
      scienceValue: 'Colony Resupply & Rover Link',
      description: 'Cleared landing zone adjacent to the blue geodesic colony biodome.',
    },
    {
      id: 'terminator_valley',
      name: 'Twilight Terminator Valley',
      angleDeg: 165,
      terrainType: 'Basaltic Liquid-Water Belt',
      risk: 'LOW',
      scienceValue: 'Habitable Temperate Zone',
      description: 'Mild twilight zone between scorching dayside and frozen nightside.',
    },
    {
      id: 'flare_caldera',
      name: 'Proxima Volcanic Caldera',
      angleDeg: 280,
      terrainType: 'Tidal-Flexed Basalt Rim',
      risk: 'HIGH',
      scienceValue: 'Geothermal Exoplanet Core',
      description: 'Active basaltic highlands exposed to intense Proxima Centauri flares.',
    },
  ],
};
