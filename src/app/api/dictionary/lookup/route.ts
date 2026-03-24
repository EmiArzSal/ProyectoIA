import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

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
};

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const word = req.nextUrl.searchParams.get("word")?.trim();
  const lang = req.nextUrl.searchParams.get("lang") ?? "en";

  if (!word) return NextResponse.json({ error: "No word provided" }, { status: 400 });

  try {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/${lang}/${encodeURIComponent(word.toLowerCase())}`,
      { next: { revalidate: 3600 } } // cache 1h
    );

    if (!res.ok) {
      return NextResponse.json({ found: false, results: [] });
    }

    const data = await res.json();
    const results: DictionaryResult[] = [];

    // Pick the first audio URL and phonetic text available
    let audioUrl: string | undefined;
    let phonetic: string | undefined;

    for (const entry of data) {
      if (!phonetic && entry.phonetic) phonetic = entry.phonetic;
      if (!audioUrl) {
        for (const p of entry.phonetics ?? []) {
          if (p.audio) { audioUrl = p.audio; break; }
        }
      }
      for (const meaning of entry.meanings ?? []) {
        for (const def of meaning.definitions ?? []) {
          results.push({
            partOfSpeech: meaning.partOfSpeech ?? "",
            definition: def.definition ?? "",
            example: def.example,
          });
        }
      }
    }

    return NextResponse.json({ found: true, results: results.slice(0, 12), phonetic, audioUrl } satisfies DictionaryLookupResponse);
  } catch {
    return NextResponse.json({ found: false, results: [] });
  }
}
