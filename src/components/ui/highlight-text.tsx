"use client";

import {
  type ComponentProps,
  type CSSProperties,
  useEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

export interface HighlightTextProps
  extends Omit<ComponentProps<"span">, "children"> {
  /** The wait before the marker starts, in milliseconds. @default 0 */
  delay?: number;
  /** How long the marker takes to cross the text, in milliseconds. @default 1000 */
  duration?: number;
  /**
   * The marker's colour, any CSS colour; keep it light enough for the text
   * to read on it.
   *
   * @default "color-mix(in oklab, var(--primary) 25%, transparent)"
   */
  highlightColor?: string;
  /** The text. */
  text: string;
  /**
   * When it draws: as soon as it's on the page, or once it scrolls into
   * view.
   *
   * @default "mount"
   */
  trigger?: "mount" | "view";
}

/** The marker by default: the theme's primary colour, light. */
const MARKER = "color-mix(in oklab, var(--primary) 25%, transparent)";

/**
 * Text marked with a highlighter that draws across it: a background the
 * `highlight-text` keyframes grow from nothing to the text's full width,
 * from where the text starts reading (the right, for Arabic or Hebrew). Each
 * line of wrapped text gets its own rounded mark. With reduced motion the
 * mark is simply there.
 *
 * @cssvar --highlight-text-color The marker's colour.
 * @cssvar --highlight-text-delay The wait before the marker starts (`0ms`).
 * @cssvar --highlight-text-duration The marker's stroke across the text (`1000ms`).
 */
export const HighlightText = (props: HighlightTextProps) => {
  const {
    delay,
    duration,
    highlightColor,
    text,
    trigger = "mount",
    className,
    ...rest
  } = props;
  const root = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(trigger === "mount");

  useEffect(() => {
    const node = root.current;
    if (trigger !== "view" || !node) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          setVisible(true);
        }
      },
      { threshold: 0.25 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [trigger]);

  return (
    <span
      className={cn("group/highlight-text", className)}
      data-slot="highlight-text"
      data-view={visible ? "in" : "out"}
      ref={root}
      {...rest}
    >
      <span
        className="-mx-[0.12em] animate-highlight-text whitespace-pre-line rounded-[0.2em] bg-[linear-gradient(var(--highlight-text-color),var(--highlight-text-color))] bg-left bg-size-[100%_100%] box-decoration-clone bg-no-repeat px-[0.12em] motion-reduce:animate-none forced-colors:bg-none group-data-[view=out]/highlight-text:[animation-play-state:paused] [&:dir(rtl)]:bg-right [@media(scripting:none)]:animate-none"
        data-slot="highlight-text-mark"
        dir="auto"
        style={
          {
            "--highlight-text-color": highlightColor ?? MARKER,
            "--highlight-text-delay":
              delay === undefined ? undefined : `${delay}ms`,
            "--highlight-text-duration":
              duration === undefined ? undefined : `${duration}ms`,
          } as CSSProperties
        }
      >
        {text}
      </span>
    </span>
  );
};
