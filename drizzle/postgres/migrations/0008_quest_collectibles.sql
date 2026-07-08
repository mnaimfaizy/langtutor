CREATE TABLE "quest_state" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"daily_period_start" text,
	"weekly_period_start" text,
	"entries" text DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_quest_state_user_id" ON "quest_state" USING btree ("user_id");--> statement-breakpoint
CREATE TABLE "collectible_grants" (
	"user_id" uuid NOT NULL,
	"collectible_id" text NOT NULL,
	"unit_id" integer NOT NULL,
	"granted_at" timestamp with time zone NOT NULL,
	PRIMARY KEY("user_id","collectible_id","unit_id")
);
--> statement-breakpoint
ALTER TABLE "quest_state" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "quest_state" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "quest_state_isolate_by_user" ON "quest_state"
  FOR ALL
  USING ("user_id"::text = current_setting('request.jwt.claim.sub', true))
  WITH CHECK ("user_id"::text = current_setting('request.jwt.claim.sub', true));--> statement-breakpoint
ALTER TABLE "collectible_grants" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "collectible_grants" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "collectible_grants_isolate_by_user" ON "collectible_grants"
  FOR ALL
  USING ("user_id"::text = current_setting('request.jwt.claim.sub', true))
  WITH CHECK ("user_id"::text = current_setting('request.jwt.claim.sub', true));
