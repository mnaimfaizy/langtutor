ALTER TABLE `cards` ADD `suspended` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE TABLE `collections` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `card_collection_members` (
	`user_id` text NOT NULL,
	`collection_id` integer NOT NULL,
	`card_id` integer NOT NULL,
	PRIMARY KEY(`user_id`, `collection_id`, `card_id`)
);
