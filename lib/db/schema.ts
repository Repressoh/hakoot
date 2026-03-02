import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const gameStepTypeEnum = pgEnum("game_step_type", ["theory", "quiz"]);
export const sessionStatusEnum = pgEnum("session_status", [
  "waiting",
  "in_progress",
  "finished",
]);

// ---------------------------------------------------------------------------
// Better-auth managed tables
// ---------------------------------------------------------------------------

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ---------------------------------------------------------------------------
// Game template
// ---------------------------------------------------------------------------

export const game = pgTable(
  "game",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    description: text("description"),
    createdById: text("created_by_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("game_created_by_idx").on(t.createdById)]
);

// ---------------------------------------------------------------------------
// Game step (theory or quiz)
// ---------------------------------------------------------------------------

export interface CodeAnnotation {
  explanation: string;
  label: string;
  lines: number[];
}

export interface CodeBlock {
  annotations: CodeAnnotation[];
  code: string;
  language: string;
}

export interface QuizChoice {
  isCorrect: boolean;
  text: string;
}

export const gameStep = pgTable(
  "game_step",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gameId: uuid("game_id")
      .notNull()
      .references(() => game.id, { onDelete: "cascade" }),
    order: integer("order").notNull(),
    type: gameStepTypeEnum("type").notNull(),
    // Theory fields
    markdownContent: text("markdown_content"),
    codeBlock: jsonb("code_block").$type<CodeBlock>(),
    // Quiz fields
    question: text("question"),
    choices: jsonb("choices").$type<QuizChoice[]>(),
    timeLimitSeconds: integer("time_limit_seconds"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("game_step_game_idx").on(t.gameId),
    index("game_step_order_idx").on(t.gameId, t.order),
  ]
);

// ---------------------------------------------------------------------------
// Game session (live run of a game template)
// ---------------------------------------------------------------------------

export const gameSession = pgTable(
  "game_session",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gameId: uuid("game_id")
      .notNull()
      .references(() => game.id, { onDelete: "cascade" }),
    hostId: text("host_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    inviteCode: text("invite_code").notNull().unique(),
    status: sessionStatusEnum("status").notNull().default("waiting"),
    currentStepIndex: integer("current_step_index").notNull().default(-1),
    stepStartedAt: timestamp("step_started_at"),
    answerRevealed: boolean("answer_revealed").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("game_session_game_idx").on(t.gameId),
    index("game_session_host_idx").on(t.hostId),
    index("game_session_invite_idx").on(t.inviteCode),
  ]
);

// ---------------------------------------------------------------------------
// Game participant (guest player in a session)
// ---------------------------------------------------------------------------

export const gameParticipant = pgTable(
  "game_participant",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => gameSession.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email"),
    participantToken: text("participant_token").notNull().unique(),
    totalScore: integer("total_score").notNull().default(0),
    joinedAt: timestamp("joined_at").notNull().defaultNow(),
  },
  (t) => [
    index("participant_session_idx").on(t.sessionId),
    index("participant_token_idx").on(t.participantToken),
  ]
);

// ---------------------------------------------------------------------------
// Participant answer
// ---------------------------------------------------------------------------

export const participantAnswer = pgTable(
  "participant_answer",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => gameParticipant.id, { onDelete: "cascade" }),
    stepId: uuid("step_id")
      .notNull()
      .references(() => gameStep.id, { onDelete: "cascade" }),
    choiceIndex: integer("choice_index").notNull(),
    isCorrect: boolean("is_correct").notNull(),
    answeredAt: timestamp("answered_at").notNull().defaultNow(),
    score: integer("score").notNull().default(0),
  },
  (t) => [
    index("answer_participant_idx").on(t.participantId),
    index("answer_step_idx").on(t.stepId),
  ]
);

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------

export type User = typeof user.$inferSelect;
export type Game = typeof game.$inferSelect;
export type GameStep = typeof gameStep.$inferSelect;
export type GameSession = typeof gameSession.$inferSelect;
export type GameParticipant = typeof gameParticipant.$inferSelect;
export type ParticipantAnswer = typeof participantAnswer.$inferSelect;
