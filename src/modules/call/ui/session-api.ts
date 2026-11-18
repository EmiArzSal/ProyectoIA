// The interview's HTTP calls. The server owns the transcript: the client only
// says which meeting it is in and sends the recorded audio.

import type { Clip } from "@/modules/call/interviewer-script";
import type { AgentTurn } from "./session-types";

// The server answered 410: the interview's time limit has passed.
export class TimeUpError extends Error {}

const readApiError = async (res: Response, fallback: string) => {
  try {
    const data = await res.json();
    return typeof data?.error === "string" ? data.error : fallback;
  } catch {
    return fallback;
  }
};

/** The interviewer's next message (intro, or a fallback when the answer request did not compose it). */
export async function requestAgentTurn(meetingId: string): Promise<AgentTurn> {
  const res = await fetch("/api/session/message", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ meetingId }),
  });
  if (res.status === 410) throw new TimeUpError();
  if (!res.ok) throw new Error(await readApiError(res, "Error al obtener respuesta del agente"));
  return await res.json() as AgentTurn;
}

export type SubmittedAnswer = { text: string; transcriptionFailed: boolean; agent: AgentTurn | null };

/**
 * Sends the answer (or a skip, with no audio). The server transcribes and
 * records it and, in the main round, already returns the interviewer's next message.
 */
export async function sendAnswer(meetingId: string, audio: Blob | null): Promise<SubmittedAnswer> {
  const formData = new FormData();
  formData.append("meetingId", meetingId);
  if (audio && audio.size > 0) formData.append("audio", audio, "answer");

  const res = await fetch("/api/session/transcribe", { method: "POST", body: formData });
  if (res.status === 410) throw new TimeUpError();
  if (!res.ok) throw new Error(await readApiError(res, "No se pudo registrar tu respuesta"));

  const data = await res.json() as { text?: string; transcriptionFailed?: boolean; agent?: AgentTurn | null };
  return { text: data.text ?? "", transcriptionFailed: !!data.transcriptionFailed, agent: data.agent ?? null };
}

/** Generates one clip of the interviewer's voice. Null on failure: the text stays on screen. */
export async function requestSpeech(
  meetingId: string,
  body: { part: Clip["kind"]; index?: number },
): Promise<Blob | null> {
  try {
    const res = await fetch("/api/session/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meetingId, ...body }),
    });
    return res.ok ? await res.blob() : null;
  } catch {
    return null;
  }
}
