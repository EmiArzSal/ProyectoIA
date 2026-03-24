import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const formData = await request.formData();
  const audio = formData.get("audio") as File | null;
  if (!audio) {
    return NextResponse.json({ error: "Falta el audio" }, { status: 400 });
  }

  const transcription = await openai.audio.transcriptions.create({
    file: audio,
    model: "whisper-1",
    language: "en",
  });

  return NextResponse.json({ text: transcription.text });
}
