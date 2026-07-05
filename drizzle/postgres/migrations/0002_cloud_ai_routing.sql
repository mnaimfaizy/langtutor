ALTER TABLE "app_config" ADD COLUMN "chat_provider" text DEFAULT 'mac' NOT NULL;--> statement-breakpoint
ALTER TABLE "app_config" ADD COLUMN "chat_model" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "app_config" ADD COLUMN "stt_provider" text DEFAULT 'mac' NOT NULL;
