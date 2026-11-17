import { nanoid } from  "nanoid";
import { pgTable, text, timestamp, boolean, pgEnum, integer, jsonb, uniqueIndex, index } from "drizzle-orm/pg-core";

export type CorrectionType = "grammar" | "vocabulary" | "technical";


export const user = pgTable("user", {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    emailVerified: boolean('email_verified').$defaultFn(() => false).notNull(),
    image: text('image'),
    createdAt: timestamp('created_at').$defaultFn(() => /* @__PURE__ */ new Date()).notNull(),
    updatedAt: timestamp('updated_at').$defaultFn(() => /* @__PURE__ */ new Date()).notNull()
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
});

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
});

export const verification = pgTable("verification", {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').$defaultFn(() => /* @__PURE__ */ new Date()),
    updatedAt: timestamp('updated_at').$defaultFn(() => /* @__PURE__ */ new Date())
});

export const agents = pgTable("agents", {
    id: text('id')
    .primaryKey()
    .$defaultFn(() => nanoid()),
    name: text('name').notNull(),
    userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
    instructions: text('instructions').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow()

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
    transcriptUrl: text('transcript_url'),
    recordingUrl: text('recording_url'),
    summary: text('summary'),
    // Set in the same transaction that applies streak, achievements and topic
    // progress, so a retried evaluation never applies them twice.
    rewardsAppliedAt: timestamp('rewards_applied_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow()

});

export const glossaryEntries = pgTable("glossary_entries", {
  id: text('id').primaryKey().$defaultFn(() => nanoid()),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: 'cascade' }),
  term: text('term').notNull(),
  definition: text('definition').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

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
});

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
});

export const corrections = pgTable("corrections", {
  id: text('id').primaryKey().$defaultFn(() => nanoid()),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: 'cascade' }),
  meetingId: text("meeting_id").references(() => meetings.id, { onDelete: 'cascade' }),
  original: text('original').notNull(),
  corrected: text('corrected').notNull(),
  type: text('type').notNull(), // "grammar" | "vocabulary" | "technical"
  note: text('note').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
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
