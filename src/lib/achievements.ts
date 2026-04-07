export type AchievementCategory = "sessions" | "streak" | "level" | "performance";

export type Achievement = {
  id: string;
  title: string;
  description: string;
  emoji: string;
  category: AchievementCategory;
};

export const ACHIEVEMENTS: Achievement[] = [
  // Sesiones
  { id: "first_session",  emoji: "🎯", category: "sessions",     title: "Primera entrevista",    description: "Completaste tu primera entrevista de práctica" },
  { id: "sessions_5",     emoji: "⭐", category: "sessions",     title: "5 entrevistas",          description: "Completaste 5 entrevistas de práctica" },
  { id: "sessions_10",    emoji: "🏆", category: "sessions",     title: "10 entrevistas",         description: "Completaste 10 entrevistas de práctica" },
  { id: "sessions_25",    emoji: "🌟", category: "sessions",     title: "25 entrevistas",         description: "Completaste 25 entrevistas de práctica" },
  // Rachas
  { id: "streak_3",       emoji: "🔥", category: "streak",       title: "Racha de 3 días",        description: "Practicaste 3 días consecutivos" },
  { id: "streak_7",       emoji: "🔥", category: "streak",       title: "Racha semanal",          description: "Practicaste 7 días consecutivos" },
  { id: "streak_30",      emoji: "💪", category: "streak",       title: "Racha mensual",          description: "Practicaste 30 días consecutivos" },
  // Nivel CEFR
  { id: "level_b1",       emoji: "📈", category: "level",        title: "Nivel B1",               description: "Alcanzaste nivel B1 en inglés" },
  { id: "level_b2",       emoji: "📈", category: "level",        title: "Nivel B2",               description: "Alcanzaste nivel B2 en inglés" },
  { id: "level_c1",       emoji: "🎓", category: "level",        title: "Nivel C1",               description: "Alcanzaste nivel C1 en inglés" },
  // Rendimiento
  { id: "no_skips",       emoji: "💎", category: "performance",  title: "Sin pausas",             description: "Completaste una sesión sin saltar ninguna pregunta" },
  { id: "all_agents",     emoji: "🗺️", category: "performance",  title: "Explorador",             description: "Practicaste con los 5 tipos de agente" },
];

export const CATEGORY_LABELS: Record<AchievementCategory, string> = {
  sessions:    "Sesiones",
  streak:      "Rachas",
  level:       "Nivel de inglés",
  performance: "Rendimiento",
};

export function getAchievement(id: string) {
  return ACHIEVEMENTS.find((a) => a.id === id);
}
