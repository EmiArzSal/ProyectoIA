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

  const { text, voice = "alloy" } = await request.json();
  if (!text || typeof text !== "string") {
    return NextResponse.json({ error: "Falta el texto" }, { status: 400 });
  }

  const mp3 = await openai.audio.speech.create({
    model: "tts-1",
    voice,
    input: text,
  });

  const buffer = Buffer.from(await mp3.arrayBuffer());
  return new Response(buffer, {
    headers: { "Content-Type": "audio/mpeg" },
  });
}
