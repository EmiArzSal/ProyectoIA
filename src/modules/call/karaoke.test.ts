import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { clipRanges, litWordCount, spokenChars, tokenize } from "./karaoke";
import { joinClips } from "./interviewer-script";

describe("tokenize", () => {
  it("keeps words, spaces and their offsets", () => {
    assert.deepEqual(tokenize("Hi, I'm  Alex."), [
      { text: "Hi,", start: 0, isWord: true },
      { text: " ", start: 3, isWord: false },
      { text: "I'm", start: 4, isWord: true },
      { text: "  ", start: 7, isWord: false },
      { text: "Alex.", start: 9, isWord: true },
    ]);
  });

  it("rebuilds the exact text", () => {
    const text = " Thanks.  Next question? ";
    assert.equal(tokenize(text).map((t) => t.text).join(""), text);
  });

  it("returns nothing for empty text", () => {
    assert.deepEqual(tokenize(""), []);
  });
});

describe("clipRanges", () => {
  it("locates each clip inside the joined message", () => {
    const clips = [{ text: "Thanks for that." }, { text: "What is a closure?" }];
    const message = joinClips(clips);
    const ranges = clipRanges(clips);
    assert.deepEqual(ranges, [{ from: 0, to: 16 }, { from: 17, to: 35 }]);
    ranges.forEach((r, i) => assert.equal(message.slice(r.from, r.to), clips[i].text));
  });
});

describe("spokenChars", () => {
  const range = { from: 10, to: 30 };

  it("moves through the clip with the audio", () => {
    assert.equal(spokenChars(range, 0, 4), 10);
    assert.equal(spokenChars(range, 2, 4), 20);
    assert.equal(spokenChars(range, 4, 4), 30);
  });

  it("stays at the clip's start while the duration is unknown", () => {
    assert.equal(spokenChars(range, 1, NaN), 10);
    assert.equal(spokenChars(range, 1, Infinity), 10);
    assert.equal(spokenChars(range, 1, 0), 10);
  });

  it("never goes past the clip", () => {
    assert.equal(spokenChars(range, 9, 4), 30);
  });
});

describe("litWordCount", () => {
  const tokens = tokenize("One two three four");

  it("lights a word as soon as it starts", () => {
    assert.equal(litWordCount(tokens, 0), 0);
    assert.equal(litWordCount(tokens, 0.1), 1);
    assert.equal(litWordCount(tokens, 4), 1);
    assert.equal(litWordCount(tokens, 4.5), 2);
  });

  it("lights everything at the end", () => {
    assert.equal(litWordCount(tokens, Infinity), 4);
  });
});
