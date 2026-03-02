CREATE TYPE "public"."game_step_type" AS ENUM('theory', 'quiz');--> statement-breakpoint
CREATE TYPE "public"."session_status" AS ENUM('waiting', 'in_progress', 'finished');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"created_by_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_participant" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"participant_token" text NOT NULL,
	"total_score" integer DEFAULT 0 NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "game_participant_participant_token_unique" UNIQUE("participant_token")
);
--> statement-breakpoint
CREATE TABLE "game_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"host_id" text NOT NULL,
	"invite_code" text NOT NULL,
	"status" "session_status" DEFAULT 'waiting' NOT NULL,
	"current_step_index" integer DEFAULT -1 NOT NULL,
	"step_started_at" timestamp,
	"answer_revealed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "game_session_invite_code_unique" UNIQUE("invite_code")
);
--> statement-breakpoint
CREATE TABLE "game_step" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"order" integer NOT NULL,
	"type" "game_step_type" NOT NULL,
	"markdown_content" text,
	"code_block" jsonb,
	"question" text,
	"choices" jsonb,
	"time_limit_seconds" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "participant_answer" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"participant_id" uuid NOT NULL,
	"step_id" uuid NOT NULL,
	"choice_index" integer NOT NULL,
	"is_correct" boolean NOT NULL,
	"answered_at" timestamp DEFAULT now() NOT NULL,
	"score" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game" ADD CONSTRAINT "game_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_participant" ADD CONSTRAINT "game_participant_session_id_game_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."game_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_session" ADD CONSTRAINT "game_session_game_id_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_session" ADD CONSTRAINT "game_session_host_id_user_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_step" ADD CONSTRAINT "game_step_game_id_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant_answer" ADD CONSTRAINT "participant_answer_participant_id_game_participant_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."game_participant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant_answer" ADD CONSTRAINT "participant_answer_step_id_game_step_id_fk" FOREIGN KEY ("step_id") REFERENCES "public"."game_step"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "game_created_by_idx" ON "game" USING btree ("created_by_id");--> statement-breakpoint
CREATE INDEX "participant_session_idx" ON "game_participant" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "participant_token_idx" ON "game_participant" USING btree ("participant_token");--> statement-breakpoint
CREATE INDEX "game_session_game_idx" ON "game_session" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "game_session_host_idx" ON "game_session" USING btree ("host_id");--> statement-breakpoint
CREATE INDEX "game_session_invite_idx" ON "game_session" USING btree ("invite_code");--> statement-breakpoint
CREATE INDEX "game_step_game_idx" ON "game_step" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "game_step_order_idx" ON "game_step" USING btree ("game_id","order");--> statement-breakpoint
CREATE INDEX "answer_participant_idx" ON "participant_answer" USING btree ("participant_id");--> statement-breakpoint
CREATE INDEX "answer_step_idx" ON "participant_answer" USING btree ("step_id");