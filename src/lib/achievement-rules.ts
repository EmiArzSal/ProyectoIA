// Which achievements a finished interview unlocks. Pure (no DB) so the rules
// are unit-tested in streak.test.ts; award-achievements.ts loads the inputs.
import type { StreakStats } from "@/lib/streak";
import { NO_ANSWER } from "@/modules/call/constants";

const CEFR_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"];
export const TOTAL_AGENTS = 5;

export type AchievementInput = {
  /** Stats AFTER this interview (see computeStreak). */
  stats: StreakStats;
  /** "A1".."C2", or "N/A" when there was not enough evidence. */
  englishLevel: string | undefined;
  answers: (string | undefined)[];
  /** Distinct interviewers practiced with, including this interview's. */
  agentsPracticed: number;
  alreadyEarned: Set<string>;
};

export function pickAchievements({ stats, englishLevel, answers, agentsPracticed, alreadyEarned }: AchievementInput): string[] {
  const toAward: string[] = [];
  const check = (id: string, condition: boolean) => {
    if (condition && !alreadyEarned.has(id)) toAward.push(id);
  };

  check("first_session", stats.totalSessions >= 1);
  check("sessions_5",    stats.totalSessions >= 5);
  check("sessions_10",   stats.totalSessions >= 10);
  check("sessions_25",   stats.totalSessions >= 25);

  check("streak_3",  stats.currentStreak >= 3);
  check("streak_7",  stats.currentStreak >= 7);
  check("streak_30", stats.currentStreak >= 30);

  // "N/A" (or anything unknown) is -1 and unlocks nothing.
  const levelIdx = CEFR_ORDER.indexOf(englishLevel?.toUpperCase() ?? "");
  check("level_b1", levelIdx >= CEFR_ORDER.indexOf("B1"));
  check("level_b2", levelIdx >= CEFR_ORDER.indexOf("B2"));
  check("level_c1", levelIdx >= CEFR_ORDER.indexOf("C1"));

  // No skips: at least one question, and every one answered.
  check("no_skips", answers.length > 0 && answers.every((a) => !!a?.trim() && a !== NO_ANSWER));

  check("all_agents", agentsPracticed >= TOTAL_AGENTS);

  return toAward;
}
