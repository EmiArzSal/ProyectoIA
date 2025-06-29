import OpenAI from "openai";
import { ChatCompletionMessageParam } from "openai/resources/index.mjs";
import {
  MessageNewEvent,
  CallEndedEvent,
  CallTranscriptionReadyEvent,
  CallRecordingReadyEvent,
  CallSessionParticipantLeftEvent,
  CallSessionStartedEvent,

} from "@stream-io/node-sdk";
import { and, eq, not, or } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { agents, meetings } from "@/db/schema";
import { streamVideo } from "@/lib/stream-video";
import { inngest } from "@/inngest/client";
import { generateAvatarUri } from "@/lib/avatar";
import { streamChat } from "@/lib/stream-chat";

const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

function verifySignatureWithSDK(body: string, signature: string): boolean {
  return streamVideo.verifyWebhook(body, signature);
}

export async function POST(request: NextRequest) {
  const signature = request.headers.get("x-signature");
  const apiKey = request.headers.get("x-api-key");

  if (!signature || !apiKey) {
    return NextResponse.json({ error: "Falta la firma o la clave API" }, { status: 400 });
  }

  const body = await request.text();
  const isValid = verifySignatureWithSDK(body, signature);

  if (!isValid) {
    return NextResponse.json({ error: "Firma inválida" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(body) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const eventType = (payload as Record<string, unknown>)?.type;
  if (eventType === "call.session_started") {
    const event = payload as CallSessionStartedEvent;
    const meetingId = event.call.custom?.meetingId;
    if (!meetingId) {
      return NextResponse.json({ error: "Falta el ID de la reunión" }, { status: 400 });
    }
    const [existingMeeting] = await db
      .select()
      .from(meetings)
      .where(
        and(
          eq(meetings.id, meetingId),
          not(eq(meetings.status, "completed")),
          not(eq(meetings.status, "active")),
          not(eq(meetings.status, "cancelled")),
          not(eq(meetings.status, "processing"))
        ));
    if (!existingMeeting) {
      return NextResponse.json({ error: "Reunión no encontrada" }, { status: 404 });
    }
    await db
      .update(meetings)
      .set({
        status: "active",
        startedAt: new Date(),
      })
      .where(eq(meetings.id, existingMeeting.id));

    const [existingAgent] = await db
      .select()
      .from(agents)
      .where(eq(agents.id, existingMeeting.agentId));
    if (!existingAgent) {
      return NextResponse.json({ error: "Agente no encontrado" }, { status: 404 });
    }

    const call = streamVideo.video.call("default", meetingId);
    const realTimeClient = await streamVideo.video.connectOpenAi({
      call,
      openAiApiKey: process.env.OPENAI_API_KEY!,
      agentUserId: existingAgent.id,
    });
    realTimeClient.updateSession({
      instructions: existingAgent.instructions,
    });
  } else if(eventType === "call.session_participant_left"){
      const event = payload as CallSessionParticipantLeftEvent;
      const meetingId = event.call_cid.split(":")[1];
      if(!meetingId){ 
        return NextResponse.json({ error: "Falta el ID de la reunión" }, { status: 400 });
      }
      const call = streamVideo.video.call("default", meetingId);
      await call.end();
    }
    else if(eventType === "call.session_ended"){
      const event = payload as CallEndedEvent;
      const meetingId = event.call.custom?.meetingId;
      if(!meetingId){
        return NextResponse.json({ error: "Falta el ID de la reunión" }, { status: 400 });
      }
      await db
        .update(meetings)
        .set({ 
          status: "processing",
          endedAt: new Date(),
        })
        .where(and(eq(meetings.id, meetingId), eq(meetings.status, "active")));
    }
    else if(eventType === "call.transcription_ready"){
      const event = payload as CallTranscriptionReadyEvent;
      const meetingId = event.call_cid.split(":")[1];
      const [updatedMeeting] = await db
        .update(meetings)
        .set({
          transcriptUrl: event.call_transcription.url,
        })
        .where(eq(meetings.id, meetingId))
        .returning();
      if(!updatedMeeting){
        return NextResponse.json({ error: "Reunión no encontrada" }, { status: 404 });
      }
      await inngest.send({
        name: "meetings/processing",
        data: {
          meetingId: updatedMeeting.id,
          transcriptUrl: updatedMeeting.transcriptUrl,
        },
      });
    } else if(eventType === "call.recording_ready"){
      const event = payload as CallRecordingReadyEvent;
      const meetingId = event.call_cid.split(":")[1];
      await db
        .update(meetings)
        .set({
          recordingUrl: event.call_recording.url,
        })
        .where(eq(meetings.id, meetingId))
  } else if(eventType === "message.new"){
      const event = payload as MessageNewEvent;
      const userId = event.user?.id;
      const channelId = event.channel_id;
      const text = event.message?.text;

      if(!userId || !channelId || !text){
        return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
      }
      const [existingMeeting] = await db
        .select()
        .from(meetings)
        .where(and(eq(meetings.id, channelId), eq(meetings.status, "completed")));

      if(!existingMeeting){
        return NextResponse.json({ error: "Reunión no encontrada" }, { status: 404 });
      }

      const [existingAgent] = await db
        .select()
        .from(agents)
        .where(eq(agents.id, existingMeeting.agentId));
      if(!existingAgent){
        return NextResponse.json({ error: "Agente no encontrado" }, { status: 404 });
      }
      if(userId !== existingAgent.id){
        const instructions = `
      Eres un asistente de IA ayudando al usuario a revisar una reunión recientemente completada.
      A continuación se muestra un resumen de la reunión, generado a partir de la transcripción:
      
      ${existingMeeting.summary}
      
      Las siguientes son tus instrucciones originales del asistente de la reunión en vivo. Por favor, continúa siguiendo estas pautas de comportamiento mientras ayudas al usuario:
      
      ${existingAgent.instructions}
      
      El usuario puede hacer preguntas sobre la reunión, solicitar aclaraciones o pedir acciones de seguimiento.
      Siempre basa tus respuestas en el resumen de la reunión anterior.
      
      También tienes acceso al historial reciente de conversación entre tú y el usuario. Usa el contexto de mensajes anteriores para proporcionar respuestas relevantes, coherentes y útiles. Si la pregunta del usuario se refiere a algo discutido anteriormente, asegúrate de tenerlo en cuenta y mantener la continuidad en la conversación.
      
      Si el resumen no contiene suficiente información para responder una pregunta, amablemente hazle saber al usuario.
      
      Sé conciso, útil y enfócate en proporcionar información precisa de la reunión y la conversación en curso.
      `;

      const channel = streamChat.channel("messaging", channelId);
      await channel.watch();

      const previousMessages = channel.state.messages
        .slice(-5)
        .filter((msg) => msg.text && msg.text.trim() !== "")
        .map<ChatCompletionMessageParam>((message) => ({
          role: message.user?.id === userId ? "assistant" : "user",
          content: message.text || "",
        }));
        const gptResponse = await openaiClient.chat.completions.create({
          messages: [
            {
              role: "system",
              content: instructions,
            },
            ...previousMessages,
            {
              role: "user",
              content: text,
            }
          ],
          model: "gpt-4o",
        });
        const gptResponseText = gptResponse.choices[0].message.content;
        if(!gptResponseText){
          return NextResponse.json({ error: "Error al generar respuesta" }, { status: 500 });
        }

        const avatarUrl = generateAvatarUri({
          seed:existingAgent.name,
          variant: "botttsNeutral"
        });
        streamChat.upsertUser({
          id: existingAgent.id,
          name: existingAgent.name,
          image: avatarUrl,
        });

        channel.sendMessage({
          text: gptResponseText,
          user: {
            id: existingAgent.id,
            name: existingAgent.name,
            image: avatarUrl,
          },
        });
      }
    }
  return NextResponse.json({ status: "ok" });
}


