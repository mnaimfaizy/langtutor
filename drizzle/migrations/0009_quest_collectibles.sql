CREATE TABLE `quest_state` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`daily_period_start` text,
	`weekly_period_start` text,
	`entries` text DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_quest_state_user_id` ON `quest_state` (`user_id`);--> statement-breakpoint
CREATE TABLE `collectible_grants` (
	`user_id` text NOT NULL,
	`collectible_id` text NOT NULL,
	`unit_id` integer NOT NULL,
	`granted_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `collectible_id`, `unit_id`)
);
