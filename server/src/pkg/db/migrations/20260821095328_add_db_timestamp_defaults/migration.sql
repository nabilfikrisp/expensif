PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_api_keys` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`key_hash` text NOT NULL,
	`label` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`last_used_at` text,
	`revoked_at` text,
	CONSTRAINT `fk_api_keys_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
);
--> statement-breakpoint
INSERT INTO `__new_api_keys`(`id`, `user_id`, `key_hash`, `label`, `created_at`, `last_used_at`, `revoked_at`) SELECT `id`, `user_id`, `key_hash`, `label`, `created_at`, `last_used_at`, `revoked_at` FROM `api_keys`;--> statement-breakpoint
DROP TABLE `api_keys`;--> statement-breakpoint
ALTER TABLE `__new_api_keys` RENAME TO `api_keys`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_linked_accounts` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`platform` text NOT NULL,
	`platform_user_id` text NOT NULL,
	`platform_username` text,
	`linked_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT `fk_linked_accounts_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`),
	CONSTRAINT `linked_accounts_platform_user_unique` UNIQUE(`platform`,`platform_user_id`)
);
--> statement-breakpoint
INSERT INTO `__new_linked_accounts`(`id`, `user_id`, `platform`, `platform_user_id`, `platform_username`, `linked_at`) SELECT `id`, `user_id`, `platform`, `platform_user_id`, `platform_username`, `linked_at` FROM `linked_accounts`;--> statement-breakpoint
DROP TABLE `linked_accounts`;--> statement-breakpoint
ALTER TABLE `__new_linked_accounts` RENAME TO `linked_accounts`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_users` (
	`id` text PRIMARY KEY,
	`email` text NOT NULL UNIQUE,
	`password_hash` text NOT NULL,
	`name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_users`(`id`, `email`, `password_hash`, `name`, `created_at`) SELECT `id`, `email`, `password_hash`, `name`, `created_at` FROM `users`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_messages` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`linked_account_id` text,
	`raw_text` text NOT NULL,
	`external_message_id` text,
	`parse_status` text NOT NULL,
	`received_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT `fk_messages_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`),
	CONSTRAINT `fk_messages_linked_account_id_linked_accounts_id_fk` FOREIGN KEY (`linked_account_id`) REFERENCES `linked_accounts`(`id`)
);
--> statement-breakpoint
INSERT INTO `__new_messages`(`id`, `user_id`, `linked_account_id`, `raw_text`, `external_message_id`, `parse_status`, `received_at`) SELECT `id`, `user_id`, `linked_account_id`, `raw_text`, `external_message_id`, `parse_status`, `received_at` FROM `messages`;--> statement-breakpoint
DROP TABLE `messages`;--> statement-breakpoint
ALTER TABLE `__new_messages` RENAME TO `messages`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_expenses` (
	`id` text PRIMARY KEY,
	`message_id` text,
	`user_id` text NOT NULL,
	`category_id` text,
	`item_name` text NOT NULL,
	`amount` numeric NOT NULL,
	`currency` text DEFAULT 'IDR' NOT NULL,
	`expense_date` text NOT NULL,
	`note` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT `fk_expenses_message_id_messages_id_fk` FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`),
	CONSTRAINT `fk_expenses_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`),
	CONSTRAINT `fk_expenses_category_id_categories_id_fk` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`)
);
--> statement-breakpoint
INSERT INTO `__new_expenses`(`id`, `message_id`, `user_id`, `category_id`, `item_name`, `amount`, `currency`, `expense_date`, `note`, `created_at`, `updated_at`) SELECT `id`, `message_id`, `user_id`, `category_id`, `item_name`, `amount`, `currency`, `expense_date`, `note`, `created_at`, `updated_at` FROM `expenses`;--> statement-breakpoint
DROP TABLE `expenses`;--> statement-breakpoint
ALTER TABLE `__new_expenses` RENAME TO `expenses`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `api_keys_key_hash_idx` ON `api_keys` (`key_hash`);--> statement-breakpoint
CREATE INDEX `messages_user_id_idx` ON `messages` (`user_id`);--> statement-breakpoint
CREATE INDEX `expenses_user_id_date_idx` ON `expenses` (`user_id`,`expense_date`);--> statement-breakpoint
CREATE INDEX `expenses_message_id_idx` ON `expenses` (`message_id`);