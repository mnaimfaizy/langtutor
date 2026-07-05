ALTER TABLE "app_config" ADD COLUMN "embeddings_provider" text DEFAULT 'mac' NOT NULL;--> statement-breakpoint
ALTER TABLE "app_config" ADD COLUMN "embeddings_model" text DEFAULT '' NOT NULL;
