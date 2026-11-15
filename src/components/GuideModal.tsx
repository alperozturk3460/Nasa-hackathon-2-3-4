import { X } from 'lucide-react';

interface GuideModalProps {
  open: boolean;
  onClose: () => void;
}

export function GuideModal({ open, onClose }: GuideModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="w-full max-w-2xl bg-[#090f1d] border border-slate-700 rounded-xl overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-100">
              MissionForge NASA Science Field Guide
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Space Engineering, Launch &amp; Deep-Space Transfer Reference
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3 max-h-[75vh] overflow-y-auto mission-scroll text-xs text-slate-300 leading-relaxed">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-lg bg-[#0d1527] border border-slate-800">
              <div className="font-display font-semibold text-cyan-300 text-sm">
                2. Hangar — Engine Thrust &amp; Propellant Mass
              </div>
              <p className="mt-1.5">
                Use the <span className="font-mono-tabular text-amber-300 font-bold">!</span> info
                buttons in the Hangar to check required liftoff thrust (2,500 kN nominal) and target
                planet propellant mass. Underpowered engines fail atmospheric escape and crash;
                short fuel runs dry in deep space. Excess fuel increases mass and raises required
                engine thrust!
              </p>
            </div>

            <div className="p-3.5 rounded-lg bg-[#0d1527] border border-slate-800">
              <div className="font-display font-semibold text-amber-300 text-sm">
                Solar Flux vs. Nuclear RTG
              </div>
              <p className="mt-1.5">
                Sunlight weakens with distance squared: 100% at Earth/Moon, 43% at Mars, and just{' '}
                <span className="font-mono-tabular text-rose-300">4%</span> at Jupiter. Outer
                missions require a Nuclear Stirling RTG.
              </p>
            </div>

            <div className="p-3.5 rounded-lg bg-[#0d1527] border border-slate-800">
              <div className="font-display font-semibold text-emerald-300 text-sm">
                3. Launch &amp; 4. Deep-Space Journey
              </div>
              <p className="mt-1.5">
                Initiate the T-5 countdown on the launch pad to clear Max-Q, separate SRB boosters,
                and deploy the spacecraft on its interplanetary transfer trajectory with adjustable
                Time-Warp multipliers.
              </p>
            </div>

            <div className="p-3.5 rounded-lg bg-[#0d1527] border border-slate-800">
              <div className="font-display font-semibold text-sky-300 text-sm">
                Controls &amp; Shortcuts
              </div>
              <ul className="mt-1.5 space-y-1">
                <li>
                  <span className="font-mono-tabular text-white">Camera Orbit:</span> Drag to orbit,
                  scroll to zoom in Hangar.
                </li>
                <li>
                  <span className="font-mono-tabular text-white">Time Warp:</span> Switch between
                  1×, 1000×, 2000×, and 10000× during Journey.
                </li>
                <li>
                  <span className="font-mono-tabular text-white">HUD Toggle:</span> Press{' '}
                  <span className="font-mono-tabular text-white">H</span> anytime.
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-xs font-semibold text-white cursor-pointer"
          >
            Back to MissionForge
          </button>
        </div>
      </div>
    </div>
  );
}
