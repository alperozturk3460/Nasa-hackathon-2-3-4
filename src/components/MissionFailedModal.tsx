import { AlertOctagon, RotateCcw, Wrench } from 'lucide-react';
import { MissionFailureInfo } from '../data/missionData';

interface MissionFailedModalProps {
  failure: MissionFailureInfo | null;
  onReturnToHangar: () => void;
  onRetryStage: () => void;
}

export function MissionFailedModal({
  failure,
  onReturnToHangar,
  onRetryStage,
}: MissionFailedModalProps) {
  if (!failure) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="w-full max-w-lg bg-[#0d080c] border-2 border-rose-500 rounded-2xl overflow-hidden shadow-2xl">
        <div className="px-6 py-5 bg-rose-950/70 border-b border-rose-500/40 flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-rose-500/20 border border-rose-400/60 flex items-center justify-center shrink-0">
            <AlertOctagon className="w-6 h-6 text-rose-400" />
          </div>
          <div>
            <div className="text-[11px] font-mono-tabular uppercase tracking-widest text-rose-300">
              NASA Flight Termination Telemetry
            </div>
            <h2 className="font-display text-2xl font-extrabold tracking-wide text-white mt-0.5">
              {failure.title}
            </h2>
          </div>
        </div>

        <div className="px-6 py-5 space-y-3">
          <div className="font-display text-sm font-bold text-rose-200">{failure.subtitle}</div>
          <p className="text-xs text-slate-300 leading-relaxed bg-[#140c12] border border-rose-900/60 rounded-lg p-3.5 font-mono-tabular">
            {failure.detail}
          </p>

          <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onRetryStage}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>
                {failure.reason === 'underpowered_engine'
                  ? 'Reset Launch Pad'
                  : 'Replay Transit Failure'}
              </span>
            </button>

            <button
              type="button"
              onClick={onReturnToHangar}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-rose-500 hover:bg-rose-400 text-xs font-bold text-slate-950 cursor-pointer"
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>Return to Hangar (Upgrade Specs)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
