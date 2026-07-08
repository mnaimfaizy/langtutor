CREATE TABLE `media_assets` (
	`kind` text NOT NULL,
	`key` text NOT NULL,
	`style` text NOT NULL,
	`mime_type` text NOT NULL,
	`data` blob NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`kind`, `key`, `style`)
);
