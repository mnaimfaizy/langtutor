ALTER TABLE `media_assets` ADD `source` text DEFAULT 'generated' NOT NULL;
--> statement-breakpoint
ALTER TABLE `media_assets` ADD `approval_status` text DEFAULT 'approved' NOT NULL;
