import { useState } from "react";
import type { CSSProperties } from "react";
import { ChatKitPanel } from "./components/ChatKitPanel";

function PipelineNode({
  label,
  index,
  state,
}: {
  label: string;
  index: number;
  state: "idle" | "queued" | "active" | "complete";
}) {
  return (
    <div
      className={`pipeline-node pipeline-node-${state}`}
      style={{ "--i": index } as CSSProperties}
    >
      <div className="node-dot" />
      <span className="node-label">{label}</span>
    </div>
  );
}

const STAGES = ["INGEST", "PARSE", "ANALYZE", "REASON", "CLASSIFY"];

export default function App() {
  const [activeStageIndex, setActiveStageIndex] = useState(-1);

  const getNodeState = (index: number) => {
    if (activeStageIndex < 0) return "idle" as const;
    if (index < activeStageIndex) return "complete" as const;
    if (index === activeStageIndex) return "active" as const;
    return "queued" as const;
  };

  return (
    <main className="app-shell">
      <div className="grid-bg" />
      <div className="orb orb-1" />
      <div className="orb orb-2" />

      <div className="app-content">
        <header className="app-header">
          <img
            className="header-logo"
            src="/sail-gtx_logo_transparent_electric-blue.png"
            alt="SAIL GTX"
          />
          <div className="status-indicator">
            <span className="status-dot" />
            System Active
          </div>
        </header>

        <div className="main-body">
          <div className="pipeline">
            <div className="pipeline-track" />
            {STAGES.map((label, i) => (
              <PipelineNode
                key={label}
                label={label}
                index={i}
                state={getNodeState(i)}
              />
            ))}
          </div>

          <div className="interface-frame">
            <ChatKitPanel onStageChange={setActiveStageIndex} />
          </div>
        </div>

        <footer className="app-footer">
          SAIL GTX Inc. All rights reserved. &copy; {new Date().getFullYear()}
        </footer>
      </div>
    </main>
  );
}
