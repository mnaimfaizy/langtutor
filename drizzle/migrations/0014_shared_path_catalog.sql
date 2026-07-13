CREATE TABLE `shared_path_stages` (
	`id` text PRIMARY KEY NOT NULL,
	`tier` text DEFAULT 'pre-A1' NOT NULL,
	`title` text NOT NULL,
	`spine_section_key` text NOT NULL,
	`stage_order` integer NOT NULL,
	`ready_for_exam` integer DEFAULT false NOT NULL,
	`updated_at` integer NOT NULL
);--> statement-breakpoint
CREATE TABLE `shared_path_unit_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`tier` text DEFAULT 'pre-A1' NOT NULL,
	`stage_id` text NOT NULL,
	`stage_order` integer NOT NULL,
	`path_index` integer NOT NULL,
	`title` text NOT NULL,
	`teacher_note` text NOT NULL,
	`activities` text DEFAULT '[]' NOT NULL,
	`richness` text NOT NULL,
	`approval_status` text DEFAULT 'approved' NOT NULL,
	`provenance` text NOT NULL,
	`target_vocab` text DEFAULT '[]' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_shared_path_unit_templates_path_index` ON `shared_path_unit_templates` (`path_index`);
