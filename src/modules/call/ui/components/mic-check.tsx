"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2Icon, CircleIcon, LoaderIcon, MicIcon, PlayIcon, TriangleAlertIcon, Volume2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MIC_ERROR_MESSAGES, type Microphone } from "@/modules/call/ui/hooks/use-microphone";
import { ConsentCard } from "@/modules/call/ui/components/consent-card";

// Level the meter must exceed, for this long, to count as "we heard you".
const SPEECH_LEVEL = 0.15;
const SPEECH_MS = 300;

interface Props {
  mic: Microphone;
  /** Plays the local test sound through the interview's audio element. */
  onPlayTestSound: () => Promise<boolean>;
  onStart: () => void;
  /** Mock mode: no microphone needed. */
  skipMic?: boolean;
  /** null while loading. The microphone is only requested after consent. */
  consentAccepted: boolean | null;
  onAcceptConsent: () => void;
  acceptingConsent: boolean;
}

export const MicCheck = ({
  mic, onPlayTestSound, onStart, skipMic = false, consentAccepted, onAcceptConsent, acceptingConsent,
}: Props) => {
  const [heard, setHeard] = useState(false);
  const [sound, setSound] = useState<"idle" | "playing" | "played" | "blocked">("idle");
  // Heard = the level stays above the threshold for SPEECH_MS. A timer, not the
  // level updates, decides: a steady level does not re-render. Sticky once done.
  const above = mic.level >= SPEECH_LEVEL;
  useEffect(() => {
    if (heard || !above) return;
    const t = setTimeout(() => setHeard(true), SPEECH_MS);
    return () => clearTimeout(t);
  }, [above, heard]);

  // A different microphone has to be heard again.
  const deviceRef = useRef(mic.deviceId);
  useEffect(() => {
    if (deviceRef.current === mic.deviceId) return;
    deviceRef.current = mic.deviceId;
    setHeard(false);
  }, [mic.deviceId]);

  const playTest = async () => {
    setSound("playing");
    setSound((await onPlayTestSound()) ? "played" : "blocked");
  };

  const ready = consentAccepted === true && (skipMic || (mic.status === "ready" && heard));
  const error = mic.error ? MIC_ERROR_MESSAGES[mic.error] : null;

  return (
    <div className="w-full flex flex-col gap-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-slate-100">Antes de empezar, prueba tu equipo</h2>
        <p className="text-sm text-slate-400 mt-1">
          La entrevista y su tiempo empiezan cuando pulses &quot;Iniciar entrevista&quot;. Probar no cuenta para tu límite diario.
        </p>
      </div>

      {consentAccepted === null && (
        <div className="flex justify-center text-slate-400"><LoaderIcon className="size-5 animate-spin" /></div>
      )}
      {consentAccepted === false && <ConsentCard onAccept={onAcceptConsent} accepting={acceptingConsent} />}

      {consentAccepted && <>
      {/* Step 1 — microphone */}
      <section className="rounded-2xl bg-slate-800/60 border border-slate-700/60 p-5 flex flex-col gap-4">
        <StepTitle done={ready && !skipMic} icon={<MicIcon className="size-4" />} title="Micrófono" />

        {skipMic ? (
          <p className="text-sm text-slate-400">Modo prueba: no se usa el micrófono.</p>
        ) : mic.status === "ready" ? (
          <>
            {mic.devices.length > 1 && (
              <label className="flex flex-col gap-1.5 text-xs text-slate-400">
                Micrófono a usar
                <select
                  value={mic.deviceId ?? ""}
                  onChange={(e) => void mic.selectDevice(e.target.value)}
                  className="h-9 rounded-md bg-slate-900 border border-slate-600 px-2 text-sm text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                >
                  {mic.devices.map((d, i) => (
                    <option key={d.deviceId} value={d.deviceId}>{d.label || `Micrófono ${i + 1}`}</option>
                  ))}
                </select>
              </label>
            )}

            <div className="flex flex-col gap-2">
              <p className="text-sm text-slate-300">
                {heard ? "¡Te escuchamos bien!" : <>Di en voz alta: <span className="italic">&quot;Hello, my name is…&quot;</span></>}
              </p>
              <div
                className="h-2.5 w-full rounded-full bg-slate-700 overflow-hidden"
                role="meter"
                aria-label="Nivel del micrófono"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(mic.level * 100)}
              >
                <div
                  className={cn("h-full rounded-full transition-[width] duration-75", heard ? "bg-emerald-400" : "bg-blue-400")}
                  style={{ width: `${Math.round(mic.level * 100)}%` }}
                />
              </div>
              {!heard && (
                <p className="text-xs text-slate-500">
                  Si la barra no se mueve, revisa que el micrófono no esté silenciado o elige otro.
                </p>
              )}
            </div>
          </>
        ) : mic.status === "requesting" ? (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <LoaderIcon className="size-4 animate-spin" />
            Esperando el permiso del navegador...
          </div>
        ) : (
          <>
            {(error || mic.status === "lost") && (
              <div className="flex gap-3 rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 text-sm">
                <TriangleAlertIcon className="size-4 shrink-0 text-amber-400 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-200">{error?.title ?? "Se desconectó tu micrófono"}</p>
                  <p className="text-amber-100/70 mt-0.5">{error?.hint ?? "Vuelve a conectarlo y pulsa el botón."}</p>
                </div>
              </div>
            )}
            {mic.error !== "unsupported" && (
              <Button onClick={() => void mic.acquire()} className="self-start bg-blue-600 hover:bg-blue-500 gap-2">
                <MicIcon className="size-4" />
                {error ? "Intentar de nuevo" : "Permitir micrófono"}
              </Button>
            )}
          </>
        )}
      </section>

      {/* Step 2 — speakers (optional) */}
      <section className="rounded-2xl bg-slate-800/60 border border-slate-700/60 p-5 flex flex-col gap-3">
        <StepTitle done={sound === "played"} icon={<Volume2Icon className="size-4" />} title="Bocinas o audífonos" optional />
        <p className="text-sm text-slate-400">
          {sound === "played"
            ? "Si escuchaste el sonido, todo listo. Si no, sube el volumen."
            : sound === "blocked"
              ? "El navegador no dejó reproducir audio. Revisa el volumen y que la pestaña no esté silenciada."
              : "El entrevistador te hablará en inglés. Comprueba que puedes escucharlo."}
        </p>
        <Button
          variant="outline"
          onClick={playTest}
          disabled={sound === "playing"}
          className="self-start gap-2 bg-transparent border-slate-600 text-slate-200 hover:bg-slate-700 hover:text-white"
        >
          <PlayIcon className="size-4" />
          Reproducir sonido de prueba
        </Button>
      </section>

      </>}

      <div className="flex flex-col items-center gap-2">
        <Button onClick={onStart} disabled={!ready} size="lg" className="bg-blue-600 hover:bg-blue-500 px-8">
          Iniciar entrevista
        </Button>
        {!ready && consentAccepted && (
          <p className="text-xs text-slate-500">Se activa cuando confirmemos que te escuchamos.</p>
        )}
      </div>
    </div>
  );
};

const StepTitle = ({ done, icon, title, optional }: { done: boolean; icon: React.ReactNode; title: string; optional?: boolean }) => (
  <div className="flex items-center gap-2 text-slate-100">
    {done ? <CheckCircle2Icon className="size-5 text-emerald-400" /> : <CircleIcon className="size-5 text-slate-600" />}
    <span className="flex items-center gap-1.5 font-medium">{icon}{title}</span>
    {optional && <span className="text-xs text-slate-500">(opcional)</span>}
  </div>
);
