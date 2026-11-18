"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { TOTAL_QUESTIONS } from "@/modules/call/constants";
import {
  CLOSING_AUDIO_URL,
  introAudioUrl,
  introText,
  type Clip,
} from "@/modules/call/interviewer-script";
import { clipRanges } from "@/modules/call/karaoke";
import type { KaraokeRange } from "@/modules/call/ui/components/karaoke-text";
import { IS_MOCK } from "@/modules/call/ui/mock-session";
import { requestSpeech } from "@/modules/call/ui/session-api";
import type { AgentTurn, PlayOutcome } from "@/modules/call/ui/session-types";

// Local file: testing the speakers costs no API call.
const TEST_SOUND_URL = "/sounds/mic-check.mp3";

type Interviewer = { id: string; interviewerName: string; role: string };

/**
 * The interviewer's voice: one audio element for the whole interview, the
 * clips of each message played in order (fixed greeting and closing from
 * /public, the next question prefetched while the candidate answers), and the
 * karaoke highlight that follows them.
 *
 * The audio element is first played inside a click (speaker test or
 * "Iniciar entrevista"), which unlocks it for the rest of the interview in
 * browsers with strict autoplay rules (Safari).
 */
export function useInterviewerVoice({
  meetingId,
  agent,
  shouldStop,
}: {
  meetingId: string;
  agent: Interviewer;
  /** True once the interview is ending or the page is gone: stop between clips. */
  shouldStop: () => boolean;
}) {
  // Part of the message being spoken (karaoke highlight); null = not speaking.
  const [karaoke, setKaraoke] = useState<KaraokeRange | null>(null);

  const audioElRef         = useRef<HTMLAudioElement | null>(null);
  const audioWarnedRef     = useRef(false);
  // Resolves the playback in progress, so stopAudio can end it.
  const playbackResolveRef = useRef<((outcome: PlayOutcome) => void) | null>(null);
  // Audio of plan questions, fetched while the candidate answers the previous one.
  const questionAudioRef   = useRef(new Map<number, Promise<string | null>>());
  const objectUrlsRef      = useRef<string[]>([]);

  const getAudioEl = () => (audioElRef.current ??= new Audio());

  /** Plays `url` to the end. Resolves "blocked" if the browser refused to play. */
  const playUrl = (url: string) =>
    new Promise<PlayOutcome>((resolve) => {
      playbackResolveRef.current?.("stopped"); // a new clip replaces the previous one
      playbackResolveRef.current = resolve;
      const audio = getAudioEl();
      audio.muted = false;
      audio.onended = () => resolve("ended");
      audio.onerror = () => resolve("error");
      audio.src = url;
      audio.play().catch((err: unknown) =>
        resolve(err instanceof DOMException && err.name === "NotAllowedError" ? "blocked" : "error"));
    });

  const playTestSound = async () => (await playUrl(TEST_SOUND_URL)) === "ended";

  /** Silences the interviewer; the playback in progress resolves "stopped". */
  const stopAudio = () => {
    const audio = audioElRef.current;
    if (audio) {
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
    }
    playbackResolveRef.current?.("stopped");
    playbackResolveRef.current = null;
    setKaraoke(null);
  };

  /** Plays one clip while highlighting the characters `range` of the message. */
  const speak = (url: string, range: KaraokeRange) => {
    const playback = playUrl(url); // sets the new src first, so the highlight starts from 0
    setKaraoke(range);
    return playback;
  };

  const warnAudioBlocked = () => {
    if (audioWarnedRef.current) return;
    audioWarnedRef.current = true;
    toast.warning("Tu navegador bloqueó el audio del entrevistador. Puedes leer las preguntas en pantalla.");
  };

  // Mock mode, inside the "Iniciar entrevista" click: a muted play unlocks the
  // element. Real interviews unlock it by playing the greeting in that click.
  const unlockAudio = () => {
    const audio = getAudioEl();
    audio.muted = true;
    audio.src = TEST_SOUND_URL;
    audio.play().then(() => audio.pause(), () => {}).finally(() => { audio.muted = false; });
  };

  const fetchSpeech = async (body: { part: Clip["kind"]; index?: number }): Promise<string | null> => {
    const blob = await requestSpeech(meetingId, body);
    if (!blob) return null;
    const url = URL.createObjectURL(blob);
    objectUrlsRef.current.push(url);
    return url;
  };

  /** Starts fetching a question's audio so it is ready when it is asked. */
  const prefetchQuestion = (index: number) => {
    if (IS_MOCK || index < 0 || index >= TOTAL_QUESTIONS) return;
    const cache = questionAudioRef.current;
    if (!cache.has(index)) cache.set(index, fetchSpeech({ part: "question", index }));
  };

  const questionAudio = async (index: number) => {
    const prefetched = await questionAudioRef.current.get(index);
    return prefetched ?? fetchSpeech({ part: "question", index });
  };

  const clipSource = (clip: Clip): Promise<string | null> => {
    switch (clip.kind) {
      case "intro":    return Promise.resolve(introAudioUrl(agent.id));
      case "closing":  return Promise.resolve(CLOSING_AUDIO_URL);
      case "ack":      return fetchSpeech({ part: "ack" });
      case "question": return questionAudio(clip.index);
    }
  };

  /**
   * Speaks the interviewer's message clip by clip. Every clip starts loading
   * at once (the question is usually prefetched already), so the next one is
   * ready when the previous ends. `startAt` skips clips already played.
   */
  const playAgentTurn = async (turn: AgentTurn, startAt = 0): Promise<void> => {
    if (IS_MOCK) {
      await new Promise<void>((r) => setTimeout(r, 300));
      return;
    }
    const ranges = clipRanges(turn.clips);
    const sources = turn.clips.map((clip, i) => ({
      clip,
      range: ranges[i],
      url: i >= startAt ? clipSource(clip) : null,
    }));
    for (const { clip, range, url } of sources.slice(startAt)) {
      if (shouldStop()) return;
      setKaraoke({ from: range.from, to: range.from }); // earlier clips lit while this one loads
      const src = await url;
      let outcome = src ? await speak(src, range) : "error";
      // A pre-recorded file that is missing: generate it instead.
      if (outcome === "error" && (clip.kind === "intro" || clip.kind === "closing")) {
        const generated = await fetchSpeech({ part: clip.kind });
        if (generated && !shouldStop()) outcome = await speak(generated, range);
      }
      if (outcome === "stopped") return;
      if (outcome === "blocked") {
        warnAudioBlocked();
        break;
      }
    }
    setKaraoke(null);
  };

  /**
   * Starts the pre-recorded greeting. Must be called inside the click that
   * starts the interview: it unlocks the audio element, and it covers the
   * time the server takes to write the question plan. Null in mock mode.
   */
  const startGreeting = (): Promise<PlayOutcome> | null => {
    if (IS_MOCK) {
      unlockAudio();
      return null;
    }
    return speak(introAudioUrl(agent.id), { from: 0, to: introText(agent).length });
  };

  /** Waits for the greeting started in the click, then speaks the rest of the intro (question 1). */
  const finishIntro = async (greeting: Promise<PlayOutcome> | null, intro: AgentTurn) => {
    let greeted = greeting ? await greeting : "ended";
    if (greeted === "error" && !shouldStop()) {
      // The pre-recorded file is missing: generate the greeting instead.
      const generated = await fetchSpeech({ part: "intro" });
      if (generated && !shouldStop()) greeted = await speak(generated, clipRanges(intro.clips)[0]);
    }
    if (shouldStop()) return;
    if (greeted === "blocked") {
      warnAudioBlocked();
      setKaraoke(null);
      return;
    }
    await playAgentTurn(intro, 1); // the greeting was clip 0
  };

  // Free the generated clips when leaving the page. StrictMode's simulated
  // remount in development happens before any clip exists.
  useEffect(() => () => {
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    objectUrlsRef.current = [];
  }, []);

  return {
    karaoke,
    /** The element the interviewer speaks through (null before the first clip). */
    audioElement: audioElRef.current,
    playTestSound,
    startGreeting,
    finishIntro,
    playAgentTurn,
    prefetchQuestion,
    stopAudio,
  };
}

export type InterviewerVoice = ReturnType<typeof useInterviewerVoice>;
