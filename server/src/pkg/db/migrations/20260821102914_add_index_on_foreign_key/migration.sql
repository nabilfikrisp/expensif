PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_messages` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`linked_account_id` text,
	`raw_text` text NOT NULL,
	`external_message_id` text UNIQUE,
	`parse_status` text NOT NULL,
	`received_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT `fk_messages_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_messages_linked_account_id_linked_accounts_id_fk` FOREIGN KEY (`linked_account_id`) REFERENCES `linked_accounts`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
INSERT INTO `__new_messages`(`id`, `user_id`, `linked_account_id`, `raw_text`, `external_message_id`, `parse_status`, `received_at`) SELECT `id`, `user_id`, `linked_account_id`, `raw_text`, `external_message_id`, `parse_status`, `received_at` FROM `messages`;--> statement-breakpoint
DROP TABLE `messages`;--> statement-breakpoint
ALTER TABLE `__new_messages` RENAME TO `messages`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `messages_user_id_idx` ON `messages` (`user_id`);--> statement-breakpoint
CREATE INDEX `messages_linked_account_id_idx` ON `messages` (`linked_account_id`);--> statement-breakpoint
CREATE INDEX `linked_accounts_user_id_idx` ON `linked_accounts` (`user_id`);--> statement-breakpoint
CREATE INDEX `expenses_category_id_idx` ON `expenses` (`category_id`);