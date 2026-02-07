import { useMemo, useState, useEffect, useRef } from "react";
import { ChatKit, useChatKit } from "@openai/chatkit-react";
import {
  createClientSecretFetcher,
  workflowId,
  workflowVersion,
} from "../lib/chatkitSession";
import { ProcessingHUD } from "./ProcessingHUD";

const STAGE_DURATION = 2200;
const STAGE_COUNT = 5;

interface ChatKitPanelProps {
  onStageChange?: (stageIndex: number) => void;
}

export function ChatKitPanel({ onStageChange }: ChatKitPanelProps) {
  const getClientSecret = useMemo(
    () => createClientSecretFetcher(workflowId, workflowVersion),
    []
  );

  const chatkit = useChatKit({
    api: { getClientSecret },
    theme: {
      colorScheme: "light",
      radius: "soft",
      density: "spacious",
      typography: {
        baseSize: 15,
        fontFamily: "Inter, system-ui, sans-serif",
      },
      color: {
        accent: { primary: "#353CED", level: 1 },
        grayscale: { hue: 237, tint: 1, shade: 0 },
        surface: { background: "#ffffff", foreground: "#353CED10",  },
      },
    },
    header: {
      enabled: true,
      title: { text: "" },
    },
    composer: {
      placeholder: "Enter product specification for analysis...",
    },
    startScreen: {
      greeting: "HTS Product Analysis Console",
    },
    threadItemActions: {
      feedback: true,
      retry: false,
    },
    history: {
      enabled: true,
      showDelete: true,
      showRename: true,
    },
  });

  const [hasMessages, setHasMessages] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const processingStartRef = useRef<number>(0);
  const stageTimerRef = useRef<number>(0);

  // Advance pipeline stages and notify parent
  useEffect(() => {
    if (!isProcessing) return;
    processingStartRef.current = Date.now();

    const interval = window.setInterval(() => {
      const dt = Date.now() - processingStartRef.current;
      const activeIndex = Math.min(
        Math.floor(dt / STAGE_DURATION),
        STAGE_COUNT - 1
      );
      onStageChange?.(activeIndex);
    }, 150);

    stageTimerRef.current = interval;
    return () => window.clearInterval(interval);
  }, [isProcessing, onStageChange]);

  // Reset pipeline on complete
  useEffect(() => {
    if (isComplete) {
      window.clearInterval(stageTimerRef.current);
      onStageChange?.(STAGE_COUNT); // all complete (index beyond last = all done)
    }
  }, [isComplete, onStageChange]);

  // Detect thread lifecycle via MutationObserver on the ChatKit DOM
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new MutationObserver(() => {
      const el = container.querySelector("openai-chatkit");
      if (!el) return;

      const threadItems = el.shadowRoot
        ? el.shadowRoot.querySelectorAll("[class*='thread-item'], [class*='message']")
        : el.querySelectorAll("[class*='thread-item'], [class*='message']");
      const msgCount = threadItems.length;

      if (msgCount > 0 && !hasMessages) {
        setHasMessages(true);
        setIsProcessing(true);
        setIsComplete(false);
      }

      const busyEl = el.shadowRoot
        ? el.shadowRoot.querySelector("[aria-busy='true'], [class*='streaming'], [class*='loading']")
        : el.querySelector("[aria-busy='true'], [class*='streaming'], [class*='loading']");

      if (hasMessages && isProcessing && !busyEl && msgCount > 1) {
        setIsProcessing(false);
        setIsComplete(true);
      }
    });

    observer.observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-busy", "class"],
    });

    return () => observer.disconnect();
  }, [hasMessages, isProcessing]);

  return (
    <div ref={containerRef} className="chatkit-console-wrapper">
      <ProcessingHUD isProcessing={isProcessing} isComplete={isComplete} />
      <ChatKit control={chatkit.control} className="chatkit-widget" />
    </div>
  );
}
