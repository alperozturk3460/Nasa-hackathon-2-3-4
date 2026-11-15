import { ArrowLeft, ArrowRight, ChevronDown, ChevronRight, Flame, Fuel, Pause, Play, X, Zap } from 'lucide-react';
import { useState } from 'react';
import {
  CraftStats,
  ENGINE_OPTIONS,
  EngineId,
  FUEL_OPTIONS,
  FuelOptionId,
  HangarConfig,
  POWER_SOURCES,
  PowerSourceId,
  WORLDS,
  WorldId,
} from '../data/missionData';

interface HangarOverlayProps {
  targetWorldId: WorldId;
  config: HangarConfig;
  stats: CraftStats;
  turntablePaused: boolean;
  onChangeEngineId: (id: EngineId) => void;
  onChangeFuelId: (id: FuelOptionId) => void;
  onChangePowerSource: (id: PowerSourceId) => void;
  onToggleTurntable: () => void;
  onProceedToLaunch: () => void;
}

function EngineVisualSvg({ id }: { id: EngineId }) {
  return (
    <svg
      viewBox="0 0 56 56"
      className="w-12 h-12 shrink-0 rounded-lg bg-[#050914] border border-slate-800/90 p-1"
      aria-hidden="true"
    >
      {id === 'rl10_single' && (
        <>
          <rect x="20" y="6" width="16" height="15" rx="2" fill="#334155" />
          <polygon points="20,21 36,21 33,31 23,31" fill="#111827" />
          <polygon points="24,31 32,31 35,49 21,49" fill="#94a3b8" />
          <ellipse cx="28" cy="40" rx="5.5" ry="1.3" fill="none" stroke="#e2e8f0" strokeWidth="1.2" />
        </>
      )}

      {id === 'merlin_trio' && (
        <>
          <polygon points="18,16 10,30 18,30" fill="#64748b" />
          <polygon points="38,16 46,30 38,30" fill="#64748b" />
          <rect x="18" y="6" width="20" height="17" rx="2" fill="#475569" />
          <polygon points="17,23 39,23 41,33 15,33" fill="#0f172a" />
          <rect x="21" y="14" width="2.2" height="16" fill="#cbd5e1" />
          <rect x="27" y="14" width="2.2" height="16" fill="#cbd5e1" />
          <rect x="33" y="14" width="2.2" height="16" fill="#cbd5e1" />
          <polygon points="17,33 22,33 23.5,47 15.5,47" fill="#b45309" />
          <polygon points="25.5,33 30.5,33 32,48 24,48" fill="#c2410c" />
          <polygon points="34,33 39,33 40.5,47 32.5,47" fill="#b45309" />
        </>
      )}

      {id === 'j2x_twin' && (
        <>
          <polygon points="17,14 6,34 17,34" fill="#e2e8f0" />
          <polygon points="39,14 50,34 39,34" fill="#e2e8f0" />
          <rect x="13" y="8" width="4" height="22" rx="1" fill="#94a3b8" />
          <rect x="12.5" y="13" width="5" height="3" fill="#f97316" />
          <rect x="39" y="8" width="4" height="22" rx="1" fill="#94a3b8" />
          <rect x="38.5" y="13" width="5" height="3" fill="#f97316" />
          <rect x="18" y="6" width="20" height="18" rx="2" fill="#cbd5e1" />
          <polygon points="18,24 38,24 41,34 15,34" fill="#94a3b8" />
          <polygon points="18,34 25,34 27,49 15,49" fill="#334155" stroke="#cbd5e1" strokeWidth="1" />
          <polygon points="31,34 38,34 41,49 29,49" fill="#334155" stroke="#cbd5e1" strokeWidth="1" />
        </>
      )}

      {id === 'rs25_quad' && (
        <>
          <polygon points="18,12 4,35 18,35" fill="#f8fafc" stroke="#0f172a" strokeWidth="1.2" />
          <polygon points="38,12 52,35 38,35" fill="#f8fafc" stroke="#0f172a" strokeWidth="1.2" />
          <rect x="18" y="6" width="20" height="17" rx="2" fill="#e2e8f0" />
          <rect x="18" y="19" width="20" height="3" fill="#e11d48" />
          <rect x="16" y="7" width="2" height="16" fill="#f59e0b" />
          <rect x="38" y="7" width="2" height="16" fill="#f59e0b" />
          <polygon points="17,22 39,22 42,34 14,34" fill="#d97706" />
          <polygon points="15,34 20,34 21,48 13.5,48" fill="#475569" stroke="#cbd5e1" strokeWidth="0.8" />
          <polygon points="22,34 27,34 28,49 21,49" fill="#334155" stroke="#cbd5e1" strokeWidth="0.8" />
          <polygon points="29,34 34,34 35,49 28,49" fill="#334155" stroke="#cbd5e1" strokeWidth="0.8" />
          <polygon points="36,34 41,34 42.5,48 35,48" fill="#475569" stroke="#cbd5e1" strokeWidth="0.8" />
        </>
      )}

      {id === 'f1b_penta' && (
        <>
          <polygon points="16,12 2,38 16,38" fill="#f97316" />
          <polygon points="40,12 54,38 40,38" fill="#f97316" />
          <polygon points="11,10 15,4 16,10" fill="#f97316" />
          <rect x="11" y="10" width="5" height="22" fill="#64748b" />
          <polygon points="40,10 41,4 45,10" fill="#f97316" />
          <rect x="40" y="10" width="5" height="22" fill="#64748b" />
          <rect x="17" y="5" width="22" height="17" rx="2" fill="#475569" />
          <polygon points="16,22 40,22 45,35 11,35" fill="#64748b" />
          <line x1="11" y1="34" x2="45" y2="34" stroke="#f59e0b" strokeWidth="2.4" />
          <polygon points="11,35 16,35 17,49 9.5,49" fill="#9a3412" />
          <polygon points="18,35 23,35 24,50 17,50" fill="#b45309" />
          <polygon points="25,35 31,35 32,51 24,51" fill="#c2410c" stroke="#fbbf24" strokeWidth="0.8" />
          <polygon points="33,35 38,35 39,50 32,50" fill="#b45309" />
          <polygon points="40,35 45,35 46.5,49 39,49" fill="#9a3412" />
        </>
      )}
    </svg>
  );
}

function FuelVisualSvg({ id }: { id: FuelOptionId }) {
  return (
    <svg
      viewBox="0 0 56 56"
      className="w-12 h-12 shrink-0 rounded-lg bg-[#050914] border border-slate-800/90 p-1"
      aria-hidden="true"
    >
      {/* Shared upper fairing indicator */}
      <polygon points="28,4 21,14 35,14" fill="#e2e8f0" />
      <rect x="21" y="14" width="14" height="7" fill="#cbd5e1" />

      {id === 'fuel_critical' && (
        <>
          <polygon points="21,21 35,21 33,26 23,26" fill="#64748b" />
          <rect x="23" y="26" width="10" height="19" rx="1.5" fill="#334155" />
          <rect x="22.5" y="34" width="11" height="3.5" fill="#e11d48" />
          <polygon points="23,45 33,45 31,51 25,51" fill="#0f172a" />
        </>
      )}

      {id === 'fuel_short' && (
        <>
          <rect x="20" y="21" width="16" height="25" rx="1.5" fill="#94a3b8" />
          <rect x="20" y="28" width="16" height="3" fill="#f59e0b" />
          <rect x="22" y="23" width="2" height="21" fill="#1e293b" />
          <rect x="32" y="23" width="2" height="21" fill="#1e293b" />
          <polygon points="20,46 36,46 34,51 22,51" fill="#1e293b" />
        </>
      )}

      {id === 'fuel_nominal' && (
        <>
          <rect x="18" y="21" width="20" height="28" rx="2" fill="#f1f5f9" />
          <rect x="18" y="28" width="20" height="3.5" fill="#06b6d4" />
          <rect x="18" y="42" width="20" height="3" fill="#334155" />
          <polygon points="18,49 38,49 36,53 20,53" fill="#1e293b" />
        </>
      )}

      {id === 'fuel_excess' && (
        <>
          {/* Twin orange strapon external drop-tanks */}
          <polygon points="9,20 12,13 15,20" fill="#f8fafc" />
          <rect x="9" y="20" width="6" height="27" rx="1" fill="#e67e22" />
          <line x1="15" y1="27" x2="17" y2="27" stroke="#94a3b8" strokeWidth="1.5" />
          <line x1="15" y1="40" x2="17" y2="40" stroke="#94a3b8" strokeWidth="1.5" />

          <polygon points="41,20 44,13 47,20" fill="#f8fafc" />
          <rect x="41" y="20" width="6" height="27" rx="1" fill="#e67e22" />
          <line x1="39" y1="27" x2="41" y2="27" stroke="#94a3b8" strokeWidth="1.5" />
          <line x1="39" y1="40" x2="41" y2="40" stroke="#94a3b8" strokeWidth="1.5" />

          {/* Wide orange core + titanium girth rings */}
          <rect x="17" y="19" width="22" height="31" rx="2" fill="#ea580c" />
          <rect x="16.5" y="25" width="23" height="2.2" fill="#94a3b8" />
          <rect x="16.5" y="34" width="23" height="2.2" fill="#94a3b8" />
          <rect x="16.5" y="43" width="23" height="2.2" fill="#94a3b8" />
          <polygon points="17,50 39,50 37,54 19,54" fill="#334155" />
        </>
      )}
    </svg>
  );
}

function PowerVisualSvg({ id }: { id: PowerSourceId }) {
  return (
    <svg
      viewBox="0 0 56 44"
      className="w-11 h-9 shrink-0 rounded-lg bg-[#050914] border border-slate-800/90 p-1"
      aria-hidden="true"
    >
      {id === 'solar_array' ? (
        <>
          <rect x="24" y="8" width="8" height="28" rx="2" fill="#e2e8f0" />
          <rect x="2" y="16" width="20" height="12" rx="1" fill="#1d4ed8" stroke="#60a5fa" strokeWidth="1" />
          <line x1="9" y1="16" x2="9" y2="28" stroke="#93c5fd" strokeWidth="0.8" />
          <line x1="15" y1="16" x2="15" y2="28" stroke="#93c5fd" strokeWidth="0.8" />
          <line x1="2" y1="22" x2="22" y2="22" stroke="#93c5fd" strokeWidth="0.8" />
          <rect x="34" y="16" width="20" height="12" rx="1" fill="#1d4ed8" stroke="#60a5fa" strokeWidth="1" />
          <line x1="41" y1="16" x2="41" y2="28" stroke="#93c5fd" strokeWidth="0.8" />
          <line x1="47" y1="16" x2="47" y2="28" stroke="#93c5fd" strokeWidth="0.8" />
          <line x1="34" y1="22" x2="54" y2="22" stroke="#93c5fd" strokeWidth="0.8" />
        </>
      ) : (
        <>
          <rect x="24" y="8" width="8" height="28" rx="2" fill="#e2e8f0" />
          <line x1="13" y1="14" x2="24" y2="20" stroke="#94a3b8" strokeWidth="2" />
          <rect x="5" y="10" width="11" height="10" rx="2" fill="#1e293b" stroke="#f59e0b" strokeWidth="1.2" />
          <circle cx="10.5" cy="15" r="2.2" fill="#fbbf24" />
          <line x1="32" y1="20" x2="43" y2="14" stroke="#94a3b8" strokeWidth="2" />
          <rect x="40" y="10" width="11" height="10" rx="2" fill="#1e293b" stroke="#f59e0b" strokeWidth="1.2" />
          <circle cx="45.5" cy="15" r="2.2" fill="#fbbf24" />
        </>
      )}
    </svg>
  );
}

type HangarSubMenu = 'engine' | 'fuel' | null;

export function HangarOverlay({
  targetWorldId,
  config,
  stats,
  turntablePaused,
  onChangeEngineId,
  onChangeFuelId,
  onChangePowerSource,
  onToggleTurntable,
  onProceedToLaunch,
}: HangarOverlayProps) {
  const world = WORLDS[targetWorldId];
  const primaryAdvisory = stats.advisories[0];
  const overMass = stats.remainingMassKg < 0;
  const overBudget = stats.remainingBudgetM < 0;

  const [activeMenu, setActiveMenu] = useState<HangarSubMenu>(null);
  const [engineInfoOpen, setEngineInfoOpen] = useState(false);
  const [fuelInfoOpen, setFuelInfoOpen] = useState(false);

  const selectedEngine =
    ENGINE_OPTIONS.find((e) => e.id === config.engineId) ?? ENGINE_OPTIONS[3];
  const selectedFuel =
    FUEL_OPTIONS.find((f) => f.id === config.fuelId) ?? FUEL_OPTIONS[2];

  const toggleMenu = (menu: Exclude<HangarSubMenu, null>) => {
    setActiveMenu((prev) => (prev === menu ? null : menu));
  };

  return (
    <>
      {/* Top-Left Facility & Turntable Control */}
      <div className="pointer-events-auto absolute top-3 left-3 z-20 flex flex-wrap items-center gap-2">
        <div className="bg-[#080d1a]/95 border border-slate-800 rounded-lg px-3 py-1.5 text-xs">
          <span className="font-display font-semibold text-cyan-300">Cleanroom Bay 04</span>
          <span className="mx-2 text-slate-600">·</span>
          <span className="text-slate-300">
            Target: {world.name} (Δv {world.transferDeltaVKms} km/s)
          </span>
        </div>

        <button
          type="button"
          onClick={onToggleTurntable}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#080d1a]/95 border border-slate-800 text-xs text-slate-300 hover:text-white cursor-pointer"
        >
          {turntablePaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
          <span>{turntablePaused ? 'Rotate' : 'Pause'}</span>
        </button>
      </div>

      {/* Right-Side Hangar Configuration Panel */}
      <aside className="pointer-events-auto absolute top-3 right-3 bottom-20 w-[356px] max-w-[92vw] z-20 flex flex-col bg-[#080d19]/95 border border-slate-800/90 rounded-xl overflow-hidden shadow-2xl">
        <div className="flex-1 overflow-y-auto mission-scroll p-3 space-y-3">
          {/* Primary Category Triggers on Right Side: Motor İtki Kuvveti & Yakıt Tankı */}
          <div className="space-y-2.5">
            {/* 1. MOTOR İTKİ KUVVETİ TRIGGER CARD */}
            <div className="rounded-xl border border-slate-800/90 bg-[#0b1222]/90 overflow-hidden">
              <div className="flex items-center justify-between gap-2 px-3 pt-2.5 pb-2">
                <button
                  type="button"
                  onClick={() => toggleMenu('engine')}
                  className="flex-1 text-left flex items-center justify-between gap-2 cursor-pointer group"
                >
                  <div>
                    <div className="text-[11px] font-mono-tabular text-cyan-400 flex items-center gap-1.5">
                      <Flame className="w-3.5 h-3.5 text-amber-400" />
                      <span>01. MOTOR İTKİ KUVVETİ</span>
                    </div>
                    <div className="font-display text-sm font-bold text-slate-100 mt-0.5 group-hover:text-cyan-200 transition-colors">
                      {activeMenu === 'engine'
                        ? 'Menüyü Kapat (5 Seçenek)'
                        : 'Motor İtki Kuvveti Seçenekleri (5)'}
                    </div>
                  </div>
                  <span className="w-7 h-7 rounded-lg bg-[#0e1b33] border border-slate-700/80 flex items-center justify-center text-cyan-300 group-hover:border-cyan-400/70 transition-colors shrink-0">
                    {activeMenu === 'engine' ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </span>
                </button>

                {/* (!) Required Thrust Info Button */}
                <button
                  type="button"
                  aria-label="Required Liftoff Thrust Information"
                  title="Required Liftoff Thrust Information"
                  onClick={() => setEngineInfoOpen((prev) => !prev)}
                  className={`w-7 h-7 rounded-full flex items-center justify-center font-display font-extrabold text-sm border transition-colors cursor-pointer shrink-0 ${
                    engineInfoOpen
                      ? 'bg-amber-500 border-amber-300 text-slate-950'
                      : 'bg-[#0e1b33] border-amber-400/70 text-amber-300 hover:bg-amber-500/20'
                  }`}
                >
                  !
                </button>
              </div>

              {/* Current Selected Engine Summary (always visible when menu is closed, clickable to open/close) */}
              {activeMenu !== 'engine' && (
                <button
                  type="button"
                  onClick={() => toggleMenu('engine')}
                  className="w-full text-left px-3 pb-2.5 pt-1 flex items-center gap-2.5 border-t border-slate-800/60 hover:bg-[#0e192f] transition-colors cursor-pointer"
                >
                  <EngineVisualSvg id={selectedEngine.id} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="font-display font-semibold text-xs text-slate-100 truncate">
                        {selectedEngine.name}
                      </span>
                      <span
                        className={`text-[10px] font-mono-tabular font-bold shrink-0 ${
                          stats.enginePasses ? 'text-cyan-300' : 'text-rose-400'
                        }`}
                      >
                        {selectedEngine.thrustKn.toLocaleString()} kN
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5 flex items-center justify-between font-mono-tabular">
                      <span>Gerekli: {stats.requiredThrustKn.toLocaleString()} kN</span>
                      <span className="text-cyan-400">Seçenekleri Aç →</span>
                    </div>
                  </div>
                </button>
              )}

              {engineInfoOpen && (
                <div className="mx-3 mb-2.5 p-2.5 rounded-lg bg-[#0d172c] border border-amber-500/60 text-[11px] leading-relaxed text-slate-200 relative">
                  <button
                    type="button"
                    aria-label="Close thrust info"
                    onClick={() => setEngineInfoOpen(false)}
                    className="absolute top-2 right-2 text-slate-400 hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <div className="font-display font-bold text-amber-300 pr-5">
                    NASA Required Liftoff Thrust
                  </div>
                  <div className="mt-1 font-mono-tabular text-xs text-white font-bold">
                    Minimum Required: {stats.requiredThrustKn.toLocaleString()} kN
                  </div>
                  <p className="mt-1 text-slate-300">
                    Earth gravity (<span className="font-mono-tabular">9.81 m/s²</span>) × minimum
                    ascent TWR (<span className="font-mono-tabular">1.25×</span>). Heavy excess fuel
                    increases required thrust.
                  </p>
                  <p className="mt-1 text-rose-300">
                    Below {stats.requiredThrustKn.toLocaleString()} kN: rocket fails to escape Earth
                    and crashes.
                  </p>
                </div>
              )}

              {/* Expanded 5 Engine Options Menu on the Right Side */}
              {activeMenu === 'engine' && (
                <div className="p-2.5 border-t border-slate-800/80 bg-[#070c18] space-y-2">
                  <div className="flex items-center justify-between gap-2 pb-1">
                    <span className="text-[11px] font-mono-tabular text-slate-300">
                      5 Motor İtki Kuvveti Seçeneği
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveMenu(null)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-800/90 hover:bg-slate-700 text-[11px] font-semibold text-cyan-200 cursor-pointer transition-colors"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Geri</span>
                    </button>
                  </div>

                  {ENGINE_OPTIONS.map((eng) => {
                    const active = config.engineId === eng.id;
                    const isLess = eng.thrustKn < stats.requiredThrustKn;
                    const isExact = eng.thrustKn === stats.requiredThrustKn;
                    const statusLabel = isLess ? '< REQ' : isExact ? '= REQ' : '> REQ';

                    return (
                      <button
                        key={eng.id}
                        type="button"
                        onClick={() => onChangeEngineId(eng.id)}
                        className={`w-full text-left rounded-lg border p-2 transition-colors cursor-pointer flex items-center gap-2.5 ${
                          active
                            ? isLess
                              ? 'bg-[#200d15] border-rose-400'
                              : 'bg-[#0e1b33] border-cyan-400'
                            : 'bg-[#0b1120] border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <EngineVisualSvg id={eng.id} />

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="font-display font-semibold text-xs text-slate-100 truncate">
                              {eng.name}
                            </span>
                            <span
                              className={`text-[10px] font-mono-tabular font-bold shrink-0 ${
                                isLess
                                  ? 'text-rose-300'
                                  : isExact
                                  ? 'text-emerald-300'
                                  : 'text-cyan-300'
                              }`}
                            >
                              {statusLabel}
                            </span>
                          </div>

                          <div className="text-[10px] font-mono-tabular text-slate-400 mt-0.5 truncate">
                            {eng.nozzleCount} Nozzle{eng.nozzleCount > 1 ? 's' : ''} · {eng.nasaProgram}
                          </div>

                          <div className="flex items-center justify-between mt-1.5 text-[10px] font-mono-tabular">
                            <span className={isLess ? 'text-rose-300 font-bold' : 'text-cyan-300 font-bold'}>
                              {eng.thrustKn.toLocaleString()} kN
                            </span>
                            <span className="text-slate-300">Isp {eng.ispSec}s</span>
                            <span className="text-emerald-300">${eng.costM}M</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 2. YAKIT TANKI TRIGGER CARD */}
            <div className="rounded-xl border border-slate-800/90 bg-[#0b1222]/90 overflow-hidden">
              <div className="flex items-center justify-between gap-2 px-3 pt-2.5 pb-2">
                <button
                  type="button"
                  onClick={() => toggleMenu('fuel')}
                  className="flex-1 text-left flex items-center justify-between gap-2 cursor-pointer group"
                >
                  <div>
                    <div className="text-[11px] font-mono-tabular text-amber-300 flex items-center gap-1.5">
                      <Fuel className="w-3.5 h-3.5" />
                      <span>02. YAKIT TANKI</span>
                    </div>
                    <div className="font-display text-sm font-bold text-slate-100 mt-0.5 group-hover:text-amber-200 transition-colors">
                      {activeMenu === 'fuel'
                        ? 'Menüyü Kapat (4 Seçenek)'
                        : 'Yakıt Tankı Seçenekleri (4)'}
                    </div>
                  </div>
                  <span className="w-7 h-7 rounded-lg bg-[#0e1b33] border border-slate-700/80 flex items-center justify-center text-amber-300 group-hover:border-amber-400/70 transition-colors shrink-0">
                    {activeMenu === 'fuel' ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </span>
                </button>

                {/* (!) Required Fuel Info Button */}
                <button
                  type="button"
                  aria-label="Required Propellant Fuel Information"
                  title="Required Propellant Fuel Information"
                  onClick={() => setFuelInfoOpen((prev) => !prev)}
                  className={`w-7 h-7 rounded-full flex items-center justify-center font-display font-extrabold text-sm border transition-colors cursor-pointer shrink-0 ${
                    fuelInfoOpen
                      ? 'bg-cyan-400 border-cyan-200 text-slate-950'
                      : 'bg-[#0e1b33] border-cyan-400/70 text-cyan-300 hover:bg-cyan-500/20'
                  }`}
                >
                  !
                </button>
              </div>

              {/* Current Selected Fuel Tank Summary (always visible when menu is closed, clickable to open/close) */}
              {activeMenu !== 'fuel' && (
                <button
                  type="button"
                  onClick={() => toggleMenu('fuel')}
                  className="w-full text-left px-3 pb-2.5 pt-1 flex items-center gap-2.5 border-t border-slate-800/60 hover:bg-[#0e192f] transition-colors cursor-pointer"
                >
                  <FuelVisualSvg id={selectedFuel.id} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="font-display font-semibold text-xs text-slate-100 truncate">
                        {selectedFuel.name}
                      </span>
                      <span
                        className={`text-[10px] font-mono-tabular font-bold shrink-0 ${
                          stats.fuelPasses ? 'text-cyan-300' : 'text-rose-400'
                        }`}
                      >
                        {stats.fuelMassKg.toLocaleString()} kg
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5 flex items-center justify-between font-mono-tabular">
                      <span>Hedef: {stats.requiredFuelKg.toLocaleString()} kg</span>
                      <span className="text-amber-300">Seçenekleri Aç →</span>
                    </div>
                  </div>
                </button>
              )}

              {fuelInfoOpen && (
                <div className="mx-3 mb-2.5 p-2.5 rounded-lg bg-[#0d172c] border border-cyan-500/60 text-[11px] leading-relaxed text-slate-200 relative">
                  <button
                    type="button"
                    aria-label="Close fuel info"
                    onClick={() => setFuelInfoOpen(false)}
                    className="absolute top-2 right-2 text-slate-400 hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <div className="font-display font-bold text-cyan-300 pr-5">
                    Required Fuel for {world.name}
                  </div>
                  <div className="mt-1 font-mono-tabular text-xs text-white font-bold">
                    Target Propellant: {stats.requiredFuelKg.toLocaleString()} kg (Δv{' '}
                    {world.transferDeltaVKms} km/s)
                  </div>
                  <p className="mt-1 text-slate-300">
                    Less than {stats.requiredFuelKg.toLocaleString()} kg: ship runs dry mid-transit
                    and drifts lost in space.
                  </p>
                  <p className="mt-1 text-amber-300">
                    Excess tank adds external drop-tanks & mass, raising Required Liftoff Thrust.
                  </p>
                </div>
              )}

              {/* Expanded 4 Fuel Tank Options Menu on the Right Side */}
              {activeMenu === 'fuel' && (
                <div className="p-2.5 border-t border-slate-800/80 bg-[#070c18] space-y-2">
                  <div className="flex items-center justify-between gap-2 pb-1">
                    <span className="text-[11px] font-mono-tabular text-slate-300">
                      4 Yakıt Tankı Seçeneği
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveMenu(null)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-800/90 hover:bg-slate-700 text-[11px] font-semibold text-amber-200 cursor-pointer transition-colors"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Geri</span>
                    </button>
                  </div>

                  {FUEL_OPTIONS.map((fuel) => {
                    const active = config.fuelId === fuel.id;
                    const fuelMassKg = Math.round(stats.requiredFuelKg * fuel.ratio);
                    const isLess = fuel.ratio < 1;
                    const isExact = fuel.ratio === 1;
                    const badge = isLess
                      ? `${Math.round(fuel.ratio * 100)}% < REQ`
                      : isExact
                      ? '100% = REQ'
                      : '138% +TANKS';

                    return (
                      <button
                        key={fuel.id}
                        type="button"
                        onClick={() => onChangeFuelId(fuel.id)}
                        className={`w-full text-left rounded-lg border p-2 transition-colors cursor-pointer flex items-center gap-2.5 ${
                          active
                            ? isLess
                              ? 'bg-[#200d15] border-rose-400'
                              : isExact
                              ? 'bg-[#0e1b33] border-cyan-400'
                              : 'bg-[#1f1709] border-amber-400'
                            : 'bg-[#0b1120] border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <FuelVisualSvg id={fuel.id} />

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="font-display font-semibold text-xs text-slate-100 truncate">
                              {fuel.name}
                            </span>
                            <span
                              className={`text-[10px] font-mono-tabular font-bold shrink-0 ${
                                isLess
                                  ? 'text-rose-300'
                                  : isExact
                                  ? 'text-emerald-300'
                                  : 'text-amber-300'
                              }`}
                            >
                              {badge}
                            </span>
                          </div>
                          <div className="flex items-center justify-between mt-1.5 text-[10px] font-mono-tabular">
                            <span className={isLess ? 'text-rose-300 font-bold' : 'text-cyan-300 font-bold'}>
                              {fuelMassKg.toLocaleString()} kg LOX/LH₂
                            </span>
                            <span className="text-emerald-300">${fuel.costM}M</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* 03. POWER SYSTEM */}
          <div className="pt-2 border-t border-slate-800/80">
            <div className="text-[11px] font-mono-tabular text-amber-300 mb-1.5 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5" />
              <span>03. POWER SYSTEM ({Math.round(world.solarFluxRatio * 100)}% SOLAR FLUX)</span>
            </div>
            <div className="space-y-1.5">
              {POWER_SOURCES.map((pwr) => {
                const active = config.powerSource === pwr.id;
                return (
                  <button
                    key={pwr.id}
                    type="button"
                    onClick={() => onChangePowerSource(pwr.id)}
                    className={`w-full text-left rounded-lg border p-2 transition-colors cursor-pointer flex items-center gap-2.5 ${
                      active
                        ? 'bg-[#0e1b33] border-amber-400'
                        : 'bg-[#0b1120] border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <PowerVisualSvg id={pwr.id} />

                    <div className="min-w-0 flex-1">
                      <div className="font-display font-semibold text-xs text-slate-100 truncate">
                        {pwr.name}
                      </div>
                      <div className="flex items-center justify-between mt-1 text-[10px] font-mono-tabular">
                        <span className="text-cyan-300">{pwr.baseWatts} W base</span>
                        <span className="text-emerald-300">
                          +{pwr.massKg} kg · ${pwr.costM}M
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Remaining Budget & Mass Limit Box */}
          <div className="p-2.5 rounded-lg bg-[#0c1426] border border-slate-800 space-y-1.5 text-[11px] font-mono-tabular">
            <div className="flex justify-between">
              <span className="text-slate-400">Remaining Budget</span>
              <span className={overBudget ? 'text-rose-400 font-bold' : 'text-emerald-300 font-bold'}>
                ${stats.remainingBudgetM}M / ${stats.budgetLimitM}M
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Remaining Mass Limit</span>
              <span className={overMass ? 'text-rose-400 font-bold' : 'text-cyan-300 font-bold'}>
                {stats.remainingMassKg.toLocaleString()} / {stats.massLimitKg.toLocaleString()} kg
              </span>
            </div>
          </div>
        </div>

        <div className="p-3 border-t border-slate-800/80 space-y-2 bg-[#070c17]">
          <div
            className={`text-[11px] px-2.5 py-2 rounded-lg border leading-snug ${
              primaryAdvisory.level === 'critical'
                ? 'bg-rose-950/70 border-rose-500/60 text-rose-200'
                : primaryAdvisory.level === 'caution'
                ? 'bg-amber-950/55 border-amber-500/45 text-amber-200'
                : 'bg-emerald-950/45 border-emerald-500/45 text-emerald-200'
            }`}
          >
            {primaryAdvisory.text}
          </div>

          <button
            type="button"
            onClick={onProceedToLaunch}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-xs font-bold text-slate-950 transition-colors cursor-pointer"
          >
            <span>Proceed to Launch Pad</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Bottom Wall Telemetry Strip (5 Live NASA Engineering Gauges) */}
      <div className="pointer-events-auto absolute bottom-3 left-3 right-3 z-20 bg-[#080d19]/95 border border-slate-800 rounded-xl px-4 py-2.5 grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div>
          <div className="flex justify-between text-[11px] font-mono-tabular">
            <span className="text-slate-400">THRUST / REQ</span>
            <span className={stats.enginePasses ? 'text-emerald-300 font-bold' : 'text-rose-400 font-bold'}>
              {stats.thrustKn.toLocaleString()} / {stats.requiredThrustKn.toLocaleString()} kN
            </span>
          </div>
          <div className="h-1.5 bg-slate-800 rounded-full mt-1 overflow-hidden">
            <div
              className={`h-full ${stats.enginePasses ? 'bg-emerald-400' : 'bg-rose-500'}`}
              style={{
                width: `${Math.min(100, (stats.thrustKn / Math.max(1, stats.requiredThrustKn)) * 80)}%`,
              }}
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between text-[11px] font-mono-tabular">
            <span className="text-slate-400">FUEL / TARGET</span>
            <span className={stats.fuelPasses ? 'text-cyan-300 font-bold' : 'text-rose-400 font-bold'}>
              {Math.round(stats.fuelMassKg / 1000)}t / {Math.round(stats.requiredFuelKg / 1000)}t
            </span>
          </div>
          <div className="h-1.5 bg-slate-800 rounded-full mt-1 overflow-hidden">
            <div
              className={`h-full ${stats.fuelPasses ? 'bg-cyan-400' : 'bg-rose-500'}`}
              style={{
                width: `${Math.min(100, (stats.fuelMassKg / Math.max(1, stats.requiredFuelKg)) * 75)}%`,
              }}
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between text-[11px] font-mono-tabular">
            <span className="text-slate-400">MASS / LIMIT</span>
            <span className={overMass ? 'text-rose-400' : 'text-cyan-300'}>
              {Math.round(stats.totalMassKg / 1000)}t / {Math.round(stats.massLimitKg / 1000)}t
            </span>
          </div>
          <div className="h-1.5 bg-slate-800 rounded-full mt-1 overflow-hidden">
            <div
              className={`h-full ${overMass ? 'bg-rose-500' : 'bg-cyan-400'}`}
              style={{ width: `${Math.min(100, (stats.totalMassKg / stats.massLimitKg) * 100)}%` }}
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between text-[11px] font-mono-tabular">
            <span className="text-slate-400">COST / BUDGET</span>
            <span className={overBudget ? 'text-rose-400' : 'text-emerald-300'}>
              ${stats.totalCostM}M / ${stats.budgetLimitM}M
            </span>
          </div>
          <div className="h-1.5 bg-slate-800 rounded-full mt-1 overflow-hidden">
            <div
              className={`h-full ${overBudget ? 'bg-rose-500' : 'bg-emerald-400'}`}
              style={{ width: `${Math.min(100, (stats.totalCostM / stats.budgetLimitM) * 100)}%` }}
            />
          </div>
        </div>

        <div className="col-span-2 sm:col-span-1">
          <div className="flex justify-between text-[11px] font-mono-tabular">
            <span className="text-slate-400">LIFTOFF TWR (9.81)</span>
            <span
              className={
                stats.launchTwr < 1.25 ? 'text-rose-400 font-bold' : 'text-emerald-300 font-bold'
              }
            >
              {stats.launchTwr.toFixed(2)}×
            </span>
          </div>
          <div className="h-1.5 bg-slate-800 rounded-full mt-1 overflow-hidden">
            <div
              className={`h-full ${stats.launchTwr < 1.25 ? 'bg-rose-500' : 'bg-emerald-400'}`}
              style={{ width: `${Math.min(100, (stats.launchTwr / 2.0) * 100)}%` }}
            />
          </div>
        </div>
      </div>
    </>
  );
}
