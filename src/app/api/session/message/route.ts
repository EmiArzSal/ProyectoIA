import OpenAI from "openai";
import { ChatCompletionMessageParam } from "openai/resources/index.mjs";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json() as {
    messages: ChatCompletionMessageParam[];
    systemPrompt: string;
  };

  const { messages, systemPrompt } = body;
  if (!systemPrompt || !Array.isArray(messages)) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      ...messages,
    ],
  });

  const text = completion.choices[0].message.content;
  return NextResponse.json({ text });
}
