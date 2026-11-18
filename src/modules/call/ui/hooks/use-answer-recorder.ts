"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { toast } from "sonner";

import { TECH_TIMER_S } from "@/modules/call/constants";
import { pickRecorderMimeType, type Microphone } from "@/modules/call/ui/hooks/use-microphone";
import { IS_MOCK, MOCK_USER_ANSWERS } from "@/modules/call/ui/mock-session";
import type { Phase, UserTurnResult } from "@/modules/call/ui/session-types";

/**
 * The candidate's answer to one question: push-to-talk recording over the
 * interview's microphone stream, the per-question countdown (it starts when
 * recording starts) and skipping. `waitForAnswer` resolves once the answer is
 * sent, skipped or the countdown runs out.
 */
export function useAnswerRecorder({
  mic,
  phaseRef,
  setPhase,
  isStopping,
}: {
  mic: Microphone;
  phaseRef: RefObject<Phase>;
  setPhase: (p: Phase) => void;
  /** True once the interview is ending: recordings are discarded. */
  isStopping: () => boolean;
}) {
  const [secondsLeft, setSecondsLeft] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef   = useRef<Blob[]>([]);
  const timerRef         = useRef<ReturnType<typeof setInterval> | null>(null);
  // Seconds allowed for the current question.
  const timeLimitRef     = useRef(TECH_TIMER_S);
  const resolveRef       = useRef<((r: UserTurnResult) => void) | null>(null);
  // Set before stopping the recorder so onstop knows not to send the audio.
  const skipRecordingRef = useRef(false);
  const mockAnswerIdxRef = useRef(0);

  const clearTimer = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  const resolveAnswer = (result: UserTurnResult) => {
    const r = resolveRef.current;
    resolveRef.current = null;
    r?.(result);
  };

  /** Waits for the answer to the current question, allowed `timeLimit` seconds once recording. */
  const waitForAnswer = (timeLimit: number): Promise<UserTurnResult> => {
    timeLimitRef.current = timeLimit;
    return new Promise((resolve) => { resolveRef.current = resolve; });
  };

  const startCountdown = () => {
    let remaining = timeLimitRef.current;
    setSecondsLeft(remaining);

    timerRef.current = setInterval(() => {
      remaining -= 1;
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        clearTimer();
        // Time is up for this question: send what was recorded.
        if (phaseRef.current === "recording") mediaRecorderRef.current?.stop();
      }
    }, 1000);
  };

  // A new recorder per answer over the interview's single microphone stream.
  const createRecorder = (stream: MediaStream) => {
    audioChunksRef.current = [];
    const mimeType = pickRecorderMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      clearTimer();

      if (skipRecordingRef.current) {
        skipRecordingRef.current = false;
        resolveAnswer({ audio: null, skipped: true });
        return;
      }

      if (isStopping() || phaseRef.current === "done") return;

      // Use the recorder's real MIME type (Safari records audio/mp4, not webm).
      const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
      resolveAnswer({ audio: blob, skipped: false });
    };

    recorder.start();
    return recorder;
  };

  const startRecording = async () => {
    if (phaseRef.current !== "user-turn") return;

    // Mock: auto-answer after 1.5 s, no microphone needed.
    if (IS_MOCK) {
      setPhase("recording");
      startCountdown();
      setTimeout(() => {
        if (isStopping()) return;
        clearTimer();
        const answer = MOCK_USER_ANSWERS[mockAnswerIdxRef.current % MOCK_USER_ANSWERS.length];
        mockAnswerIdxRef.current++;
        resolveAnswer({ audio: null, skipped: false, mockText: answer });
      }, 1500);
      return;
    }

    const stream = await mic.getStream();
    if (!stream) {
      toast.error("No se pudo acceder al micrófono. Usa \"Reconectar micrófono\" e inténtalo de nuevo.");
      return;
    }
    // The turn may have ended (skip, time up) while the microphone reopened.
    if (phaseRef.current !== "user-turn") return;

    let recorder: MediaRecorder;
    try {
      recorder = createRecorder(stream);
    } catch {
      // Some browsers (Safari) refuse a new recorder on a reused stream: reopen once.
      const fresh = await mic.acquire();
      try {
        if (!fresh || phaseRef.current !== "user-turn") throw new Error("no stream");
        recorder = createRecorder(fresh);
      } catch {
        toast.error("No se pudo grabar con tu micrófono. Usa \"Reconectar micrófono\" e inténtalo de nuevo.");
        return;
      }
    }

    mediaRecorderRef.current = recorder;
    setPhase("recording");
    startCountdown(); // the question's timer starts with the recording
  };

  /** Sends what was recorded. */
  const stopRecording = () => {
    if (phaseRef.current !== "recording") return;
    clearTimer();
    mediaRecorderRef.current?.stop();
  };

  const skip = () => {
    clearTimer();
    if (phaseRef.current === "recording") {
      skipRecordingRef.current = true;
      mediaRecorderRef.current?.stop();
    } else if (phaseRef.current === "user-turn") {
      resolveAnswer({ audio: null, skipped: true });
    }
  };

  /** The whole interview's time ran out mid-answer: send what was recorded. */
  const sendNowForTimeUp = () => {
    clearTimer();
    mediaRecorderRef.current?.stop();
  };

  /** The interview is ending: discard any answer in progress. */
  const abort = async () => {
    clearTimer();
    resolveAnswer({ audio: null, skipped: true });
    if (mediaRecorderRef.current?.state === "recording") {
      skipRecordingRef.current = true;
      mediaRecorderRef.current.stop();
      await new Promise<void>((r) => setTimeout(r, 300));
    }
  };

  useEffect(() => () => clearTimer(), []);

  return {
    secondsLeft,
    /** Seconds allowed for the current question (shown dimmed before recording). */
    timeLimit: timeLimitRef.current,
    waitForAnswer,
    startRecording,
    stopRecording,
    skip,
    sendNowForTimeUp,
    abort,
  };
}

export type AnswerRecorder = ReturnType<typeof useAnswerRecorder>;
