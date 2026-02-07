CREATE TABLE `canvas_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`canvas_id` text NOT NULL,
	`version` integer NOT NULL,
	`elements` text NOT NULL,
	`app_state` text,
	`files` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`canvas_id`) REFERENCES `canvases`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `canvases` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text DEFAULT 'Untitled' NOT NULL,
	`current_version` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `operations` (
	`id` text PRIMARY KEY NOT NULL,
	`canvas_id` text NOT NULL,
	`base_version` integer NOT NULL,
	`op_type` text NOT NULL,
	`element_id` text NOT NULL,
	`payload` text NOT NULL,
	`user_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`canvas_id`) REFERENCES `canvases`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`canvas_id` text NOT NULL,
	`user_id` text NOT NULL,
	`cursor_x` integer,
	`cursor_y` integer,
	`color` text DEFAULT '#f97316' NOT NULL,
	`last_active_at` integer NOT NULL,
	FOREIGN KEY (`canvas_id`) REFERENCES `canvases`(`id`) ON UPDATE no action ON DELETE cascade
);
