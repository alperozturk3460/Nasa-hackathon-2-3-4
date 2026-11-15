import { AlertTriangle, ArrowRight, Flame, RotateCcw } from 'lucide-react';
import { CraftStats, WORLDS, WorldId } from '../data/missionData';
import { LaunchTelemetry } from '../three/MissionWorldEngine';

interface LaunchOverlayProps {
  targetWorldId: WorldId;
  stats: CraftStats;
  telemetry: LaunchTelemetry;
  onStartCountdown: () => void;
  onResetPad: () => void;
  onSkipToJourney: () => void;
  onReturnHangar: () => void;
}

const LAUNCH_STEPS: { id: LaunchTelemetry['phase']; label: string }[] = [
  { id: 'liftoff', label: '1. Liftoff' },
  { id: 'srb_sep', label: '2. SRB Sep (45 km)' },
  { id: 'tank_sep', label: '3. Forward Cruise (115 km)' },
  { id: 'satellite_sep', label: '4. Spaceship Deploy (185 km)' },
];

export function LaunchOverlay({
  targetWorldId,
  stats,
  telemetry,
  onStartCountdown,
  onResetPad,
  onSkipToJourney,
  onReturnHangar,
}: LaunchOverlayProps) {
  const world = WORLDS[targetWorldId];
  const isFlightActive =
    telemetry.phase === 'liftoff' ||
    telemetry.phase === 'srb_sep' ||
    telemetry.phase === 'tank_sep' ||
    telemetry.phase === 'satellite_sep';
  const isFailing =
    telemetry.phase === 'failed_arc' || telemetry.phase === 'failed_crash';
  const activeStepIdx = LAUNCH_STEPS.findIndex((s) => s.id === telemetry.phase);

  return (
    <>
      <div className="pointer-events-auto absolute top-3 left-3 right-3 z-20 flex flex-wrap items-center justify-between gap-2">
        <div className="bg-[#080d1a]/94 border border-slate-800 rounded-lg px-3.5 py-1.5 text-xs flex flex-wrap items-center gap-2">
          <span className="font-display font-semibold text-cyan-300">Launch Complex 39A</span>
          <span className="text-slate-600">·</span>
          <span className="text-slate-300">Destination: {world.name}</span>
          <span className="text-slate-600">·</span>
          <span
            className={`font-mono-tabular font-semibold ${
              stats.enginePasses ? 'text-emerald-300' : 'text-rose-400'
            }`}
          >
            Thrust {stats.thrustKn.toLocaleString()} / {stats.requiredThrustKn.toLocaleString()} kN
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onReturnHangar}
            className="px-3 py-1.5 rounded-lg bg-[#080d1a]/94 border border-slate-800 text-xs text-slate-300 hover:text-white cursor-pointer"
          >
            Back to Hangar
          </button>
          {!isFailing && stats.enginePasses && (
            <button
              type="button"
              onClick={onSkipToJourney}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#080d1a]/94 border border-cyan-500/40 text-xs text-cyan-200 hover:bg-cyan-500/20 cursor-pointer"
            >
              <span>Skip to Journey</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* NASA Launch & Separation Milestone Bar */}
      {isFlightActive && (
        <div className="pointer-events-none absolute top-14 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2">
          <div className="bg-[#080d1a]/94 border border-slate-800 rounded-lg p-1.5 flex flex-wrap items-center justify-center gap-1">
            {LAUNCH_STEPS.map((step, idx) => {
              const active = step.id === telemetry.phase;
              const completed = idx < activeStepIdx;
              return (
                <div
                  key={step.id}
                  className={`px-2.5 py-1 rounded text-[11px] font-mono-tabular font-medium transition-colors ${
                    active
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : completed
                      ? 'bg-cyan-950/75 text-cyan-300 border border-cyan-500/30'
                      : 'text-slate-500'
                  }`}
                >
                  {step.label}
                </div>
              );
            })}
          </div>
          <div className="bg-[#080d1a]/94 border border-amber-500/45 rounded-lg px-3.5 py-1 text-[11px] font-mono-tabular text-amber-200">
            {telemetry.stageLabel}
          </div>
        </div>
      )}

      {/* Insufficient Thrust Atmospheric Failure Banner */}
      {isFailing && (
        <div className="pointer-events-none absolute top-16 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2">
          <div className="bg-rose-950/95 border border-rose-500 rounded-xl px-5 py-2.5 flex items-center gap-2.5 shadow-2xl">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <div className="text-xs font-mono-tabular text-rose-100 font-semibold">
              {telemetry.stageLabel}
            </div>
          </div>
        </div>
      )}

      {/* Countdown 5..0 Center Display */}
      {telemetry.phase === 'countdown' && (
        <div className="pointer-events-none absolute top-20 left-1/2 -translate-x-1/2 z-20 bg-[#080d1a]/95 border border-amber-500/60 rounded-xl px-8 py-4 text-center">
          <div className="text-[11px] font-mono-tabular uppercase tracking-widest text-slate-400">
            Terminal Launch Countdown
          </div>
          <div className="font-display text-5xl font-bold text-white font-mono-tabular mt-1">
            T-{telemetry.countdownValue}
          </div>
          <div className="text-xs text-amber-300 mt-1">
            Liftoff TWR {stats.launchTwr.toFixed(2)}× · Main Engines Priming
          </div>
        </div>
      )}

      {/* Left Compact NASA Flight Telemetry Card */}
      <div className="pointer-events-auto hidden sm:flex flex-col gap-1.5 absolute bottom-4 left-4 w-64 z-20 bg-[#080d1a]/94 border border-slate-800 rounded-xl p-3.5 text-xs font-mono-tabular">
        <div className="font-display font-semibold text-cyan-300 text-xs mb-1">
          NASA Ascent Telemetry
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">ALTITUDE</span>
          <span className={isFailing ? 'text-rose-300' : 'text-cyan-300'}>
            {telemetry.altitudeKm} km
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">VELOCITY</span>
          <span className="text-slate-100">{telemetry.velocityKmh.toLocaleString()} km/h</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">THRUST / REQ</span>
          <span className={stats.enginePasses ? 'text-emerald-300' : 'text-rose-400 font-bold'}>
            {stats.thrustKn.toLocaleString()} / {stats.requiredThrustKn.toLocaleString()} kN
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">LOAD FACTOR</span>
          <span className={isFailing ? 'text-rose-300' : 'text-emerald-300'}>
            {telemetry.accelG.toFixed(1)} g
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">BOOSTER FUEL</span>
          <span className="text-amber-300">{telemetry.fuelPct}%</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">DROP-SHIP DEPLOY</span>
          <span className="text-cyan-200">
            {telemetry.sepVelocityMs > 0
              ? `IN FLIGHT (+${telemetry.sepVelocityMs.toFixed(1)} m/s)`
              : 'BAY STOWED'}
          </span>
        </div>
        <div className="flex justify-between pt-1 border-t border-slate-800/80">
          <span className="text-slate-400">ROCKET / EARTH</span>
          <span className="text-emerald-300 font-bold">0.0055%</span>
        </div>
      </div>

      {/* Right Launch Action */}
      <div className="pointer-events-auto absolute bottom-4 right-4 z-20 flex flex-col gap-2 w-64">
        {telemetry.phase === 'pad' && (
          <button
            type="button"
            onClick={onStartCountdown}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-xs font-bold text-slate-950 transition-colors shadow-lg cursor-pointer"
          >
            <Flame className="w-4 h-4" />
            <span>Ignite &amp; Launch (T-5..0)</span>
          </button>
        )}

        {isFlightActive && stats.enginePasses && (
          <button
            type="button"
            onClick={onSkipToJourney}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-xs font-bold text-slate-950 transition-colors cursor-pointer"
          >
            <span>Proceed to Transfer Journey</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}

        {telemetry.phase === 'countdown' && (
          <button
            type="button"
            onClick={onResetPad}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Hold / Reset Countdown</span>
          </button>
        )}
      </div>
    </>
  );
}
