CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"role" text DEFAULT 'standard' NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "app_config" (
	"id" integer PRIMARY KEY NOT NULL,
	"mac_llm_base_url" text NOT NULL,
	"mac_llm_model" text NOT NULL,
	"mac_utility_model" text NOT NULL,
	"mac_embed_model" text NOT NULL,
	"mac_stt_url" text NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"level" text NOT NULL,
	"topic" text NOT NULL,
	"payload" text NOT NULL,
	"source" text NOT NULL,
	"validated_at" timestamp with time zone NOT NULL,
	"embedding" text
);
--> statement-breakpoint
CREATE INDEX "idx_content_type_level" ON "content" USING btree ("type","level");--> statement-breakpoint
CREATE TABLE "lexicon_cache" (
	"word" text PRIMARY KEY NOT NULL,
	"data" text NOT NULL,
	"cached_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profile" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"cefr_level" text,
	"goals" text DEFAULT '[]' NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"settings" text DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_profile_user_id" ON "profile" USING btree ("user_id");--> statement-breakpoint
CREATE TABLE "cards" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"word" text NOT NULL,
	"sense" text,
	"definition" text NOT NULL,
	"examples" text DEFAULT '[]' NOT NULL,
	"cefr" text NOT NULL,
	"fsrs" text NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"embedding" text
);
--> statement-breakpoint
CREATE INDEX "idx_cards_user_due" ON "cards" USING btree ("user_id","due_at");--> statement-breakpoint
CREATE TABLE "error_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"skill" text NOT NULL,
	"category" text NOT NULL,
	"cefr" text NOT NULL,
	"context" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_error_events_skill_cefr" ON "error_events" USING btree ("user_id","skill","cefr");--> statement-breakpoint
CREATE TABLE "weakness" (
	"user_id" uuid NOT NULL,
	"skill" text NOT NULL,
	"category" text NOT NULL,
	"cefr" text NOT NULL,
	"score" double precision NOT NULL,
	"confidence" double precision NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "weakness_user_id_skill_category_cefr_pk" PRIMARY KEY("user_id","skill","category","cefr")
);
--> statement-breakpoint
CREATE TABLE "gamification" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"xp" integer DEFAULT 0 NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"streak_count" integer DEFAULT 0 NOT NULL,
	"last_activity_date" text,
	"achievements" text DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_gamification_user_id" ON "gamification" USING btree ("user_id");
