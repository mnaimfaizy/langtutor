CREATE TABLE `chapter_gates` (
	`user_id` text NOT NULL,
	`tier` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `tier`)
);
