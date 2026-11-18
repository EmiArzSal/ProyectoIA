import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { lookupDictionary, validateWord } from "./lookup";

type Call = { url: string };

/** A fake fetch that answers by URL prefix and records what was requested. */
const fakeFetch = (routes: Record<string, () => Response | Promise<Response>>) => {
  const calls: Call[] = [];
  const fetcher = async (input: string | URL) => {
    const url = input.toString();
    calls.push({ url });
    const match = Object.keys(routes).find((prefix) => url.startsWith(prefix));
    if (!match) throw new Error(`unexpected request: ${url}`);
    return routes[match]();
  };
  return { fetcher, calls };
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const DICT = "https://api.dictionaryapi.dev/api/v2/entries/en/";
const COMMONS = "https://commons.wikimedia.org/w/api.php";

const guitarEntry = {
  word: "guitar",
  phonetics: [
    { text: "/ɡɪˈtɑː/", audio: "", sourceUrl: "" },
    {
      text: "/ɡɪˈtɑɹ/",
      audio: "https://api.dictionaryapi.dev/media/pronunciations/en/guitar-us.mp3",
      sourceUrl: "https://commons.wikimedia.org/w/index.php?curid=123",
    },
  ],
  meanings: [
    { partOfSpeech: "noun", definitions: [{ definition: "A stringed musical instrument.", example: "She plays the guitar." }] },
    { partOfSpeech: "verb", definitions: [{ definition: "To play the guitar." }] },
  ],
};

describe("validateWord", () => {
  it("trims and accepts words, phrases and tech terms", () => {
    assert.deepEqual(validateWord("  guitar "), { ok: true, word: "guitar" });
    for (const w of ["machine learning", "C#", "Node.js", "don't", "front-end"]) {
      assert.equal(validateWord(w).ok, true, w);
    }
  });

  it("rejects empty, symbol-only and overly long input", () => {
    assert.equal(validateWord("   ").ok, false);
    assert.equal(validateWord("<script>").ok, false);
    assert.equal(validateWord("---").ok, false);
    assert.equal(validateWord("a".repeat(101)).ok, false);
  });
});

describe("lookupDictionary", () => {
  it("returns definitions, phonetic and the resolved Wikimedia audio", async () => {
    const { fetcher, calls } = fakeFetch({
      [DICT]: () => json([guitarEntry]),
      [COMMONS]: () => json({ query: { pages: { 123: { imageinfo: [{ url: "https://upload.wikimedia.org/a/guitar.ogg" }] } } } }),
    });
    const result = await lookupDictionary("Guitar", fetcher);

    assert.equal(result.error, undefined);
    assert.equal(result.found, true);
    assert.deepEqual(result.results.map((r) => r.partOfSpeech), ["noun", "verb"]);
    assert.equal(result.results[0].example, "She plays the guitar.");
    assert.equal(result.phonetic, "/ɡɪˈtɑː/");
    assert.equal(result.audioUrl, "https://upload.wikimedia.org/a/guitar.ogg");
    assert.equal(calls[0].url, `${DICT}guitar`, "looks up the lowercase word");
    assert.equal(new URL(calls[1].url).searchParams.get("origin"), "*", "Wikimedia needs origin=* for CORS");
  });

  it("encodes the word in the URL", async () => {
    const { fetcher, calls } = fakeFetch({ [DICT]: () => json({}, 404) });
    await lookupDictionary("machine learning", fetcher);
    assert.equal(calls[0].url, `${DICT}machine%20learning`);
  });

  it("does not request anything for an invalid word", async () => {
    const { fetcher, calls } = fakeFetch({});
    const result = await lookupDictionary("<script>", fetcher);
    assert.equal(result.error?.code, "INVALID_WORD");
    assert.equal(calls.length, 0);
  });

  it("treats 404 as not found, not as an error", async () => {
    const { fetcher } = fakeFetch({ [DICT]: () => json({ title: "No Definitions Found" }, 404) });
    assert.deepEqual(await lookupDictionary("asdfgh", fetcher), { found: false, results: [] });
  });

  it("reports a Cloudflare challenge as unavailable", async () => {
    const { fetcher } = fakeFetch({
      [DICT]: () => new Response("<title>Just a moment...</title>", { status: 403, headers: { "cf-mitigated": "challenge" } }),
    });
    const result = await lookupDictionary("guitar", fetcher);
    assert.equal(result.found, false);
    assert.equal(result.error?.code, "DICTIONARY_UNAVAILABLE");
  });

  it("reports the rate limit separately", async () => {
    const { fetcher } = fakeFetch({ [DICT]: () => json({}, 429) });
    assert.equal((await lookupDictionary("guitar", fetcher)).error?.code, "DICTIONARY_RATE_LIMITED");
  });

  it("reports a network failure without throwing", async () => {
    const result = await lookupDictionary("guitar", async () => { throw new TypeError("Failed to fetch"); });
    assert.equal(result.error?.code, "DICTIONARY_UNREACHABLE");
  });

  it("rejects a malformed provider response", async () => {
    const { fetcher } = fakeFetch({ [DICT]: () => json({ unexpected: true }) });
    assert.equal((await lookupDictionary("guitar", fetcher)).error?.code, "DICTIONARY_INVALID_RESPONSE");
  });

  it("keeps the definitions when the audio lookup fails", async () => {
    const { fetcher } = fakeFetch({
      [DICT]: () => json([guitarEntry]),
      [COMMONS]: () => json({}, 500),
    });
    const result = await lookupDictionary("guitar", fetcher);
    assert.equal(result.found, true);
    assert.equal(result.audioUrl, undefined);
  });

  it("ignores audio that is not served from upload.wikimedia.org", async () => {
    const { fetcher } = fakeFetch({
      [DICT]: () => json([guitarEntry]),
      [COMMONS]: () => json({ query: { pages: { 123: { imageinfo: [{ url: "https://evil.example/a.ogg" }] } } } }),
    });
    assert.equal((await lookupDictionary("guitar", fetcher)).audioUrl, undefined);
  });

  it("caps the number of definitions", async () => {
    const many = { meanings: [{ partOfSpeech: "noun", definitions: Array.from({ length: 30 }, (_, i) => ({ definition: `d${i}` })) }] };
    const { fetcher } = fakeFetch({ [DICT]: () => json([many]) });
    assert.equal((await lookupDictionary("set", fetcher)).results.length, 12);
  });
});
