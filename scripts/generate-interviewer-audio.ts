// Generates the interviewer's fixed clips (one greeting per interviewer and
// the closing) into public/sounds/interviewer. They are the same in every
// interview, so playing a file is instant and costs nothing per interview.
//
// Run again after changing an interviewer's name or role, the greeting or
// closing text (src/modules/call/interviewer-script.ts), or the voice
// (src/lib/ai-models.ts):
//   npm run audio:interviewer            # only missing files
//   npm run audio:interviewer -- --force # regenerate all

import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { AI_MODELS, TTS_INSTRUCTIONS, TTS_VOICE } from "../src/lib/ai-models";
import { PREDEFINED_AGENTS } from "../src/lib/predefined-agents";
import { CLOSING_AUDIO_URL, CLOSING_TEXT, introAudioUrl, introText } from "../src/modules/call/interviewer-script";

const force = process.argv.includes("--force");
const publicDir = path.join(process.cwd(), "public");

const exists = (file: string) => stat(file).then(() => true, () => false);

async function speak(text: string): Promise<Buffer> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set (run with --env-file=.env)");

  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: AI_MODELS.tts,
      voice: TTS_VOICE,
      instructions: TTS_INSTRUCTIONS,
      input: text,
      response_format: "mp3",
    }),
  });
  if (!res.ok) throw new Error(`OpenAI TTS failed: ${res.status} ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  const clips = [
    ...PREDEFINED_AGENTS.map((agent) => ({ url: introAudioUrl(agent.id), text: introText(agent) })),
    { url: CLOSING_AUDIO_URL, text: CLOSING_TEXT },
  ];

  for (const clip of clips) {
    const file = path.join(publicDir, clip.url);
    if (!force && (await exists(file))) {
      console.log(`skip     ${clip.url}`);
      continue;
    }
    await mkdir(path.dirname(file), { recursive: true });
    const audio = await speak(clip.text);
    await writeFile(file, audio);
    console.log(`written  ${clip.url} (${Math.round(audio.length / 1024)} KB): ${clip.text}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
