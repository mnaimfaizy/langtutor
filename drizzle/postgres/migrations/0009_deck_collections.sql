ALTER TABLE "cards" ADD COLUMN "suspended" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE TABLE "collections" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "card_collection_members" (
	"user_id" uuid NOT NULL,
	"collection_id" integer NOT NULL,
	"card_id" integer NOT NULL,
	PRIMARY KEY("user_id","collection_id","card_id")
);
--> statement-breakpoint
ALTER TABLE "collections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "collections" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "collections_isolate_by_user" ON "collections"
  FOR ALL
  USING ("user_id"::text = current_setting('request.jwt.claim.sub', true))
  WITH CHECK ("user_id"::text = current_setting('request.jwt.claim.sub', true));--> statement-breakpoint
ALTER TABLE "card_collection_members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "card_collection_members" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "card_collection_members_isolate_by_user" ON "card_collection_members"
  FOR ALL
  USING ("user_id"::text = current_setting('request.jwt.claim.sub', true))
  WITH CHECK ("user_id"::text = current_setting('request.jwt.claim.sub', true));
