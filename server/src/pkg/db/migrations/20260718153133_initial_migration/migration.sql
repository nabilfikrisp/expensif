CREATE TABLE `api_keys` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`key_hash` text NOT NULL,
	`label` text,
	`created_at` text NOT NULL,
	`last_used_at` text,
	`revoked_at` text,
	CONSTRAINT `fk_api_keys_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
);
--> statement-breakpoint
CREATE TABLE `linked_accounts` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`platform` text NOT NULL,
	`platform_user_id` text NOT NULL,
	`platform_username` text,
	`linked_at` text NOT NULL,
	CONSTRAINT `fk_linked_accounts_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`),
	CONSTRAINT `linked_accounts_platform_user_unique` UNIQUE(`platform`,`platform_user_id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY,
	`email` text NOT NULL UNIQUE,
	`password_hash` text NOT NULL,
	`name` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`slug` text NOT NULL UNIQUE
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`linked_account_id` text,
	`raw_text` text NOT NULL,
	`external_message_id` text,
	`parse_status` text NOT NULL,
	`received_at` text NOT NULL,
	CONSTRAINT `fk_messages_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`),
	CONSTRAINT `fk_messages_linked_account_id_linked_accounts_id_fk` FOREIGN KEY (`linked_account_id`) REFERENCES `linked_accounts`(`id`)
);
--> statement-breakpoint
CREATE TABLE `expenses` (
	`id` text PRIMARY KEY,
	`message_id` text,
	`user_id` text NOT NULL,
	`category_id` text,
	`item_name` text NOT NULL,
	`amount` numeric NOT NULL,
	`currency` text DEFAULT 'IDR' NOT NULL,
	`expense_date` text NOT NULL,
	`note` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT `fk_expenses_message_id_messages_id_fk` FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`),
	CONSTRAINT `fk_expenses_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`),
	CONSTRAINT `fk_expenses_category_id_categories_id_fk` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`)
);
--> statement-breakpoint
CREATE INDEX `api_keys_key_hash_idx` ON `api_keys` (`key_hash`);--> statement-breakpoint
CREATE INDEX `messages_user_id_idx` ON `messages` (`user_id`);--> statement-breakpoint
CREATE INDEX `expenses_user_id_date_idx` ON `expenses` (`user_id`,`expense_date`);--> statement-breakpoint
CREATE INDEX `expenses_message_id_idx` ON `expenses` (`message_id`);