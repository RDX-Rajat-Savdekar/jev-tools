"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ScriptedUtterance } from "@/lib/transcript-fixtures";
import { partialAt } from "@/lib/transcript-fixtures";
import type { AsrChunk } from "./useSpeechRecognition";

export function useScriptedTranscript(
  utterance: ScriptedUtterance | null,
  onChunk: (chunk: AsrChunk) => void,
) {
  const [playing, setPlaying] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onChunkRef = useRef(onChunk);
  onChunkRef.current = onChunk;

  const stop = useCallback(() => {
    if (timerRef.current != null) clearInterval(timerRef.current);
    timerRef.current = null;
    setPlaying(false);
  }, []);

  const start = useCallback(() => {
    if (!utterance) return;
    stop();
    setPlaying(true);
    const t0 = Date.now();
    let lastText = "";
    let finalized = false;

    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - t0;
      const { text, isFinal } = partialAt(utterance, elapsed);
      if (text !== lastText || (isFinal && !finalized)) {
        lastText = text;
        onChunkRef.current({
          text,
          isFinal,
          timestamp: Date.now(),
        });
        if (isFinal) {
          finalized = true;
          stop();
        }
      }
    }, 50);
  }, [utterance, stop]);

  useEffect(() => () => stop(), [stop]);

  return { playing, start, stop };
}
