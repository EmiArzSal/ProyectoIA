"use client";

import { useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/utils";
import { litWordCount, spokenChars, tokenize } from "@/modules/call/karaoke";

/**
 * Characters of the message: before `from` already said; [from, to) is the
 * clip playing now, followed through the audio element's position.
 */
export type KaraokeRange = { from: number; to: number };

interface Props {
  text: string;
  /** Null when the interviewer is not speaking: every word is lit. */
  range: KaraokeRange | null;
  audio: HTMLAudioElement | null;
  className?: string;
}

const prefersReducedMotion = () =>
  typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * The interviewer's message with the words already said lit up, karaoke
 * style. The whole text is always visible, so the candidate can read ahead.
 */
export const KaraokeText = ({ text, range, audio, className }: Props) => {
  const tokens = useMemo(() => tokenize(text), [text]);
  const [lit, setLit] = useState(Number.POSITIVE_INFINITY);

  useEffect(() => {
    if (!range || prefersReducedMotion()) {
      setLit(Number.POSITIVE_INFINITY);
      return;
    }
    let raf = 0;
    const tick = () => {
      const spoken = audio ? spokenChars(range, audio.currentTime, audio.duration) : range.from;
      setLit(litWordCount(tokens, spoken)); // same count → no re-render
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [range, audio, tokens]);

  let word = 0;
  return (
    <p className={cn("text-base leading-relaxed", className)}>
      {/* Screen readers get the message once, not word by word. */}
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {tokens.map((t, i) => {
          if (!t.isWord) return t.text;
          const on = word++ < lit;
          return (
            <span
              key={i}
              className={cn("transition-colors duration-200", on ? "text-slate-100" : "text-slate-500")}
            >
              {t.text}
            </span>
          );
        })}
      </span>
    </p>
  );
};
