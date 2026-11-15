import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GuideModal } from './components/GuideModal';
import { HangarOverlay } from './components/HangarOverlay';
import { JourneyOverlay } from './components/JourneyOverlay';
import { LaunchOverlay } from './components/LaunchOverlay';
import { MissionFailedModal } from './components/MissionFailedModal';
import { TopBar } from './components/TopBar';
import {
  computeCraftStats,
  DEFAULT_HANGAR_CONFIG,
  EngineId,
  FuelOptionId,
  HangarConfig,
  JourneyWarpSpeed,
  MissionFailureInfo,
  PowerSourceId,
  SceneStage,
  WorldId,
} from './data/missionData';
import {
  LaunchTelemetry,
  MissionWorldEngine,
} from './three/MissionWorldEngine';
import { missionAudio } from './utils/audio';

const INITIAL_LAUNCH_TELEMETRY: LaunchTelemetry = {
  phase: 'pad',
  countdownValue: 5,
  altitudeKm: 0,
  velocityKmh: 0,
  accelG: 1.0,
  fuelPct: 100,
  stageLabel: 'PRE-LAUNCH PAD HOLD',
  sepVelocityMs: 0,
};

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<MissionWorldEngine | null>(null);

  const [stage, setStage] = useState<SceneStage>('hangar');
  const [targetWorldId, setTargetWorldId] = useState<WorldId>('moon');
  const [hangarConfig, setHangarConfig] = useState<HangarConfig>({ ...DEFAULT_HANGAR_CONFIG });
  const [turntablePaused, setTurntablePaused] = useState(false);

  const [launchTelemetry, setLaunchTelemetry] = useState<LaunchTelemetry>(INITIAL_LAUNCH_TELEMETRY);
  const [journeyProgress, setJourneyProgress] = useState(0);
  const [journeyFuelPct, setJourneyFuelPct] = useState(100);
  const [journeyWarp, setJourneyWarp] = useState<JourneyWarpSpeed>(1000);
  const [missionFailure, setMissionFailure] = useState<MissionFailureInfo | null>(null);

  const [audioEnabled, setAudioEnabled] = useState(false);
  const [hudHidden, setHudHidden] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [webglError, setWebglError] = useState(false);

  const craftStats = useMemo(
    () => computeCraftStats(hangarConfig, targetWorldId),
    [hangarConfig, targetWorldId]
  );

  const switchStage = useCallback(
    (nextStage: SceneStage) => {
      missionAudio.playClick();
      setMissionFailure(null);
      setStage(nextStage);
      if (nextStage === 'journey') {
        setJourneyProgress(0);
        setJourneyFuelPct(100);
        engineRef.current?.setJourneySpeed(journeyWarp);
      }
      engineRef.current?.setStage(nextStage);
    },
    [journeyWarp]
  );

  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    try {
      const engine = new MissionWorldEngine(
        mount,
        hangarConfig,
        craftStats,
        targetWorldId,
        {
          onWorldSelect: (wId) => {
            setTargetWorldId(wId);
          },
          onWorldHover: () => {},
          onLaunchTelemetry: (t) => {
            setLaunchTelemetry(t);
          },
          onLaunchComplete: () => {
            setMissionFailure(null);
            setStage('journey');
            setJourneyProgress(0);
            setJourneyFuelPct(100);
            engine.setStage('journey');
          },
          onMissionFailed: (failure) => {
            setMissionFailure(failure);
          },
          onJourneyProgress: (pct) => {
            setJourneyProgress(pct);
          },
          onJourneyFuelUpdate: (fuelPct) => {
            setJourneyFuelPct(fuelPct);
          },
          onJourneyComplete: () => {
            // Stage 5 will be integrated by teammates
          },
        }
      );

      const canvas = mount.querySelector('canvas');
      const handleLost = (e: Event) => {
        e.preventDefault();
        setWebglError(true);
      };
      const handleRestored = () => setWebglError(false);
      canvas?.addEventListener('webglcontextlost', handleLost);
      canvas?.addEventListener('webglcontextrestored', handleRestored);

      engineRef.current = engine;

      return () => {
        canvas?.removeEventListener('webglcontextlost', handleLost);
        canvas?.removeEventListener('webglcontextrestored', handleRestored);
        engine.dispose();
        engineRef.current = null;
      };
    } catch {
      setWebglError(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateConfig = useCallback(
    (patch: Partial<HangarConfig>) => {
      missionAudio.playSnap();
      setMissionFailure(null);
      const next = { ...hangarConfig, ...patch };
      setHangarConfig(next);
      const nextStats = computeCraftStats(next, targetWorldId);
      engineRef.current?.updateHangarConfig(next, nextStats);
    },
    [hangarConfig, targetWorldId]
  );

  // Keyboard shortcut: H for HUD visibility toggle
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (guideOpen || missionFailure) return;

      if (e.code === 'KeyH') {
        setHudHidden((prev) => !prev);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [guideOpen, missionFailure]);

  const handleResetMission = useCallback(() => {
    missionAudio.playClick();
    setMissionFailure(null);
    setHangarConfig({ ...DEFAULT_HANGAR_CONFIG });
    setTargetWorldId('moon');
    setJourneyWarp(1000);
    setJourneyProgress(0);
    setJourneyFuelPct(100);
    setLaunchTelemetry(INITIAL_LAUNCH_TELEMETRY);
    setStage('hangar');
    const nextStats = computeCraftStats(DEFAULT_HANGAR_CONFIG, 'moon');
    engineRef.current?.setJourneySpeed(1000);
    engineRef.current?.updateHangarConfig(DEFAULT_HANGAR_CONFIG, nextStats);
    engineRef.current?.focusWorld('moon');
    engineRef.current?.setStage('hangar');
  }, []);

  return (
    <div className="relative w-screen h-screen flex flex-col bg-[#03050c] text-slate-100 overflow-hidden">
      <TopBar
        stage={stage}
        onStageChange={switchStage}
        targetWorldId={targetWorldId}
        audioEnabled={audioEnabled}
        onToggleAudio={() => {
          const next = !audioEnabled;
          setAudioEnabled(next);
          missionAudio.setEnabled(next);
        }}
        hudHidden={hudHidden}
        onToggleHud={() => setHudHidden((prev) => !prev)}
        onOpenGuide={() => {
          missionAudio.playClick();
          setGuideOpen(true);
        }}
        onResetMission={handleResetMission}
      />

      <main className="relative flex-1 w-full h-full overflow-hidden">
        {/* Isolated WebGL Mount Container */}
        <div ref={canvasMountRef} className="absolute inset-0 w-full h-full" />

        {webglError && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#060911] p-6 text-center">
            <div className="max-w-md bg-[#0b1222] border border-slate-800 rounded-xl p-6">
              <h2 className="font-display text-lg font-bold text-white">
                3D Graphics Context Unavailable
              </h2>
              <p className="text-xs text-slate-400 mt-2">
                WebGL rendering was interrupted. Reload the page to reinitialize MissionForge.
              </p>
            </div>
          </div>
        )}

        {!hudHidden && stage === 'hangar' && (
          <HangarOverlay
            targetWorldId={targetWorldId}
            config={hangarConfig}
            stats={craftStats}
            turntablePaused={turntablePaused}
            onChangeEngineId={(id: EngineId) => updateConfig({ engineId: id })}
            onChangeFuelId={(id: FuelOptionId) => updateConfig({ fuelId: id })}
            onChangePowerSource={(id: PowerSourceId) => updateConfig({ powerSource: id })}
            onToggleTurntable={() => {
              const next = !turntablePaused;
              setTurntablePaused(next);
              engineRef.current?.setTurntablePaused(next);
            }}
            onProceedToLaunch={() => switchStage('launch_pad')}
          />
        )}

        {!hudHidden && stage === 'launch_pad' && (
          <LaunchOverlay
            targetWorldId={targetWorldId}
            stats={craftStats}
            telemetry={launchTelemetry}
            onStartCountdown={() => engineRef.current?.startCountdown()}
            onResetPad={() => engineRef.current?.resetLaunchState()}
            onSkipToJourney={() => switchStage('journey')}
            onReturnHangar={() => switchStage('hangar')}
          />
        )}

        {!hudHidden && stage === 'journey' && (
          <JourneyOverlay
            targetWorldId={targetWorldId}
            progressPct={journeyProgress}
            fuelPct={journeyFuelPct}
            fuelPasses={craftStats.fuelPasses}
            warpSpeed={journeyWarp}
            onChangeWarpSpeed={(speed) => {
              missionAudio.playClick();
              setJourneyWarp(speed);
              engineRef.current?.setJourneySpeed(speed);
            }}
          />
        )}

        {hudHidden && (
          <div className="pointer-events-auto absolute bottom-4 left-1/2 -translate-x-1/2 z-30">
            <button
              type="button"
              onClick={() => setHudHidden(false)}
              className="px-4 py-2 rounded-lg bg-[#080d1a]/92 border border-cyan-500/40 text-xs font-medium text-cyan-200 hover:bg-cyan-500/20 cursor-pointer"
            >
              Show HUD [H]
            </button>
          </div>
        )}
      </main>

      <MissionFailedModal
        failure={missionFailure}
        onReturnToHangar={() => switchStage('hangar')}
        onRetryStage={() => {
          missionAudio.playClick();
          const reason = missionFailure?.reason;
          setMissionFailure(null);
          if (reason === 'underpowered_engine') {
            engineRef.current?.resetLaunchState();
          } else {
            setJourneyProgress(0);
            setJourneyFuelPct(100);
            engineRef.current?.setStage('journey');
          }
        }}
      />

      <GuideModal open={guideOpen} onClose={() => setGuideOpen(false)} />
    </div>
  );
}
