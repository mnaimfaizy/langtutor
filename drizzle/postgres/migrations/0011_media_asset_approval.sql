ALTER TABLE "media_assets" ADD COLUMN "source" text DEFAULT 'generated' NOT NULL;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "approval_status" text DEFAULT 'approved' NOT NULL;
