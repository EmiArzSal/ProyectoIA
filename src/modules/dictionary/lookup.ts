import { z } from "zod";

// Runs in the browser. dictionaryapi.dev sits behind a Cloudflare challenge
// that blocks datacenter IPs (Vercel functions get a 403 "Just a moment..."
// page), while a user's own connection is allowed. Both APIs used here send
// `Access-Control-Allow-Origin: *`, and nothing here costs money, so there is
// no reason to proxy them through our server.

export type DictionaryResult = {
  partOfSpeech: string;
  definition: string;
  example?: string;
};

export type DictionaryLookupResponse = {
  found: boolean;
  results: DictionaryResult[];
  phonetic?: string;
  audioUrl?: string;
  error?: {
    code: string;
    message: string;
  };
};

const MAX_RESULTS = 12;

const wordPattern = /^(?=.*[\p{L}\p{N}])[\p{L}\p{M}\p{N}+#.'’_-]+(?:\s+[\p{L}\p{M}\p{N}+#.'’_-]+)*$/u;
const wordSchema = z.string().trim().min(1).max(100).regex(wordPattern);

const providerEntrySchema = z.object({
  phonetic: z.string().optional(),
  phonetics: z.array(z.object({
    text: z.string().optional(),
    audio: z.string().optional(),
    sourceUrl: z.string().optional(),
  }).passthrough()).optional(),
  meanings: z.array(z.object({
    partOfSpeech: z.string().optional(),
    definitions: z.array(z.object({
      definition: z.string(),
      example: z.string().optional(),
    }).passthrough()),
  }).passthrough()).optional(),
}).passthrough();

const failure = (code: string, message: string): DictionaryLookupResponse => ({
  found: false,
  results: [],
  error: { code, message },
});

/** The trimmed word, or a message to show when it cannot be looked up. */
export function validateWord(word: string): { ok: true; word: string } | { ok: false; message: string } {
  if (!word.trim()) return { ok: false, message: "Escribe una palabra para buscar." };
  const parsed = wordSchema.safeParse(word);
  if (!parsed.success) return { ok: false, message: "Usa una palabra válida en inglés de hasta 100 caracteres." };
  return { ok: true, word: parsed.data };
}

type DictionaryFetch = (input: string | URL, init?: RequestInit) => Promise<Response>;

const defaultFetch: DictionaryFetch = (input, init) => fetch(input, init);

async function resolveWikimediaAudio(sourceUrl: string | undefined, fetcher: DictionaryFetch) {
  if (!sourceUrl) return undefined;

  try {
    const source = new URL(sourceUrl);
    const pageId = source.searchParams.get("curid");
    if (source.protocol !== "https:" || source.hostname !== "commons.wikimedia.org" || !pageId || !/^\d+$/.test(pageId)) {
      return undefined;
    }

    const apiUrl = new URL("https://commons.wikimedia.org/w/api.php");
    apiUrl.search = new URLSearchParams({
      action: "query",
      prop: "imageinfo",
      iiprop: "url",
      pageids: pageId,
      format: "json",
      origin: "*", // anonymous CORS request from the browser
    }).toString();
    const response = await fetcher(apiUrl, { signal: AbortSignal.timeout(6000) });
    if (!response.ok) return undefined;

    const payload: unknown = await response.json();
    const pages = (payload as { query?: { pages?: Record<string, { imageinfo?: Array<{ url?: string }> }> } })
      .query?.pages;
    const audioUrl = pages?.[pageId]?.imageinfo?.[0]?.url;
    if (!audioUrl) return undefined;

    const resolved = new URL(audioUrl);
    return resolved.protocol === "https:" && resolved.hostname === "upload.wikimedia.org"
      ? resolved.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Looks up an English word. Never throws: a failure comes back in `error`,
 * and a word the dictionary does not know comes back as `found: false`.
 */
export async function lookupDictionary(
  word: string,
  fetcher: DictionaryFetch = defaultFetch,
): Promise<DictionaryLookupResponse> {
  const valid = validateWord(word);
  if (!valid.ok) return failure("INVALID_WORD", valid.message);

  try {
    const response = await fetcher(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(valid.word.toLowerCase())}`,
      { signal: AbortSignal.timeout(8000) },
    );

    if (response.status === 404) return { found: false, results: [] };
    if (response.status === 429) {
      return failure("DICTIONARY_RATE_LIMITED", "Hiciste muchas búsquedas seguidas. Espera un momento e intenta de nuevo.");
    }
    if (!response.ok) {
      return failure("DICTIONARY_UNAVAILABLE", "No se pudo consultar el diccionario. Intenta de nuevo.");
    }

    const parsed = providerEntrySchema.array().safeParse(await response.json());
    if (!parsed.success) {
      return failure("DICTIONARY_INVALID_RESPONSE", "El diccionario respondió con datos no válidos.");
    }

    const results: DictionaryResult[] = [];
    let phonetic: string | undefined;
    let audioSourceUrl: string | undefined;

    for (const entry of parsed.data) {
      phonetic ??= entry.phonetic ?? entry.phonetics?.find((item) => item.text)?.text;
      if (!audioSourceUrl) {
        audioSourceUrl = entry.phonetics?.find((item) =>
          item.audio?.startsWith("https://api.dictionaryapi.dev/media/pronunciations/") && item.sourceUrl,
        )?.sourceUrl;
      }
      for (const meaning of entry.meanings ?? []) {
        for (const definition of meaning.definitions) {
          results.push({
            partOfSpeech: meaning.partOfSpeech ?? "",
            definition: definition.definition,
            example: definition.example,
          });
        }
      }
    }

    const audioUrl = await resolveWikimediaAudio(audioSourceUrl, fetcher);

    return {
      found: results.length > 0,
      results: results.slice(0, MAX_RESULTS),
      phonetic,
      audioUrl,
    };
  } catch {
    return failure("DICTIONARY_UNREACHABLE", "No se pudo conectar con el diccionario. Revisa tu conexión e intenta de nuevo.");
  }
}
