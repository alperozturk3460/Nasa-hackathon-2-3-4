import { BookOpen, Eye, EyeOff, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { SceneStage, WORLDS, WorldId } from '../data/missionData';

interface TopBarProps {
  stage: SceneStage;
  onStageChange: (stage: SceneStage) => void;
  targetWorldId: WorldId;
  audioEnabled: boolean;
  onToggleAudio: () => void;
  hudHidden: boolean;
  onToggleHud: () => void;
  onOpenGuide: () => void;
  onResetMission: () => void;
}

const STAGES: { id: SceneStage; label: string }[] = [
  { id: 'hangar', label: '2. Hangar' },
  { id: 'launch_pad', label: '3. Launch' },
  { id: 'journey', label: '4. Journey' },
];

export function TopBar({
  stage,
  onStageChange,
  targetWorldId,
  audioEnabled,
  onToggleAudio,
  hudHidden,
  onToggleHud,
  onOpenGuide,
  onResetMission,
}: TopBarProps) {
  const world = WORLDS[targetWorldId];

  return (
    <header className="relative z-30 flex items-center justify-between gap-4 px-5 h-14 bg-[#070b14]/95 border-b border-slate-800/90 select-none">
      {/* Zone 1: Brand */}
      <div className="flex items-center gap-3 min-w-0 shrink-0">
        <div className="w-7 h-7 rounded-md bg-rose-600 flex items-center justify-center font-display font-bold text-xs text-white tracking-wider">
          MF
        </div>
        <span className="font-display font-bold text-base tracking-wide text-slate-100 whitespace-nowrap">
          MissionForge
        </span>
        <span className="hidden xl:inline text-slate-600" aria-hidden="true">
          ·
        </span>
        <span className="hidden xl:inline text-xs font-mono-tabular text-cyan-300/90 truncate max-w-[220px]">
          {world.name} · {world.gravity} m/s²
        </span>
      </div>

      {/* Zone 2: 6-Scene Pipeline Navigation */}
      <nav
        aria-label="Mission Stages"
        className="flex items-center gap-1 bg-[#0b1222] border border-slate-800 rounded-lg p-1 overflow-x-auto mission-scroll"
      >
        {STAGES.map((item) => {
          const active = stage === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onStageChange(item.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                active
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/70'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Zone 3: Utilities & Field Guide */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onToggleHud}
          title="Toggle HUD visibility (H)"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-800 bg-[#0b1222] text-xs text-slate-300 hover:text-cyan-300 transition-colors whitespace-nowrap cursor-pointer"
        >
          {hudHidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          <span className="hidden sm:inline">{hudHidden ? 'Show HUD' : 'Hide HUD'}</span>
        </button>

        <button
          type="button"
          onClick={onToggleAudio}
          title="Toggle synthesized audio"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-800 bg-[#0b1222] text-xs text-slate-300 hover:text-cyan-300 transition-colors whitespace-nowrap cursor-pointer"
        >
          {audioEnabled ? <Volume2 className="w-3.5 h-3.5 text-cyan-400" /> : <VolumeX className="w-3.5 h-3.5" />}
          <span className="hidden md:inline">{audioEnabled ? 'Audio' : 'Muted'}</span>
        </button>

        <button
          type="button"
          onClick={onResetMission}
          title="Reset mission"
          className="p-1.5 rounded-md border border-slate-800 bg-[#0b1222] text-slate-400 hover:text-amber-300 transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={onOpenGuide}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-cyan-500/15 border border-cyan-500/40 text-xs font-medium text-cyan-200 hover:bg-cyan-500/25 transition-colors whitespace-nowrap cursor-pointer"
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Field Guide</span>
        </button>
      </div>
    </header>
  );
}
