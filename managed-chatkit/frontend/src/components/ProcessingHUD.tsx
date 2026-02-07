import { useEffect, useState, useRef } from "react";

type StageState = "queued" | "active" | "complete";

interface HUDStage {
  label: string;
  state: StageState;
}

interface ProcessingHUDProps {
  isProcessing: boolean;
  isComplete: boolean;
}

const STAGE_LABELS = ["INGEST", "PARSE", "ANALYZE", "REASON", "CLASSIFY"];
const STAGE_DURATION = 2200; // ms per stage simulation

export function ProcessingHUD({ isProcessing, isComplete }: ProcessingHUDProps) {
  const [stages, setStages] = useState<HUDStage[]>(
    STAGE_LABELS.map((label) => ({ label, state: "queued" }))
  );
  const [elapsed, setElapsed] = useState(0);
  const [tokenCount, setTokenCount] = useState(0);
  const [runId] = useState(() => `RUN-${Date.now().toString(36).toUpperCase()}`);
  const startRef = useRef<number>(0);
  const timerRef = useRef<number>(0);

  // Advance stages over time while processing
  useEffect(() => {
    if (!isProcessing) return;
    startRef.current = Date.now();

    const interval = window.setInterval(() => {
      const dt = Date.now() - startRef.current;
      setElapsed(dt);
      setTokenCount(Math.floor(dt / 18));

      const activeIndex = Math.min(
        Math.floor(dt / STAGE_DURATION),
        STAGE_LABELS.length - 1
      );
      setStages(
        STAGE_LABELS.map((label, i) => ({
          label,
          state: i < activeIndex ? "complete" : i === activeIndex ? "active" : "queued",
        }))
      );
    }, 150);

    timerRef.current = interval;
    return () => window.clearInterval(interval);
  }, [isProcessing]);

  // Mark all complete when done
  useEffect(() => {
    if (isComplete) {
      window.clearInterval(timerRef.current);
      setStages(STAGE_LABELS.map((label) => ({ label, state: "complete" })));
    }
  }, [isComplete]);

  if (!isProcessing && !isComplete) return null;

  const allDone = stages.every((s) => s.state === "complete");

  return (
    <div className={`processing-hud ${allDone ? "hud-complete" : ""}`}>
      {!allDone && <div className="hud-databus" />}

      <div className="hud-header">
        <span className="hud-run-id">{runId}</span>
        <span className={`hud-status-badge ${allDone ? "badge-done" : "badge-active"}`}>
          {allDone ? "RUN COMPLETED" : "PROCESSING"}
        </span>
      </div>

      <div className="hud-timeline">
        {stages.map((stage) => (
          <div key={stage.label} className={`hud-stage hud-stage-${stage.state}`}>
            <div className="hud-stage-indicator" />
            <span className="hud-stage-label">{stage.label}</span>
          </div>
        ))}
      </div>

      <div className="hud-telemetry">
        <div className="hud-tel-item">
          <span className="hud-tel-key">stream</span>
          <span className={`hud-tel-val ${!allDone ? "tel-active" : ""}`}>
            {allDone ? "idle" : "active"}
          </span>
        </div>
        <div className="hud-tel-item">
          <span className="hud-tel-key">latency</span>
          <span className="hud-tel-val">{elapsed}ms</span>
        </div>
        <div className="hud-tel-item">
          <span className="hud-tel-key">tokens</span>
          <span className="hud-tel-val">{tokenCount}</span>
        </div>
        <div className="hud-tel-item">
          <span className="hud-tel-key">artifacts</span>
          <span className={`hud-tel-val ${!allDone ? "tel-active" : ""}`}>
            {allDone ? "ready" : "generating"}
          </span>
        </div>
      </div>
    </div>
  );
}
