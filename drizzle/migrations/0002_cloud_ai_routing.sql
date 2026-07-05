ALTER TABLE `app_config` ADD `chat_provider` text DEFAULT 'mac' NOT NULL;--> statement-breakpoint
ALTER TABLE `app_config` ADD `chat_model` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `app_config` ADD `stt_provider` text DEFAULT 'mac' NOT NULL;
