import { z } from "zod";

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

const wordPattern = /^(?=.*[\p{L}\p{N}])[\p{L}\p{M}\p{N}+#.'’_-]+(?:\s+[\p{L}\p{M}\p{N}+#.'’_-]+)*$/u;
const querySchema = z.object({
  word: z.string().trim().min(1).max(100).regex(wordPattern),
  lang: z.enum(["en"]).default("en"),
});

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

export const errorBody = (code: string, message: string): DictionaryLookupResponse => ({
  found: false,
  results: [],
  error: { code, message },
});

export function parseLookupQuery(params: URLSearchParams) {
  const words = params.getAll("word");
  const languages = params.getAll("lang");

  if (words.length !== 1 || (languages.length > 1)) {
    return { success: false as const, response: errorBody("INVALID_QUERY", "La consulta no es válida."), status: 400 };
  }
  if (!words[0]?.trim()) {
    return { success: false as const, response: errorBody("WORD_REQUIRED", "Escribe una palabra para buscar."), status: 400 };
  }

  const parsed = querySchema.safeParse({
    word: words[0],
    lang: languages[0] ?? "en",
  });
  if (!parsed.success) {
    return { success: false as const, response: errorBody("INVALID_QUERY", "Usa una palabra válida de hasta 100 caracteres y el idioma inglés."), status: 400 };
  }

  return { success: true as const, data: parsed.data };
}

type DictionaryFetch = (input: string | URL, init?: RequestInit) => Promise<Response>;

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

export async function lookupDictionary(
  word: string,
  lang: "en",
  fetcher: DictionaryFetch = fetch,
): Promise<{ status: number; body: DictionaryLookupResponse }> {
  try {
    const response = await fetcher(
      `https://api.dictionaryapi.dev/api/v2/entries/${lang}/${encodeURIComponent(word.toLowerCase())}`,
      { signal: AbortSignal.timeout(8000) },
    );

    if (response.status === 404) {
      return { status: 200, body: { found: false, results: [] } };
    }
    if (!response.ok) {
      return {
        status: response.status === 429 ? 503 : 502,
        body: errorBody("DICTIONARY_UNAVAILABLE", "No se pudo consultar el diccionario. Intenta de nuevo."),
      };
    }

    const parsed = providerEntrySchema.array().safeParse(await response.json());
    if (!parsed.success) {
      return {
        status: 502,
        body: errorBody("DICTIONARY_INVALID_RESPONSE", "El diccionario respondió con datos no válidos."),
      };
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
      status: 200,
      body: {
        found: results.length > 0,
        results: results.slice(0, 12),
        phonetic,
        audioUrl,
      },
    };
  } catch {
    return {
      status: 503,
      body: errorBody("DICTIONARY_UNAVAILABLE", "No se pudo conectar con el diccionario. Intenta de nuevo."),
    };
  }
}

