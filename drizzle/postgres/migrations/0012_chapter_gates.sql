CREATE TABLE "chapter_gates" (
	"user_id" uuid NOT NULL,
	"tier" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	PRIMARY KEY("user_id","tier")
);
--> statement-breakpoint
ALTER TABLE "chapter_gates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "chapter_gates" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "chapter_gates_isolate_by_user" ON "chapter_gates"
  FOR ALL
  USING ("user_id"::text = current_setting('request.jwt.claim.sub', true))
  WITH CHECK ("user_id"::text = current_setting('request.jwt.claim.sub', true));
