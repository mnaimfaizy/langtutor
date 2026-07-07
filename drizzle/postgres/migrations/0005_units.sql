CREATE TABLE "units" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"unit_index" integer NOT NULL,
	"title" text NOT NULL,
	"teacher_note" text NOT NULL,
	"target_grammar_ids" text DEFAULT '[]' NOT NULL,
	"target_cefr" text NOT NULL,
	"activities" text DEFAULT '[]' NOT NULL,
	"status" text DEFAULT 'locked' NOT NULL,
	"buffer_status" text DEFAULT 'empty' NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_units_user_index" ON "units" USING btree ("user_id","unit_index");--> statement-breakpoint
ALTER TABLE "units" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "units" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "units_isolate_by_user" ON "units"
  FOR ALL
  USING ("user_id"::text = current_setting('request.jwt.claim.sub', true))
  WITH CHECK ("user_id"::text = current_setting('request.jwt.claim.sub', true));
