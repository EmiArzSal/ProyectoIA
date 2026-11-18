// Pure helpers for the karaoke highlight of the interviewer's message: which
// words have been said, estimated from how far each clip's audio has played.
// TTS gives no word timestamps, but the interviewer's voice keeps a steady
// pace, so a word's position in its clip's text tracks its time in the audio
// closely enough. Tested in karaoke.test.ts.

export type Token = { text: string; start: number; isWord: boolean };

/** Splits text into words and the whitespace between them, keeping character offsets. */
export function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let start = 0;
  for (const part of text.split(/(\s+)/)) {
    if (part) tokens.push({ text: part, start, isWord: !/^\s+$/.test(part) });
    start += part.length;
  }
  return tokens;
}

/**
 * Character range of each clip inside the full message (clips are joined
 * with one space, see joinClips).
 */
export function clipRanges(clips: { text: string }[]): { from: number; to: number }[] {
  let offset = 0;
  return clips.map(({ text }) => {
    const range = { from: offset, to: offset + text.length };
    offset = range.to + 1;
    return range;
  });
}

/**
 * Characters of the message said so far while a clip covering [from, to)
 * plays. `fraction` is the clip's playback position (0–1); unknown durations
 * count as the clip's start.
 */
export function spokenChars(range: { from: number; to: number }, currentTime: number, duration: number): number {
  const fraction = Number.isFinite(duration) && duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0;
  return range.from + (range.to - range.from) * fraction;
}

/** Number of words lit: a word lights up as soon as it starts being said. */
export function litWordCount(tokens: Token[], spoken: number): number {
  let lit = 0;
  for (const t of tokens) {
    if (!t.isWord) continue;
    if (t.start < spoken) lit++;
    else break;
  }
  return lit;
}
