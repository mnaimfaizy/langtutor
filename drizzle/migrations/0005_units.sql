CREATE TABLE `units` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`unit_index` integer NOT NULL,
	`title` text NOT NULL,
	`teacher_note` text NOT NULL,
	`target_grammar_ids` text DEFAULT '[]' NOT NULL,
	`target_cefr` text NOT NULL,
	`activities` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'locked' NOT NULL,
	`buffer_status` text DEFAULT 'empty' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_units_user_index` ON `units` (`user_id`,`unit_index`);
