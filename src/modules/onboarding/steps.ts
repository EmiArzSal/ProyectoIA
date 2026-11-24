// "Primeros pasos": the checklist a new user sees on the dashboard. Every step
// is derived from data the app already stores, so it never goes out of sync
// (deleting something or switching devices shows the truth). Pure; tested in
// steps.test.ts.

export type OnboardingSignals = {
  /** An interview was started (interview_usage survives deleting it). */
  startedInterview: boolean;
  /** An interview was evaluated (status completed). */
  receivedReport: boolean;
  /** A correction was turned into a flashcard. */
  correctionCard: boolean;
  /** A flashcard was reviewed at least once. */
  reviewedCard: boolean;
  /** A word was saved from the dictionary. */
  savedWord: boolean;
};

export type OnboardingStepId = keyof OnboardingSignals;

export type OnboardingStep = {
  id: OnboardingStepId;
  title: string;
  description: string;
  href: string;
  cta: string;
  done: boolean;
};

const STEPS: Omit<OnboardingStep, "done">[] = [
  {
    id: "startedInterview",
    title: "Haz tu primera entrevista",
    description: "Elige un entrevistador y responde sus preguntas en inglés.",
    href: "/agentes",
    cta: "Elegir entrevistador",
  },
  {
    id: "receivedReport",
    title: "Revisa tu reporte",
    description: "Consulta tu nivel de inglés, tus calificaciones y las correcciones.",
    href: "/meetings",
    cta: "Ver historial",
  },
  {
    id: "correctionCard",
    title: "Agrega una corrección a tus tarjetas",
    description: "Convierte un error de tu entrevista en una tarjeta de estudio.",
    href: "/corrections",
    cta: "Ver correcciones",
  },
  {
    id: "reviewedCard",
    title: "Haz tu primer repaso",
    description: "Repasa tus tarjetas pendientes y califica qué tanto las recuerdas.",
    href: "/glossary",
    cta: "Ir al glosario",
  },
  {
    id: "savedWord",
    title: "Guarda una palabra del diccionario",
    description: "Busca una palabra en inglés y guárdala con su definición.",
    href: "/glossary?tab=dictionary",
    cta: "Abrir diccionario",
  },
];

export type OnboardingChecklist = {
  steps: OnboardingStep[];
  completed: number;
  total: number;
  /** All steps done. */
  finished: boolean;
  /** The step to suggest next (the first one not done), if any. */
  next: OnboardingStepId | null;
  /** Whether the dashboard shows the card at all. */
  visible: boolean;
};

/** `dismissed`: the user closed the card (or acknowledged finishing it). */
export function buildChecklist(signals: OnboardingSignals, dismissed: boolean): OnboardingChecklist {
  const steps = STEPS.map((s) => ({ ...s, done: signals[s.id] }));
  const completed = steps.filter((s) => s.done).length;
  return {
    steps,
    completed,
    total: steps.length,
    finished: completed === steps.length,
    next: steps.find((s) => !s.done)?.id ?? null,
    visible: !dismissed,
  };
}
