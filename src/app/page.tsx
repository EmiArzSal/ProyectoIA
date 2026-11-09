import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import Link from "next/link";
import Image from "next/image";
import Script from "next/script";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Steps,
  StepsList,
  StepsItem,
  StepsTrigger,
  StepsIndicator,
  StepsSeparator,
  StepsTitle,
  StepsDescription,
} from "@/components/ui/steps";
import type { Metadata } from "next";
import { FlipWords } from "@/components/ui/flip-words";
import { HighlightText } from "@/components/ui/highlight-text";
import { Button } from "@/components/ui/button";
import "./agora.css";
import { Separator } from "@radix-ui/react-separator";

export const metadata: Metadata = {
  title: "Agora | Practica entrevistas en inglés",
  description:
    "Practica entrevistas de trabajo en inglés para puestos tech entry-level con Agora.",
};

const roles = [
  {
    title: "Frontend Developer",
    description: "HTML, CSS, JavaScript, React, accesibilidad y rendimiento de interfaces.",
    questions: [
      "How can semantic HTML improve accessibility?",
      "When would you use CSS Grid instead of Flexbox?",
      "What is the difference between props and state in React?",
      "Tell me about a personal or academic project you're proud of.",
    ],
  },
  {
    title: "Backend Developer",
    description: "APIs REST, bases de datos, autenticación, escalabilidad y diseño de sistemas.",
    questions: [
      "What makes an HTTP method safe or idempotent?",
      "When would you choose SQL over a NoSQL database?",
      "What is the difference between authentication and authorization?",
      "Describe a project where you built or consumed an API.",
    ],
  },
  {
    title: "Data Analyst",
    description: "SQL, Python, visualización de datos, pensamiento analítico y estadística.",
    questions: [
      "What is the difference between an INNER JOIN and a LEFT JOIN?",
      "How would you handle missing values in a dataset?",
      "How would you choose a chart to compare categories?",
      "Describe a time you used data to support a decision.",
    ],
  },
  {
    title: "QA Engineer",
    description: "Planificación de pruebas, testing manual y automatizado, reporte de bugs y CI/CD.",
    questions: [
      "When would you use manual testing instead of automation?",
      "What should a clear bug report include?",
      "How do unit, integration, and end-to-end tests differ?",
      "How do you decide what to test when time is limited?",
    ],
  },
  {
    title: "DevOps Engineer",
    description: "Linux, CI/CD, contenedores, servicios en la nube y monitoreo de infraestructura.",
    questions: [
      "What is the difference between a Docker image and a container?",
      "What stages might a CI/CD pipeline include?",
      "How do logs and metrics help you investigate an incident?",
      "How do you stay current with tools and technologies in DevOps?",
    ],
  },
];

const practiceSteps = [
  {
    title: "Elige un puesto",
    description: "Su agente iniciará la sesión.",
  },
  {
    title: "Responde en inglés",
    description: "Responde preguntas técnicas y de soft skills como en una entrevista real.",
  },
  {
    title: "Revisa tu entrevista",
    description: "Recibe la transcripción completa y un resumen de IA con observaciones y áreas de mejora.",
  },
];

const concepts = [
  { role: "Frontend Developer", name: "HTML semántico", image: "html" },
  { role: "Frontend Developer", name: "CSS, Flexbox y Grid", image: "css" },
  { role: "Frontend Developer", name: "JavaScript", image: "javascript" },
  { role: "Frontend Developer", name: "React", image: "react" },
  { role: "Backend Developer", name: "Bases de datos", image: "database" },
  { role: "Data Analyst", name: "SQL y consultas", image: "sql" },
  { role: "Data Analyst", name: "Python", image: "python" },
  { role: "Data Analyst", name: "pandas", image: "pandas" },
  { role: "QA Engineer", name: "Selenium", image: "selenium" },
  { role: "DevOps Engineer", name: "Linux", image: "linux" },
  { role: "DevOps Engineer", name: "Docker", image: "docker" },
];

export default async function HomePage() {
  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch(() => null);

  if (session) {
    redirect("/dashboard");
  }

  return (
    <main className="agora-page">
      <header className="agora-header">
        <div className="agora-container agora-header__inner">
          <Link className="agora-wordmark" href="/" aria-label="Agora, inicio">
            <Image src="/logo.png" alt="" width={60} height={60} />
            <span className="agora-wordmark__name">Agora</span>
          </Link>

          <nav className="agora-nav" aria-label="Cuenta">
              <Button className="agora-button_login" size="lg" nativeButton={false} render={<Link href="/sign-in" />}>
                Iniciar Sesión
              </Button>
            <Button className="agora-button_register" size="lg" variant="ghost" nativeButton={false} render={<Link href="/sign-up" />}>
              Registrarse
            </Button>
          </nav>
        </div>
      </header>

      <section className="agora-hero" aria-labelledby="hero-title">
        <div className="agora-container agora-hero__grid">
          <div className="agora-hero__copy">
            <h1 id="hero-title"><FlipWords
              words={["Practica", "Mejora", "Prepara"]}
              duration={2200}
              stagger={80}
              className="hero-flip-words"
            /></h1>
            <h1>tu próxima entrevista tech en inglés</h1>
            <p className="agora-lead">
              Practica entrevistas laborales en inglés, <HighlightText
                text="recibe retroalimentación personalizada"
                duration={1500}
                highlightColor="var(--color-land-accent)"
              /> y <HighlightText
                text="desarrolla la confianza"
                duration={1300}
                highlightColor="var(--color-land-accent)"
              /> que necesitas para dar el siguiente paso en tu carrera profesional.
            </p>
          </div>

          <figure
            className="practice-screen"
            data-slot="practice-screen"
            data-kind="product"
            data-alt="Captura de una sesión de entrevista simulada en inglés"
          >
            <div className="practice-screen__top">
              <span className="practice-screen__brand">Agora</span>
              <span className="practice-screen__role">Frontend Developer</span>
            </div>
            <div className="practice-screen__body">
              <div className="practice-screen__speaker">
                <span className="practice-screen__speaker-mark" aria-hidden="true">A</span>
                <div>
                  <p className="practice-screen__speaker-name">Entrevistador de IA</p>
                  <p className="practice-screen__speaker-state">Pregunta</p>
                </div>
              </div>
              <p className="practice-screen__question">
                “How would you make a React component accessible?”
              </p>
              <div className="practice-screen__response">
                <div className="practice-screen__response-head">
                  <span>Tu respuesta</span>
                  <span>Audio</span>
                </div>
                <div className="practice-wave" aria-hidden="true">
                  {Array.from({ length: 29 }, (_, index) => (
                    <span key={index} />
                  ))}
                </div>
              </div>
            </div>
          </figure>
        </div>
      </section>

      <section className="agora-roles" aria-labelledby="roles-title">
        <div className="agora-container">
          <div className="agora-section-heading">
            <h2 id="roles-title">Cinco roles para empezar</h2>
            <p>Basándonos en las necesidades del mercado laboral, hemos seleccionado cinco roles clave para que puedas practicar y mejorar tus habilidades.</p>
          </div>
          <Accordion type="single" collapsible defaultValue="Frontend Developer" className="w-full border-t-4 border-[var(--color-ink)]">
            {roles.map((role, index) => (
              <AccordionItem key={role.title} value={role.title} className="border-b border-[var(--color-rule)]">
                <AccordionTrigger className="hover:no-underline py-6 px-0 text-left cursor-pointer">
                  <div className="grid grid-cols-[48px_1fr] sm:grid-cols-[64px_1fr] items-center gap-3 sm:gap-4 w-full text-left">
                    <span className="role-list__number">0{index + 1}</span>
                    <span className="role-list__title">{role.title}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="p-0">
                  <div className="role-list__details">
                    <p>{role.description}</p>
                    <Separator/>
                    <Separator/>
                    <Separator/>
                    <h3>Preguntas de ejemplo</h3>
                    <ul>
                      {role.questions.map((question) => (
                        <li key={question}>{question}</li>
                      ))}
                    </ul>
                    <Separator/>
                    <Separator/>
                    <p className="role-list__note">Las preguntas pueden variar entre sesiones.</p>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      <section className="agora-concepts" aria-labelledby="concepts-title">
        <div className="agora-container agora-concepts__grid">
          {/* Imágenes a la izquierda */}
          <div className="agora-concepts__carousel">
            <Carousel
              opts={{
                loop: true,
                align: "center",
              }}
              autoplay={3000}
              className="w-full max-w-sm mx-auto"
            >
              <CarouselContent>
                {concepts.map((concept) => (
                  <CarouselItem
                    key={`${concept.role}-${concept.name}`}
                    className="flex flex-col items-center justify-center p-4 select-none"
                  >
                    <div className="w-36 h-36 sm:w-44 sm:h-44 flex items-center justify-center p-2">
                      <Image
                        src={`/concepts/${concept.image}.svg`}
                        alt={concept.name}
                        width={180}
                        height={180}
                        className="object-contain max-h-full max-w-full"
                        draggable={false}
                      />
                    </div>
                    <div className="mt-4 text-center">
                      <span className="text-xs uppercase tracking-wider text-[var(--color-muted)] font-semibold block">
                        {concept.role}
                      </span>
                      <h3 className="text-xl md:text-2xl font-bold mt-1 text-[var(--color-ink)]">
                        {concept.name}
                      </h3>
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
            </Carousel>
          </div>

          {/* Texto del lado derecho */}
          <div className="agora-concepts__content">
            <h2 id="concepts-title">Tecnología según el puesto</h2>
            <p className="agora-lead">
              Cada rol requiere un conjunto específico de habilidades y conocimientos técnicos. Practica <HighlightText 
                text="cómo explicar conceptos clave"
                highlightColor="var(--color-land-accent)"
                duration={1500}/> de tu área de especialización en inglés, para que puedas <HighlightText 
                text="comunicarte con confianza"
                highlightColor="var(--color-land-accent)"
                duration={1300}/> durante tus entrevistas.
            </p>
          </div>
        </div>
      </section>

      <section className="agora-practice" aria-labelledby="practice-title">
        <div className="agora-container agora-practice__grid">
          <div className="agora-section-heading">
            <h2 id="practice-title">De tu puesto ideal a la práctica</h2>
            <p className="agora-lead">
              Sigue estos pasos para practicar las habilidades técnicas necesarias para tu rol.
            </p>
          </div>
          <div className="w-full border-t-4 border-[var(--color-ink)] pt-6 md:pt-8">
            <Steps
              orientation="vertical"
              count={practiceSteps.length}
              defaultStep={0}
              linear={false}
              className="w-full"
            >
              <StepsList className="w-full">
                {practiceSteps.map((step, index) => (
                  <StepsItem
                    key={step.title}
                    index={index}
                    className="w-full pb-8 last:pb-0"
                  >
                    <StepsTrigger className="w-full text-left flex items-start gap-4 p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer">
                      <StepsIndicator className="mt-0.5 shrink-0 font-bold">
                        {index + 1}
                      </StepsIndicator>
                      <div className="flex flex-col gap-1">
                        <StepsTitle className="text-xl md:text-2xl font-bold font-display text-[var(--color-ink)]">
                          {step.title}
                        </StepsTitle>
                        <StepsDescription className="text-sm md:text-base text-[var(--color-ink-2)] font-reading leading-relaxed mt-1">
                          {step.description}
                        </StepsDescription>
                      </div>
                    </StepsTrigger>
                    <StepsSeparator />
                  </StepsItem>
                ))}
              </StepsList>
            </Steps>
          </div>
        </div>
      </section>

      <section className="agora-english" aria-labelledby="english-title">
        <div className="agora-container agora-english__inner">
          <div className="agora-english__copy">
            <h2 id="english-title">Explica tecnología en inglés</h2>
            <p>
              Muchas empresas tech, también remotas e internacionales, entrevistan en inglés.
              Algunos candidatos con buenas habilidades técnicas no logran comunicarlas con claridad.
              Practica cómo expresarlas en inglés técnico y bajo presión antes de una entrevista real.
            </p>
          </div>
          <Image
            className="agora-english__image"
            src="/interview.png"
            alt="Práctica de entrevistas en inglés"
            width={500}
            height={500}
          />
        </div>
      </section>

      <footer className="agora-footer">
        <div className="agora-container agora-footer__inner">
          <div>
            <p>
              Práctica de entrevistas en inglés para ESCOM, IPN.
            </p>
          </div>
          <nav className="agora-footer__links" aria-label="Acceso a la cuenta">
            <Button render={<Link href="/sign-in" />} nativeButton={false} variant="ghost" size="lg" className="agora-button_login">
              Iniciar sesión
            </Button>
            <Button render={<Link href="/sign-up" />} nativeButton={false} variant="ghost" size="lg" className="agora-button_register">
              Registrarse
            </Button>
          </nav>
        </div>

      </footer>
      <Script id="hallmark-slots" strategy="afterInteractive">
        {`window.hallmarkSlots = (m) => { for (const [k, v] of Object.entries(m)) { const s = document.querySelector('[data-slot="' + k + '"]'); if (!s) continue; const im = new Image(); im.src = typeof v === 'string' ? v : v.src; im.alt = (typeof v === 'object' && v.alt) || s.dataset.alt || ''; im.addEventListener('error', () => im.remove(), { once: true }); s.querySelectorAll(':scope > img').forEach((o) => o.remove()); s.prepend(im); } }; document.querySelectorAll('[data-slot] img').forEach((i) => { if (i.complete && !i.naturalWidth) i.remove(); else i.addEventListener('error', () => i.remove(), { once: true }); });`}
      </Script>
    </main>
  );
}
