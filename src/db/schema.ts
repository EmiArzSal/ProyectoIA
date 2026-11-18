import { nanoid } from  "nanoid";
import { pgTable, text, timestamp, boolean, pgEnum, integer, jsonb, real, uniqueIndex, index } from "drizzle-orm/pg-core";
import type { InterviewReport } from "@/lib/generate-summary";
import { sql } from "drizzle-orm";

export type CorrectionType = "grammar" | "vocabulary" | "technical";


export const user = pgTable("user", {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    emailVerified: boolean('email_verified').$defaultFn(() => false).notNull(),
    image: text('image'),
    createdAt: timestamp('created_at').$defaultFn(() => /* @__PURE__ */ new Date()).notNull(),
    updatedAt: timestamp('updated_at').$defaultFn(() => /* @__PURE__ */ new Date()).notNull(),
    // Recording/AI-processing consent (see src/lib/consent.ts). Null = never
    // accepted; an older version than CONSENT_VERSION must accept again.
    recordingConsentVersion: integer('recording_consent_version'),
    recordingConsentAt: timestamp('recording_consent_at'),
});

export const session = pgTable("session", {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at').notNull(),
    token: text('token').notNull().unique(),
    createdAt: timestamp('created_at').notNull(),
    updatedAt: timestamp('updated_at').notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id').notNull().references(()=> user.id, { onDelete: 'cascade' })
}, (t) => [
  // better-auth lists/revokes a user's sessions; also the account-deletion cascade.
  index("session_user_idx").on(t.userId),
]);

export const account = pgTable("account", {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id').notNull().references(()=> user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at'),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at').notNull(),
    updatedAt: timestamp('updated_at').notNull()
}, (t) => [
  index("account_user_idx").on(t.userId),
]);

export const verification = pgTable("verification", {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').$defaultFn(() => /* @__PURE__ */ new Date()),
    updatedAt: timestamp('updated_at').$defaultFn(() => /* @__PURE__ */ new Date())
});

// "failed": the evaluation job ran out of retries; the user can retry it.
export const meetingStatus = pgEnum("meeting_status", ["upcoming", "active", "completed", "processing","cancelled", "failed"]);

export const meetings = pgTable("meetings", {
    id: text('id')
    .primaryKey()
    .$defaultFn(() => nanoid()),
    name: text('name').notNull(),
    userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
    agentId: text("agent_id")
    .notNull(),
    status: meetingStatus("status").notNull().default("upcoming"),
    startedAt: timestamp('started_at'),
    endedAt: timestamp('ended_at'),
    // JSONL transcript built turn by turn by the server (see call/server/session.ts).
    // The column keeps its original name; only the property was renamed.
    transcript: text('transcript_url'),
    // Deprecated: the report as JSON text. Replaced by `report`; dropped once
    // the deploy that stops reading it is live.
    summary: text('summary'),
    // The evaluation report, plus its headline numbers as plain columns so
    // progress can be queried in SQL. Null = no evidence (see lib/report-columns).
    report: jsonb('report').$type<InterviewReport>(),
    englishLevel: text('english_level'),            // "A1" … "C2"
    grammarScore: real('grammar_score'),            // 1–5
    vocabularyScore: real('vocabulary_score'),
    fluencyScore: real('fluency_score'),
    technicalScore: real('technical_score'),
    softSkillsScore: real('soft_skills_score'),
    // Set in the same transaction that applies streak, achievements and topic
    // progress, so a retried evaluation never applies them twice.
    rewardsAppliedAt: timestamp('rewards_applied_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow()

}, (t) => [
  // History list (order + pagination), its total, the home page's "this
  // week/month" counts and per-interviewer counts: one user's rows, in order.
  index("meetings_user_created_idx").on(t.userId, t.createdAt.desc().nullsFirst(), t.id.desc().nullsFirst()),
  // Completed interviews: stats, progress, achievements.
  index("meetings_user_status_idx").on(t.userId, t.status),
  // Abandoned-interview cron. Partial: only interviews in progress, so it is
  // almost always empty and costs nothing to other writes.
  index("meetings_active_started_idx").on(t.startedAt).where(sql`status = 'active'`),
]);

export const glossaryEntries = pgTable("glossary_entries", {
  id: text('id').primaryKey().$defaultFn(() => nanoid()),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: 'cascade' }),
  term: text('term').notNull(),
  definition: text('definition').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  index("glossary_entries_user_created_idx").on(t.userId, t.createdAt.desc().nullsFirst()),
]);

export const userStats = pgTable("user_stats", {
  id: text('id').primaryKey().$defaultFn(() => nanoid()),
  userId: text("user_id").notNull().unique().references(() => user.id, { onDelete: 'cascade' }),
  currentStreak: integer('current_streak').notNull().default(0),
  longestStreak: integer('longest_streak').notNull().default(0),
  lastPracticeDate: text('last_practice_date'), // "YYYY-MM-DD"
  totalSessions: integer('total_sessions').notNull().default(0),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const userAchievements = pgTable("user_achievements", {
  id: text('id').primaryKey().$defaultFn(() => nanoid()),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: 'cascade' }),
  achievementId: text('achievement_id').notNull(),
  seen: boolean('seen').notNull().default(false),
  earnedAt: timestamp('earned_at').notNull().defaultNow(),
}, (t) => [
  // An achievement is earned once. Also serves lookups by user_id.
  uniqueIndex("user_achievements_user_achievement_idx").on(t.userId, t.achievementId),
]);

export const dictionaryEntries = pgTable("dictionary_entries", {
  id: text('id').primaryKey().$defaultFn(() => nanoid()),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: 'cascade' }),
  word: text('word').notNull(),
  definition: text('definition').notNull(),
  partOfSpeech: text('part_of_speech'),
  phonetic: text('phonetic'),
  audioUrl: text('audio_url'),
  language: text('language').notNull(), // 'en' | 'es'
  letter: text('letter').notNull(),     // primera letra en mayúscula
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  // Matches the alphabetical listing, so no sort is needed.
  index("dictionary_entries_user_letter_word_idx").on(t.userId, t.letter, t.word),
]);

export const corrections = pgTable("corrections", {
  id: text('id').primaryKey().$defaultFn(() => nanoid()),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: 'cascade' }),
  meetingId: text("meeting_id").references(() => meetings.id, { onDelete: 'cascade' }),
  original: text('original').notNull(),
  corrected: text('corrected').notNull(),
  type: text('type').notNull(), // "grammar" | "vocabulary" | "technical"
  note: text('note').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  index("corrections_user_created_idx").on(t.userId, t.createdAt.desc().nullsFirst()),
  // Meeting deletion cascade and saveCorrections' delete-by-meeting.
  index("corrections_meeting_idx").on(t.meetingId),
]);
// ── Interview plan ────────────────────────────────────────────────────────────
// The 10 questions chosen for a meeting when it starts (6 technical + 4 soft).
// Topics come from src/lib/interview-topics.ts.
export const meetingQuestions = pgTable("meeting_questions", {
  id: text('id').primaryKey().$defaultFn(() => nanoid()),
  meetingId: text("meeting_id").notNull().references(() => meetings.id, { onDelete: 'cascade' }),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: 'cascade' }),
  position: integer('position').notNull(),          // 1–10
  kind: text('kind').notNull(),                     // "technical" | "soft"
  topicId: text('topic_id').notNull(),
  level: integer('level').notNull(),                // 1–3 (soft: always 1)
  question: text('question').notNull(),
  expectedConcepts: jsonb('expected_concepts').$type<string[]>().notNull(),
  source: text('source').notNull(),                 // "generated" | "seed"
  score: integer('score'),                          // 1–5 after evaluation; null if unanswered
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  uniqueIndex("meeting_questions_meeting_position_idx").on(t.meetingId, t.position),
  index("meeting_questions_user_topic_idx").on(t.userId, t.topicId),
]);

// Per-user mastery of each topic; drives adaptive topic selection.
export const userTopicProgress = pgTable("user_topic_progress", {
  id: text('id').primaryKey().$defaultFn(() => nanoid()),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: 'cascade' }),
  topicId: text('topic_id').notNull(),
  level: integer('level').notNull().default(1),     // next level to ask (1–3)
  attempts: integer('attempts').notNull().default(0),
  lastScore: integer('last_score'),                 // 1–5
  bestScore: integer('best_score'),
  lastPracticedAt: timestamp('last_practiced_at'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  uniqueIndex("user_topic_progress_user_topic_idx").on(t.userId, t.topicId),
]);

// One row per interview STARTED: what the daily quotas count. Kept when the
// meeting is deleted (meeting_id becomes NULL), so deleting history never gives
// back a quota slot; the API cost was already spent. Holds no interview content.
export const interviewUsage = pgTable("interview_usage", {
  id: text('id').primaryKey().$defaultFn(() => nanoid()),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: 'cascade' }),
  meetingId: text("meeting_id").references(() => meetings.id, { onDelete: 'set null' }),
  startedAt: timestamp('started_at').notNull(),
}, (t) => [
  index("interview_usage_user_started_idx").on(t.userId, t.startedAt),
  index("interview_usage_started_idx").on(t.startedAt),
  // At most one row per meeting (several NULLs are allowed after deletions).
  uniqueIndex("interview_usage_meeting_idx").on(t.meetingId),
]);
