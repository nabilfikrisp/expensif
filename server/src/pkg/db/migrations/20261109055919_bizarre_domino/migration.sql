ALTER TABLE "messages" DROP CONSTRAINT "messages_user_id_users_id_fkey";--> statement-breakpoint
ALTER TABLE "expenses" DROP CONSTRAINT "expenses_user_id_users_id_fkey";--> statement-breakpoint
ALTER TABLE "linked_accounts" DROP CONSTRAINT "linked_accounts_user_id_users_id_fkey";--> statement-breakpoint
ALTER TABLE "api_keys" DROP CONSTRAINT "api_keys_user_id_users_id_fkey";