import { db } from "@/db";
import { user, meetings } from "@/db/schema";
import { PREDEFINED_AGENTS } from "@/lib/predefined-agents";
import { inngest } from "@/inngest/client";
import { StreamTranscriptItem } from "@/modules/meetings/types";
import { eq, inArray } from "drizzle-orm";
import JSONL from "jsonl-parse-stringify"
import { createAgent, openai, TextMessage } from "@inngest/agent-kit"

const summarizer = createAgent({
  name: "summarizer",
  system: `
Eres un experto resumidor. Escribes contenido legible, conciso y simple. Te dan una transcripción de una reunión y necesitas resumirla.

Usa la siguiente estructura markdown para cada salida:

### Resumen General
Proporciona un resumen detallado y atractivo del contenido de la entrevista . Enfócate en las características principales, flujos de trabajo del usuario y cualquier conclusión clave. Escribe en un estilo narrativo, usando oraciones completas. Destaca aspectos únicos o poderosos del producto, plataforma o discusión.

### Notas
Desglosa el contenido clave en secciones temáticas con rangos de tiempo. Cada sección debe resumir puntos clave, acciones o demos en formato de viñetas.

Ejemplo:
#### Nombre de la Sección
- Punto principal o demo mostrado aquí
- Otra idea clave o interacción
- Herramienta de seguimiento o explicación proporcionada

#### Próxima Sección
- La característica X automáticamente hace Y
- Mención de integración con Z
  `.trim(),
  model: openai({ model: "gpt-4o", apiKey: process.env.OPENAI_API_KEY})
});

export const meetingsProcessing = inngest.createFunction(
  { id: "meetings/processing" },
  { event: "meetings/processing" },
  async ({ event, step }) => {
    const response = await step.run("fetch-transcript", async () => {
      const url = event.data.transcriptUrl;
      // Inline JSONL (stored directly in DB, not a remote URL)
      if (!url.startsWith("http")) return url;
      return fetch(url).then((res) => res.text());
    });
    const transcript = await step.run("parse-transcript", async () => {
      return JSONL.parse<StreamTranscriptItem>(response);
    });
    const transcriptWithSpeakers = await step.run("add-speakers", async () => {
      const speakerIds = [
        ...new Set(transcript.map((item) => item.speaker_id)),
      ];
      const userSpeakers = await db
        .select()
        .from(user)
        .where(inArray(user.id, speakerIds))
        .then((users) => 
          users.map((user) => ({
            ...user,
          }))
        );
        const agentSpeakers = PREDEFINED_AGENTS
          .filter((agent) => speakerIds.includes(agent.id))
          .map((agent) => ({ id: agent.id, name: agent.role }));
      
      const speakers = [ ...userSpeakers, ...agentSpeakers ];
      return transcript.map((item) => {
        const speaker = speakers.find((speaker) => speaker.id === item.speaker_id);
        if(!speaker){
          return {
            ...item,
            user:{ 
              name: "Unknown",
            },
          };
        }
      return {
        ...item,
        user:{
          name: speaker.name,
        },
      };
    });
    });
    
    const { output } = await summarizer.run(
      "Resume la siguiente transcripción: " + JSON.stringify(transcriptWithSpeakers),
    );

    await step.run("save-summary", async () => {
      await db
      .update(meetings)
      .set({
        summary: (output[0] as TextMessage).content as string,
        status: "completed",
      })
      .where(eq(meetings.id, event.data.meetingId));
    });
  },
);