import { AlertTriangle, ArrowRight, FastForward, Fuel } from 'lucide-react';
import { JourneyWarpSpeed, WORLDS, WorldId } from '../data/missionData';

interface JourneyOverlayProps {
  targetWorldId: WorldId;
  progressPct: number;
  fuelPct: number;
  fuelPasses: boolean;
  warpSpeed: JourneyWarpSpeed;
  onChangeWarpSpeed: (speed: JourneyWarpSpeed) => void;
  onSkipToOrbit?: () => void;
}

const WARP_SPEEDS: JourneyWarpSpeed[] = [1, 1000, 2000, 10000];

export function JourneyOverlay({
  targetWorldId,
  progressPct,
  fuelPct,
  fuelPasses,
  warpSpeed,
  onChangeWarpSpeed,
  onSkipToOrbit,
}: JourneyOverlayProps) {
  const world = WORLDS[targetWorldId];
  const fuelEmpty = fuelPct <= 0;

  return (
    <>
      <div className="pointer-events-none absolute top-4 left-4 z-20 flex flex-col gap-2">
        <div className="bg-[#080d1a]/94 border border-slate-800 rounded-lg px-4 py-2 text-xs">
          <span className="font-display font-semibold text-cyan-300">
            Transfer Trajectory · {warpSpeed.toLocaleString()}× Warp
          </span>
          <span className="mx-2 text-slate-600">·</span>
          <span className="text-slate-300">
            Earth Departure → {world.name} ({world.distanceLabel})
          </span>
        </div>

        {fuelEmpty && (
          <div className="bg-rose-950/95 border border-rose-500 rounded-lg px-4 py-2 text-xs font-mono-tabular text-rose-100 flex items-center gap-2 shadow-xl">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>PROPELLANT EXHAUSTED · SPACECRAFT ADRIFT IN DEEP SPACE</span>
          </div>
        )}
      </div>

      <div className="pointer-events-auto absolute bottom-5 left-1/2 -translate-x-1/2 z-20 w-[780px] max-w-[95vw] bg-[#080d19]/95 border border-slate-800 rounded-xl px-5 py-4 space-y-3.5 shadow-2xl">
        {/* Transfer Progress + Live Fuel Remaining */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex-1 min-w-[240px]">
            <div className="flex justify-between text-xs font-mono-tabular mb-1.5">
              <span className={fuelEmpty ? 'text-rose-300 font-semibold' : 'text-slate-300'}>
                {fuelEmpty
                  ? 'Engine Flameout — Drifting Off Trajectory'
                  : progressPct < 22
                  ? 'Earth Escape Injection (Deployed Spaceship)'
                  : progressPct < 72
                  ? `Deep Space Curved Cruise (${warpSpeed.toLocaleString()}×)`
                  : `Capturing & Settling into ${world.name} Orbit`}
              </span>
              <span className="text-cyan-300 font-semibold">{progressPct}%</span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-150 ${
                  fuelEmpty ? 'bg-rose-500' : 'bg-cyan-400'
                }`}
                style={{ width: `${progressPct}%` }}
              />
            </div>

            {/* Live Propellant Fuel Gauge */}
            <div className="mt-2.5 flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-[11px] font-mono-tabular text-slate-400 shrink-0">
                <Fuel className={`w-3.5 h-3.5 ${fuelEmpty ? 'text-rose-400' : 'text-amber-400'}`} />
                <span>FUEL</span>
              </div>
              <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-150 ${
                    fuelEmpty
                      ? 'bg-rose-500'
                      : fuelPct < 25
                      ? 'bg-amber-400'
                      : 'bg-emerald-400'
                  }`}
                  style={{ width: `${Math.max(0, Math.min(100, fuelPct))}%` }}
                />
              </div>
              <span
                className={`text-[11px] font-mono-tabular font-bold w-12 text-right ${
                  fuelEmpty ? 'text-rose-400' : fuelPct < 25 ? 'text-amber-300' : 'text-emerald-300'
                }`}
              >
                {fuelPct}%
              </span>
            </div>
          </div>

          {fuelPasses && !fuelEmpty && onSkipToOrbit && (
            <button
              type="button"
              onClick={onSkipToOrbit}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-cyan-200 transition-colors whitespace-nowrap cursor-pointer"
            >
              <span>Skip to Orbit</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Time-Warp Speed Multiplier Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-slate-800/90">
          <div className="flex items-center gap-2 text-[11px] font-mono-tabular text-slate-400">
            <FastForward className="w-3.5 h-3.5 text-amber-400" />
            <span>TIME WARP MULTIPLIER</span>
          </div>
          <div className="flex items-center gap-2">
            {WARP_SPEEDS.map((speed) => {
              const active = warpSpeed === speed;
              return (
                <button
                  key={speed}
                  type="button"
                  onClick={() => onChangeWarpSpeed(speed)}
                  className={`px-3.5 py-1.5 rounded-lg border font-mono-tabular text-xs font-bold transition-colors cursor-pointer ${
                    active
                      ? 'bg-amber-500 border-amber-400 text-slate-950 shadow-sm'
                      : 'bg-[#0b1222] border-slate-700 text-slate-200 hover:border-cyan-400/70 hover:text-cyan-200'
                  }`}
                >
                  {speed}×
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
