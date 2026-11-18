import type { Metadata } from "next";
import Link from "next/link";

import { CONSENT_VERSION } from "@/lib/consent";

export const metadata: Metadata = {
  title: "Aviso de privacidad | Agora",
  description: "Qué datos recoge Agora, para qué los usa, quién los procesa y cómo borrarlos.",
};

// Optional public contact, e.g. a project or school address. Never a personal
// address committed to the repository.
const CONTACT = process.env.NEXT_PUBLIC_PRIVACY_CONTACT;

// Simplified notice for a school project. It is not legal advice: review it
// before using the app with real users outside the classroom.
export default function PrivacyPage() {
  return (
    <main className="min-h-svh bg-muted px-4 py-10 md:py-16">
      <article className="mx-auto max-w-2xl rounded-2xl bg-background p-6 md:p-10 shadow-sm flex flex-col gap-8 text-sm leading-relaxed text-foreground">
        <header className="flex flex-col gap-2">
          <Link href="/" className="text-xs text-muted-foreground hover:underline">← Agora</Link>
          <h1 className="text-2xl font-bold">Aviso de privacidad</h1>
          <p className="text-muted-foreground">
            Versión {CONSENT_VERSION}. Agora es un proyecto escolar para practicar entrevistas de trabajo en inglés.
            Aquí explicamos qué datos usamos, para qué y cómo puedes borrarlos.
          </p>
        </header>

        <Section title="Qué datos recogemos">
          <ul className="list-disc pl-5 flex flex-col gap-1.5">
            <li><strong>Cuenta:</strong> nombre, correo y contraseña (guardada cifrada).</li>
            <li><strong>Tu voz:</strong> solo mientras respondes una pregunta, desde que pulsas el micrófono hasta que envías tu respuesta.</li>
            <li><strong>Tus entrevistas:</strong> la transcripción de tus respuestas, el reporte con tu evaluación y las correcciones.</li>
            <li><strong>Tu progreso:</strong> temas practicados, calificaciones, racha y logros.</li>
            <li><strong>Glosario y diccionario:</strong> las palabras y definiciones que agregas.</li>
          </ul>
        </Section>

        <Section title="Para qué los usamos">
          <p>
            Solo para darte el servicio: hacerte la entrevista, transcribir y evaluar tus respuestas, mostrarte tu
            reporte y tu progreso, y limitar cuántas entrevistas se hacen al día. No vendemos tus datos ni los usamos
            para publicidad.
          </p>
        </Section>

        <Section title="Quién procesa tus datos">
          <ul className="list-disc pl-5 flex flex-col gap-1.5">
            <li>
              <strong>OpenAI</strong> (proveedor de inteligencia artificial): recibe el audio de cada respuesta para
              transcribirlo, el texto de tus respuestas para evaluarlas y las preguntas para generar la voz del
              entrevistador. Según las políticas de su API, por defecto no usa estos datos para entrenar sus modelos y
              puede conservarlos por un tiempo limitado para detectar abusos.
            </li>
            <li><strong>Neon</strong> (base de datos): guarda tu cuenta, tus entrevistas y tu progreso.</li>
          </ul>
          <p>Agora no guarda el audio de tus respuestas: solo el texto transcrito.</p>
        </Section>

        <Section title="Cuánto tiempo los guardamos">
          <ul className="list-disc pl-5 flex flex-col gap-1.5">
            <li>Tus entrevistas, reportes y correcciones: hasta que borres la entrevista o tu cuenta.</li>
            <li>
              El registro de que iniciaste una entrevista (solo la fecha, sin su contenido) se conserva aunque borres
              la entrevista, para respetar el límite diario. Se borra al eliminar tu cuenta.
            </li>
            <li>Tu progreso, racha y logros: hasta que elimines tu cuenta.</li>
          </ul>
        </Section>

        <Section title="Cómo borrar tus datos">
          <p>
            Puedes borrar cualquier entrevista desde su historial. Para borrar todo, elimina tu cuenta en{" "}
            <Link href="/dashboard/settings" className="underline">Configuración</Link>: se eliminan tu cuenta,
            entrevistas, reportes, progreso, glosario y diccionario.
          </p>
        </Section>

        <Section title="Recomendaciones">
          <p>
            Durante las entrevistas no menciones datos personales sensibles, como tu nombre completo, teléfono,
            dirección, datos de salud o financieros. No son necesarios para practicar.
          </p>
        </Section>

        {CONTACT && (
          <Section title="Contacto">
            <p>Si tienes dudas sobre tus datos, escríbenos a {CONTACT}.</p>
          </Section>
        )}

        <footer className="text-xs text-muted-foreground border-t pt-4">
          Si cambiamos qué datos recogemos, quién los procesa o cuánto tiempo los guardamos, actualizaremos este aviso
          y te pediremos aceptarlo de nuevo antes de tu siguiente entrevista.
        </footer>
      </article>
    </main>
  );
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="flex flex-col gap-2">
    <h2 className="text-base font-semibold">{title}</h2>
    {children}
  </section>
);
