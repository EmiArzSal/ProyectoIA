"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { LoaderIcon, ShieldCheckIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { PRIVACY_PATH } from "@/lib/consent";

interface Props {
  onAccept: () => void;
  accepting: boolean;
}

/**
 * Shown once (per consent version) before the first interview. The server
 * refuses to start an interview without it, so this is the explanation, not
 * the enforcement.
 */
export const ConsentCard = ({ onAccept, accepting }: Props) => {
  const [checked, setChecked] = useState(false);
  const checkboxId = useId();

  return (
    <section className="rounded-2xl bg-slate-800/60 border border-slate-700/60 p-5 flex flex-col gap-4">
      <div className="flex items-center gap-2 text-slate-100 font-medium">
        <ShieldCheckIcon className="size-5 text-blue-400" />
        Antes de grabar: cómo usamos tu voz
      </div>

      <ul className="flex flex-col gap-2.5 text-sm text-slate-300">
        <li>
          <span className="font-medium text-slate-100">Qué se graba:</span> tu voz mientras respondes cada
          pregunta. Solo grabamos cuando pulsas el micrófono.
        </li>
        <li>
          <span className="font-medium text-slate-100">A dónde va:</span> el audio se envía a OpenAI para
          transcribirlo y tus respuestas en texto se envían para evaluarlas. Agora no guarda el audio.
        </li>
        <li>
          <span className="font-medium text-slate-100">Qué guardamos:</span> la transcripción y tu reporte,
          hasta que borres la entrevista o tu cuenta.
        </li>
        <li>
          <span className="font-medium text-slate-100">Te recomendamos:</span> no mencionar datos personales
          sensibles (nombre completo, teléfono, dirección, datos de salud).
        </li>
      </ul>

      <label htmlFor={checkboxId} className="flex items-start gap-3 text-sm text-slate-200 cursor-pointer">
        <Checkbox
          id={checkboxId}
          checked={checked}
          onCheckedChange={(value) => setChecked(value === true)}
          className="mt-0.5 border-slate-400 data-[state=checked]:border-blue-500 data-[state=checked]:bg-blue-500"
        />
        <span>
          Entiendo cómo se usan mis datos y acepto el{" "}
          <Link href={PRIVACY_PATH} target="_blank" className="text-blue-300 underline underline-offset-2">
            aviso de privacidad
          </Link>
          .
        </span>
      </label>

      <Button
        onClick={onAccept}
        disabled={!checked || accepting}
        className="self-start bg-blue-600 hover:bg-blue-500 gap-2"
      >
        {accepting && <LoaderIcon className="size-4 animate-spin" />}
        Aceptar y continuar
      </Button>
    </section>
  );
};
